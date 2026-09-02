import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

export type Papel = "admin" | "moderador" | "visualizador";

export function usePapel() {
  const { data, isLoading } = useQuery({
    queryKey: ["meu_papel"],
    queryFn: async (): Promise<Papel> => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) return "visualizador";
      const { data: rows, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", uid);
      if (error) throw error;
      const papeis = (rows ?? []).map((r) => r.role as Papel);
      if (papeis.includes("admin")) return "admin";
      if (papeis.includes("moderador")) return "moderador";
      return "visualizador";
    },
    staleTime: 5 * 60 * 1000,
  });

  const papel: Papel = data ?? "visualizador";
  return {
    papel,
    carregando: isLoading,
    ehAdmin: papel === "admin",
    podeEscalar: papel === "admin" || papel === "moderador",
  };
}
