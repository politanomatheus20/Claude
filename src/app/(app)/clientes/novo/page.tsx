import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { NewClientForm } from "./new-client-form";

export const metadata: Metadata = { title: "Novo cliente" };

export default function NewClientPage() {
  return (
    <>
      <PageHeader
        eyebrow="Clientes"
        title="Registrar cliente fechado"
        description="Preencha como uma linha da planilha. O cálculo ao lado usa exatamente as mesmas fórmulas."
      />
      <NewClientForm />
    </>
  );
}
