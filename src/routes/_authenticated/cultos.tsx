import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import {
  consultas,
  cor,
  dataLonga,
  gerarRecorrentes,
  hoje,
  hora,
  MODELOS_RECORRENTES,
} from "@/lib/dados";

export const Route = createFileRoute("/_authenticated/cultos")({
  head: () => ({
    meta: [
      { title: "Cultos · Escala de cultos" },
      {
        name: "description",
        content: "Agenda dos cultos com título, data, horário e quem já está escalado em cada um.",
      },
      { property: "og:title", content: "Cultos · Escala de cultos" },
      { property: "og:description", content: "Agenda dos cultos e escalados de cada um." },
    ],
  }),
  component: CultosPage,
});

function CultosPage() {
  const qc = useQueryClient();
  const { data: cultos = [] } = useQuery(consultas.cultos());
  const { data: escalas = [] } = useQuery(consultas.escalas());
  const { data: pessoas = [] } = useQuery(consultas.pessoas());
  const { data: funcoes = [] } = useQuery(consultas.funcoes());
  const { data: departamentos = [] } = useQuery(consultas.departamentos());

  const [form, setForm] = useState({ titulo: "", data: hoje(), horario: "19:00" });

  const criar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("cultos").insert(form);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cultos"] });
      setForm({ titulo: "", data: hoje(), horario: "19:00" });
      toast.success("Culto criado.");
    },
    onError: () => toast.error("Não foi possível criar o culto."),
  });

  const excluir = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("cultos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries();
      toast.success("Culto removido.");
    },
  });

  return (
    <>
      <section className="rise mb-8">
        <h1 className="font-display text-4xl font-light tracking-tight">Próximos cultos</h1>
        <p className="label-mono mt-3">{cultos.length} cultos na agenda</p>
      </section>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          criar.mutate();
        }}
        className="rise mb-8 flex flex-wrap items-end gap-3 rounded-xl border border-line bg-surface p-5 text-[13px]"
        style={{ animationDelay: "120ms" }}
      >
        <label className="min-w-[200px] flex-1">
          <span className="label-mono">Título</span>
          <input
            required
            value={form.titulo}
            onChange={(e) => setForm({ ...form, titulo: e.target.value })}
            placeholder="Culto de Celebração"
            className="mt-1.5 w-full rounded-md border border-line bg-surface2 px-3 py-2 text-ink outline-none focus:border-clay/50"
          />
        </label>
        <label>
          <span className="label-mono">Data</span>
          <input
            type="date"
            required
            value={form.data}
            onChange={(e) => setForm({ ...form, data: e.target.value })}
            className="mt-1.5 rounded-md border border-line bg-surface2 px-3 py-2 text-ink outline-none focus:border-clay/50"
          />
        </label>
        <label>
          <span className="label-mono">Horário</span>
          <input
            type="time"
            required
            value={form.horario}
            onChange={(e) => setForm({ ...form, horario: e.target.value })}
            className="mt-1.5 rounded-md border border-line bg-surface2 px-3 py-2 text-ink outline-none focus:border-clay/50"
          />
        </label>
        <button
          type="submit"
          className="rounded-md bg-clay px-4 py-2 font-medium text-paper transition-colors hover:bg-clay/85"
        >
          Adicionar culto
        </button>
      </form>

      <section className="rise space-y-3" style={{ animationDelay: "180ms" }}>
        {cultos.map((c) => {
          const doCulto = escalas.filter((e) => e.culto_id === c.id);
          return (
            <div key={c.id} className="rounded-xl border border-line bg-surface p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <div>
                  <h2 className="font-display text-xl font-medium">{c.titulo}</h2>
                  <p className="label-mono mt-1">
                    {dataLonga(c.data)} · {hora(c.horario)}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <span className="font-mono text-[11px] text-muted">
                    {doCulto.length} escalados
                  </span>
                  <button
                    onClick={() => excluir.mutate(c.id)}
                    className="font-mono text-[11px] text-muted transition-colors hover:text-clay"
                  >
                    Excluir
                  </button>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {doCulto.length === 0 ? (
                  <span className="text-[13px] text-muted">Ninguém escalado ainda.</span>
                ) : (
                  doCulto.map((e) => {
                    const f = funcoes.find((x) => x.id === e.funcao_id);
                    const d = departamentos.find((x) => x.id === f?.departamento_id);
                    return (
                      <span
                        key={e.id}
                        className={`rounded-full px-2.5 py-1 text-[11px] ring-1 ${cor(d?.cor).chip}`}
                      >
                        {pessoas.find((p) => p.id === e.pessoa_id)?.nome} · {f?.nome}
                      </span>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </section>
    </>
  );
}
