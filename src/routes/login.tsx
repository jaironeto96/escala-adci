import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { salvarTelefone } from "@/lib/conta.functions";

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

const campo =
  "mt-1.5 w-full rounded-md border border-line bg-surface2 px-3 py-2 text-ink outline-none focus:border-clay/50";

function AuthPage() {
  const router = useRouter();
  const [modo, setModo] = useState<"entrar" | "criar">("entrar");
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [celular, setCelular] = useState("");
  const [carregando, setCarregando] = useState(false);
  const enviarTelefone = useServerFn(salvarTelefone);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.navigate({ to: "/escala" });
    });
  }, [router]);

  async function criarConta() {
    const { data, error } = await supabase.auth.signUp({
      email,
      password: senha,
      // A trigger do banco lê full_name para preencher o nome em `pessoas`.
      options: { data: { full_name: nome.trim(), telefone: celular.trim() } },
    });
    if (error) throw error;

    // Sem confirmação de e-mail o Supabase já devolve a sessão. Se ela não vier,
    // a confirmação continua ligada no painel e a conta fica pendente.
    if (!data.session) {
      toast.info("Conta criada. Confirme o e-mail para poder entrar.");
      setModo("entrar");
      return;
    }

    if (celular.trim()) {
      try {
        await enviarTelefone({ data: { telefone: celular.trim() } });
      } catch {
        toast.warning(
          "Conta criada, mas o celular não foi salvo. Peça para atualizarem em Voluntários.",
        );
      }
    }

    toast.success("Conta criada.");
    router.navigate({ to: "/escala" });
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setCarregando(true);
    try {
      if (modo === "entrar") {
        const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
        if (error) throw error;
        router.navigate({ to: "/escala" });
      } else {
        await criarConta();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível continuar.");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper px-4 text-ink">
      <div className="rise w-full max-w-sm rounded-xl border border-line bg-surface p-6">
        <div className="flex items-baseline gap-2">
          <span className="font-display text-[22px] font-semibold tracking-tight">ADCI</span>
          <span className="label-mono border-l border-line pl-2">Ministérios</span>
        </div>
        <h1 className="mt-6 font-display text-2xl font-light tracking-tight">
          {modo === "entrar" ? "Entrar no painel" : "Criar acesso"}
        </h1>

        <form onSubmit={enviar} className="mt-6 space-y-4 text-[13px]">
          {modo === "criar" ? (
            <label className="block">
              <span className="label-mono">Nome completo</span>
              <input
                type="text"
                required
                autoComplete="name"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                className={campo}
              />
            </label>
          ) : null}

          <label className="block">
            <span className="label-mono">E-mail</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={campo}
            />
          </label>

          {modo === "criar" ? (
            <label className="block">
              <span className="label-mono">Celular</span>
              <input
                type="tel"
                required
                inputMode="tel"
                placeholder="(27) 99999-0000"
                value={celular}
                onChange={(e) => setCelular(e.target.value)}
                className={campo}
              />
            </label>
          ) : null}

          <label className="block">
            <span className="label-mono">Senha</span>
            <input
              type="password"
              required
              minLength={6}
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              className={campo}
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
          onClick={() => setModo(modo === "entrar" ? "criar" : "entrar")}
          className="mt-5 w-full font-mono text-[11px] text-muted transition-colors hover:text-ink"
        >
          {modo === "entrar" ? "Não tenho acesso ainda" : "Já tenho conta"}
        </button>
      </div>
    </div>
  );
}
