"use client";

import Link from "next/link";
import { Loader2 } from "lucide-react";
import { useActionState } from "react";
import { createClient } from "@/app/actions";
import { useActionFeedback } from "@/components/use-action-feedback";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Field, Textarea } from "@/components/ui/field";
import { FileDrop } from "@/components/ui/file-drop";
import { today } from "@/lib/format";
import type { ActionState } from "@/lib/validation";
import { ClientFields } from "../client-fields";
import { ContractFields } from "../contract-fields";

export function NewClientForm() {
  const [state, action, pending] = useActionState<ActionState, FormData>(createClient, {});
  useActionFeedback(state);
  const v = state.values;
  const e = state.errors;

  return (
    <form action={action} className="grid grid-cols-1 gap-4" noValidate>
      <Card className="animate-fade-up">
        <CardHeader title="Cliente" />
        <div className="px-5 py-5">
          <ClientFields values={v} errors={e} autoFocus />
        </div>
      </Card>

      <Card className="animate-fade-up [animation-delay:60ms]">
        <CardHeader title="Contrato" description="Mesmas colunas e fórmulas da planilha" />
        <div className="grid gap-7 px-5 py-5">
          <ContractFields
            values={v}
            errors={e}
            defaults={{ signedAt: today(), startAt: today(), billingStatus: "pendente", licenseStatus: "pendente" }}
          />
          <FileDrop name="proposalFile" label="Anexar proposta" error={e?.proposalFile} />
          <Field label="Observações" htmlFor="notes" hint="Opcional">
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
