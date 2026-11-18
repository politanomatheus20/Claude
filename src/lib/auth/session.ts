import { jwtVerify, SignJWT } from "jose";

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

function secret() {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 32) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("SESSION_SECRET ausente ou curto (mínimo 32 caracteres).");
    }
    return new TextEncoder().encode("dev-only-secret-change-me-dev-only-secret");
  }
  return new TextEncoder().encode(value);
}

export async function signSession(payload: SessionPayload) {
  return new SignJWT({ email: payload.email, name: payload.name })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(secret());
}

export async function verifySession(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"] });
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
