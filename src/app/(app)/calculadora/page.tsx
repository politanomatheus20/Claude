import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { LicenseCalculator } from "./license-calculator";

export const metadata: Metadata = { title: "Calculadora" };

export default function CalculatorPage() {
  return (
    <>
      <PageHeader eyebrow="Calculadora" title="Proposta de licenças" />
      <LicenseCalculator />
    </>
  );
}
