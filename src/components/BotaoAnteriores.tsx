type Props = {
  ativo: boolean;
  onChange: (ativo: boolean) => void;
};

// "Cultos anteriores": por padrao a escala mostra do culto de hoje em diante, e so
// quem escala (moderador e administrador) pode olhar para tras. O mesmo botao na
// Minha escala e na grade dos ministerios.
export function BotaoAnteriores({ ativo, onChange }: Props) {
  return (
    <button
      onClick={() => onChange(!ativo)}
      aria-pressed={ativo}
      className="rounded-full border border-line px-3 py-1 font-mono text-[11px] text-muted transition-colors hover:text-ink aria-pressed:bg-surface2 aria-pressed:text-ink"
    >
      {ativo ? "Voltar aos próximos" : "Cultos anteriores"}
    </button>
  );
}
