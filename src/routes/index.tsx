import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect } from "react";

import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Escala · Escalas de cultos por departamento" },
      {
        name: "description",
        content:
          "Monte a escala de cada culto por função e departamento, cadastre voluntários com múltiplos ministérios e avise por e-mail quem está escalado no dia.",
      },
      { property: "og:title", content: "Escala · Escalas de cultos por departamento" },
      {
        property: "og:description",
        content:
          "Escalas por culto e por departamento, cadastro de voluntários e aviso automático por e-mail.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.navigate({ to: "/escala" });
    });
  }, [router]);

  return (
    <div className="min-h-screen bg-paper text-ink">
      <div className="mx-auto flex h-16 max-w-[1440px] items-center gap-2 px-6">
        <span className="font-display text-[22px] font-semibold tracking-tight">Escala</span>
        <span className="label-mono border-l border-line pl-2">Ministérios</span>
      </div>

      <div className="mx-auto max-w-[1440px] px-6 py-20">
        <div className="rise max-w-[46ch]">
          <h1 className="text-balance font-display text-5xl font-light leading-[1.02] tracking-tight">
            Grade de <span className="font-medium italic text-clay">cultos</span> por função
          </h1>
          <p className="mt-4 text-[15px] leading-relaxed text-muted">
            Monte a escala de cada culto por departamento e função, cadastre voluntários com mais de
            um ministério e deixe o aviso por e-mail sair sozinho na manhã do culto.
          </p>
          <div className="mt-8 flex gap-3">
            <Link
              to="/auth"
              className="rounded-md bg-clay px-4 py-2 text-[13px] font-medium text-paper transition-colors hover:bg-clay/85"
            >
              Entrar
            </Link>
          </div>
        </div>

        <div className="rise mt-16 grid gap-4 md:grid-cols-3" style={{ animationDelay: "120ms" }}>
          {[
            {
              t: "Escala por culto",
              d: "Uma grade por semana: funções nas linhas, cultos nas colunas.",
            },
            {
              t: "Escala por departamento",
              d: "Filtre a grade por Louvor, Som e Luz, Acolhimento e o que mais existir.",
            },
            {
              t: "Aviso automático",
              d: "Na manhã do culto, cada escalado recebe um e-mail com sua função.",
            },
          ].map((c) => (
            <div key={c.t} className="rounded-xl border border-line bg-surface p-5">
              <h2 className="font-display text-lg font-medium">{c.t}</h2>
              <p className="mt-2 text-[13px] leading-relaxed text-muted">{c.d}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
