"use client";

import { Dialog as D } from "radix-ui";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export const Dialog = D.Root;
export const DialogTrigger = D.Trigger;
export const DialogClose = D.Close;

export function DialogContent({
  title,
  description,
  className,
  children,
}: {
  title: string;
  description?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <D.Portal>
      <D.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm data-[state=open]:animate-[fade-in_150ms_ease-out]" />
      <D.Content
        className={cn(
          "fixed top-1/2 left-1/2 z-50 flex max-h-[min(92svh,56rem)] w-[calc(100vw-2rem)] max-w-xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-white/10 bg-abyss shadow-[0_40px_120px_-20px_rgb(0_0_0/0.8)] outline-none data-[state=open]:animate-[dialog-in_220ms_cubic-bezier(0.22,1,0.36,1)]",
          className,
        )}
      >
        <header className="flex items-start justify-between gap-4 border-b border-white/[0.06] px-6 py-5">
          <div>
            <D.Title className="text-base font-semibold tracking-tight">{title}</D.Title>
            {description ? <D.Description className="mt-1 text-[13px] text-mist/50">{description}</D.Description> : <D.Description className="sr-only">{title}</D.Description>}
          </div>
          <D.Close className="-mt-1 -mr-2 flex size-8 items-center justify-center rounded-md text-mist/50 hover:bg-white/5 hover:text-mist" aria-label="Fechar">
            <X className="size-4" />
          </D.Close>
        </header>
        <div className="overflow-y-auto px-6 py-5">{children}</div>
      </D.Content>
      <style>{`@keyframes fade-in{from{opacity:0}}@keyframes dialog-in{from{opacity:0;transform:translate(-50%,-48%) scale(.98)}}`}</style>
    </D.Portal>
  );
}
