"use client";

import { Check, HandCoins, Loader2, Paperclip, Pencil, Plus, RotateCcw, Trash2 } from "lucide-react";
import { useActionState, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  addContract,
  addInvoice,
  addReceipt,
  attachProposalFile,
  deleteClient,
  deleteContract,
  deleteInvoice,
  setInvoiceStatus,
  updateClientInfo,
  updateContract,
} from "@/app/actions";
import { useActionFeedback } from "@/components/use-action-feedback";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Field, Input, MoneyInput, Select, Textarea } from "@/components/ui/field";
import { FileDrop } from "@/components/ui/file-drop";
import type { Client, Contract, ContractKind } from "@/lib/db/schema";
import { money, today } from "@/lib/format";
import type { ActionState } from "@/lib/validation";
import { ClientFields } from "../client-fields";
import { ContractFields } from "../contract-fields";

function Footer({ pending, label }: { pending: boolean; label: string }) {
  return (
    <div className="mt-6 flex justify-end gap-2 border-t border-white/[0.06] pt-5">
      <DialogClose asChild>
        <Button type="button" variant="ghost">
          Cancelar
        </Button>
      </DialogClose>
      <Button type="submit" variant="primary" disabled={pending}>
        {pending ? <Loader2 className="animate-spin" /> : null}
        {label}
      </Button>
    </div>
  );
}

type OpenProps = { open: boolean; setOpen: (open: boolean) => void };

/**
 * Ao fechar um diálogo, recria o formulário: reabrir mostra os dados atuais,
 * sem os valores e erros de uma tentativa anterior que foi cancelada.
 */
function withFreshState<P extends object>(Inner: React.ComponentType<P & OpenProps>) {
  return function FreshDialog(props: P) {
    const [open, setOpenRaw] = useState(false);
    const [generation, setGeneration] = useState(0);
    const setOpen = (o: boolean) => {
      setOpenRaw(o);
      if (!o) setGeneration((g) => g + 1);
    };
    return <Inner key={generation} {...props} open={open} setOpen={setOpen} />;
  };
}

/** Estado do form só é reaproveitado quando a última tentativa falhou. */
const failed = (s: ActionState) => (s.ok ? undefined : s);

function EditClientDialogInner({ client, open, setOpen }: { client: Client } & OpenProps) {
  const [state, action, pending] = useActionState<ActionState, FormData>(updateClientInfo.bind(null, client.id), {});
  useActionFeedback(state, () => setOpen(false));
  const f = failed(state);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary">
          <Pencil />
          Editar cliente
        </Button>
      </DialogTrigger>
      <DialogContent title="Dados do cliente" className="max-w-2xl">
        <form action={action} noValidate>
          <ClientFields defaults={client} values={f?.values} errors={f?.errors} />
          <Field label="Observações" htmlFor="e-notes" className="mt-4">
            <Textarea id="e-notes" name="notes" defaultValue={f?.values?.notes ?? client.notes ?? ""} />
          </Field>
          <Footer pending={pending} label="Salvar" />
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Novo contrato: "atualizacao" = linha da seção ATUALIZAÇÃO da planilha. */
function AddContractDialogInner({ clientId, kind, variant, open, setOpen }: { clientId: string; kind: ContractKind; variant?: "link" } & OpenProps) {
  const [state, action, pending] = useActionState<ActionState, FormData>(addContract.bind(null, clientId, kind), {});
  useActionFeedback(state, () => setOpen(false));
  const f = failed(state);
  const isUpdate = kind === "atualizacao";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {variant === "link" ? (
          <button type="button" className="inline-flex items-center gap-1.5 text-xs text-mist/50 transition hover:text-jelly-teal">
            <Plus className="size-3.5" />
            Outro contrato
          </button>
        ) : (
          <Button variant="primary">
            <Plus />
            {isUpdate ? "Registrar atualização" : "Novo contrato"}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent
        title={isUpdate ? "Registrar atualização" : "Novo contrato"}
        description={
          isUpdate
            ? "Como na seção ATUALIZAÇÃO da planilha: licenças adicionais com cálculo próprio. Conta na meta pela data de início."
            : "Um contrato separado para o mesmo cliente."
        }
        className="max-w-5xl"
      >
        <form action={action} className="grid gap-6" noValidate>
          <ContractFields
            key={open ? "o" : "c"}
            values={f?.values}
            errors={f?.errors}
            defaults={{ startAt: today(), signedAt: isUpdate ? undefined : today(), billingStatus: "pendente", licenseStatus: "pendente" }}
          />
          <FileDrop name="proposalFile" label="Anexar proposta (opcional)" error={f?.errors?.proposalFile} />
          <Footer pending={pending} label={isUpdate ? "Registrar atualização" : "Registrar contrato"} />
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Editar contrato = atualizar proposta: nova versão no histórico + recálculo. */
function EditContractDialogInner({ contract, open, setOpen }: { contract: Contract } & OpenProps) {
  const [state, action, pending] = useActionState<ActionState, FormData>(updateContract.bind(null, contract.id), {});
  useActionFeedback(state, () => setOpen(false));
  const f = failed(state);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="secondary">
          <Pencil />
          Atualizar
        </Button>
      </DialogTrigger>
      <DialogContent title="Atualizar contrato" description={`Cria a versão ${contract.version + 1}. Todos os cálculos são refeitos na hora.`} className="max-w-5xl">
        <form action={action} className="grid gap-6" noValidate>
          <ContractFields key={open ? "o" : "c"} defaults={contract} values={f?.values} errors={f?.errors} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Motivo da atualização" htmlFor="reason" error={f?.errors?.reason}>
              <Input id="reason" name="reason" placeholder="Ex.: upgrade de 20 para 35 licenças" defaultValue={f?.values?.reason} aria-invalid={Boolean(f?.errors?.reason)} />
            </Field>
            <FileDrop name="proposalFile" label="Anexar nova proposta (opcional)" error={f?.errors?.proposalFile} />
          </div>
          <Footer pending={pending} label="Salvar nova versão" />
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ReceiptDialogInner({ contractId, balance, open, setOpen }: { contractId: string; balance: number } & OpenProps) {
  const [state, action, pending] = useActionState<ActionState, FormData>(addReceipt.bind(null, contractId), {});
  useActionFeedback(state, () => setOpen(false));
  const f = failed(state);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost">
          <HandCoins />
          Recebimento
        </Button>
      </DialogTrigger>
      <DialogContent title="Registrar recebimento" description={`Saldo a receber: ${money(balance)}`} className="max-w-md">
        <form action={action} noValidate>
          <Field label="Valor recebido" htmlFor="rc-amount" error={f?.errors?.amount}>
            <MoneyInput id="rc-amount" name="amount" autoFocus placeholder="0,00" defaultValue={f?.values?.amount} aria-invalid={Boolean(f?.errors?.amount)} />
          </Field>
          <Footer pending={pending} label="Registrar" />
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AddInvoiceDialogInner({ clientId, contracts, open, setOpen }: { clientId: string; contracts: { id: string; label: string }[] } & OpenProps) {
  const [state, action, pending] = useActionState<ActionState, FormData>(addInvoice.bind(null, clientId), {});
  useActionFeedback(state, () => setOpen(false));
  const v = failed(state)?.values;
  const e = failed(state)?.errors;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="secondary">
          <Plus />
          Invoice
        </Button>
      </DialogTrigger>
      <DialogContent title="Registrar invoice" description="Para conferir o custo previsto da licença (coluna R).">
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
          {contracts.length > 1 ? (
            <Field label="Contrato" htmlFor="i-contract" className="sm:col-span-2">
              <Select id="i-contract" name="contractId" defaultValue={v?.contractId ?? ""}>
                <option value="">Sem vínculo</option>
                {contracts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </Select>
            </Field>
          ) : contracts[0] ? (
            <input type="hidden" name="contractId" value={contracts[0].id} />
          ) : null}
          <Field label="Status" htmlFor="i-status" className="sm:col-span-2">
            <div className="inline-flex gap-2">
              {(["pendente", "paga"] as const).map((s) => (
                <label key={s} className="flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-white/10 px-3 text-sm capitalize has-[:checked]:border-jelly-teal/50 has-[:checked]:bg-jelly-teal/[0.08]">
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

function AddAttachmentDialogInner({ clientId, open, setOpen }: { clientId: string } & OpenProps) {
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
      <DialogContent title="Anexar arquivo" description="Para mudar valores, use “Atualizar” no contrato.">
        <form action={action} noValidate>
          <FileDrop name="proposalFile" label="Arquivo" error={failed(state)?.errors?.proposalFile} />
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
        onClick={() =>
          start(async () => {
            await setInvoiceStatus(invoiceId, clientId, next);
            toast.success(next === "paga" ? "Invoice marcada como paga." : "Invoice voltou para pendente.");
          })
        }
        className="flex size-8 items-center justify-center rounded-md text-mist/50 hover:bg-white/5 hover:text-mist disabled:opacity-40"
        title={next === "paga" ? "Marcar como paga" : "Marcar como pendente"}
      >
        {pending ? <Loader2 className="size-4 animate-spin" /> : next === "paga" ? <Check className="size-4" /> : <RotateCcw className="size-4" />}
      </button>
      <ConfirmDelete
        title="Excluir invoice?"
        description="A invoice e o vínculo com o anexo serão removidos."
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

export function DeleteContractButton({ contractId }: { contractId: string }) {
  return (
    <ConfirmDelete
      title="Excluir contrato?"
      description="Remove o contrato e o histórico de versões. Totais, resultado e meta serão recalculados."
      onConfirm={async () => {
        await deleteContract(contractId);
        toast.success("Contrato excluído.");
      }}
      trigger={
        <button type="button" className="flex size-8 items-center justify-center rounded-md text-mist/40 hover:bg-danger/10 hover:text-danger" title="Excluir contrato">
          <Trash2 className="size-4" />
        </button>
      }
    />
  );
}

export function DeleteClientButton({ clientId, name }: { clientId: string; name: string }) {
  return (
    <ConfirmDelete
      title={`Excluir ${name}?`}
      description="Remove o cliente, todos os contratos, invoices e anexos. A meta será recalculada. Não dá para desfazer."
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

function ConfirmDelete({ title, description, trigger, onConfirm }: { title: string; description: string; trigger: React.ReactNode; onConfirm: () => Promise<unknown> }) {
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

export const EditClientDialog = withFreshState(EditClientDialogInner);
export const AddContractDialog = withFreshState(AddContractDialogInner);
export const EditContractDialog = withFreshState(EditContractDialogInner);
export const ReceiptDialog = withFreshState(ReceiptDialogInner);
export const AddAttachmentDialog = withFreshState(AddAttachmentDialogInner);
export const AddInvoiceDialog = withFreshState(AddInvoiceDialogInner);
