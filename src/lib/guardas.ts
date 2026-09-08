import { redirect } from "@tanstack/react-router";

import { supabase } from "@/integrations/supabase/client";
import type { Papel } from "@/hooks/usePapel";

// Repete a consulta do usePapel de proposito: isto roda no beforeLoad da rota,
// antes de qualquer componente montar, entao nao da para reaproveitar o hook.
//
// ATENCAO: isto recusa a NAVEGACAO, nao o ACESSO AOS DADOS. As politicas do
// banco continuam permitindo leitura a qualquer conta autenticada — restringir
// de verdade exige mudar o RLS no Supabase.
async function papeisDaConta(): Promise<Papel[]> {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) throw redirect({ to: "/auth" });

  const { data: rows, error } = await supabase.from("user_roles").select("role").eq("user_id", uid);

  // Falha de rede nao deve abrir a porta: na duvida, devolve para a escala.
  if (error) throw redirect({ to: "/escala" });

  return (rows ?? []).map((r) => r.role as Papel);
}

// Cultos: administrador e moderador. O moderador monta a agenda e escala gente.
export async function exigirPodeEscalar() {
  const papeis = await papeisDaConta();
  if (!papeis.includes("admin") && !papeis.includes("moderador")) {
    throw redirect({ to: "/escala" });
  }
}

// Voluntarios e departamentos: so administrador. E o Jairo quem liga cada
// pessoa as funcoes do departamento — e esse vinculo que faz o nome aparecer
// no "Atribuir" da escala.
export async function exigirAdmin() {
  const papeis = await papeisDaConta();
  if (!papeis.includes("admin")) {
    throw redirect({ to: "/escala" });
  }
}
