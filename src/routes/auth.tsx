import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar · Escala de cultos" },
      {
        name: "description",
        content: "Acesse o painel de escalas dos cultos, voluntários e departamentos da igreja.",
      },
      { property: "og:title", content: "Entrar · Escala de cultos" },
      {
        property: "og:description",
        content: "Acesse o painel de escalas dos cultos e voluntários.",
      },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const router = useRouter();
  const [modo, setModo] = useState<"entrar" | "criar">("entrar");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.navigate({ to: "/escala" });
    });
  }, [router]);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setCarregando(true);
    try {
      if (modo === "entrar") {
        const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
        if (error) throw error;
        router.navigate({ to: "/escala" });
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password: senha,
          options: { emailRedirectTo: `${window.location.origin}/escala` },
        });
        if (error) throw error;
        toast.success("Conta criada. Confirme o e-mail se for solicitado.");
        router.navigate({ to: "/escala" });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível continuar.");
    } finally {
      setCarregando(false);
    }
  }

  async function google() {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      toast.error("Não foi possível entrar com o Google.");
      return;
    }
    if (result.redirected) return;
    router.navigate({ to: "/escala" });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper px-4 text-ink">
      <div className="rise w-full max-w-sm rounded-xl border border-line bg-surface p-6">
        <div className="flex items-baseline gap-2">
          <span className="font-display text-[22px] font-semibold tracking-tight">Escala</span>
          <span className="label-mono border-l border-line pl-2">Ministérios</span>
        </div>
        <h1 className="mt-6 font-display text-2xl font-light tracking-tight">
          {modo === "entrar" ? "Entrar no painel" : "Criar acesso"}
        </h1>

        <form onSubmit={enviar} className="mt-6 space-y-4 text-[13px]">
          <label className="block">
            <span className="label-mono">E-mail</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1.5 w-full rounded-md border border-line bg-surface2 px-3 py-2 text-ink outline-none focus:border-clay/50"
            />
          </label>
          <label className="block">
            <span className="label-mono">Senha</span>
            <input
              type="password"
              required
              minLength={6}
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              className="mt-1.5 w-full rounded-md border border-line bg-surface2 px-3 py-2 text-ink outline-none focus:border-clay/50"
            />
          </label>
          <button
            type="submit"
            disabled={carregando}
            className="w-full rounded-md bg-clay py-2 text-[13px] font-medium text-paper transition-colors hover:bg-clay/85 disabled:opacity-60"
          >
            {modo === "entrar" ? "Entrar" : "Criar conta"}
          </button>
        </form>

        <button
          onClick={google}
          className="mt-3 w-full rounded-md border border-line py-2 text-[13px] text-muted transition-colors hover:text-ink"
        >
          Continuar com Google
        </button>

        <button
          onClick={() => setModo(modo === "entrar" ? "criar" : "entrar")}
          className="mt-5 w-full font-mono text-[11px] text-muted transition-colors hover:text-ink"
        >
          {modo === "entrar" ? "Não tenho acesso ainda" : "Já tenho conta"}
        </button>
      </div>
    </div>
  );
}
