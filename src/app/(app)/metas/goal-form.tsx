"use client";

import { Loader2 } from "lucide-react";
import { useActionState } from "react";
import { saveGoal } from "@/app/actions";
import { useActionFeedback } from "@/components/use-action-feedback";
import { Button } from "@/components/ui/button";
import { Field, Input, MoneyInput } from "@/components/ui/field";
import { centsToInput } from "@/lib/format";
import type { ActionState } from "@/lib/validation";

export function GoalForm({
  month,
  targetCents,
  compact,
}: {
  month: string;
  targetCents?: number;
  compact?: boolean;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(saveGoal, {});
  useActionFeedback(state);

  if (compact) {
    return (
      <form action={action} className="flex w-full items-start gap-2 sm:w-auto">
        <input type="hidden" name="month" value={month} />
        <div className="flex-1 sm:w-56">
          <MoneyInput
            name="target"
            placeholder="Meta do mês"
            aria-label="Valor da meta"
            defaultValue={state.values?.target ?? ""}
            aria-invalid={Boolean(state.errors?.target)}
          />
          {state.errors?.target ? <p className="mt-1 text-xs text-danger">{state.errors.target[0]}</p> : null}
        </div>
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : null}
          Definir meta
        </Button>
      </form>
    );
  }

  return (
    <form action={action} className="grid gap-4 sm:grid-cols-[10rem_1fr_auto] sm:items-end">
      <Field label="Mês" htmlFor="goal-month" error={state.errors?.month}>
        <Input id="goal-month" type="month" name="month" defaultValue={state.values?.month ?? month} required />
      </Field>
      <Field label="Valor da meta mensal" htmlFor="goal-target" error={state.errors?.target}>
        <MoneyInput
          id="goal-target"
          name="target"
          placeholder="0,00"
          defaultValue={state.values?.target ?? (targetCents ? centsToInput(targetCents) : "")}
          aria-invalid={Boolean(state.errors?.target)}
        />
      </Field>
      <Button type="submit" variant="primary" disabled={pending} className="sm:mb-px">
        {pending ? <Loader2 className="animate-spin" /> : null}
        Salvar meta
      </Button>
    </form>
  );
}
