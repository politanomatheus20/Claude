import "server-only";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { put } from "@vercel/blob";

/**
 * Armazenamento de anexos.
 * - Com BLOB_READ_WRITE_TOKEN (produção/Vercel): Vercel Blob (acesso privado via rota autenticada).
 * - Sem token (local): pasta ./data/uploads.
 */

const LOCAL_DIR = path.join(process.cwd(), "data", "uploads");

export const MAX_FILE_BYTES = 10 * 1024 * 1024;
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

export async function saveFile(file: File, folder: string): Promise<string> {
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

export function validateUpload(file: File | null | undefined): string | null {
  if (!file || file.size === 0) return null;
  if (file.size > MAX_FILE_BYTES) return "Arquivo maior que 10 MB.";
  if (!ALLOWED_MIME.has(file.type)) return "Formato não suportado. Envie PDF, imagem ou documento Office.";
  return null;
}
