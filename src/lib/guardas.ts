import { redirect } from "@tanstack/react-router";

import { supabase } from "@/integrations/supabase/client";

// Repete a consulta do usePapel de proposito: isto roda no beforeLoad da rota,
// antes de qualquer componente montar, entao nao da para reaproveitar o hook.
//
// ATENCAO: isto recusa a NAVEGACAO, nao o ACESSO AOS DADOS. As politicas do
// banco continuam permitindo leitura a qualquer conta autenticada — restringir
// de verdade exige mudar o RLS no Supabase.
export async function exigirPodeEscalar() {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) throw redirect({ to: "/auth" });

  const { data: rows, error } = await supabase.from("user_roles").select("role").eq("user_id", uid);

  // Falha de rede nao deve abrir a porta: na duvida, devolve para a escala.
  if (error) throw redirect({ to: "/escala" });

  const papeis = (rows ?? []).map((r) => r.role);
  if (!papeis.includes("admin") && !papeis.includes("moderador")) {
    throw redirect({ to: "/escala" });
  }
}
