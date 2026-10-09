import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { ativarNotificacoes, estadoAtual, type EstadoNotificacoes } from "@/lib/notificacoes";

// Avisa as outras telas abertas que o estado mudou: ativar pelo menu tem que fazer
// sumir o convite da Escala, e vice-versa.
const EVENTO = "notificacoes-mudou";

// Estado das notificacoes neste aparelho, compartilhado pelo convite da Escala e
// pelo item "Notificacoes" do menu.
export function useNotificacoes() {
  const [estado, setEstado] = useState<EstadoNotificacoes | null>(null);
  const [ativando, setAtivando] = useState(false);

  const recarregar = useCallback(() => {
    estadoAtual()
      .then(setEstado)
      .catch(() => setEstado("sem-suporte"));
  }, []);

  useEffect(() => {
    recarregar();
    window.addEventListener(EVENTO, recarregar);
    return () => window.removeEventListener(EVENTO, recarregar);
  }, [recarregar]);

  async function ativar() {
    setAtivando(true);
    try {
      const novo = await ativarNotificacoes();
      setEstado(novo);
      window.dispatchEvent(new Event(EVENTO));
      if (novo === "ativado") {
        toast.success("Notificações ativadas.", {
          description: "Você vai receber um aviso no dia em que estiver escalado.",
        });
      }
    } catch (erro) {
      toast.error("Não foi possível ativar as notificações.", {
        description: erro instanceof Error ? erro.message : undefined,
      });
    } finally {
      setAtivando(false);
    }
  }

  return { estado, ativando, ativar };
}
