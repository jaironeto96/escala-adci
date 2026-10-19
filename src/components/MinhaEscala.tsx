import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronRight } from "lucide-react";

import {
  consultas,
  cor,
  dataCurta,
  hoje,
  hora,
  juntar,
  rotuloMes,
  type Culto,
  type Departamento,
  type Escala,
  type Funcao,
} from "@/lib/dados";
import { usePapel } from "@/hooks/usePapel";
import { useMinhaPessoa } from "@/hooks/useMinhaPessoa";
import { AtivarNotificacoes } from "@/components/AtivarNotificacoes";

// Visao pessoal de quem esta logado: os cultos em que a pessoa serve, e, num toque,
// quem vai servir junto. Nao e grade de funcoes nem tem botao de escalar — e so
// consulta, igual para todos os papeis. Por isso o mesmo cartao serve no celular
// e no computador.
export function MinhaEscala({ dia }: { dia?: string | undefined }) {
  const { podeEscalar } = usePapel();
  const { pessoaId, carregando: carregandoPessoa } = useMinhaPessoa();

  const { data: departamentos = [] } = useQuery(consultas.departamentos());
  const { data: funcoes = [] } = useQuery(consultas.funcoes());
  const { data: pessoas = [] } = useQuery(consultas.pessoas());
  const { data: cultos = [], isLoading: carregandoCultos } = useQuery(consultas.cultos());
  const { data: escalas = [], isLoading: carregandoEscalas } = useQuery(consultas.escalas());

  // O voluntario ve do culto de hoje em diante. Quem escala pode olhar para tras.
  const [anteriores, setAnteriores] = useState(false);
  const verAnteriores = podeEscalar && anteriores;

  // Vindo da notificacao, o culto do dia precisa estar na tela.
  useEffect(() => {
    if (dia) setAnteriores(false);
  }, [dia]);

  // A equipe sai agrupada por ministerio e, dentro dele, na ordem das funcoes do
  // app (Video, Audio, Som...) — a mesma em todo cartao. O sort e estavel: so
  // agrupa por ministerio, sem desfazer a ordem que ja vem da consulta.
  const ordemDe = useMemo(() => {
    const deptoDe = (f: Funcao) =>
      departamentos.find((d) => d.id === f.departamento_id)?.nome ?? "";
    const ordenadas = [...funcoes].sort((a, b) => deptoDe(a).localeCompare(deptoDe(b), "pt-BR"));
    return new Map(ordenadas.map((f, i) => [f.id, i]));
  }, [funcoes, departamentos]);

  const porMes = useMemo(() => {
    if (!pessoaId) return [];
    const meus = new Set(escalas.filter((e) => e.pessoa_id === pessoaId).map((e) => e.culto_id));
    const hj = hoje();
    // O culto de hoje fica entre os proximos o dia inteiro, mesmo depois de acabar.
    const lista = cultos.filter(
      (c) => meus.has(c.id) && (verAnteriores ? c.data < hj : c.data >= hj),
    );
    // Os cultos chegam em ordem de data; os anteriores, do mais recente para tras.
    if (verAnteriores) lista.reverse();

    // O cartao diz "Dom 04", sem o mes — o titulo do grupo diz qual e.
    const grupos: { mes: string; cultos: Culto[] }[] = [];
    for (const c of lista) {
      const mes = c.data.slice(0, 7);
      const ultimo = grupos[grupos.length - 1];
      if (ultimo?.mes === mes) ultimo.cultos.push(c);
      else grupos.push({ mes, cultos: [c] });
    }
    return grupos;
  }, [cultos, escalas, pessoaId, verAnteriores]);

  // Vindo da notificacao, rola ate o culto do dia e o destaca.
  const rolouPara = useRef<string | null>(null);
  useEffect(() => {
    if (!dia || rolouPara.current === dia) return;
    const alvo = document.querySelector<HTMLElement>(`[data-culto-dia="${dia}"]`);
    if (!alvo) return;
    rolouPara.current = dia;
    requestAnimationFrame(() => alvo.scrollIntoView({ behavior: "smooth", block: "center" }));
  });

  const funcao = (id: string) => funcoes.find((f) => f.id === id);
  const nome = (id: string) => pessoas.find((p) => p.id === id)?.nome ?? "—";
  const naOrdem = (lista: Escala[]) =>
    [...lista].sort(
      (a, b) =>
        (ordemDe.get(a.funcao_id) ?? 999) - (ordemDe.get(b.funcao_id) ?? 999) ||
        nome(a.pessoa_id).localeCompare(nome(b.pessoa_id), "pt-BR"),
    );

  const carregando = carregandoPessoa || carregandoCultos || carregandoEscalas;

  return (
    <>
      <section className="rise mb-8 flex flex-wrap items-end justify-between gap-8">
        <div className="max-w-[46ch]">
          <h1 className="text-balance font-display text-5xl font-light leading-[1.02] tracking-tight">
            Escala
          </h1>
          <p className="label-mono mt-3">
            {verAnteriores ? "Minha escala · cultos anteriores" : "Minha escala"}
          </p>
        </div>
        {podeEscalar ? (
          <button
            onClick={() => setAnteriores((v) => !v)}
            aria-pressed={anteriores}
            className="rounded-full border border-line px-3 py-1 font-mono text-[11px] text-muted transition-colors hover:text-ink aria-pressed:bg-surface2 aria-pressed:text-ink"
          >
            {anteriores ? "Voltar aos próximos" : "Cultos anteriores"}
          </button>
        ) : null}
      </section>

      <AtivarNotificacoes />

      <div className="rise space-y-8" style={{ animationDelay: "120ms" }}>
        {carregando ? (
          <p className="rounded-xl border border-line bg-surface px-4 py-6 text-[13px] text-muted">
            Carregando…
          </p>
        ) : !pessoaId ? (
          <p className="rounded-xl border border-line bg-surface px-4 py-6 text-[13px] text-muted">
            Seu e-mail ainda não está no cadastro de voluntários. Peça para a liderança do seu
            ministério cadastrar.
          </p>
        ) : porMes.length === 0 ? (
          <p className="rounded-xl border border-line bg-surface px-4 py-6 text-[13px] text-muted">
            {verAnteriores
              ? "Nenhum culto anterior com você escalado(a)."
              : "Você não está escalado(a) em nenhum culto daqui para frente."}
          </p>
        ) : (
          porMes.map((grupo) => (
            <section key={grupo.mes}>
              <h2 className="label-mono mb-3">{rotuloMes(grupo.mes)}</h2>
              {/* items-start: abrir a equipe de um cartao nao estica o vizinho. */}
              <div className="grid items-start gap-3 md:grid-cols-2 xl:grid-cols-3">
                {grupo.cultos.map((culto) => {
                  const doCulto = escalas.filter((e) => e.culto_id === culto.id);

                  // As funcoes da pessoa viram uma frase — ela nao precisa ler o
                  // proprio nome no meio da equipe.
                  const minhasFuncoes = [
                    ...new Set(
                      naOrdem(doCulto.filter((e) => e.pessoa_id === pessoaId))
                        .map((e) => funcao(e.funcao_id)?.nome)
                        .filter((n): n is string => !!n),
                    ),
                  ];

                  const equipe: { funcao: Funcao; nomes: string[] }[] = [];
                  for (const e of naOrdem(doCulto.filter((e) => e.pessoa_id !== pessoaId))) {
                    const f = funcao(e.funcao_id);
                    if (!f) continue;
                    const ultima = equipe[equipe.length - 1];
                    if (ultima?.funcao.id === f.id) ultima.nomes.push(nome(e.pessoa_id));
                    else equipe.push({ funcao: f, nomes: [nome(e.pessoa_id)] });
                  }

                  return (
                    <CartaoDoCulto
                      key={culto.id}
                      culto={culto}
                      destacado={culto.data === dia}
                      minhasFuncoes={minhasFuncoes}
                      equipe={equipe}
                      departamentos={departamentos}
                    />
                  );
                })}
              </div>
            </section>
          ))
        )}
      </div>
    </>
  );
}

type Props = {
  culto: Culto;
  /** Culto que veio do toque na notificacao. */
  destacado: boolean;
  minhasFuncoes: string[];
  equipe: { funcao: Funcao; nomes: string[] }[];
  departamentos: Departamento[];
};

// Um culto da pessoa. Fechado, mostra so a propria escala; o "›" de "Com voce neste
// culto" abre a equipe. Cada cartao abre e fecha sozinho.
function CartaoDoCulto({ culto, destacado, minhasFuncoes, equipe, departamentos }: Props) {
  const [aberto, setAberto] = useState(false);
  const ehHoje = culto.data === hoje();
  const pessoasNaEquipe = new Set(equipe.flatMap((e) => e.nomes)).size;

  return (
    <article
      data-culto-dia={culto.data}
      className={`overflow-hidden rounded-xl border bg-surface ${
        ehHoje ? "border-clay/40" : "border-line"
      } ${destacado ? "ring-2 ring-clay/60" : ""}`}
    >
      <header
        className={`flex flex-col gap-0.5 border-b border-line px-4 py-3 ${ehHoje ? "bg-clay/5" : ""}`}
      >
        <span className={`font-medium ${ehHoje ? "text-clay" : ""}`}>
          {dataCurta(culto.data)}
          {ehHoje ? <span className="ml-2 font-mono text-[11px] font-normal">hoje</span> : null}
        </span>
        <span className="font-mono text-[11px] text-muted">
          {culto.titulo} · {hora(culto.horario)}
        </span>
      </header>

      <p className="border-b border-line bg-clay/10 px-4 py-3 text-[14px] leading-snug">
        Você está escalado(a) para:{" "}
        <strong className="font-medium text-clay">{juntar(minhasFuncoes)}</strong>
      </p>

      {equipe.length === 0 ? (
        <p className="px-4 py-3 font-mono text-[11px] text-muted">
          Ninguém mais escalado neste culto ainda.
        </p>
      ) : (
        <>
          <button
            onClick={() => setAberto((v) => !v)}
            aria-expanded={aberto}
            aria-controls={`equipe-${culto.id}`}
            className="flex w-full items-center gap-2 px-4 py-3 text-left text-[13px] text-muted transition-colors hover:text-ink"
          >
            <ChevronRight
              aria-hidden="true"
              className={`size-4 shrink-0 transition-transform ${aberto ? "rotate-90" : ""}`}
            />
            Com você neste culto
            <span className="ml-auto font-mono text-[11px]">
              {pessoasNaEquipe} {pessoasNaEquipe === 1 ? "pessoa" : "pessoas"}
            </span>
          </button>
          {aberto ? (
            <div id={`equipe-${culto.id}`} className="divide-y divide-line border-t border-line">
              {equipe.map(({ funcao: f, nomes }) => {
                const c = cor(departamentos.find((d) => d.id === f.departamento_id)?.cor);
                return (
                  <div key={f.id} className="flex flex-col gap-2 px-4 py-3">
                    <span className="label-mono flex items-center gap-2">
                      <span className={`size-2 rounded-full ${c.dot}`} />
                      {f.nome}
                    </span>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {nomes.map((n, i) => (
                        <span
                          key={`${n}-${i}`}
                          className="rounded-md bg-surface2 px-2.5 py-1 text-[13px] ring-1 ring-line"
                        >
                          {n}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}
        </>
      )}
    </article>
  );
}
