import "server-only";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { del, put } from "@vercel/blob";

/**
 * Armazenamento de anexos.
 * - Com BLOB_READ_WRITE_TOKEN (produção/Vercel): Vercel Blob (acesso privado via rota autenticada).
 * - Sem token (local): pasta ./data/uploads.
 */

const LOCAL_DIR = path.join(process.cwd(), "data", "uploads");

/** 4 MB: abaixo do limite de corpo da Vercel (4,5 MB), para o erro ser amigável. */
export const MAX_FILE_BYTES = 4 * 1024 * 1024;
export const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/msword",
  "application/vnd.ms-excel",
]);

const blobEnabled = () => Boolean(process.env.BLOB_READ_WRITE_TOKEN);

function safeName(name: string) {
  return name.normalize("NFKD").replace(/[^\w.-]+/g, "_").slice(-120);
}

const SAFE_FOLDER = /^[0-9a-f-]{36}\/(proposta|invoice)$/;

export async function saveFile(file: File, folder: string): Promise<string> {
  // A pasta vem de IDs; impede "../" e afins de escapar de data/uploads.
  if (!SAFE_FOLDER.test(folder)) throw new Error("Pasta de anexo inválida.");
  const key = `${folder}/${crypto.randomUUID()}-${safeName(file.name)}`;
  if (blobEnabled()) {
    const blob = await put(key, file, { access: "public", addRandomSuffix: false, contentType: file.type });
    return blob.url;
  }
  const target = path.join(LOCAL_DIR, key);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, Buffer.from(await file.arrayBuffer()));
  return key;
}

export async function readStoredFile(storageKey: string): Promise<Buffer | Response> {
  if (/^https?:\/\//.test(storageKey)) {
    return fetch(storageKey);
  }
  const target = path.resolve(LOCAL_DIR, storageKey);
  if (!target.startsWith(LOCAL_DIR + path.sep)) throw new Error("Caminho inválido");
  return readFile(target);
}

/** Remove o arquivo do armazenamento (local ou Vercel Blob). Silencioso se já não existir. */
export async function deleteStoredFile(storageKey: string) {
  if (/^https?:\/\//.test(storageKey)) {
    await del(storageKey);
    return;
  }
  const target = path.resolve(LOCAL_DIR, storageKey);
  if (!target.startsWith(LOCAL_DIR + path.sep)) return;
  await unlink(target).catch(() => {});
}

export function validateUpload(file: File | null | undefined): string | null {
  if (!file || file.size === 0) return null;
  if (file.size > MAX_FILE_BYTES) return "Arquivo maior que 4 MB.";
  if (!ALLOWED_MIME.has(file.type)) return "Formato não suportado. Envie PDF, imagem ou documento Office.";
  return null;
}
