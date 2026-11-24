import "server-only";
import { readFile, unlink } from "node:fs/promises";
import path from "node:path";
import { del } from "@vercel/blob";
import { eq } from "drizzle-orm";
import { db } from "./db";
import { fileBlobs } from "./db/schema";

/**
 * Armazenamento de anexos: no próprio banco (tabela file_blobs), chave "db:<id>".
 * Funciona igual no computador e na Vercel, sem configurar nada além do banco.
 * Leitura/remoção continuam aceitando anexos antigos (pasta ./data/uploads ou URL do Vercel Blob).
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

const SAFE_FOLDER = /^[0-9a-f-]{36}\/(proposta|invoice)$/;

export async function saveFile(file: File, folder: string): Promise<string> {
  // A pasta vem de IDs; recusa qualquer coisa fora do formato esperado.
  if (!SAFE_FOLDER.test(folder)) throw new Error("Pasta de anexo inválida.");
  const id = crypto.randomUUID();
  await db.insert(fileBlobs).values({ id, data: Buffer.from(await file.arrayBuffer()) });
  return `db:${id}`;
}

export async function readStoredFile(storageKey: string): Promise<Buffer | Response> {
  if (storageKey.startsWith("db:")) {
    const row = await db.query.fileBlobs.findFirst({ where: eq(fileBlobs.id, storageKey.slice(3)) });
    if (!row) throw new Error("Arquivo não encontrado.");
    return Buffer.from(row.data);
  }
  if (/^https?:\/\//.test(storageKey)) {
    return fetch(storageKey);
  }
  const target = path.resolve(LOCAL_DIR, storageKey);
  if (!target.startsWith(LOCAL_DIR + path.sep)) throw new Error("Caminho inválido");
  return readFile(target);
}

/** Remove o arquivo do armazenamento (banco, pasta local ou Vercel Blob). Silencioso se já não existir. */
export async function deleteStoredFile(storageKey: string) {
  if (storageKey.startsWith("db:")) {
    await db.delete(fileBlobs).where(eq(fileBlobs.id, storageKey.slice(3)));
    return;
  }
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
