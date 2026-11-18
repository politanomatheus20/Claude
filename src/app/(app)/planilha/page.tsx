import type { Metadata } from "next";
import { listContracts } from "@/lib/data";
import { SheetTable, type SheetRowData } from "./sheet-table";

export const metadata: Metadata = { title: "Planilha" };

export default async function SheetPage() {
  const rows = await listContracts();
  // Envia os dados crus: o navegador recalcula com src/lib/calc.ts a cada edição.
  const data: SheetRowData[] = rows.map((r) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { calc, client, ...contract } = r;
    return { contract, client };
  });
  return <SheetTable initialRows={data} />;
}
