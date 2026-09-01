import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { consultas, cor, dataCurta, hoje, hora } from "@/lib/dados";

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

function EscalaPage() {
  const { depto } = Route.useSearch();
  const navigate = Route.useNavigate();
  const qc = useQueryClient();

  const { data: departamentos = [] } = useQuery(consultas.departamentos());
  const { data: funcoes = [] } = useQuery(consultas.funcoes());
  const { data: pessoas = [] } = useQuery(consultas.pessoas());
  const { data: pessoaFuncoes = [] } = useQuery(consultas.pessoaFuncoes());
  const { data: cultos = [] } = useQuery(consultas.cultos());
  const { data: escalas = [] } = useQuery(consultas.escalas());

  const [alvo, setAlvo] = useState<{ cultoId: string; funcaoId: string } | null>(null);

  const proximos = useMemo(() => cultos.filter((c) => c.data >= hoje()).slice(0, 5), [cultos]);
  const linhas = useMemo(
    () => (depto ? funcoes.filter((f) => f.departamento_id === depto) : funcoes),
    [funcoes, depto],
  );

  const deptoDe = (funcaoId: string) => {
    const f = funcoes.find((x) => x.id === funcaoId);
    return departamentos.find((d) => d.id === f?.departamento_id);
  };

  const atribuir = useMutation({
    mutationFn: async ({ pessoaId }: { pessoaId: string }) => {
      if (!alvo) return;
      const { error } = await supabase.from("escalas").insert({
        culto_id: alvo.cultoId,
        funcao_id: alvo.funcaoId,
        pessoa_id: pessoaId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["escalas"] });
      toast.success("Voluntário escalado.");
    },
    onError: () => toast.error("Não foi possível escalar."),
  });

  const remover = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("escalas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["escalas"] });
      toast.success("Atribuição removida.");
    },
  });

  const totalEscalados = escalas.filter((e) =>
    proximos.some((c) => c.id === e.culto_id),
  ).length;
  const vazios = proximos.length * linhas.length - totalEscalados;

  const jaEscalados = alvo
    ? escalas.filter((e) => e.culto_id === alvo.cultoId && e.funcao_id === alvo.funcaoId)
    : [];

  const candidatos = alvo
    ? pessoas.filter((p) =>
        pessoaFuncoes.some((pf) => pf.pessoa_id === p.id && pf.funcao_id === alvo.funcaoId),
      )
    : [];

  return (
    <>
      <section className="rise mb-8 flex flex-wrap items-end justify-between gap-8">
        <div className="max-w-[46ch]">
          <h1 className="text-balance font-display text-5xl font-light leading-[1.02] tracking-tight">
            Grade de <span className="font-medium italic text-clay">cultos</span> por função
          </h1>
          <p className="label-mono mt-3">
            {proximos.length} cultos à frente · {pessoas.length} voluntários ativos
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
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
          <span className="rounded-full border border-line px-3 py-1 font-mono text-[11px] text-clay">
            Faltas · {Math.max(vazios, 0)}
          </span>
        </div>
      </section>

      <section
        className="rise overflow-hidden rounded-xl border border-line bg-surface"
        style={{ animationDelay: "120ms" }}
      >
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="text-left">
                <th className="label-mono sticky left-0 z-10 bg-surface px-4 py-3">Função</th>
                {proximos.map((c) => (
                  <th key={c.id} className="label-mono px-4 py-3 whitespace-nowrap">
                    <span className={c.data === hoje() ? "text-clay" : undefined}>
                      {dataCurta(c.data)}
                    </span>{" "}
                    · {hora(c.horario)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {linhas.map((f) => {
                const d = deptoDe(f.id);
                const c = cor(d?.cor);
                return (
                  <tr key={f.id} className="transition-colors hover:bg-surface2">
                    <td className="sticky left-0 z-10 bg-surface px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className={`size-2 rounded-full ${c.dot}`} />
                        <span className="font-medium">{f.nome}</span>
                      </div>
                    </td>
                    {proximos.map((culto) => {
                      const atribuicoes = escalas.filter(
                        (e) => e.culto_id === culto.id && e.funcao_id === f.id,
                      );
                      return (
                        <td
                          key={culto.id}
                          className={`px-4 py-3 ${culto.data === hoje() ? "bg-clay/5" : ""}`}
                        >
                          <div className="flex flex-wrap items-center gap-1.5">
                            {atribuicoes.map((e) => {
                              const p = pessoas.find((x) => x.id === e.pessoa_id);
                              return (
                                <button
                                  key={e.id}
                                  onClick={() => remover.mutate(e.id)}
                                  title="Remover da escala"
                                  className="rounded-md bg-surface2 px-2.5 py-1 text-[12px] ring-1 ring-line transition-colors hover:text-clay"
                                >
                                  {p?.nome ?? "—"}
                                </button>
                              );
                            })}
                            <button
                              onClick={() => setAlvo({ cultoId: culto.id, funcaoId: f.id })}
                              className="rounded-md border border-dashed border-line px-2.5 py-1 text-[12px] text-muted transition-colors hover:border-clay/50 hover:text-clay"
                            >
                              {atribuicoes.length > 0 ? "+ Adicionar" : "Atribuir"}
                            </button>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {alvo ? (
        <div className="fixed inset-0 z-50 grid place-items-center p-4">
          <div className="absolute inset-0 bg-paper/70" onClick={() => setAlvo(null)} />
          <div className="rise relative w-full max-w-sm rounded-xl border border-line bg-surface p-5">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-display text-lg font-medium">Atribuir voluntário</h3>
              <span className="label-mono">
                {dataCurta(cultos.find((c) => c.id === alvo.cultoId)?.data ?? hoje())}
              </span>
            </div>
            <div className="space-y-4 text-[13px]">
              <div>
                <span className="label-mono">Função</span>
                <div className="mt-1.5 flex items-center gap-2 rounded-md border border-clay/40 bg-clay/5 px-3 py-2">
                  <span className={`size-2 rounded-full ${cor(deptoDe(alvo.funcaoId)?.cor).dot}`} />
                  {funcoes.find((f) => f.id === alvo.funcaoId)?.nome} ·{" "}
                  <span className="text-clay">{deptoDe(alvo.funcaoId)?.nome}</span>
                </div>
              </div>
              <div>
                <span className="label-mono">
                  Voluntários com esta função · {jaEscalados.length} selecionados
                </span>
                <div className="mt-1.5 space-y-1">
                  {candidatos.length === 0 ? (
                    <p className="text-muted">
                      Nenhum voluntário cadastrado nesta função ainda.
                    </p>
                  ) : (
                    candidatos.map((p) => {
                      const atual = jaEscalados.find((e) => e.pessoa_id === p.id);
                      return (
                        <button
                          key={p.id}
                          onClick={() =>
                            atual
                              ? remover.mutate(atual.id)
                              : atribuir.mutate({ pessoaId: p.id })
                          }
                          className={`flex w-full items-center justify-between rounded-md border px-3 py-2 text-left transition-colors ${
                            atual
                              ? "border-clay/50 bg-clay/10"
                              : "border-line bg-surface2 hover:border-clay/50"
                          }`}
                        >
                          <span className="flex items-center gap-2">
                            <span
                              className={`grid size-4 place-items-center rounded-[4px] border text-[10px] ${
                                atual ? "border-clay bg-clay text-paper" : "border-line"
                              }`}
                            >
                              {atual ? "✓" : ""}
                            </span>
                            {p.nome}
                          </span>
                          <span className="font-mono text-[11px] text-muted">
                            {pessoaFuncoes.filter((pf) => pf.pessoa_id === p.id).length} funções
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-md bg-surface2 px-3 py-2">
                <span className="size-1.5 rounded-full bg-olive" />
                <span className="font-mono text-[11px] text-muted">
                  E-mail de aviso enviado na manhã do culto
                </span>
              </div>
              <button
                onClick={() => setAlvo(null)}
                className="w-full rounded-md border border-line py-2 text-[13px] text-muted transition-colors hover:text-ink"
              >
                Concluir
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
