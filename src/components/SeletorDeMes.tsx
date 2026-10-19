import { MES_MINIMO, rotuloMes, somarMes } from "@/lib/dados";

type Props = {
  mes: string;
  onChange: (mes: string) => void;
};

// "‹ Outubro 2026 ›". Nao volta antes de MES_MINIMO: nao ha nada cadastrado la.
export function SeletorDeMes({ mes, onChange }: Props) {
  const mudar = (delta: number) => {
    const alvo = somarMes(mes, delta);
    if (alvo >= MES_MINIMO) onChange(alvo);
  };

  return (
    <div className="flex items-center gap-1 rounded-full border border-line px-1 py-0.5">
      <button
        onClick={() => mudar(-1)}
        disabled={mes <= MES_MINIMO}
        aria-label="Mês anterior"
        className="rounded-full px-2 py-0.5 font-mono text-[11px] text-muted hover:text-ink disabled:cursor-not-allowed disabled:opacity-25 disabled:hover:text-muted"
      >
        ‹
      </button>
      <span className="px-1 font-mono text-[11px] text-ink">{rotuloMes(mes)}</span>
      <button
        onClick={() => mudar(1)}
        aria-label="Próximo mês"
        className="rounded-full px-2 py-0.5 font-mono text-[11px] text-muted hover:text-ink"
      >
        ›
      </button>
    </div>
  );
}
