import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

// A conta do login e o cadastro de voluntario vivem em tabelas diferentes, e o
// e-mail e o unico elo entre elas. Quem entrou mas ainda nao foi cadastrado em
// `pessoas` devolve null — "Minha escala" fica vazia em vez de quebrar.
export function useMinhaPessoa() {
  const { data, isLoading } = useQuery({
    queryKey: ["minha_pessoa"],
    queryFn: async (): Promise<string | null> => {
      const { data: userData } = await supabase.auth.getUser();
      const email = userData.user?.email;
      if (!email) return null;

      // Sem limit(1) um e-mail duplicado em `pessoas` derrubaria a consulta.
      const { data: linhas, error } = await supabase
        .from("pessoas")
        .select("id")
        .eq("email", email)
        .limit(1);
      if (error) throw error;

      return linhas?.[0]?.id ?? null;
    },
    staleTime: 5 * 60 * 1000,
  });

  return { pessoaId: data ?? null, carregando: isLoading };
}
