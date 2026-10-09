import { useNotificacoes } from "@/hooks/useNotificacoes";

type Props = { onClose: () => void };

// Aberto pelo item "Notificacoes" do menu. Existe para que ativar nunca dependa do
// convite da Escala: quem tocou em "Agora nao" ali ficaria 14 dias sem como ligar.
export function NotificacoesModal({ onClose }: Props) {
  const { estado, ativando, ativar } = useNotificacoes();

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4">
      <div className="absolute inset-0 bg-paper/70" onClick={onClose} />
      <div className="rise relative w-full max-w-sm rounded-xl border border-line bg-surface p-5">
        <h3 className="font-display text-lg font-medium">Notificações</h3>

        <div className="mt-3 space-y-3 text-[13px] leading-relaxed text-muted">
          {estado === null ? <p>Verificando este aparelho…</p> : null}

          {estado === "ativado" ? (
            <>
              <p className="flex items-center gap-2 text-ink">
                <span className="size-2 rounded-full bg-olive" />
                Ativadas neste aparelho.
              </p>
              <p>
                Você recebe um aviso às 7h do dia em que estiver escalado. Para parar de receber,
                desative as notificações do app nos ajustes do celular.
              </p>
            </>
          ) : null}

          {estado === "desativado" ? (
            <>
              <p className="text-ink">Desativadas neste aparelho.</p>
              <p>Ative para receber um aviso às 7h do dia em que você estiver escalado.</p>
              <button
                onClick={ativar}
                disabled={ativando}
                className="w-full rounded-md bg-clay py-2 text-[13px] font-medium text-paper transition-colors hover:bg-clay/85 disabled:opacity-60"
              >
                {ativando ? "Ativando…" : "Ativar notificações"}
              </button>
            </>
          ) : null}

          {estado === "bloqueado" ? (
            <>
              <p className="text-ink">Bloqueadas neste aparelho.</p>
              <p>
                Em algum momento o pedido de permissão foi recusado, e o app não pode perguntar de
                novo. Para liberar:
              </p>
              <p>
                <strong className="text-ink">Android:</strong> Configurações → Apps → ADCI Escalas
                (ou Chrome) → Notificações.
              </p>
              <p>
                <strong className="text-ink">iPhone:</strong> Ajustes → Notificações → ADCI Escalas.
              </p>
            </>
          ) : null}

          {estado === "instalar-no-iphone" ? (
            <>
              <p className="text-ink">
                No iPhone, as notificações só funcionam com o app instalado.
              </p>
              <p>
                No Safari, toque em <strong className="text-ink">Compartilhar</strong> e depois em{" "}
                <strong className="text-ink">Adicionar à Tela de Início</strong>. Abra o app pelo
                ícone novo e volte aqui.
              </p>
            </>
          ) : null}

          {estado === "sem-suporte" ? (
            <p>
              Este navegador não recebe notificações. No Android, use o Chrome; no iPhone, instale o
              app pela Tela de Início do Safari (iOS 16.4 ou mais recente).
            </p>
          ) : null}
        </div>

        <button
          onClick={onClose}
          className="mt-4 w-full rounded-md border border-line py-2 text-[13px] text-muted transition-colors hover:text-ink"
        >
          Fechar
        </button>
      </div>
    </div>
  );
}
