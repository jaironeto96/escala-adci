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

function doMes(d: DadosDaEscala) {
  const cultos = d.cultos.filter((c) => c.data.slice(0, 7) === d.mes);
  const ids = new Set(cultos.map((c) => c.id));
  return { cultos, escalas: d.escalas.filter((e) => ids.has(e.culto_id)) };
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

/** Quem tem pelo menos uma escala no mes, na ordem do cadastro (por nome). */
export function pessoasDoMes(d: DadosDaEscala): Pessoa[] {
  const { escalas } = doMes(d);
  const escaladas = new Set(escalas.map((e) => e.pessoa_id));
  return d.pessoas.filter((p) => escaladas.has(p.id));
}

/** Os cultos do mes em que a pessoa serve, com a(s) funcao(oes) de cada um. */
export function escalaDaPessoa(d: DadosDaEscala, pessoaId: string): LinhaDaPessoa[] {
  const { cultos, escalas } = doMes(d);
  const minhas = escalas.filter((e) => e.pessoa_id === pessoaId);
  return cultos
    .map((culto) => ({
      culto,
      funcoes: [
        ...new Set(
          minhas
            .filter((e) => e.culto_id === culto.id)
            .map((e) => d.funcoes.find((f) => f.id === e.funcao_id)?.nome)
            .filter((n): n is string => !!n),
        ),
      ].sort(porNome),
    }))
    .filter((l) => l.funcoes.length > 0);
}
