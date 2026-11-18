import type { Client } from "@/lib/db/schema";
import type { FieldErrors } from "@/lib/validation";
import { Field, Input, Select } from "@/components/ui/field";

/** Campos do cliente: B, C, D, AH, AI, AJ. */
export function ClientFields({
  defaults,
  values,
  errors,
  autoFocus,
}: {
  defaults?: Partial<Client>;
  values?: Record<string, string>;
  errors?: FieldErrors;
  autoFocus?: boolean;
}) {
  const val = (k: keyof Client) => values?.[k] ?? (defaults?.[k] as string | null | undefined) ?? "";
  return (
    <div className="grid gap-4 sm:grid-cols-6">
      <Field label="Nome do cliente" htmlFor="c-name" error={errors?.name} className="sm:col-span-4">
        <Input id="c-name" name="name" defaultValue={val("name")} autoFocus={autoFocus} placeholder="Razão social ou nome fantasia" aria-invalid={Boolean(errors?.name)} />
      </Field>
      <Field label="Setor" htmlFor="c-sector" className="sm:col-span-2">
        <Select id="c-sector" name="sector" defaultValue={val("sector") || "privado"}>
          <option value="privado">Privado</option>
          <option value="governo">Governo</option>
        </Select>
      </Field>
      <Field label="CNPJ" htmlFor="c-document" error={errors?.document} className="sm:col-span-2">
        <Input id="c-document" name="document" defaultValue={val("document")} placeholder="00.000.000/0000-00" />
      </Field>
      <Field label="Nome do contato" htmlFor="c-contact" error={errors?.contactName} className="sm:col-span-4">
        <Input id="c-contact" name="contactName" defaultValue={val("contactName")} />
      </Field>
      <Field label="E-mail do contato" htmlFor="c-email" error={errors?.contactEmail} className="sm:col-span-3">
        <Input id="c-email" name="contactEmail" type="email" defaultValue={val("contactEmail")} placeholder="nome@cliente.com.br" aria-invalid={Boolean(errors?.contactEmail)} />
      </Field>
      <Field label="Telefone do contato" htmlFor="c-phone" error={errors?.contactPhone} className="sm:col-span-3">
        <Input id="c-phone" name="contactPhone" type="tel" defaultValue={val("contactPhone")} placeholder="+55 11 99999-9999" />
      </Field>
    </div>
  );
}
