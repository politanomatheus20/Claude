"use client";

import { FileText, Upload, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { fileSize } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Campo de anexo com arrastar-e-soltar. Mantém o <input type=file> nativo para o FormData. */
export function FileDrop({ name, label, error }: { name: string; label: string; error?: string[] }) {
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [over, setOver] = useState(false);

  const pick = (f: File | null) => {
    setFile(f);
    if (input.current && f) {
      const dt = new DataTransfer();
      dt.items.add(f);
      input.current.files = dt.files;
    }
  };

  const clear = () => {
    setFile(null);
    if (input.current) input.current.value = "";
  };

  // O React reseta o <form> após cada action: mantém o estado visual em sincronia.
  useEffect(() => {
    const form = input.current?.form;
    if (!form) return;
    const onReset = () => setFile(null);
    form.addEventListener("reset", onReset);
    return () => form.removeEventListener("reset", onReset);
  }, []);

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[13px] font-medium text-mist/80">{label}</span>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          pick(e.dataTransfer.files[0] ?? null);
        }}
        className={cn(
          "relative flex min-h-16 items-center gap-3 rounded-lg border border-dashed px-4 py-3 transition",
          over ? "border-jelly-teal/60 bg-jelly-teal/[0.05]" : "border-white/15 bg-abyss-deep/40 hover:border-white/25",
          error && "border-danger/50",
        )}
      >
        <input
          ref={input}
          type="file"
          name={name}
          accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.xls,.xlsx,.pptx"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className={cn("absolute inset-0 cursor-pointer opacity-0", file && "pointer-events-none")}
          aria-label={label}
        />
        {file ? (
          <>
            <FileText className="size-5 shrink-0 text-jelly-teal" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm">{file.name}</span>
              <span className="text-xs text-mist/40">{fileSize(file.size)}</span>
            </span>
            <button
              type="button"
              onClick={clear}
              className="relative z-10 flex size-7 items-center justify-center rounded-md text-mist/50 hover:bg-white/5 hover:text-mist"
              aria-label="Remover arquivo"
            >
              <X className="size-4" />
            </button>
          </>
        ) : (
          <>
            <Upload className="size-5 shrink-0 text-mist/40" />
            <span className="text-sm text-mist/55">
              Arraste o arquivo ou <span className="text-jelly-teal">clique para escolher</span>
              <span className="block text-xs text-mist/35">PDF, imagem ou Office · até 4 MB</span>
            </span>
          </>
        )}
      </div>
      {error?.[0] ? <p className="text-xs text-danger">{error[0]}</p> : null}
    </div>
  );
}
