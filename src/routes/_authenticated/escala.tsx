import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { consultas, cor, dataCurta, hoje, hora } from "@/lib/dados";
import { usePapel } from "@/hooks/usePapel";
import { useMinhaPessoa } from "@/hooks/useMinhaPessoa";
import { AtribuirModal } from "@/components/AtribuirModal";

type Busca = { depto?: string | undefined; minha?: boolean | undefined };

export const Route = createFileRoute("/_authenticated/escala")({
  validateSearch: (search: Record<string, unknown>): Busca => ({
    ...(typeof search["depto"] === "string" ? { depto: search["depto"] } : {}),
    // O link chega como booleano, mas colado na barra de enderecos vira string.
    ...(search["minha"] === true || search["minha"] === "true" ? { minha: true } : {}),
  }),

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

// Nada foi cadastrado antes disto, entao nao ha o que ver para tras.
const MES_MINIMO = "2026-09";

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
  const { depto, minha } = Route.useSearch();
  const { podeEscalar } = usePapel();
  const { pessoaId } = useMinhaPessoa();

  const { data: departamentos = [] } = useQuery(consultas.departamentos());
  const { data: funcoes = [] } = useQuery(consultas.funcoes());
  const { data: pessoas = [] } = useQuery(consultas.pessoas());
  const { data: cultos = [] } = useQuery(consultas.cultos());
  const { data: escalas = [] } = useQuery(consultas.escalas());

  const [alvo, setAlvo] = useState<{ cultoId: string; funcaoId: string } | null>(null);
  const [mes, setMes] = useState(() => {
    const atual = hoje().slice(0, 7);
    return atual < MES_MINIMO ? MES_MINIMO : atual;
  });

  const minhasEscalas = useMemo(
    () => (pessoaId ? escalas.filter((e) => e.pessoa_id === pessoaId) : []),
    [escalas, pessoaId],
  );

  // Em "Minha escala" a grade encolhe duas vezes: so os cultos em que a pessoa
  // aparece, e dentro deles so as funcoes que ela exerce.
  const linhas = useMemo(() => {
    const doMes = cultos.filter((c) => c.data.slice(0, 7) === mes);
    if (!minha) return doMes;
    const meus = new Set(minhasEscalas.map((e) => e.culto_id));
    return doMes.filter((c) => meus.has(c.id));
  }, [cultos, mes, minha, minhasEscalas]);

  const colunas = useMemo(() => {
    const doDepto = depto ? funcoes.filter((f) => f.departamento_id === depto) : funcoes;
    if (!minha) return doDepto;
    const minhas = new Set(minhasEscalas.map((e) => e.funcao_id));
    return doDepto.filter((f) => minhas.has(f.id));
  }, [funcoes, depto, minha, minhasEscalas]);

  // O ministerio escolhido no menu ou nos filtros. Sem ele, a grade mostra tudo.
  const deptoAtual = departamentos.find((d) => d.id === depto);

  const deptoDe = (funcaoId: string) => {
    const f = funcoes.find((x) => x.id === funcaoId);
    return departamentos.find((d) => d.id === f?.departamento_id);
  };

  const mudarMes = (delta: number) => {
    const [a, m] = mes.split("-").map(Number);
    const d = new Date(a!, m! - 1 + delta, 1);
    const alvo = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (alvo < MES_MINIMO) return;
    setMes(alvo);
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
          {minha ? (
            <p className="label-mono mt-3">Minha escala</p>
          ) : deptoAtual ? (
            <p className="label-mono mt-3 flex items-center gap-2">
              <span className={`size-2 rounded-full ${cor(deptoAtual.cor).dot}`} />
              {deptoAtual.nome}
            </p>
          ) : (
            <p className="label-mono mt-3">Todos os ministérios</p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-full border border-line px-1 py-0.5">
            <button
              onClick={() => mudarMes(-1)}
              disabled={mes <= MES_MINIMO}
              className="rounded-full px-2 py-0.5 font-mono text-[11px] text-muted hover:text-ink disabled:cursor-not-allowed disabled:opacity-25 disabled:hover:text-muted"
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
        </div>
      </section>

      {/* Celular: a grade vira lista. Com muitas funcoes, rolar a tabela de lado
          espreme os nomes ate ficarem ilegiveis — aqui cada culto e um cartao e
          o nome ocupa a largura toda. */}
      <section className="rise space-y-3 md:hidden" style={{ animationDelay: "120ms" }}>
        {linhas.length === 0 ? (
          <p className="rounded-xl border border-line bg-surface px-4 py-6 text-[13px] text-muted">
            {minha ? "Você não está escalado neste mês." : "Nenhum culto neste mês."}
          </p>
        ) : (
          linhas.map((culto) => {
            const doCulto = colunas
              .map((f) => ({
                funcao: f,
                atribuicoes: escalas.filter((e) => e.culto_id === culto.id && e.funcao_id === f.id),
              }))
              // Quem so acompanha nao precisa ver funcao vazia; quem escala precisa,
              // senao nao tem onde clicar para atribuir.
              .filter((item) => podeEscalar || item.atribuicoes.length > 0);

            const ehHoje = culto.data === hoje();

            return (
              <article
                key={culto.id}
                className={`overflow-hidden rounded-xl border bg-surface ${
                  ehHoje ? "border-clay/40" : "border-line"
                }`}
              >
                {/* Empilhado, nao lado a lado: em tela estreita um titulo longo
                    empurrava a data e o horario para a linha de baixo, quebrando
                    "Qui 10" no meio. Cada informacao ganha a sua linha. */}
                <header
                  className={`flex flex-col gap-0.5 border-b border-line px-4 py-3 ${
                    ehHoje ? "bg-clay/5" : ""
                  }`}
                >
                  <span className={`font-medium ${ehHoje ? "text-clay" : ""}`}>
                    {dataCurta(culto.data)}
                  </span>
                  <span className="font-mono text-[11px] text-muted">
                    {culto.titulo} · {hora(culto.horario)}
                  </span>
                </header>

                {doCulto.length === 0 ? (
                  <p className="px-4 py-3 font-mono text-[11px] text-muted">
                    Ninguém escalado ainda.
                  </p>
                ) : (
                  <div className="divide-y divide-line">
                    {doCulto.map(({ funcao: f, atribuicoes }) => {
                      const c = cor(deptoDe(f.id)?.cor);
                      return (
                        <div key={f.id} className="flex flex-col gap-2 px-4 py-3">
                          <span className="label-mono flex items-center gap-2">
                            <span className={`size-2 rounded-full ${c.dot}`} />
                            {f.nome}
                          </span>
                          <div className="flex flex-wrap items-center gap-1.5">
                            {atribuicoes.map((e) => (
                              <span
                                key={e.id}
                                className="rounded-md bg-surface2 px-2.5 py-1 text-[13px] ring-1 ring-line"
                              >
                                {pessoas.find((x) => x.id === e.pessoa_id)?.nome ?? "—"}
                              </span>
                            ))}
                            {podeEscalar ? (
                              <button
                                onClick={() => setAlvo({ cultoId: culto.id, funcaoId: f.id })}
                                className="rounded-md border border-dashed border-line px-2.5 py-1 text-[13px] text-muted transition-colors hover:border-clay/50 hover:text-clay"
                              >
                                {atribuicoes.length > 0 ? "+" : "Atribuir"}
                              </button>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </article>
            );
          })
        )}
      </section>

      <section
        className="rise hidden overflow-hidden rounded-xl border border-line bg-surface md:block"
        style={{ animationDelay: "120ms" }}
      >
        <div className="max-h-[calc(100vh-12rem)] overflow-auto [scrollbar-width:auto]">
          <table className="w-max min-w-full border-collapse text-[13px]">
            <thead>
              <tr className="text-left">
                <th className="sticky top-0 left-0 z-30 font-mono text-[11px] font-medium tracking-[0.12em] uppercase text-ink bg-surface px-4 py-3 shadow-[0_1px_0_0_var(--line)]">
                  Culto
                </th>
                {colunas.map((f) => {
                  const c = cor(deptoDe(f.id)?.cor);
                  return (
                    <th
                      key={f.id}
                      className="sticky top-0 z-20 font-mono text-[11px] font-medium tracking-[0.12em] uppercase text-ink bg-surface px-4 py-3 whitespace-nowrap shadow-[0_1px_0_0_var(--line)]"
                    >
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
                    {minha ? "Você não está escalado neste mês." : "Nenhum culto neste mês."}
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
