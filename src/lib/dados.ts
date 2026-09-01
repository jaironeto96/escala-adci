import { supabase } from "@/integrations/supabase/client";

export type Departamento = { id: string; nome: string; cor: string };
export type Funcao = { id: string; nome: string; departamento_id: string };
export type Pessoa = {
  id: string;
  nome: string;
  email: string;
  telefone: string | null;
  ativo: boolean;
};
export type Culto = { id: string; titulo: string; data: string; horario: string };
export type Escala = {
  id: string;
  culto_id: string;
  funcao_id: string;
  pessoa_id: string;
};

export type CorDepto = {
  dot: string;
  text: string;
  chip: string;
};

const CORES: Record<string, CorDepto> = {
  clay: { dot: "bg-clay", text: "text-clay", chip: "bg-clay/12 text-clay ring-clay/25" },
  mut: { dot: "bg-mut", text: "text-mut", chip: "bg-mut/12 text-mut ring-mut/25" },
  amber: { dot: "bg-amber", text: "text-amber", chip: "bg-amber/12 text-amber ring-amber/25" },
  olive: { dot: "bg-olive", text: "text-olive", chip: "bg-olive/12 text-olive ring-olive/25" },
  stone: { dot: "bg-stone", text: "text-stone", chip: "bg-stone/12 text-stone ring-stone/25" },
};

export const CORES_DISPONIVEIS = Object.keys(CORES);

export function cor(nome: string | undefined): CorDepto {
  return CORES[nome ?? "stone"] ?? CORES["stone"]!;
}

export function iniciais(nome: string) {
  return nome
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

const DIAS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export function dataCurta(iso: string) {
  const d = new Date(`${iso}T12:00:00`);
  return `${DIAS[d.getDay()]} ${String(d.getDate()).padStart(2, "0")}`;
}

export function dataLonga(iso: string) {
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });
}

export function hora(h: string) {
  return h.slice(0, 5);
}

export function hoje() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

async function pegar<T>(promise: PromiseLike<{ data: T | null; error: unknown }>) {
  const { data, error } = await promise;
  if (error) throw error;
  return (data ?? []) as T;
}

export const consultas = {
  departamentos: () => ({
    queryKey: ["departamentos"],
    queryFn: () =>
      pegar<Departamento[]>(supabase.from("departamentos").select("id, nome, cor").order("nome")),
  }),
  funcoes: () => ({
    queryKey: ["funcoes"],
    queryFn: () =>
      pegar<Funcao[]>(supabase.from("funcoes").select("id, nome, departamento_id").order("nome")),
  }),
  pessoas: () => ({
    queryKey: ["pessoas"],
    queryFn: () =>
      pegar<Pessoa[]>(
        supabase.from("pessoas").select("id, nome, email, telefone, ativo").order("nome"),
      ),
  }),
  pessoaDepartamentos: () => ({
    queryKey: ["pessoa_departamentos"],
    queryFn: () =>
      pegar<{ pessoa_id: string; departamento_id: string }[]>(
        supabase.from("pessoa_departamentos").select("pessoa_id, departamento_id"),
      ),
  }),
  pessoaFuncoes: () => ({
    queryKey: ["pessoa_funcoes"],
    queryFn: () =>
      pegar<{ pessoa_id: string; funcao_id: string }[]>(
        supabase.from("pessoa_funcoes").select("pessoa_id, funcao_id"),
      ),
  }),
  cultos: () => ({
    queryKey: ["cultos"],
    queryFn: () =>
      pegar<Culto[]>(
        supabase
          .from("cultos")
          .select("id, titulo, data, horario")
          .order("data")
          .order("horario"),
      ),
  }),
  escalas: () => ({
    queryKey: ["escalas"],
    queryFn: () =>
      pegar<Escala[]>(supabase.from("escalas").select("id, culto_id, funcao_id, pessoa_id")),
  }),
};
