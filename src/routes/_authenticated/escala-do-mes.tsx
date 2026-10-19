import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { consultas, cor, dataCurta, hoje, hora, juntar, mesAtual, rotuloMes } from "@/lib/dados";
import {
  escalaDaPessoa,
  pessoasDoMes,
  tabelasDoMes,
  type DadosDaEscala,
} from "@/lib/escala-do-mes";
import { pdfDaPessoa, pdfDoMes, prepararPdf } from "@/lib/pdf-escala";
import { exigirPodeEscalar } from "@/lib/guardas";
import { SeletorDeMes } from "@/components/SeletorDeMes";

export const Route = createFileRoute("/_authenticated/escala-do-mes")({
  beforeLoad: exigirPodeEscalar,

  head: () => ({
    meta: [
      { title: "Escala do mês · Escala de cultos" },
      {
        name: "description",
        content: "Todos os cultos do mês com os escalados de cada função, para exportar em PDF.",
      },
      { property: "og:title", content: "Escala do mês · Escala de cultos" },
      { property: "og:description", content: "A escala do mês inteiro, por ministério." },
    ],
  }),
  component: EscalaDoMesPage,
});

const TH =
  "font-mono text-[11px] font-medium tracking-[0.12em] uppercase text-ink bg-surface px-3 py-3 whitespace-nowrap shadow-[0_1px_0_0_var(--line)]";

const AVISO = "rounded-xl border border-line bg-surface px-4 py-6 text-[13px] text-muted";

function EscalaDoMesPage() {
  const { data: departamentos = [] } = useQuery(consultas.departamentos());
  const { data: funcoes = [] } = useQuery(consultas.funcoes());
  const { data: pessoas = [] } = useQuery(consultas.pessoas());
  const { data: cultos = [], isLoading: carregandoCultos } = useQuery(consultas.cultos());
  const { data: escalas = [], isLoading: carregandoEscalas } = useQuery(consultas.escalas());
  const { data: ajustes = [] } = useQuery(consultas.ajustesFuncao());

  const [mes, setMes] = useState(mesAtual);
  const [deptoId, setDeptoId] = useState("");
  const [pessoaId, setPessoaId] = useState("");
  const [exportando, setExportando] = useState(false);

  // Deixa o gerador de PDF pronto antes do clique.
  useEffect(() => {
    prepararPdf().catch(() => {});
  }, []);

  const dados: DadosDaEscala = useMemo(
    () => ({ mes, cultos, escalas, funcoes, departamentos, pessoas, ajustes }),
    [mes, cultos, escalas, funcoes, departamentos, pessoas, ajustes],
  );
  const depto = departamentos.find((d) => d.id === deptoId);
  const pessoa = pessoas.find((p) => p.id === pessoaId);

  // O ministerio escolhido vale para tudo: para a tabela, para a lista de
  // voluntarios e para a escala de uma pessoa — e o PDF sai igual a tela.
  const tabelas = useMemo(
    () => tabelasDoMes(dados).filter((t) => !deptoId || t.depto.id === deptoId),
    [dados, deptoId],
  );
  const escaladas = useMemo(() => pessoasDoMes(dados, deptoId || undefined), [dados, deptoId]);
  const daPessoa = useMemo(
    () => (pessoaId ? escalaDaPessoa(dados, pessoaId, deptoId || undefined) : []),
    [dados, pessoaId, deptoId],
  );

  // O filtro lista quem serve no mes. A pessoa escolhida continua na lista mesmo
  // num mes em que nao serve — senao o filtro "pularia" sozinho ao trocar de mes.
  const opcoes =
    pessoa && !escaladas.some((p) => p.id === pessoa.id)
      ? [...escaladas, pessoa].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
      : escaladas;

  const carregando = carregandoCultos || carregandoEscalas;
  const vazio = pessoa ? daPessoa.length === 0 : tabelas.length === 0;
  // "Midia · Outubro 2026" ou "Ana Souza · Outubro 2026 (Midia)" nos avisos.
  const noMes = `${rotuloMes(mes)}${depto ? ` (${depto.nome})` : ""}`;

  async function exportar() {
    setExportando(true);
    try {
      if (pessoa) await pdfDaPessoa(mes, pessoa.nome, daPessoa, depto);
      else await pdfDoMes(mes, tabelas);
    } catch {
      toast.error("Não foi possível gerar o PDF.", {
        description: "Confira a internet e tente de novo.",
      });
    } finally {
      setExportando(false);
    }
  }

  return (
    <>
      <section className="rise mb-8 flex flex-wrap items-end justify-between gap-8">
        <div className="max-w-[46ch]">
          <h1 className="text-balance font-display text-5xl font-light leading-[1.02] tracking-tight">
            Escala do mês
          </h1>
          <p className="label-mono mt-3 flex items-center gap-2">
            {depto ? <span className={`size-2 rounded-full ${cor(depto.cor).dot}`} /> : null}
            {[depto?.nome ?? "Todos os ministérios", pessoa?.nome].filter(Boolean).join(" · ")}
          </p>
        </div>
        <SeletorDeMes mes={mes} onChange={setMes} />
      </section>

      <section
        className="rise mb-6 flex flex-wrap items-end gap-3 text-[13px]"
        style={{ animationDelay: "60ms" }}
      >
        <label className="min-w-[160px] flex-1 sm:flex-none">
          <span className="label-mono">Ministério</span>
          <select
            value={deptoId}
            onChange={(e) => setDeptoId(e.target.value)}
            className="mt-1.5 block w-full rounded-md border border-line bg-surface2 px-3 py-2 text-ink outline-none focus:border-clay/50 sm:w-48"
          >
            <option value="">Todos os ministérios</option>
            {departamentos.map((d) => (
              <option key={d.id} value={d.id}>
                {d.nome}
              </option>
            ))}
          </select>
        </label>
        <label className="min-w-[200px] flex-1 sm:flex-none">
          <span className="label-mono">Voluntário</span>
          <select
            value={pessoaId}
            onChange={(e) => setPessoaId(e.target.value)}
            className="mt-1.5 block w-full rounded-md border border-line bg-surface2 px-3 py-2 text-ink outline-none focus:border-clay/50 sm:w-64"
          >
            <option value="">Todos os voluntários</option>
            {opcoes.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
              </option>
            ))}
          </select>
        </label>
        <button
          onClick={exportar}
          disabled={carregando || vazio || exportando}
          className="rounded-md border border-clay/40 px-4 py-2 font-medium text-clay transition-colors hover:bg-clay/10 disabled:opacity-50"
        >
          {exportando ? "Gerando PDF…" : "Exportar como PDF"}
        </button>
      </section>

      {carregando ? (
        <p className={AVISO}>Carregando…</p>
      ) : pessoa ? (
        <section className="rise" style={{ animationDelay: "120ms" }}>
          {daPessoa.length === 0 ? (
            <p className={AVISO}>
              {pessoa.nome} não está escalado(a) em {noMes}.
            </p>
          ) : (
            <>
              <div className="overflow-hidden rounded-xl border border-line bg-surface">
                <table className="w-full border-collapse text-[13px]">
                  <thead>
                    <tr className="text-left">
                      <th className={TH}>Data</th>
                      <th className={TH}>Culto</th>
                      <th className={TH}>Função</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {daPessoa.map(({ culto, funcoes: suas }) => {
                      const ehHoje = culto.data === hoje();
                      return (
                        <tr key={culto.id} className={ehHoje ? "bg-clay/5" : ""}>
                          <td
                            className={`px-3 py-3 align-top font-medium whitespace-nowrap ${
                              ehHoje ? "text-clay" : ""
                            }`}
                          >
                            {dataCurta(culto.data)}
                          </td>
                          <td className="px-3 py-3 align-top">
                            {culto.titulo}
                            <div className="font-mono text-[11px] text-muted">
                              {hora(culto.horario)}
                            </div>
                          </td>
                          <td className="px-3 py-3 align-top">{juntar(suas)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="mt-3 font-mono text-[11px] text-muted">
                {daPessoa.length} {daPessoa.length === 1 ? "culto" : "cultos"} em {noMes}
              </p>
            </>
          )}
        </section>
      ) : tabelas.length === 0 ? (
        <p className={AVISO}>Ninguém escalado em {noMes} ainda.</p>
      ) : (
        <div className="rise space-y-8" style={{ animationDelay: "120ms" }}>
          {tabelas.map((t) => (
            <section key={t.depto.id}>
              <h2 className="label-mono mb-3 flex items-center gap-2">
                <span className={`size-2 rounded-full ${cor(t.depto.cor).dot}`} />
                {t.depto.nome}
              </h2>
              <div className="overflow-hidden rounded-xl border border-line bg-surface">
                <div className="overflow-x-auto [scrollbar-width:auto]">
                  <table className="w-max min-w-full border-collapse text-[12px]">
                    <thead>
                      <tr className="text-left">
                        <th className={`${TH} sticky left-0 z-10`}>Culto</th>
                        {t.funcoes.map((f) => (
                          <th key={f.id} className={`${TH} text-center`}>
                            {f.nome}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {t.linhas.map(({ culto, celulas }) => {
                        const ehHoje = culto.data === hoje();
                        return (
                          <tr key={culto.id}>
                            {/* No celular o titulo quebra em duas linhas: com a coluna
                                fixa estreita, sobra tela para rolar as funcoes. */}
                            <td
                              className={`sticky left-0 z-10 w-36 min-w-36 bg-surface px-3 py-2.5 align-top sm:w-auto sm:whitespace-nowrap ${
                                ehHoje ? "text-clay" : ""
                              }`}
                            >
                              <div className="font-medium">{dataCurta(culto.data)}</div>
                              <div className="font-mono text-[11px] leading-snug text-muted">
                                {culto.titulo} · {hora(culto.horario)}
                              </div>
                            </td>
                            {celulas.map((celula, i) => (
                              <td
                                key={t.funcoes[i]!.id}
                                className={`px-3 py-2.5 text-center align-middle ${
                                  !celula.vale && celula.nomes.length === 0 ? "bg-surface2/50" : ""
                                } ${ehHoje ? "bg-clay/5" : ""}`}
                              >
                                {celula.nomes.length > 0 ? (
                                  <div
                                    className={`flex flex-col items-center gap-0.5 ${
                                      celula.vale ? "" : "text-amber"
                                    }`}
                                  >
                                    {celula.nomes.map((n, j) => (
                                      <span key={`${n}-${j}`} className="whitespace-nowrap">
                                        {n}
                                      </span>
                                    ))}
                                  </div>
                                ) : celula.vale ? (
                                  <span className="text-muted/50">—</span>
                                ) : null}
                              </td>
                            ))}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          ))}
          <p className="font-mono text-[11px] text-muted">
            — função ainda sem ninguém · cinza: função que não faz parte daquele culto
          </p>
        </div>
      )}
    </>
  );
}
