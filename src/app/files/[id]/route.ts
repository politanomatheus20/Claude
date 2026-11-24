import { getSession } from "@/lib/auth/dal";
import { getFile } from "@/lib/data";
import { readStoredFile } from "@/lib/storage";

/** Download autenticado de anexos (propostas e invoices). */
export async function GET(request: Request, ctx: RouteContext<"/files/[id]">) {
  if (!(await getSession())) return new Response("Não autorizado", { status: 401 });

  const { id } = await ctx.params;
  const file = await getFile(id);
  if (!file) return new Response("Arquivo não encontrado", { status: 404 });

  let body: BodyInit | null;
  try {
    const content = await readStoredFile(file.storageKey);
    if (content instanceof Response && !content.ok) throw new Error(`HTTP ${content.status}`);
    body = content instanceof Response ? content.body : new Uint8Array(content);
  } catch {
    return new Response("Arquivo não encontrado", { status: 404 });
  }
  const download = new URL(request.url).searchParams.has("download");

  return new Response(body, {
    headers: {
      "Content-Type": file.mimeType,
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(file.name)}`,
      "Cache-Control": "private, max-age=0, must-revalidate",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
