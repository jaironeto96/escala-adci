import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  consultas,
  cor,
  dataCurta,
  hoje,
  hora,
  MES_MINIMO,
  mesAtual,
  type Culto,
  type Funcao,
} from "@/lib/dados";
import { funcaoAtivaNoCulto } from "@/lib/funcoes-do-culto";
import { usePapel } from "@/hooks/usePapel";
import { useMinhaPessoa } from "@/hooks/useMinhaPessoa";
import { useAjustarFuncao } from "@/hooks/useAjustarFuncao";
import { AtribuirModal } from "@/components/AtribuirModal";
import { AtivarNotificacoes } from "@/components/AtivarNotificacoes";
import { BotaoAnteriores } from "@/components/BotaoAnteriores";
import { FuncoesDoCultoModal } from "@/components/FuncoesDoCultoModal";
import { MinhaEscala } from "@/components/MinhaEscala";
import { SeletorDeMes } from "@/components/SeletorDeMes";

type Busca = {
  depto?: string | undefined;
  minha?: boolean | undefined;
  /** Dia a destacar (AAAA-MM-DD). Vem do toque na notificacao do aviso. */
  dia?: string | undefined;
};

export const Route = createFileRoute("/_authenticated/escala")({
  validateSearch: (search: Record<string, unknown>): Busca => ({
    ...(typeof search["depto"] === "string" ? { depto: search["depto"] } : {}),
    // O link chega como booleano, mas colado na barra de enderecos vira string.
    ...(search["minha"] === true || search["minha"] === "true" ? { minha: true } : {}),
    ...(typeof search["dia"] === "string" && /^\d{4}-\d{2}-\d{2}$/.test(search["dia"])
      ? { dia: search["dia"] }
      : {}),
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

function EscalaPage() {
  const { depto, minha, dia } = Route.useSearch();
  // "Minha escala" e outra tela: a lista pessoal de quem esta logado, sem grade.
  return minha ? <MinhaEscala dia={dia} /> : <GradeDaEscala depto={depto} />;
}

function GradeDaEscala({ depto }: { depto?: string | undefined }) {
  const { podeEscalar } = usePapel();
  const { pessoaId } = useMinhaPessoa();

  const { data: departamentos = [] } = useQuery(consultas.departamentos());
  const { data: funcoes = [] } = useQuery(consultas.funcoes());
  const { data: pessoas = [] } = useQuery(consultas.pessoas());
  const { data: cultos = [] } = useQuery(consultas.cultos());
  const { data: escalas = [] } = useQuery(consultas.escalas());
  const { data: ajustes = [] } = useQuery(consultas.ajustesFuncao());

  const [alvo, setAlvo] = useState<{ cultoId: string; funcaoId: string } | null>(null);
  const [painelDe, setPainelDe] = useState<Culto | null>(null);
  const [mes, setMes] = useState(mesAtual);

  // Igual a Minha escala: a grade mostra do culto de hoje em diante, e so quem
  // escala pode olhar para tras — ai o mes volta a aparecer inteiro e da para
  // voltar aos meses anteriores.
  const [anteriores, setAnteriores] = useState(false);
  const verAnteriores = podeEscalar && anteriores;

  const mudarAnteriores = (ativo: boolean) => {
    setAnteriores(ativo);
    // Saindo dos anteriores, volta para um mes que ainda tem culto pela frente.
    if (!ativo) setMes((m) => (m < mesAtual() ? mesAtual() : m));
  };

  // Nos ultimos dias do mes, quando ja nao ha culto pela frente, a tela abre
  // direto no mes do proximo culto — e nao num mes vazio.
  const pulouMes = useRef(false);
  useEffect(() => {
    if (pulouMes.current || cultos.length === 0) return;
    pulouMes.current = true;
    const proximo = cultos.find((c) => c.data >= hoje())?.data.slice(0, 7);
    if (proximo) setMes((m) => (proximo > m ? proximo : m));
  }, [cultos]);

  const linhas = useMemo(
    () =>
      cultos.filter(
        // O culto de hoje fica na tela o dia inteiro, mesmo depois de acabar.
        (c) => c.data.slice(0, 7) === mes && (verAnteriores || c.data >= hoje()),
      ),
    [cultos, mes, verAnteriores],
  );

  const colunas = useMemo(
    () => (depto ? funcoes.filter((f) => f.departamento_id === depto) : funcoes),
    [funcoes, depto],
  );

  // O ministerio escolhido no menu. Sem ele, a grade mostra tudo.
  const deptoAtual = departamentos.find((d) => d.id === depto);

  const deptoDe = (funcaoId: string) => {
    const f = funcoes.find((x) => x.id === funcaoId);
    return departamentos.find((d) => d.id === f?.departamento_id);
  };

  const ativa = (culto: Culto, f: Funcao) => funcaoAtivaNoCulto(culto, f, departamentos, ajustes);

  const escaladosEm = (culto: Culto, f: Funcao) =>
    escalas.filter((e) => e.culto_id === culto.id && e.funcao_id === f.id);

  // Mesma regra de excluir em todo lugar: vem do hook, nao e reescrita aqui.
  const { excluir: excluirFuncao, adicionar: adicionarFuncao, ocupado } = useAjustarFuncao();

  return (
    <>
      <section className="rise mb-8 flex flex-wrap items-end justify-between gap-8">
        <div className="max-w-[46ch]">
          <h1 className="text-balance font-display text-5xl font-light leading-[1.02] tracking-tight">
            Escala
          </h1>
          {deptoAtual ? (
            <p className="label-mono mt-3 flex items-center gap-2">
              <span className={`size-2 rounded-full ${cor(deptoAtual.cor).dot}`} />
              {deptoAtual.nome}
            </p>
          ) : (
            <p className="label-mono mt-3">Todos os ministérios</p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {podeEscalar ? <BotaoAnteriores ativo={anteriores} onChange={mudarAnteriores} /> : null}
          <SeletorDeMes
            mes={mes}
            onChange={setMes}
            minimo={verAnteriores ? MES_MINIMO : mesAtual()}
          />
        </div>
      </section>

      <AtivarNotificacoes />

      {/* Celular: a grade vira lista. Com muitas funcoes, rolar a tabela de lado
          espreme os nomes ate ficarem ilegiveis — aqui cada culto e um cartao e
          o nome ocupa a largura toda. */}
      <section className="rise space-y-3 md:hidden" style={{ animationDelay: "120ms" }}>
        {linhas.length === 0 ? (
          <p className="rounded-xl border border-line bg-surface px-4 py-6 text-[13px] text-muted">
            {verAnteriores
              ? "Nenhum culto neste mês."
              : "Nenhum culto daqui para frente neste mês."}
          </p>
        ) : (
          linhas.map((culto) => {
            const doCulto = colunas
              .map((f) => ({
                funcao: f,
                vale: ativa(culto, f),
                atribuicoes: escaladosEm(culto, f),
              }))
              // Funcao fora deste culto some — a menos que ainda tenha gente
              // escalada nela; ai continua visivel para nada ficar escondido.
              .filter((item) => item.vale || item.atribuicoes.length > 0)
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
                    {doCulto.map(({ funcao: f, vale, atribuicoes }) => {
                      const c = cor(deptoDe(f.id)?.cor);
                      return (
                        <div key={f.id} className="flex flex-col gap-2 px-4 py-3">
                          <div className="flex items-center justify-between gap-2">
                            <span className="label-mono flex items-center gap-2">
                              <span className={`size-2 rounded-full ${c.dot}`} />
                              {f.nome}
                              {vale ? null : (
                                <span className="normal-case tracking-normal text-amber">
                                  · fora deste culto
                                </span>
                              )}
                            </span>
                            {podeEscalar && vale ? (
                              <button
                                onClick={() => excluirFuncao(culto, f)}
                                disabled={ocupado}
                                className="font-mono text-[11px] text-muted transition-colors hover:text-clay disabled:opacity-50"
                              >
                                Excluir
                              </button>
                            ) : null}
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5">
                            {atribuicoes.map((e) => (
                              <span
                                key={e.id}
                                title={e.pessoa_id === pessoaId ? "Você" : undefined}
                                className={`rounded-md px-2.5 py-1 text-[13px] ring-1 ${
                                  e.pessoa_id === pessoaId
                                    ? "bg-clay font-medium text-paper ring-clay"
                                    : "bg-surface2 ring-line"
                                }`}
                              >
                                {pessoas.find((x) => x.id === e.pessoa_id)?.nome ?? "—"}
                              </span>
                            ))}
                            {podeEscalar && vale ? (
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

                {/* Sempre visivel para quem ajusta, em qualquer ministerio. Antes so
                    aparecia quando havia algo a adicionar naquele ministerio — na
                    pagina da Base, onde tudo ja vale, o botao sumia. */}
                {podeEscalar ? (
                  <div className="border-t border-line px-4 py-3">
                    <button
                      onClick={() => setPainelDe(culto)}
                      className="w-full rounded-md border border-dashed border-line py-2 text-[13px] text-muted transition-colors hover:border-clay/50 hover:text-clay"
                    >
                      Funções deste culto
                    </button>
                  </div>
                ) : null}
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
                    {verAnteriores
                      ? "Nenhum culto neste mês."
                      : "Nenhum culto daqui para frente neste mês."}
                  </td>
                </tr>
              ) : (
                linhas.map((culto) => {
                  const ehHoje = culto.data === hoje();
                  return (
                    <tr key={culto.id} className="transition-colors hover:bg-surface2">
                      <td
                        className={`sticky left-0 z-10 bg-surface px-4 py-3 whitespace-nowrap ${ehHoje ? "text-clay" : ""}`}
                      >
                        <div className="font-medium">{dataCurta(culto.data)}</div>
                        <div className="font-mono text-[11px] text-muted">
                          {culto.titulo} · {hora(culto.horario)}
                        </div>
                        {podeEscalar ? (
                          <button
                            onClick={() => setPainelDe(culto)}
                            className="mt-1.5 font-mono text-[11px] text-muted underline-offset-2 transition-colors hover:text-clay hover:underline"
                          >
                            Funções deste culto
                          </button>
                        ) : null}
                      </td>
                      {colunas.map((f) => {
                        const atribuicoes = escaladosEm(culto, f);
                        const vale = ativa(culto, f);

                        // A tabela precisa de colunas fixas, mas nem toda funcao existe
                        // em todo culto. Celula de funcao ausente fica apagada; quem
                        // escala pode trazer a funcao de volta so para este dia.
                        if (!vale) {
                          return (
                            <td key={f.id} className="group bg-surface2/50 px-4 py-3 align-top">
                              <div className="flex flex-wrap items-center gap-1.5">
                                {atribuicoes.map((e) => (
                                  <span
                                    key={e.id}
                                    title="Escalado numa função que está fora deste culto"
                                    className="rounded-md bg-amber/10 px-2.5 py-1 text-[12px] whitespace-nowrap text-amber ring-1 ring-amber/25"
                                  >
                                    {pessoas.find((x) => x.id === e.pessoa_id)?.nome ?? "—"}
                                  </span>
                                ))}
                                {podeEscalar ? (
                                  <button
                                    onClick={() => adicionarFuncao(culto, f)}
                                    disabled={ocupado}
                                    className="rounded-md px-2 py-1 font-mono text-[11px] whitespace-nowrap text-muted opacity-0 transition-opacity group-hover:opacity-100 hover:text-clay focus:opacity-100"
                                  >
                                    + Adicionar
                                  </button>
                                ) : atribuicoes.length === 0 ? (
                                  <span className="font-mono text-[11px] text-muted/40">—</span>
                                ) : null}
                              </div>
                            </td>
                          );
                        }

                        return (
                          <td
                            key={f.id}
                            className={`group px-4 py-3 align-top ${ehHoje ? "bg-clay/5" : ""}`}
                          >
                            <div className="flex flex-wrap items-center gap-1.5">
                              {atribuicoes.map((e) => (
                                <span
                                  key={e.id}
                                  title={e.pessoa_id === pessoaId ? "Você" : undefined}
                                  className={`rounded-md px-2.5 py-1 text-[12px] whitespace-nowrap ring-1 ${
                                    e.pessoa_id === pessoaId
                                      ? "bg-clay font-medium text-paper ring-clay"
                                      : "bg-surface2 ring-line"
                                  }`}
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
                              {podeEscalar ? (
                                <button
                                  onClick={() => excluirFuncao(culto, f)}
                                  disabled={ocupado}
                                  title="Excluir esta função só deste culto"
                                  aria-label={`Excluir ${f.nome} deste culto`}
                                  className="rounded-md px-1.5 py-1 font-mono text-[11px] text-muted opacity-0 transition-opacity group-hover:opacity-100 hover:text-clay focus:opacity-100"
                                >
                                  Excluir
                                </button>
                              ) : null}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })
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

      {painelDe ? <FuncoesDoCultoModal culto={painelDe} onClose={() => setPainelDe(null)} /> : null}
    </>
  );
}
