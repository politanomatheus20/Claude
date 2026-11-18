import type { Metadata, Viewport } from "next";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Metas Claude · DataGroup",
    template: "%s · Metas Claude · DataGroup",
  },
  description: "Gestão de clientes, propostas e metas da operação Claude da DataGroup.",
  icons: { icon: "/brand/favicon.svg" },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#121211",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className="h-full">
      <body className="min-h-full">
        {children}
        <Toaster
          theme="dark"
          position="bottom-right"
          toastOptions={{
            classNames: {
              toast: "!bg-surface !border-white/10 !text-mist !rounded-xl !shadow-[var(--shadow-card)]",
              description: "!text-mist/60",
            },
          }}
        />
      </body>
    </html>
  );
}
