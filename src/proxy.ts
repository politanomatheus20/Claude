import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/auth/session";

/**
 * Redirecionamento otimista: sem sessão → /login; com sessão em /login → painel.
 * A verificação definitiva acontece no DAL (src/lib/auth/dal.ts).
 */
export async function proxy(request: NextRequest) {
  const session = await verifySession(request.cookies.get(SESSION_COOKIE)?.value);
  const isLogin = request.nextUrl.pathname.startsWith("/login");

  if (!session && !isLogin) {
    const url = new URL("/login", request.url);
    return NextResponse.redirect(url);
  }
  if (session && isLogin) {
    return NextResponse.redirect(new URL("/", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|brand/|media/|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|webp|mp4|ico)$).*)"],
};
