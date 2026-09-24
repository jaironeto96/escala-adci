import { useQuery } from "@tanstack/react-query";

import { consultas, cor, dataCurta, hora, type Culto } from "@/lib/dados";
import { funcaoAtivaNoCulto } from "@/lib/funcoes-do-culto";
import { useAjustarFuncao } from "@/hooks/useAjustarFuncao";

type Props = {
  culto: Culto;
  onClose: () => void;
};

// Todas as funcoes de todos os ministerios, com o estado de cada uma neste culto.
// Mostra tudo de proposito, independente do ministerio que se esta vendo: e o
// que permite, estando na pagina da Base, trazer de volta uma funcao da Midia.
export function FuncoesDoCultoModal({ culto, onClose }: Props) {
  const { data: departamentos = [] } = useQuery(consultas.departamentos());
  const { data: funcoes = [] } = useQuery(consultas.funcoes());
  const { data: ajustes = [] } = useQuery(consultas.ajustesFuncao());
  const { excluir, adicionar, escaladosEm, ocupado } = useAjustarFuncao();

  const grupos = departamentos
    .map((d) => ({ depto: d, funcoes: funcoes.filter((f) => f.departamento_id === d.id) }))
    .filter((g) => g.funcoes.length > 0);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4">
      <div className="absolute inset-0 bg-paper/70" onClick={onClose} />
      <div className="rise relative flex max-h-[85vh] w-full max-w-md flex-col rounded-xl border border-line bg-surface">
        <div className="border-b border-line p-5">
          <h3 className="font-display text-lg font-medium">Funções deste culto</h3>
          <p className="mt-1 font-mono text-[11px] text-muted">
            {dataCurta(culto.data)} · {culto.titulo} · {hora(culto.horario)}
          </p>
          <p className="mt-2 text-[12px] text-muted">
            As mudanças valem só para este culto. Os outros continuam seguindo a regra do dia.
          </p>
        </div>

        <div className="space-y-5 overflow-y-auto p-5">
          {grupos.map(({ depto, funcoes: doDepto }) => (
            <div key={depto.id}>
              <span className="label-mono flex items-center gap-2">
                <span className={`size-2 rounded-full ${cor(depto.cor).dot}`} />
                {depto.nome}
              </span>
              <div className="mt-2 space-y-1">
                {doDepto.map((f) => {
                  const vale = funcaoAtivaNoCulto(culto, f, departamentos, ajustes);
                  // Ha ajuste quando alguem mudou a mao o que a regra diria.
                  const manual = ajustes.some(
                    (a) => a.culto_id === culto.id && a.funcao_id === f.id,
                  );
                  const escalados = escaladosEm(culto, f);

                  return (
                    <div
                      key={f.id}
                      className={`flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-[13px] ${
                        vale ? "border-line bg-surface2" : "border-dashed border-line"
                      }`}
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <span className={vale ? "text-ink" : "text-muted line-through"}>
                          {f.nome}
                        </span>
                        {manual ? (
                          <span className="rounded-full bg-clay/10 px-1.5 py-0.5 font-mono text-[10px] text-clay">
                            ajustado
                          </span>
                        ) : null}
                        {escalados > 0 ? (
                          <span className="font-mono text-[10px] text-muted">
                            {escalados} escalado{escalados > 1 ? "s" : ""}
                          </span>
                        ) : null}
                      </span>

                      {vale ? (
                        <button
                          disabled={ocupado}
                          onClick={() => excluir(culto, f)}
                          className="shrink-0 font-mono text-[11px] text-muted transition-colors hover:text-clay disabled:opacity-50"
                        >
                          Excluir
                        </button>
                      ) : (
                        <button
                          disabled={ocupado}
                          onClick={() => adicionar(culto, f)}
                          className="shrink-0 font-mono text-[11px] text-clay transition-colors hover:text-ink disabled:opacity-50"
                        >
                          + Adicionar
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="border-t border-line p-4">
          <button
            onClick={onClose}
            className="w-full rounded-md border border-line py-2 text-[13px] text-muted transition-colors hover:text-ink"
          >
            Concluir
          </button>
        </div>
      </div>
    </div>
  );
}
