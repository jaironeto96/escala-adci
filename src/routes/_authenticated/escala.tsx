import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { consultas, cor, dataCurta, hoje, hora } from "@/lib/dados";
import { usePapel } from "@/hooks/usePapel";
import { AtribuirModal } from "@/components/AtribuirModal";

type Busca = { depto?: string | undefined };

export const Route = createFileRoute("/_authenticated/escala")({
  validateSearch: (search: Record<string, unknown>): Busca =>
    typeof search["depto"] === "string" ? { depto: search["depto"] } : {},

  head: () => ({
    meta: [
      { title: "Grade de escala · Escala de cultos" },
      {
        name: "description",
        content: "Grade de escala dos cultos por função e departamento, com atribuição rápida.",
      },
      { property: "og:title", content: "Grade de escala · Escala de cultos" },
      {
        property: "og:description",
        content: "Grade de escala dos cultos por função e departamento.",
      },
    ],
  }),
  component: EscalaPage,
});

const MESES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

function EscalaPage() {
  const { depto } = Route.useSearch();
  const navigate = Route.useNavigate();
  const { podeEscalar } = usePapel();

  const { data: departamentos = [] } = useQuery(consultas.departamentos());
  const { data: funcoes = [] } = useQuery(consultas.funcoes());
  const { data: pessoas = [] } = useQuery(consultas.pessoas());
  const { data: cultos = [] } = useQuery(consultas.cultos());
  const { data: escalas = [] } = useQuery(consultas.escalas());

  const [alvo, setAlvo] = useState<{ cultoId: string; funcaoId: string } | null>(null);
  const [mes, setMes] = useState(() => hoje().slice(0, 7));

  const linhas = useMemo(
    () => cultos.filter((c) => c.data.slice(0, 7) === mes),
    [cultos, mes],
  );
  const colunas = useMemo(
    () => (depto ? funcoes.filter((f) => f.departamento_id === depto) : funcoes),
    [funcoes, depto],
  );

  const deptoDe = (funcaoId: string) => {
    const f = funcoes.find((x) => x.id === funcaoId);
    return departamentos.find((d) => d.id === f?.departamento_id);
  };

  const mudarMes = (delta: number) => {
    const [a, m] = mes.split("-").map(Number);
    const d = new Date(a!, m! - 1 + delta, 1);
    setMes(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  };

  const rotuloMes = () => {
    const [a, m] = mes.split("-").map(Number);
    return `${MESES[m! - 1]} ${a}`;
  };

  return (
    <>
      <section className="rise mb-8 flex flex-wrap items-end justify-between gap-8">
        <div className="max-w-[46ch]">
          <h1 className="text-balance font-display text-5xl font-light leading-[1.02] tracking-tight">
            Escala
          </h1>
          <p className="label-mono mt-3">{"\n"}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-full border border-line px-1 py-0.5">
            <button
              onClick={() => mudarMes(-1)}
              className="rounded-full px-2 py-0.5 font-mono text-[11px] text-muted hover:text-ink"
            >
              ‹
            </button>
            <span className="px-1 font-mono text-[11px] text-ink">{rotuloMes()}</span>
            <button
              onClick={() => mudarMes(1)}
              className="rounded-full px-2 py-0.5 font-mono text-[11px] text-muted hover:text-ink"
            >
              ›
            </button>
          </div>
          <button
            onClick={() => navigate({ search: {} })}
            className={`rounded-full border border-line px-3 py-1 font-mono text-[11px] ${depto ? "text-muted" : "text-ink"}`}
          >
            Todos
          </button>
          {departamentos.map((d) => (
            <button
              key={d.id}
              onClick={() => navigate({ search: { depto: d.id } })}
              className={`rounded-full border border-line px-3 py-1 font-mono text-[11px] ${depto === d.id ? cor(d.cor).text : "text-muted"}`}
            >
              {d.nome}
            </button>
          ))}
        </div>
      </section>

      <section
        className="rise overflow-hidden rounded-xl border border-line bg-surface"
        style={{ animationDelay: "120ms" }}
      >
        <div className="overflow-x-auto [scrollbar-width:auto]">
          <table className="w-max min-w-full border-collapse text-[13px]">
            <thead>
              <tr className="text-left">
                <th className="label-mono sticky left-0 z-10 bg-surface px-4 py-3">Culto</th>
                {colunas.map((f) => {
                  const c = cor(deptoDe(f.id)?.cor);
                  return (
                    <th key={f.id} className="label-mono px-4 py-3 whitespace-nowrap">
                      <span className="flex items-center gap-2">
                        <span className={`size-2 rounded-full ${c.dot}`} />
                        {f.nome}
                      </span>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {linhas.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-muted" colSpan={colunas.length + 1}>
                    Nenhum culto neste mês.
                  </td>
                </tr>
              ) : (
                linhas.map((culto) => (
                  <tr key={culto.id} className="transition-colors hover:bg-surface2">
                    <td
                      className={`sticky left-0 z-10 bg-surface px-4 py-3 whitespace-nowrap ${culto.data === hoje() ? "text-clay" : ""}`}
                    >
                      <div className="font-medium">{dataCurta(culto.data)}</div>
                      <div className="font-mono text-[11px] text-muted">
                        {culto.titulo} · {hora(culto.horario)}
                      </div>
                    </td>
                    {colunas.map((f) => {
                      const atribuicoes = escalas.filter(
                        (e) => e.culto_id === culto.id && e.funcao_id === f.id,
                      );
                      return (
                        <td
                          key={f.id}
                          className={`px-4 py-3 align-top ${culto.data === hoje() ? "bg-clay/5" : ""}`}
                        >
                          <div className="flex flex-wrap items-center gap-1.5">
                            {atribuicoes.map((e) => (
                              <span
                                key={e.id}
                                className="rounded-md bg-surface2 px-2.5 py-1 text-[12px] whitespace-nowrap ring-1 ring-line"
                              >
                                {pessoas.find((x) => x.id === e.pessoa_id)?.nome ?? "—"}
                              </span>
                            ))}
                            {podeEscalar ? (
                              <button
                                onClick={() => setAlvo({ cultoId: culto.id, funcaoId: f.id })}
                                className="rounded-md border border-dashed border-line px-2.5 py-1 text-[12px] whitespace-nowrap text-muted transition-colors hover:border-clay/50 hover:text-clay"
                              >
                                {atribuicoes.length > 0 ? "+" : "Atribuir"}
                              </button>
                            ) : atribuicoes.length === 0 ? (
                              <span className="font-mono text-[11px] text-muted">—</span>
                            ) : null}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {alvo ? (
        <AtribuirModal
          cultoId={alvo.cultoId}
          funcaoId={alvo.funcaoId}
          onClose={() => setAlvo(null)}
        />
      ) : null}
    </>
  );
}
