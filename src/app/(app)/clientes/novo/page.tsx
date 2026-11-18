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
        description="Os valores desta proposta viram a versão 1. Atualizações futuras geram novas versões e recalculam tudo."
      />
      <NewClientForm />
    </>
  );
}
