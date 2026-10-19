import type { AjusteFuncao, Culto, Departamento, Escala, Funcao, Pessoa } from "@/lib/dados";
import { funcaoAtivaNoCulto } from "@/lib/funcoes-do-culto";

// Monta a "Escala do mes" uma vez so, e a mesma estrutura vai para a tela e para
// o PDF — o que se exporta e exatamente o que se ve.

export type Celula = {
  nomes: string[];
  /** A funcao faz parte deste culto? Celula vazia de funcao ausente fica apagada. */
  vale: boolean;
};

export type TabelaMinisterio = {
  depto: Departamento;
  funcoes: Funcao[];
  linhas: { culto: Culto; celulas: Celula[] }[];
};

export type LinhaDaPessoa = { culto: Culto; funcoes: string[] };

export type DadosDaEscala = {
  mes: string;
  cultos: Culto[];
  escalas: Escala[];
  funcoes: Funcao[];
  departamentos: Departamento[];
  pessoas: Pessoa[];
  ajustes: AjusteFuncao[];
};

const porNome = (a: string, b: string) => a.localeCompare(b, "pt-BR");

// Cultos e escalas do mes. Com `deptoId`, so as escalas em funcoes daquele ministerio.
function doMes(d: DadosDaEscala, deptoId?: string) {
  const cultos = d.cultos.filter((c) => c.data.slice(0, 7) === d.mes);
  const ids = new Set(cultos.map((c) => c.id));
  const doDepto = deptoId
    ? new Set(d.funcoes.filter((f) => f.departamento_id === deptoId).map((f) => f.id))
    : null;
  return {
    cultos,
    escalas: d.escalas.filter((e) => ids.has(e.culto_id) && (!doDepto || doDepto.has(e.funcao_id))),
  };
}

/** Uma tabela por ministerio: cultos nas linhas, funcoes nas colunas. */
export function tabelasDoMes(d: DadosDaEscala): TabelaMinisterio[] {
  const { cultos, escalas } = doMes(d);
  const nome = (id: string) => d.pessoas.find((p) => p.id === id)?.nome ?? "—";

  return d.departamentos
    .map((depto) => {
      // So entra funcao que alguem ocupa no mes: coluna vazia o mes inteiro e
      // ruido — e ministerio sem ninguem escalado nem aparece.
      const funcoes = d.funcoes.filter(
        (f) => f.departamento_id === depto.id && escalas.some((e) => e.funcao_id === f.id),
      );
      const linhas = cultos.map((culto) => ({
        culto,
        celulas: funcoes.map((f) => ({
          vale: funcaoAtivaNoCulto(culto, f, d.departamentos, d.ajustes),
          nomes: escalas
            .filter((e) => e.culto_id === culto.id && e.funcao_id === f.id)
            .map((e) => nome(e.pessoa_id))
            .sort(porNome),
        })),
      }));
      return { depto, funcoes, linhas };
    })
    .filter((t) => t.funcoes.length > 0);
}

/** Quem tem pelo menos uma escala no mes (no ministerio, se houver), por nome. */
export function pessoasDoMes(d: DadosDaEscala, deptoId?: string): Pessoa[] {
  const { escalas } = doMes(d, deptoId);
  const escaladas = new Set(escalas.map((e) => e.pessoa_id));
  return d.pessoas.filter((p) => escaladas.has(p.id));
}

/** Os cultos do mes em que a pessoa serve, com a(s) funcao(oes) de cada um. */
export function escalaDaPessoa(
  d: DadosDaEscala,
  pessoaId: string,
  deptoId?: string,
): LinhaDaPessoa[] {
  const { cultos, escalas } = doMes(d, deptoId);
  const minhas = new Set(
    escalas.filter((e) => e.pessoa_id === pessoaId).map((e) => `${e.culto_id}|${e.funcao_id}`),
  );
  // Percorre as funcoes, e nao as escalas: assim "Audio e Som" sai na mesma ordem
  // das colunas da tabela.
  return cultos
    .map((culto) => ({
      culto,
      funcoes: d.funcoes.filter((f) => minhas.has(`${culto.id}|${f.id}`)).map((f) => f.nome),
    }))
    .filter((l) => l.funcoes.length > 0);
}
