import { useEffect, useState } from "react";

import { useNotificacoes } from "@/hooks/useNotificacoes";

const CHAVE_ADIADO = "notificacoes-adiado-ate";
const QUATORZE_DIAS = 14 * 24 * 60 * 60 * 1000;

function adiado() {
  try {
    return Number(localStorage.getItem(CHAVE_ADIADO) ?? 0) > Date.now();
  } catch {
    return false;
  }
}

function adiar() {
  try {
    localStorage.setItem(CHAVE_ADIADO, String(Date.now() + QUATORZE_DIAS));
  } catch {
    // Sem armazenamento local o aviso so volta na proxima abertura; tudo bem.
  }
}

// Convite para receber o aviso de escala como notificacao. Quem ja ativou nao ve
// nada; quem tocou em "Agora nao" so ve de novo daqui a 14 dias — e enquanto isso
// pode ativar pelo item "Notificacoes" do menu.
export function AtivarNotificacoes() {
  const { estado, ativando, ativar } = useNotificacoes();
  const [oculto, setOculto] = useState(true);

  useEffect(() => {
    setOculto(adiado());
  }, []);

  if (oculto || !estado || estado === "ativado" || estado === "sem-suporte") return null;

  const fechar = () => {
    adiar();
    setOculto(true);
  };

  return (
    <section className="rise mb-6 flex flex-col gap-3 rounded-xl border border-clay/30 bg-clay/5 p-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-[13px] leading-relaxed text-ink">
        {estado === "desativado" &&
          "Receba um aviso neste aparelho no dia em que você estiver escalado."}
        {estado === "instalar-no-iphone" && (
          <>
            Para receber o aviso no celular, instale o app: toque em <strong>Compartilhar</strong> e
            depois em <strong>Adicionar à Tela de Início</strong>.
          </>
        )}
        {estado === "bloqueado" &&
          "As notificações estão bloqueadas neste aparelho. Para receber os avisos, libere nos ajustes do celular."}
      </p>

      <div className="flex shrink-0 items-center gap-2">
        {estado === "desativado" ? (
          <button
            onClick={ativar}
            disabled={ativando}
            className="rounded-md bg-clay px-3 py-2 text-[13px] font-medium text-paper transition-colors hover:bg-clay/85 disabled:opacity-60"
          >
            {ativando ? "Ativando…" : "Ativar notificações"}
          </button>
        ) : null}
        <button
          onClick={fechar}
          className="rounded-md px-3 py-2 font-mono text-[11px] text-muted transition-colors hover:text-ink"
        >
          {estado === "desativado" ? "Agora não" : "Entendi"}
        </button>
      </div>
    </section>
  );
}
