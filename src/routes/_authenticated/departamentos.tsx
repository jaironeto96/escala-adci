import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { consultas, cor, CORES_DISPONIVEIS } from "@/lib/dados";
import { usePapel } from "@/hooks/usePapel";

export const Route = createFileRoute("/_authenticated/departamentos")({
  head: () => ({
    meta: [
      { title: "Departamentos · Escala de cultos" },
      {
        name: "description",
        content: "Departamentos e funções da igreja usados para montar as escalas dos cultos.",
      },
      { property: "og:title", content: "Departamentos · Escala de cultos" },
      { property: "og:description", content: "Departamentos e funções usados nas escalas." },
    ],
  }),
  component: DepartamentosPage,
});

function DepartamentosPage() {
  const qc = useQueryClient();
  const { ehAdmin } = usePapel();
  const { data: departamentos = [] } = useQuery(consultas.departamentos());
  const { data: funcoes = [] } = useQuery(consultas.funcoes());
  const { data: pessoaDeptos = [] } = useQuery(consultas.pessoaDepartamentos());

  const [novo, setNovo] = useState({ nome: "", cor: "clay" });
  const [novaFuncao, setNovaFuncao] = useState<Record<string, string>>({});

  const criarDepto = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("departamentos").insert(novo);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["departamentos"] });
      setNovo({ nome: "", cor: "clay" });
      toast.success("Departamento criado.");
    },
    onError: () => toast.error("Não foi possível criar o departamento."),
  });

  const criarFuncao = useMutation({
    mutationFn: async ({ deptoId, nome }: { deptoId: string; nome: string }) => {
      const { error } = await supabase
        .from("funcoes")
        .insert({ departamento_id: deptoId, nome });
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["funcoes"] });
      setNovaFuncao((s) => ({ ...s, [v.deptoId]: "" }));
      toast.success("Função criada.");
    },
    onError: () => toast.error("Não foi possível criar a função."),
  });

  const excluirFuncao = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("funcoes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries(),
  });

  const excluirDepto = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("departamentos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries(),
  });

  return (
    <>
      <section className="rise mb-8">
        <h1 className="font-display text-4xl font-light tracking-tight">Departamentos</h1>
        <p className="label-mono mt-3">
          {departamentos.length} departamentos · {funcoes.length} funções
        </p>
      </section>

      {ehAdmin ? (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          criarDepto.mutate();
        }}
        className="rise mb-8 flex flex-wrap items-end gap-3 rounded-xl border border-line bg-surface p-5 text-[13px]"
        style={{ animationDelay: "120ms" }}
      >
        <label className="min-w-[200px] flex-1">
          <span className="label-mono">Novo departamento</span>
          <input
            required
            value={novo.nome}
            onChange={(e) => setNovo({ ...novo, nome: e.target.value })}
            placeholder="Intercessão"
            className="mt-1.5 w-full rounded-md border border-line bg-surface2 px-3 py-2 text-ink outline-none focus:border-clay/50"
          />
        </label>
        <div>
          <span className="label-mono">Cor</span>
          <div className="mt-1.5 flex gap-1.5">
            {CORES_DISPONIVEIS.map((c) => (
              <button
                type="button"
                key={c}
                onClick={() => setNovo({ ...novo, cor: c })}
                className={`size-7 rounded-full ${cor(c).dot} ${novo.cor === c ? "ring-2 ring-ink/40" : "opacity-60"}`}
                aria-label={c}
              />
            ))}
          </div>
        </div>
        <button
          type="submit"
          className="rounded-md bg-clay px-4 py-2 font-medium text-paper transition-colors hover:bg-clay/85"
        >
          Adicionar
        </button>
      </form>

      <section className="rise grid gap-3 md:grid-cols-2" style={{ animationDelay: "180ms" }}>
        {departamentos.map((d) => {
          const c = cor(d.cor);
          const doDepto = funcoes.filter((f) => f.departamento_id === d.id);
          return (
            <div key={d.id} className="rounded-xl border border-line bg-surface p-5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="flex items-center gap-2 font-display text-xl font-medium">
                  <span className={`size-2.5 rounded-full ${c.dot}`} />
                  {d.nome}
                </h2>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-[11px] text-muted">
                    {pessoaDeptos.filter((p) => p.departamento_id === d.id).length} pessoas
                  </span>
                  <button
                    onClick={() => excluirDepto.mutate(d.id)}
                    className="font-mono text-[11px] text-muted transition-colors hover:text-clay"
                  >
                    Excluir
                  </button>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-1.5">
                {doDepto.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => excluirFuncao.mutate(f.id)}
                    title="Remover função"
                    className={`rounded-full px-2.5 py-1 text-[11px] ring-1 transition-colors hover:opacity-70 ${c.chip}`}
                  >
                    {f.nome}
                  </button>
                ))}
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const nome = (novaFuncao[d.id] ?? "").trim();
                  if (nome) criarFuncao.mutate({ deptoId: d.id, nome });
                }}
                className="mt-4 flex gap-2 text-[13px]"
              >
                <input
                  value={novaFuncao[d.id] ?? ""}
                  onChange={(e) => setNovaFuncao((s) => ({ ...s, [d.id]: e.target.value }))}
                  placeholder="Nova função"
                  className="flex-1 rounded-md border border-line bg-surface2 px-3 py-2 text-ink outline-none focus:border-clay/50"
                />
                <button
                  type="submit"
                  className="rounded-md border border-line px-3 py-2 text-muted transition-colors hover:text-ink"
                >
                  Adicionar
                </button>
              </form>
            </div>
          );
        })}
      </section>
    </>
  );
}
