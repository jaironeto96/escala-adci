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
import { usePapel } from "@/hooks/usePapel";

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
  const { ehAdmin } = usePapel();
  const { data: cultos = [] } = useQuery(consultas.cultos());
  const { data: escalas = [] } = useQuery(consultas.escalas());
  const { data: pessoas = [] } = useQuery(consultas.pessoas());
  const { data: funcoes = [] } = useQuery(consultas.funcoes());
  const { data: departamentos = [] } = useQuery(consultas.departamentos());

  const [form, setForm] = useState({ titulo: "", data: hoje(), horario: "19:00" });
  const [semanas, setSemanas] = useState(8);

  const gerar = useMutation({
    mutationFn: async () => {
      const previstos = gerarRecorrentes(semanas);
      const novos = previstos.filter(
        (p) =>
          !cultos.some(
            (c) => c.data === p.data && hora(c.horario) === p.horario && c.titulo === p.titulo,
          ),
      );
      if (novos.length === 0) return 0;
      const { error } = await supabase.from("cultos").insert(novos);
      if (error) throw error;
      return novos.length;
    },
    onSuccess: (n) => {
      qc.invalidateQueries({ queryKey: ["cultos"] });
      toast.success(n === 0 ? "Agenda já está em dia." : `${n} cultos adicionados.`);
    },
    onError: () => toast.error("Não foi possível gerar os cultos."),
  });


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
        <p className="label-mono mt-3">{"\n"}</p>
      </section>

      <section
        className="rise mb-8 rounded-xl border border-line bg-surface p-5"
        style={{ animationDelay: "60ms" }}
      >
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="font-display text-xl font-medium">Cultos fixos</h2>
          <span className="label-mono">recorrência semanal</span>
        </div>
        <ul className="mt-4 flex flex-wrap gap-1.5">
          {MODELOS_RECORRENTES.map((m) => (
            <li
              key={m.titulo}
              className="rounded-full bg-surface2 px-3 py-1 text-[11px] text-muted ring-1 ring-line"
            >
              <span className="text-ink">{m.titulo}</span> · {m.descricao}
            </li>
          ))}
        </ul>
        {ehAdmin ? (
        <div className="mt-5 flex flex-wrap items-end gap-3 text-[13px]">
          <label>
            <span className="label-mono">Gerar para as próximas</span>
            <select
              value={semanas}
              onChange={(e) => setSemanas(Number(e.target.value))}
              className="mt-1.5 block rounded-md border border-line bg-surface2 px-3 py-2 text-ink outline-none focus:border-clay/50"
            >
              {[4, 8, 12, 26, 52].map((n) => (
                <option key={n} value={n}>
                  {n} semanas
                </option>
              ))}
            </select>
          </label>
          <button
            onClick={() => gerar.mutate()}
            disabled={gerar.isPending}
            className="rounded-md border border-clay/40 px-4 py-2 font-medium text-clay transition-colors hover:bg-clay/10 disabled:opacity-50"
          >
            Gerar agenda recorrente
          </button>
        </div>
        ) : null}
      </section>

      {ehAdmin ? (
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
      ) : null}

      <section className="rise mb-4 flex flex-wrap items-center gap-2" style={{ animationDelay: "150ms" }}>
        <span className="label-mono">Dias</span>
        <button
          onClick={() => setDias([])}
          className={`rounded-full border border-line px-3 py-1 font-mono text-[11px] ${dias.length === 0 ? "text-ink" : "text-muted"}`}
        >
          Todos
        </button>
        {DIAS_SEMANA.map((d, i) => (
          <button
            key={d}
            onClick={() =>
              setDias((atual) =>
                atual.includes(i) ? atual.filter((x) => x !== i) : [...atual, i],
              )
            }
            className={`rounded-full border px-3 py-1 font-mono text-[11px] ${dias.includes(i) ? "border-clay/50 text-clay" : "border-line text-muted"}`}
          >
            {d}
          </button>
        ))}
      </section>

      <section className="rise space-y-3" style={{ animationDelay: "180ms" }}>
        {visiveis.map((c) => {
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
                  {ehAdmin ? (
                  <button
                    onClick={() => excluir.mutate(c.id)}
                    className="font-mono text-[11px] text-muted transition-colors hover:text-clay"
                  >
                    Excluir
                  </button>
                  ) : null}
                </div>

              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {funcoes.map((f) => {
                  const d = departamentos.find((x) => x.id === f.departamento_id);
                  const naFuncao = doCulto.filter((e) => e.funcao_id === f.id);
                  return (
                    <div
                      key={f.id}
                      className="rounded-lg border border-line bg-surface2 px-3 py-2"
                    >
                      <div className="flex items-center gap-2 font-mono text-[11px] text-muted">
                        <span className={`size-2 rounded-full ${cor(d?.cor).dot}`} />
                        {f.nome}
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        {naFuncao.map((e) => (
                          <span
                            key={e.id}
                            className={`rounded-full px-2.5 py-1 text-[11px] ring-1 ${cor(d?.cor).chip}`}
                          >
                            {pessoas.find((p) => p.id === e.pessoa_id)?.nome}
                          </span>
                        ))}
                        {podeEscalar ? (
                          <button
                            onClick={() => setAlvo({ cultoId: c.id, funcaoId: f.id })}
                            className="rounded-md border border-dashed border-line px-2.5 py-1 text-[11px] text-muted transition-colors hover:border-clay/50 hover:text-clay"
                          >
                            {naFuncao.length > 0 ? "+" : "Atribuir"}
                          </button>
                        ) : naFuncao.length === 0 ? (
                          <span className="font-mono text-[11px] text-muted">—</span>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
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
