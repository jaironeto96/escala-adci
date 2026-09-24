import { cor, dataCurta, hora, type Culto, type Departamento, type Funcao } from "@/lib/dados";

type Props = {
  culto: Culto;
  /** Funcoes que ainda nao valem neste culto — as unicas que faz sentido oferecer. */
  candidatas: Funcao[];
  departamentos: Departamento[];
  ocupado: boolean;
  onAdicionar: (funcao: Funcao) => void;
  onClose: () => void;
};

export function AdicionarFuncaoModal({
  culto,
  candidatas,
  departamentos,
  ocupado,
  onAdicionar,
  onClose,
}: Props) {
  // Agrupa por ministerio: com Reels, Foto e Story misturados a Base e Louvor a
  // lista fica dificil de ler.
  const grupos = departamentos
    .map((d) => ({ depto: d, funcoes: candidatas.filter((f) => f.departamento_id === d.id) }))
    .filter((g) => g.funcoes.length > 0);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4">
      <div className="absolute inset-0 bg-paper/70" onClick={onClose} />
      <div className="rise relative w-full max-w-sm rounded-xl border border-line bg-surface p-5">
        <div className="mb-4">
          <h3 className="font-display text-lg font-medium">Adicionar função</h3>
          <p className="mt-1 font-mono text-[11px] text-muted">
            {dataCurta(culto.data)} · {culto.titulo} · {hora(culto.horario)}
          </p>
          <p className="mt-2 text-[12px] text-muted">Vale só para este culto.</p>
        </div>

        {grupos.length === 0 ? (
          <p className="text-[13px] text-muted">Todas as funções já fazem parte deste culto.</p>
        ) : (
          <div className="max-h-72 space-y-4 overflow-y-auto">
            {grupos.map(({ depto, funcoes }) => (
              <div key={depto.id}>
                <span className="label-mono flex items-center gap-2">
                  <span className={`size-2 rounded-full ${cor(depto.cor).dot}`} />
                  {depto.nome}
                </span>
                <div className="mt-1.5 space-y-1">
                  {funcoes.map((f) => (
                    <button
                      key={f.id}
                      disabled={ocupado}
                      onClick={() => onAdicionar(f)}
                      className="flex w-full items-center justify-between rounded-md border border-line bg-surface2 px-3 py-2 text-left text-[13px] transition-colors hover:border-clay/50 disabled:opacity-50"
                    >
                      {f.nome}
                      <span className="font-mono text-[11px] text-clay">+ adicionar</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        <button
          onClick={onClose}
          className="mt-4 w-full rounded-md border border-line py-2 text-[13px] text-muted transition-colors hover:text-ink"
        >
          Concluir
        </button>
      </div>
    </div>
  );
}
