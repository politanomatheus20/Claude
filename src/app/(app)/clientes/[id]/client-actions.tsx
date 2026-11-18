"use client";

import { Check, Loader2, Paperclip, Pencil, Plus, RefreshCw, RotateCcw, Trash2 } from "lucide-react";
import { useActionState, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  addInvoice,
  attachProposalFile,
  deleteClient,
  deleteInvoice,
  setInvoiceStatus,
  updateClientInfo,
  updateProposal,
} from "@/app/actions";
import { useActionFeedback } from "@/components/use-action-feedback";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Field, Input, MoneyInput, Textarea } from "@/components/ui/field";
import { FileDrop } from "@/components/ui/file-drop";
import type { Client } from "@/lib/db/schema";
import { today } from "@/lib/format";
import type { ActionState } from "@/lib/validation";
import { ProposalFields } from "../proposal-fields";

function Submit({ pending, children }: { pending: boolean; children: React.ReactNode }) {
  return (
    <Button type="submit" variant="primary" disabled={pending}>
      {pending ? <Loader2 className="animate-spin" /> : null}
      {children}
    </Button>
  );
}

function Footer({ pending, label }: { pending: boolean; label: string }) {
  return (
    <div className="mt-6 flex justify-end gap-2 border-t border-white/[0.06] pt-5">
      <DialogClose asChild>
        <Button type="button" variant="ghost">
          Cancelar
        </Button>
      </DialogClose>
      <Submit pending={pending}>{label}</Submit>
    </div>
  );
}

/** Atualização da proposta: gera nova versão e recalcula meta, receita e resultado. */
export function UpdateProposalDialog({ client }: { client: Client }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<ActionState, FormData>(updateProposal.bind(null, client.id), {});
  useActionFeedback(state, () => setOpen(false));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="primary">
          <RefreshCw />
          Atualizar proposta
        </Button>
      </DialogTrigger>
      <DialogContent
        title="Atualizar proposta"
        description={`Cria a versão ${client.currentVersion + 1}. A meta, a receita e o resultado são recalculados na hora.`}
        className="max-w-3xl"
      >
        <form action={action} className="grid gap-6" noValidate>
          <ProposalFields
            key={open ? "open" : "closed"}
            defaults={client}
            values={state.ok ? undefined : state.values}
            errors={state.ok ? undefined : state.errors}
          />
          <Field label="Motivo da atualização" htmlFor="reason" error={state.ok ? undefined : state.errors?.reason}>
            <Input id="reason" name="reason" placeholder="Ex.: upgrade de 20 para 35 licenças" defaultValue={state.ok ? "" : state.values?.reason} />
          </Field>
          <FileDrop name="proposalFile" label="Anexar nova proposta (opcional)" error={state.ok ? undefined : state.errors?.proposalFile} />
          <Footer pending={pending} label="Salvar nova versão" />
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function EditClientDialog({ client }: { client: Client }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<ActionState, FormData>(updateClientInfo.bind(null, client.id), {});
  useActionFeedback(state, () => setOpen(false));
  const v = state.ok ? undefined : state.values;
  const e = state.ok ? undefined : state.errors;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary">
          <Pencil />
          Editar dados
        </Button>
      </DialogTrigger>
      <DialogContent title="Dados do cliente" description="Valores da proposta são alterados em “Atualizar proposta”.">
        <form action={action} className="grid gap-4 sm:grid-cols-2" noValidate>
          <Field label="Nome" htmlFor="e-name" error={e?.name} className="sm:col-span-2">
            <Input id="e-name" name="name" defaultValue={v?.name ?? client.name} />
          </Field>
          <Field label="CNPJ" htmlFor="e-doc" error={e?.document}>
            <Input id="e-doc" name="document" defaultValue={v?.document ?? client.document ?? ""} />
          </Field>
          <Field label="Data de fechamento" htmlFor="e-closed" error={e?.closedAt}>
            <Input id="e-closed" type="date" name="closedAt" defaultValue={v?.closedAt ?? client.closedAt} />
          </Field>
          <Field label="Contato" htmlFor="e-contact" error={e?.contactName}>
            <Input id="e-contact" name="contactName" defaultValue={v?.contactName ?? client.contactName ?? ""} />
          </Field>
          <Field label="E-mail do contato" htmlFor="e-email" error={e?.contactEmail}>
            <Input id="e-email" type="email" name="contactEmail" defaultValue={v?.contactEmail ?? client.contactEmail ?? ""} />
          </Field>
          <Field label="Observações" htmlFor="e-notes" className="sm:col-span-2">
            <Textarea id="e-notes" name="notes" defaultValue={v?.notes ?? client.notes ?? ""} />
          </Field>
          <div className="sm:col-span-2">
            <Footer pending={pending} label="Salvar" />
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function AddInvoiceDialog({ clientId }: { clientId: string }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<ActionState, FormData>(addInvoice.bind(null, clientId), {});
  useActionFeedback(state, () => setOpen(false));
  const v = state.ok ? undefined : state.values;
  const e = state.ok ? undefined : state.errors;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="secondary">
          <Plus />
          Invoice
        </Button>
      </DialogTrigger>
      <DialogContent title="Registrar invoice" description="O valor entra no custo do cliente e atualiza o resultado.">
        <form action={action} className="grid gap-4 sm:grid-cols-2" noValidate>
          <Field label="Número" htmlFor="i-number" error={e?.number}>
            <Input id="i-number" name="number" defaultValue={v?.number} placeholder="INV-0001" aria-invalid={Boolean(e?.number)} />
          </Field>
          <Field label="Valor" htmlFor="i-amount" error={e?.amount}>
            <MoneyInput id="i-amount" name="amount" defaultValue={v?.amount} placeholder="0,00" aria-invalid={Boolean(e?.amount)} />
          </Field>
          <Field label="Emissão" htmlFor="i-issue" error={e?.issueDate}>
            <Input id="i-issue" type="date" name="issueDate" defaultValue={v?.issueDate ?? today()} />
          </Field>
          <Field label="Vencimento" htmlFor="i-due" hint="Opcional" error={e?.dueDate}>
            <Input id="i-due" type="date" name="dueDate" defaultValue={v?.dueDate} />
          </Field>
          <Field label="Status" htmlFor="i-status" className="sm:col-span-2">
            <div className="inline-flex gap-2">
              {(["pendente", "paga"] as const).map((s) => (
                <label
                  key={s}
                  className="flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-white/10 px-3 text-sm capitalize has-[:checked]:border-jelly-teal/50 has-[:checked]:bg-jelly-teal/[0.08]"
                >
                  <input type="radio" name="status" value={s} defaultChecked={(v?.status ?? "pendente") === s} className="accent-[#35e8c8]" />
                  {s}
                </label>
              ))}
            </div>
          </Field>
          <Field label="Descrição" htmlFor="i-desc" hint="Opcional" className="sm:col-span-2">
            <Input id="i-desc" name="description" defaultValue={v?.description} placeholder="Ex.: licenças Claude Team — novembro" />
          </Field>
          <div className="sm:col-span-2">
            <FileDrop name="invoiceFile" label="Anexar invoice (opcional)" error={e?.invoiceFile} />
          </div>
          <div className="sm:col-span-2">
            <Footer pending={pending} label="Registrar invoice" />
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function AddAttachmentDialog({ clientId }: { clientId: string }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<ActionState, FormData>(attachProposalFile.bind(null, clientId), {});
  useActionFeedback(state, () => setOpen(false));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="secondary">
          <Paperclip />
          Anexar
        </Button>
      </DialogTrigger>
      <DialogContent title="Anexar proposta" description="Para mudar valores, use “Atualizar proposta”.">
        <form action={action} noValidate>
          <FileDrop name="proposalFile" label="Arquivo" error={state.ok ? undefined : state.errors?.proposalFile} />
          <Footer pending={pending} label="Anexar" />
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function InvoiceActions({ invoiceId, clientId, status }: { invoiceId: string; clientId: string; status: "pendente" | "paga" }) {
  const [pending, start] = useTransition();
  const next = status === "paga" ? "pendente" : "paga";

  return (
    <>
      <button
        type="button"
        disabled={pending}
        onClick={() => start(async () => {
          await setInvoiceStatus(invoiceId, clientId, next);
          toast.success(next === "paga" ? "Invoice marcada como paga." : "Invoice voltou para pendente.");
        })}
        className="flex size-8 items-center justify-center rounded-md text-mist/50 hover:bg-white/5 hover:text-mist disabled:opacity-40"
        title={next === "paga" ? "Marcar como paga" : "Marcar como pendente"}
      >
        {pending ? <Loader2 className="size-4 animate-spin" /> : next === "paga" ? <Check className="size-4" /> : <RotateCcw className="size-4" />}
      </button>
      <ConfirmDelete
        title="Excluir invoice?"
        description="O custo e o resultado do cliente serão recalculados."
        onConfirm={() => deleteInvoice(invoiceId, clientId)}
        trigger={
          <button type="button" className="flex size-8 items-center justify-center rounded-md text-mist/40 hover:bg-danger/10 hover:text-danger" title="Excluir invoice">
            <Trash2 className="size-4" />
          </button>
        }
      />
    </>
  );
}

export function DeleteClientButton({ clientId, name }: { clientId: string; name: string }) {
  return (
    <ConfirmDelete
      title={`Excluir ${name}?`}
      description="Remove o cliente, o histórico de propostas, as invoices e os anexos. A meta do mês será recalculada. Não dá para desfazer."
      onConfirm={() => deleteClient(clientId)}
      trigger={
        <button type="button" className="inline-flex items-center gap-1.5 text-xs text-mist/40 transition hover:text-danger">
          <Trash2 className="size-3.5" />
          Excluir cliente
        </button>
      }
    />
  );
}

function ConfirmDelete({
  title,
  description,
  trigger,
  onConfirm,
}: {
  title: string;
  description: string;
  trigger: React.ReactNode;
  onConfirm: () => Promise<unknown>;
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent title={title} description={description} className="max-w-md">
        <div className="flex justify-end gap-2">
          <DialogClose asChild>
            <Button variant="ghost">Cancelar</Button>
          </DialogClose>
          <Button
            variant="danger"
            disabled={pending}
            onClick={() =>
              start(async () => {
                await onConfirm();
                setOpen(false);
              })
            }
          >
            {pending ? <Loader2 className="animate-spin" /> : <Trash2 />}
            Excluir
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
