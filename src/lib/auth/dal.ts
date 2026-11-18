import "server-only";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db } from "../db";
import { users } from "../db/schema";
import { SESSION_COOKIE, verifySession } from "./session";

/**
 * Data Access Layer de autenticação. Toda página, action e route handler
 * deve passar por aqui — o proxy só faz o redirecionamento otimista.
 */
export const getSession = cache(async () => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return verifySession(token);
});

export const requireUser = cache(async () => {
  const session = await getSession();
  if (!session) redirect("/login");

  // A sessão é assinada; se o registro sumiu (ex.: banco recriado), ele é restaurado
  // em vez de gerar um loop de redirecionamento entre proxy e página.
  const exists = await db.query.users.findFirst({ where: eq(users.id, session.sub), columns: { id: true } });
  if (!exists) {
    await db
      .insert(users)
      .values({ id: session.sub, email: session.email, name: session.name })
      .onConflictDoNothing();
  }

  return { id: session.sub, email: session.email, name: session.name };
});

export type CurrentUser = Awaited<ReturnType<typeof requireUser>>;
