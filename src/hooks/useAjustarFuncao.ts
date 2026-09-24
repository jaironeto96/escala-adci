import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { consultas, type Culto, type Funcao } from "@/lib/dados";
import { padraoIncluiFuncao } from "@/lib/funcoes-do-culto";

// Liga e desliga funcoes de um culto especifico. Compartilhado pela Escala, por
// Proximos cultos e pelo painel "Funcoes deste culto", para que a regra de
// excluir seja a mesma em todo lugar.
export function useAjustarFuncao() {
  const qc = useQueryClient();
  const { data: departamentos = [] } = useQuery(consultas.departamentos());
  const { data: escalas = [] } = useQuery(consultas.escalas());

  const mutacao = useMutation({
    mutationFn: async (v: { culto: Culto; funcao: Funcao; incluir: boolean }) => {
      const padrao = padraoIncluiFuncao(v.culto, v.funcao, departamentos);
      // Voltar ao que a regra ja diria nao e ajuste nenhum: apaga a excecao em vez
      // de gravar uma linha que so repete o padrao.
      if (v.incluir === padrao) {
        const { error } = await supabase
          .from("culto_funcao_ajustes")
          .delete()
          .eq("culto_id", v.culto.id)
          .eq("funcao_id", v.funcao.id);
        if (error) throw error;
        return;
      }
      const { error } = await supabase
        .from("culto_funcao_ajustes")
        .upsert({ culto_id: v.culto.id, funcao_id: v.funcao.id, incluir: v.incluir });
      if (error) throw error;
    },
    onSuccess: (_r, v) => {
      qc.invalidateQueries({ queryKey: ["culto_funcao_ajustes"] });
      toast.success(
        v.incluir
          ? `Função ${v.funcao.nome} adicionada a este culto.`
          : `Função ${v.funcao.nome} excluída deste culto.`,
      );
    },
    onError: () => toast.error("Não foi possível alterar as funções deste culto."),
  });

  const escaladosEm = (culto: Culto, funcao: Funcao) =>
    escalas.filter((e) => e.culto_id === culto.id && e.funcao_id === funcao.id).length;

  const excluir = (culto: Culto, funcao: Funcao) => {
    // Excluir com gente escalada deixaria a pessoa numa funcao que "nao existe"
    // naquele dia — e o aviso por e-mail sairia do mesmo jeito.
    if (escaladosEm(culto, funcao) > 0) {
      toast.error("Tire as pessoas escaladas nesta função antes de excluí-la.");
      return;
    }
    mutacao.mutate({ culto, funcao, incluir: false });
  };

  const adicionar = (culto: Culto, funcao: Funcao) =>
    mutacao.mutate({ culto, funcao, incluir: true });

  return { excluir, adicionar, escaladosEm, ocupado: mutacao.isPending };
}
