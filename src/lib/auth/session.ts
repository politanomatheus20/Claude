import { jwtVerify, SignJWT } from "jose";
import { databaseTokenFromEnv } from "../env";

/**
 * Sessão em cookie httpOnly assinado (JWT HS256).
 * Compatível com o runtime do proxy (sem dependências de Node).
 */

export const SESSION_COOKIE = "dg_session";
/** Após o primeiro acesso o usuário fica logado por 1 ano (renovado a cada login). */
export const SESSION_MAX_AGE = 60 * 60 * 24 * 365;

export const ALLOWED_DOMAIN = "datagroup.global";

export interface SessionPayload {
  sub: string; // user id
  email: string;
  name: string;
}

/**
 * Chave de assinatura da sessão:
 * 1. SESSION_SECRET, se cadastrado (mínimo 32 caracteres);
 * 2. senão, derivada (HKDF-SHA256) do token do banco Turso — um segredo que só o
 *    servidor conhece. Assim, na Vercel basta conectar o Turso: nada a cadastrar;
 * 3. no computador (desenvolvimento), uma chave fixa de desenvolvimento.
 */
let keyPromise: Promise<Uint8Array> | null = null;

async function deriveKey(material: string) {
  const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(material), "HKDF", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt: new TextEncoder().encode("datagroup-metas"), info: new TextEncoder().encode("session-v1") },
    base,
    256,
  );
  return new Uint8Array(bits);
}

export function sessionKeySource(): "secret" | "database" | "dev" | null {
  if ((process.env.SESSION_SECRET?.length ?? 0) >= 32) return "secret";
  if (databaseTokenFromEnv()) return "database";
  if (process.env.NODE_ENV !== "production" || !process.env.VERCEL) return "dev";
  return null;
}

function secret(): Promise<Uint8Array> {
  if (!keyPromise) {
    const source = sessionKeySource();
    if (source === "secret") keyPromise = Promise.resolve(new TextEncoder().encode(process.env.SESSION_SECRET!));
    else if (source === "database") keyPromise = deriveKey(databaseTokenFromEnv()!);
    else if (source === "dev" && process.env.SESSION_SECRET) keyPromise = Promise.resolve(new TextEncoder().encode(process.env.SESSION_SECRET));
    else if (source === "dev") keyPromise = Promise.resolve(new TextEncoder().encode("dev-only-secret-change-me-dev-only-secret"));
    else return Promise.reject(new Error("SESSION_SECRET ausente e banco Turso não conectado."));
  }
  return keyPromise;
}

export async function signSession(payload: SessionPayload) {
  return new SignJWT({ email: payload.email, name: payload.name })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(await secret());
}

export async function verifySession(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, await secret(), { algorithms: ["HS256"] });
    if (!payload.sub || typeof payload.email !== "string") return null;
    if (!isAllowedEmail(payload.email)) return null;
    return { sub: payload.sub, email: payload.email, name: String(payload.name ?? "") };
  } catch {
    return null;
  }
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function isAllowedEmail(email: string) {
  const e = normalizeEmail(email);
  return /^[^\s@]+@[^\s@]+$/.test(e) && e.endsWith(`@${ALLOWED_DOMAIN}`);
}
