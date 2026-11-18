"use client";

import { ArrowRight, Loader2 } from "lucide-react";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { login, type LoginState } from "./actions";

export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, {});

  return (
    <form action={action} className="mt-10" noValidate>
      <label htmlFor="email" className="sr-only">
        E-mail corporativo
      </label>
      <div
        className="flex gap-2 rounded-xl border border-white/15 bg-abyss-deep/50 p-1.5 backdrop-blur-md transition focus-within:border-jelly-teal/60 focus-within:shadow-[0_0_0_4px_rgb(53_232_200/0.1)] aria-[invalid=true]:border-danger/60"
        aria-invalid={Boolean(state.error)}
      >
        <input
          id="email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoFocus
          required
          defaultValue={state.email}
          placeholder="voce@datagroup.global"
          aria-describedby={state.error ? "email-help" : undefined}
          className="h-11 min-w-0 flex-1 bg-transparent px-3 text-[15px] text-mist outline-none placeholder:text-mist/30"
        />
        <Button type="submit" variant="primary" className="h-11 px-5" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : <ArrowRight />}
          <span>Entrar</span>
        </Button>
      </div>
      {state.error ? (
        <p id="email-help" role="alert" className="mt-3 text-sm text-danger">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
