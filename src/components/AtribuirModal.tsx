import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { consultas, cor, dataCurta, hoje, type Funcao } from "@/lib/dados";

// "Áudio", "Áudio e Vídeo", "Áudio, Vídeo e Foto".
function juntar(nomes: string[]) {
  if (nomes.length <= 1) return nomes[0] ?? "";
  return `${nomes.slice(0, -1).join(", ")} e ${nomes[nomes.length - 1]}`;
}

type Props = {
  cultoId: string;
  funcaoId: string;
  onClose: () => void;
};

export function AtribuirModal({ cultoId, funcaoId, onClose }: Props) {
  const qc = useQueryClient();
  const { data: departamentos = [] } = useQuery(consultas.departamentos());
  const { data: funcoes = [] } = useQuery(consultas.funcoes());
  const { data: pessoas = [] } = useQuery(consultas.pessoas());
  const { data: pessoaFuncoes = [] } = useQuery(consultas.pessoaFuncoes());
  const { data: cultos = [] } = useQuery(consultas.cultos());
  const { data: escalas = [] } = useQuery(consultas.escalas());

  const funcao = funcoes.find((f) => f.id === funcaoId);
  const depto = departamentos.find((d) => d.id === funcao?.departamento_id);
  const [confirmar, setConfirmar] = useState<{ pessoaId: string; aviso: string } | null>(null);

  // Onde a pessoa ja serve neste culto, em OUTRO ministerio. Quem escala o Louvor
  // nao ve a escala da Midia, e vice-versa: o choque so aparece aqui. Dentro do
  // mesmo ministerio nao avisa — quem escala ja esta vendo a propria escala.
  const emOutroMinisterio = (pessoaId: string): Funcao[] =>
    escalas
      .filter((e) => e.culto_id === cultoId && e.pessoa_id === pessoaId && e.funcao_id !== funcaoId)
      .map((e) => funcoes.find((f) => f.id === e.funcao_id))
      .filter((f): f is Funcao => !!f && f.departamento_id !== funcao?.departamento_id);

  const escalar = (pessoaId: string, nome: string) => {
    const choques = emOutroMinisterio(pessoaId);
    if (choques.length > 0) {
      setConfirmar({
        pessoaId,
        aviso: `${nome} já está escalado(a) para ${juntar(choques.map((f) => f.nome))} neste culto.`,
      });
      return;
    }
    atribuir.mutate(pessoaId);
  };

  const atribuir = useMutation({
    mutationFn: async (pessoaId: string) => {
      const { error } = await supabase
        .from("escalas")
        .insert({ culto_id: cultoId, funcao_id: funcaoId, pessoa_id: pessoaId });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["escalas"] });
      toast.success("Voluntário escalado.");
    },
    onError: () => toast.error("Não foi possível escalar."),
  });

  const remover = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("escalas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["escalas"] });
      toast.success("Atribuição removida.");
    },
  });

  const jaEscalados = escalas.filter((e) => e.culto_id === cultoId && e.funcao_id === funcaoId);
  const candidatos = pessoas.filter((p) =>
    pessoaFuncoes.some((pf) => pf.pessoa_id === p.id && pf.funcao_id === funcaoId),
  );

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4">
      <div className="absolute inset-0 bg-paper/70" onClick={onClose} />
      <div className="rise relative w-full max-w-sm rounded-xl border border-line bg-surface p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-display text-lg font-medium">Atribuir voluntário</h3>
          <span className="label-mono">
            {dataCurta(cultos.find((c) => c.id === cultoId)?.data ?? hoje())}
          </span>
        </div>
        <div className="space-y-4 text-[13px]">
          <div>
            <span className="label-mono">Função</span>
            <div className="mt-1.5 flex items-center gap-2 rounded-md border border-clay/40 bg-clay/5 px-3 py-2">
              <span className={`size-2 rounded-full ${cor(depto?.cor).dot}`} />
              {funcao?.nome} · <span className="text-clay">{depto?.nome}</span>
            </div>
          </div>
          <div>
            <span className="label-mono">
              Voluntários com esta função · {jaEscalados.length} selecionados
            </span>
            <div className="mt-1.5 max-h-64 space-y-1 overflow-y-auto">
              {candidatos.length === 0 ? (
                <p className="text-muted">Nenhum voluntário cadastrado nesta função ainda.</p>
              ) : (
                candidatos.map((p) => {
                  const atual = jaEscalados.find((e) => e.pessoa_id === p.id);
                  return (
                    <button
                      key={p.id}
                      onClick={() => (atual ? remover.mutate(atual.id) : escalar(p.id, p.nome))}
                      className={`flex w-full items-center justify-between rounded-md border px-3 py-2 text-left transition-colors ${
                        atual
                          ? "border-clay/50 bg-clay/10"
                          : "border-line bg-surface2 hover:border-clay/50"
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <span
                          className={`grid size-4 place-items-center rounded-[4px] border text-[10px] ${
                            atual ? "border-clay bg-clay text-paper" : "border-line"
                          }`}
                        >
                          {atual ? "✓" : ""}
                        </span>
                        {p.nome}
                      </span>
                      {!atual && emOutroMinisterio(p.id).length > 0 ? (
                        <span className="font-mono text-[11px] text-amber">
                          já em {juntar(emOutroMinisterio(p.id).map((f) => f.nome))}
                        </span>
                      ) : (
                        <span className="font-mono text-[11px] text-muted">
                          {pessoaFuncoes.filter((pf) => pf.pessoa_id === p.id).length} funções
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>
          {confirmar ? (
            <div
              role="alert"
              className="space-y-3 rounded-md border border-amber/40 bg-amber/10 px-3 py-3"
            >
              <p className="text-[13px] leading-relaxed text-ink">{confirmar.aviso}</p>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    atribuir.mutate(confirmar.pessoaId);
                    setConfirmar(null);
                  }}
                  className="flex-1 rounded-md bg-clay py-2 text-[13px] font-medium text-paper transition-colors hover:bg-clay/85"
                >
                  Escalar mesmo assim
                </button>
                <button
                  onClick={() => setConfirmar(null)}
                  className="flex-1 rounded-md border border-line py-2 text-[13px] text-muted transition-colors hover:text-ink"
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : null}
          <div className="flex items-center gap-2 rounded-md bg-surface2 px-3 py-2">
            <span className="size-1.5 rounded-full bg-olive" />
            <span className="font-mono text-[11px] text-muted">
              E-mail de aviso enviado na manhã do culto
            </span>
          </div>
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
