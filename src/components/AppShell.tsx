import { useState } from "react";
import { Link, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { Menu, X } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { consultas, cor, dataCurta, hoje, hora } from "@/lib/dados";
import { usePapel } from "@/hooks/usePapel";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/escala", label: "Escala" },
  { to: "/cultos", label: "Próximos cultos" },
  { to: "/voluntarios", label: "Voluntários" },
  { to: "/departamentos", label: "Departamentos" },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { papel, ehAdmin } = usePapel();
  const [menuOpen, setMenuOpen] = useState(false);

  const { data: departamentos = [] } = useQuery(consultas.departamentos());
  const { data: pessoaDeptos = [] } = useQuery(consultas.pessoaDepartamentos());
  const { data: cultos = [] } = useQuery(consultas.cultos());
  const { data: escalas = [] } = useQuery(consultas.escalas());

  const proximos = cultos.filter((c) => c.data >= hoje()).slice(0, 3);
  const cultoHoje = cultos.find((c) => c.data === hoje());

  const navItems = [
    ...NAV,
    ...(ehAdmin ? [{ to: "/usuarios", label: "Acessos" } as const] : []),
  ];

  async function sair() {
    setMenuOpen(false);
    await supabase.auth.signOut();
    router.navigate({ to: "/auth" });
  }

  return (
    <div className="min-h-screen bg-paper text-ink font-body">
      <div className="sticky top-0 z-40 border-b border-line bg-paper/90 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-[1440px] items-center gap-8 px-6">
          <div className="flex items-baseline gap-2">
            <span className="font-display text-[22px] font-semibold tracking-tight">ADCI</span>
            <span className="label-mono border-l border-line pl-2">Ministérios</span>
          </div>

          <nav className="hidden items-center gap-6 text-[13px] md:flex">
            {navItems.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="text-muted transition-colors hover:text-ink"
                activeProps={{ className: "text-ink" }}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-4">
            <span className="hidden rounded-full border border-line px-3 py-1 font-mono text-[11px] text-muted sm:inline">
              {papel === "admin" ? "Administrador" : papel === "moderador" ? "Moderador" : "Visualizador"}
            </span>
            {cultoHoje ? (
              <div className="hidden items-center gap-2 rounded-md border border-line px-3 py-2 lg:flex">
                <span className="size-1.5 rounded-full bg-clay" />
                <span className="font-mono text-[11px] text-muted">
                  Culto de hoje · {hora(cultoHoje.horario)}
                </span>
              </div>
            ) : null}

            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="inline-flex items-center justify-center rounded-md border border-line p-2 text-muted transition-colors hover:text-ink md:hidden"
              aria-expanded={menuOpen}
              aria-label={menuOpen ? "Fechar menu" : "Abrir menu"}
            >
              {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>

            <button
              onClick={sair}
              className="hidden rounded-md border border-line px-3 py-2 text-[13px] text-muted transition-colors hover:text-ink md:inline-flex"
            >
              Sair
            </button>
          </div>
        </div>

        <div
          className={cn(
            "absolute left-0 right-0 top-full border-b border-line bg-paper md:hidden",
            menuOpen ? "block" : "hidden"
          )}
        >
          <div className="mx-auto max-w-[1440px] px-6 py-4">
            <div className="mb-3 flex items-center gap-3 sm:hidden">
              <span className="rounded-full border border-line px-3 py-1 font-mono text-[11px] text-muted">
                {papel === "admin" ? "Administrador" : papel === "moderador" ? "Moderador" : "Visualizador"}
              </span>
              {cultoHoje ? (
                <span className="flex items-center gap-2 font-mono text-[11px] text-muted">
                  <span className="size-1.5 rounded-full bg-clay" />
                  Culto de hoje · {hora(cultoHoje.horario)}
                </span>
              ) : null}
            </div>

            <nav className="flex flex-col gap-1">
              {navItems.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setMenuOpen(false)}
                  className="rounded-md px-3 py-2.5 text-[14px] text-muted transition-colors hover:bg-surface hover:text-ink"
                  activeProps={{ className: "bg-surface2 text-ink" }}
                >
                  {item.label}
                </Link>
              ))}
              <button
                onClick={sair}
                className="mt-2 rounded-md border border-line px-3 py-2.5 text-left text-[14px] text-muted transition-colors hover:text-ink"
              >
                Sair
              </button>
            </nav>
          </div>
        </div>
      </div>

      <div className="mx-auto grid max-w-[1440px] grid-cols-1 gap-8 px-6 py-8 lg:grid-cols-[200px_minmax(0,1fr)]">
        <aside className="rise hidden lg:block">
          <div className="label-mono mb-3">Departamentos</div>
          <div className="space-y-0.5 text-[13px]">
            {departamentos.map((d) => {
              const c = cor(d.cor);
              const total = pessoaDeptos.filter((p) => p.departamento_id === d.id).length;
              return (
                <Link
                  key={d.id}
                  to="/escala"
                  search={{ depto: d.id }}
                  className="flex items-center justify-between rounded-md px-3 py-2 text-muted transition-colors hover:bg-surface"
                  activeOptions={{ includeSearch: true }}
                  activeProps={{ className: "bg-surface2 text-ink" }}
                >
                  <span className="flex items-center gap-2">
                    <span className={`size-2 rounded-full ${c.dot}`} />
                    {d.nome}
                  </span>
                  <span className="font-mono text-[11px] text-muted">{total}</span>
                </Link>
              );
            })}
          </div>

          <div className="mt-8 rounded-lg border border-line p-4">
            <div className="label-mono mb-3">Próximos cultos</div>
            <div className="space-y-3 text-[13px]">
              {proximos.length === 0 ? (
                <p className="text-muted">Nenhum culto agendado.</p>
              ) : (
                proximos.map((c) => (
                  <div key={c.id} className="flex items-start justify-between gap-2">
                    <span className="font-medium">
                      {dataCurta(c.data)} · {c.titulo}
                    </span>
                    <span className="shrink-0 font-mono text-[11px] text-clay">
                      {escalas.filter((e) => e.culto_id === c.id).length}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </aside>

        <main className="min-w-0">{children}</main>
      </div>
    </div>
  );
}
