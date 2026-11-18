"use client";

import Link from "next/link";
import { Loader2 } from "lucide-react";
import { useActionState } from "react";
import { createClient } from "@/app/actions";
import { useActionFeedback } from "@/components/use-action-feedback";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/field";
import { FileDrop } from "@/components/ui/file-drop";
import { today } from "@/lib/format";
import type { ActionState } from "@/lib/validation";
import { ProposalFields } from "../proposal-fields";

export function NewClientForm() {
  const [state, action, pending] = useActionState<ActionState, FormData>(createClient, {});
  useActionFeedback(state);
  const v = state.values;
  const e = state.errors;

  return (
    <form action={action} className="grid grid-cols-1 gap-4" noValidate>
      <Card className="animate-fade-up">
        <CardHeader title="Cliente" />
        <div className="grid gap-5 px-5 py-5 sm:grid-cols-2">
          <Field label="Nome do cliente" htmlFor="name" error={e?.name} className="sm:col-span-2">
            <Input id="name" name="name" defaultValue={v?.name} autoFocus placeholder="Razão social ou nome fantasia" aria-invalid={Boolean(e?.name)} />
          </Field>
          <Field label="CNPJ" htmlFor="document" hint="Opcional" error={e?.document}>
            <Input id="document" name="document" defaultValue={v?.document} placeholder="00.000.000/0000-00" />
          </Field>
          <Field label="Data de fechamento" htmlFor="closedAt" hint="Define o mês em que entra na meta" error={e?.closedAt}>
            <Input id="closedAt" name="closedAt" type="date" defaultValue={v?.closedAt ?? today()} aria-invalid={Boolean(e?.closedAt)} />
          </Field>
          <Field label="Contato" htmlFor="contactName" hint="Opcional" error={e?.contactName}>
            <Input id="contactName" name="contactName" defaultValue={v?.contactName} placeholder="Nome do responsável" />
          </Field>
          <Field label="E-mail do contato" htmlFor="contactEmail" hint="Opcional" error={e?.contactEmail}>
            <Input id="contactEmail" name="contactEmail" type="email" defaultValue={v?.contactEmail} placeholder="nome@cliente.com.br" aria-invalid={Boolean(e?.contactEmail)} />
          </Field>
        </div>
      </Card>

      <Card className="animate-fade-up [animation-delay:60ms]">
        <CardHeader title="Proposta" description="Valores fechados com o cliente" />
        <div className="grid gap-6 px-5 py-5">
          <ProposalFields values={v} errors={e} />
          <FileDrop name="proposalFile" label="Anexar proposta" error={e?.proposalFile} />
          <Field label="Observações" htmlFor="notes" hint="Opcional" error={e?.notes}>
            <Textarea id="notes" name="notes" defaultValue={v?.notes} placeholder="Condições especiais, prazos, detalhes da negociação…" />
          </Field>
        </div>
      </Card>

      <div className="sticky bottom-0 z-10 -mx-5 flex justify-end gap-2 border-t border-white/[0.06] bg-abyss-deep/85 px-5 py-4 backdrop-blur-xl sm:mx-0 sm:rounded-xl sm:border">
        <Button asChild variant="ghost">
          <Link href="/clientes">Cancelar</Link>
        </Button>
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : null}
          Registrar cliente
        </Button>
      </div>
    </form>
  );
}
