"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { nameFromEmail } from "@/lib/format";
import { describeServerError, missingConfig, missingConfigMessage } from "@/lib/server-errors";
import {
  ALLOWED_DOMAIN,
  isAllowedEmail,
  normalizeEmail,
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  signSession,
} from "@/lib/auth/session";

export interface LoginState {
  error?: string;
  email?: string;
}

export async function login(_: LoginState, formData: FormData): Promise<LoginState> {
  const email = normalizeEmail(String(formData.get("email") ?? ""));

  if (!email) return { error: "Informe seu e-mail corporativo.", email };
  if (!isAllowedEmail(email)) {
    return { error: `Acesso restrito a e-mails @${ALLOWED_DOMAIN}.`, email };
  }

  // Falta configuração no servidor (ex.: variáveis na Vercel) → mensagem clara em vez de erro genérico.
  const missing = missingConfig();
  if (missing.length > 0) return { error: missingConfigMessage(missing), email };

  try {
    const now = new Date().toISOString();
    const [user] = await db
      .insert(users)
      .values({ email, name: nameFromEmail(email), lastLoginAt: now })
      .onConflictDoUpdate({ target: users.email, set: { lastLoginAt: now } })
      .returning();

    const token = await signSession({ sub: user.id, email: user.email, name: user.name });
    (await cookies()).set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: Boolean(process.env.VERCEL),
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_MAX_AGE,
    });
  } catch (err) {
    console.error("[login] falhou:", err);
    return { error: describeServerError(err), email };
  }

  redirect("/");
}

export async function logout() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}
