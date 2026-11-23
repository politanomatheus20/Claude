"use client";

/**
 * Último recurso: erro no layout raiz (quando nem o layout consegue carregar).
 * Usa estilos inline porque o CSS do app pode não ter carregado.
 */
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  return (
    <html lang="pt-BR">
      <body style={{ margin: 0, minHeight: "100vh", display: "grid", placeItems: "center", background: "#121211", color: "#f7f7f7", fontFamily: "system-ui, sans-serif" }}>
        <div style={{ maxWidth: 420, padding: 24, textAlign: "center" }}>
          <h1 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>Não foi possível carregar o sistema</h1>
          <p style={{ fontSize: 14, lineHeight: 1.6, color: "rgb(247 247 247 / 0.6)", marginTop: 12 }}>
            Ocorreu um erro no servidor. Recarregue a página em instantes. Se continuar, informe o código abaixo ao responsável pelo sistema.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{ marginTop: 20, height: 40, padding: "0 16px", borderRadius: 8, border: 0, background: "#f7f7f7", color: "#121211", fontWeight: 500, cursor: "pointer" }}
          >
            Recarregar
          </button>
          {error.digest ? <p style={{ marginTop: 28, fontFamily: "monospace", fontSize: 11, color: "rgb(247 247 247 / 0.3)" }}>Código: {error.digest}</p> : null}
        </div>
      </body>
    </html>
  );
}
