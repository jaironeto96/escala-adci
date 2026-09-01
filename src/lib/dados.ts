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

export type ModeloRecorrente = {
  titulo: string;
  horario: string;
  /** 0 = domingo ... 6 = sábado */
  diaSemana: number;
  /** somente na primeira ocorrência do mês */
  primeiroDoMes?: boolean;
  descricao: string;
};

export const MODELOS_RECORRENTES: ModeloRecorrente[] = [
  { titulo: "Culto de Doutrina", horario: "19:30", diaSemana: 2, descricao: "Terças · 19h30" },
  {
    titulo: "Culto Clamando pelo Impossível",
    horario: "19:30",
    diaSemana: 4,
    descricao: "Quintas · 19h30",
  },
  { titulo: "EBD", horario: "08:30", diaSemana: 0, descricao: "Domingos de manhã · 08h30" },
  {
    titulo: "Culto de Louvor e Adoração",
    horario: "18:00",
    diaSemana: 0,
    descricao: "Domingos à noite · 18h",
  },
  {
    titulo: "Culto de Santa Ceia",
    horario: "19:00",
    diaSemana: 6,
    primeiroDoMes: true,
    descricao: "1º sábado do mês · 19h",
  },
];

function iso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Gera as ocorrências dos cultos fixos entre hoje e `semanas` semanas à frente. */
export function gerarRecorrentes(semanas = 8, inicioIso = hoje()) {
  const inicio = new Date(`${inicioIso}T12:00:00`);
  const fim = new Date(inicio);
  fim.setDate(fim.getDate() + semanas * 7);

  const lista: { titulo: string; data: string; horario: string }[] = [];
  for (const d = new Date(inicio); d <= fim; d.setDate(d.getDate() + 1)) {
    for (const m of MODELOS_RECORRENTES) {
      if (d.getDay() !== m.diaSemana) continue;
      if (m.primeiroDoMes && d.getDate() > 7) continue;
      lista.push({ titulo: m.titulo, data: iso(d), horario: m.horario });
    }
  }
  return lista;
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
