import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { consultas, cor, iniciais, type Pessoa } from "@/lib/dados";
import { usePapel } from "@/hooks/usePapel";

export const Route = createFileRoute("/_authenticated/voluntarios")({
  head: () => ({
    meta: [
      { title: "Voluntários · Escala de cultos" },
      {
        name: "description",
        content:
          "Cadastro de voluntários com nome, telefone, e-mail e múltiplos departamentos e funções.",
      },
      { property: "og:title", content: "Voluntários · Escala de cultos" },
      {
        property: "og:description",
        content: "Cadastro de voluntários com múltiplos departamentos e funções.",
      },
    ],
  }),
  component: VoluntariosPage,
});

const vazio = { nome: "", email: "", telefone: "" };

function VoluntariosPage() {
  const qc = useQueryClient();
  const { ehAdmin } = usePapel();
  const { data: departamentos = [] } = useQuery(consultas.departamentos());
  const { data: funcoes = [] } = useQuery(consultas.funcoes());
  const { data: pessoas = [] } = useQuery(consultas.pessoas());
  const { data: pessoaDeptos = [] } = useQuery(consultas.pessoaDepartamentos());
  const { data: pessoaFuncoes = [] } = useQuery(consultas.pessoaFuncoes());

  const [aberto, setAberto] = useState(false);
  const [editando, setEditando] = useState<Pessoa | null>(null);
  const [form, setForm] = useState(vazio);
  const [deptosSel, setDeptosSel] = useState<string[]>([]);
  const [funcoesSel, setFuncoesSel] = useState<string[]>([]);

  function abrirNovo() {
    setEditando(null);
    setForm(vazio);
    setDeptosSel([]);
    setFuncoesSel([]);
    setAberto(true);
  }

  function abrirEdicao(p: Pessoa) {
    setEditando(p);
    setForm({ nome: p.nome, email: p.email, telefone: p.telefone ?? "" });
    setDeptosSel(pessoaDeptos.filter((x) => x.pessoa_id === p.id).map((x) => x.departamento_id));
    setFuncoesSel(pessoaFuncoes.filter((x) => x.pessoa_id === p.id).map((x) => x.funcao_id));
    setAberto(true);
  }

  const salvar = useMutation({
    mutationFn: async () => {
      let pessoaId = editando?.id;
      if (editando) {
        const { error } = await supabase
          .from("pessoas")
          .update({ nome: form.nome, email: form.email, telefone: form.telefone || null })
          .eq("id", editando.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("pessoas")
          .insert({ nome: form.nome, email: form.email, telefone: form.telefone || null })
          .select("id")
          .single();
        if (error) throw error;
        pessoaId = data.id;
      }
      if (!pessoaId) throw new Error("sem id");

      await supabase.from("pessoa_departamentos").delete().eq("pessoa_id", pessoaId);
      await supabase.from("pessoa_funcoes").delete().eq("pessoa_id", pessoaId);
      if (deptosSel.length) {
        const { error } = await supabase
          .from("pessoa_departamentos")
          .insert(deptosSel.map((d) => ({ pessoa_id: pessoaId!, departamento_id: d })));
        if (error) throw error;
      }
      if (funcoesSel.length) {
        const { error } = await supabase
          .from("pessoa_funcoes")
          .insert(funcoesSel.map((f) => ({ pessoa_id: pessoaId!, funcao_id: f })));
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries();
      setAberto(false);
      toast.success("Cadastro salvo.");
    },
    onError: () => toast.error("Não foi possível salvar o cadastro."),
  });

  const excluir = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("pessoas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries();
      toast.success("Voluntário removido.");
    },
  });

  function alternar(lista: string[], set: (v: string[]) => void, id: string) {
    set(lista.includes(id) ? lista.filter((x) => x !== id) : [...lista, id]);
  }

  return (
    <>
      <section className="rise mb-8 flex flex-wrap items-end justify-between gap-6">
        <div>
          <h1 className="font-display text-4xl font-light tracking-tight">Voluntários</h1>
          <p className="label-mono mt-3">{pessoas.length} cadastrados</p>
        </div>
        {ehAdmin ? (
          <button
            onClick={abrirNovo}
            className="rounded-md bg-clay px-4 py-2 text-[13px] font-medium text-paper transition-colors hover:bg-clay/85"
          >
            Novo voluntário
          </button>
        ) : null}
      </section>

      <section className="rise space-y-1" style={{ animationDelay: "120ms" }}>
        {pessoas.map((p) => {
          const deps = pessoaDeptos
            .filter((x) => x.pessoa_id === p.id)
            .map((x) => departamentos.find((d) => d.id === x.departamento_id))
            .filter(Boolean);
          const funs = pessoaFuncoes
            .filter((x) => x.pessoa_id === p.id)
            .map((x) => funcoes.find((f) => f.id === x.funcao_id))
            .filter(Boolean);
          return (
            <div
              key={p.id}
              className="flex flex-wrap items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-surface"
            >
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-surface2 font-mono text-[11px] text-muted ring-1 ring-line">
                {iniciais(p.nome)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium">{p.nome}</p>
                <p className="truncate font-mono text-[11px] text-muted">
                  {p.email}
                  {p.telefone ? ` · ${p.telefone}` : ""}
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {deps.map((d) => (
                  <span
                    key={d!.id}
                    className={`rounded-full px-2 py-0.5 text-[10px] ring-1 ${cor(d!.cor).chip}`}
                  >
                    {d!.nome}
                  </span>
                ))}
                {funs.map((f) => (
                  <span
                    key={f!.id}
                    className="rounded-full bg-surface2 px-2 py-0.5 text-[10px] text-muted ring-1 ring-line"
                  >
                    {f!.nome}
                  </span>
                ))}
              </div>
              <div className={`flex shrink-0 gap-3 ${ehAdmin ? "" : "hidden"}`}>
                <button
                  onClick={() => abrirEdicao(p)}
                  className="font-mono text-[11px] text-muted transition-colors hover:text-ink"
                >
                  Editar
                </button>
                <button
                  onClick={() => excluir.mutate(p.id)}
                  className="font-mono text-[11px] text-muted transition-colors hover:text-clay"
                >
                  Excluir
                </button>
              </div>
            </div>
          );
        })}
      </section>

      {aberto ? (
        <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto p-4">
          <div className="absolute inset-0 bg-paper/70" onClick={() => setAberto(false)} />
          <form
            onSubmit={(e) => {
              e.preventDefault();
              salvar.mutate();
            }}
            className="rise relative my-8 w-full max-w-md rounded-xl border border-line bg-surface p-5"
          >
            <h3 className="font-display text-lg font-medium">
              {editando ? "Editar voluntário" : "Novo voluntário"}
            </h3>
            <div className="mt-4 space-y-4 text-[13px]">
              {(
                [
                  ["nome", "Nome", "text", true],
                  ["email", "E-mail", "email", true],
                  ["telefone", "Telefone", "text", false],
                ] as const
              ).map(([campo, rotulo, tipo, obrigatorio]) => (
                <label key={campo} className="block">
                  <span className="label-mono">{rotulo}</span>
                  <input
                    type={tipo}
                    required={obrigatorio}
                    value={form[campo]}
                    onChange={(e) => setForm({ ...form, [campo]: e.target.value })}
                    className="mt-1.5 w-full rounded-md border border-line bg-surface2 px-3 py-2 text-ink outline-none focus:border-clay/50"
                  />
                </label>
              ))}

              <div>
                <span className="label-mono">Departamentos (vários)</span>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {departamentos.map((d) => {
                    const on = deptosSel.includes(d.id);
                    return (
                      <button
                        type="button"
                        key={d.id}
                        onClick={() => alternar(deptosSel, setDeptosSel, d.id)}
                        className={`rounded-full px-2.5 py-1 text-[11px] ring-1 transition-colors ${
                          on ? cor(d.cor).chip : "bg-surface2 text-muted ring-line"
                        }`}
                      >
                        {d.nome}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <span className="label-mono">Funções (várias)</span>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {funcoes.map((f) => {
                    const on = funcoesSel.includes(f.id);
                    return (
                      <button
                        type="button"
                        key={f.id}
                        onClick={() => alternar(funcoesSel, setFuncoesSel, f.id)}
                        className={`rounded-full px-2.5 py-1 text-[11px] ring-1 transition-colors ${
                          on ? "bg-clay/12 text-clay ring-clay/25" : "bg-surface2 text-muted ring-line"
                        }`}
                      >
                        {f.nome}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setAberto(false)}
                  className="flex-1 rounded-md border border-line py-2 text-[13px] text-muted transition-colors hover:text-ink"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={salvar.isPending}
                  className="flex-1 rounded-md bg-clay py-2 text-[13px] font-medium text-paper transition-colors hover:bg-clay/85 disabled:opacity-60"
                >
                  Salvar
                </button>
              </div>
            </div>
          </form>
        </div>
      ) : null}
    </>
  );
}
