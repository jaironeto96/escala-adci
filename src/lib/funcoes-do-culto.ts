import type { AjusteFuncao, Culto, Departamento, Funcao } from "@/lib/dados";

// Compara nomes ignorando maiuscula, acento e pontuacao: "Aúdio", "Áudio" e
// "audio" viram a mesma coisa. Foi um acento trocado no cadastro que motivou
// isto — a regra nao pode deixar de funcionar por causa de digitacao.
export function normalizar(texto: string) {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// Funcoes de Midia que so existem nos cultos maiores.
const SO_CULTOS_MAIORES = new Set(["foto", "story", "comunicador"]);
// Na EBD a Midia se resume ao som.
const SO_NA_EBD = new Set(["som", "aux som"]);
// Nunca entram por padrao — so quando alguem acrescenta a mao.
const NUNCA_POR_PADRAO = new Set(["reels"]);

function diaDaSemana(culto: Culto) {
  // Meio-dia evita que o fuso empurre a data para o dia anterior.
  return new Date(`${culto.data}T12:00:00`).getDay(); // 0 = domingo, 6 = sabado
}

// A EBD e o culto de domingo de manha. Pelo horario, e nao pelo titulo: titulo
// muda, domingo de manha continua sendo domingo de manha.
function ehDomingoDeManha(culto: Culto) {
  return diaDaSemana(culto) === 0 && culto.horario < "12:00";
}

// Cultos com a equipe de Midia completa: qualquer sabado e o domingo a noite
// (Culto de Louvor e Adoracao).
function ehCultoMaior(culto: Culto) {
  const dia = diaDaSemana(culto);
  return dia === 6 || (dia === 0 && culto.horario >= "12:00");
}

/** A funcao faz parte do culto por padrao, antes de qualquer ajuste manual? */
export function padraoIncluiFuncao(culto: Culto, funcao: Funcao, departamentos: Departamento[]) {
  const depto = departamentos.find((d) => d.id === funcao.departamento_id);

  // Base, Louvor e qualquer outro ministerio: sempre completos.
  if (!depto || normalizar(depto.nome) !== "midia") return true;

  const nome = normalizar(funcao.nome);
  if (NUNCA_POR_PADRAO.has(nome)) return false;
  if (ehDomingoDeManha(culto)) return SO_NA_EBD.has(nome);
  if (SO_CULTOS_MAIORES.has(nome)) return ehCultoMaior(culto);
  return true;
}

/** A funcao vale neste culto, somando o padrao e os ajustes feitos a mao? */
export function funcaoAtivaNoCulto(
  culto: Culto,
  funcao: Funcao,
  departamentos: Departamento[],
  ajustes: AjusteFuncao[],
) {
  const ajuste = ajustes.find((a) => a.culto_id === culto.id && a.funcao_id === funcao.id);
  return ajuste ? ajuste.incluir : padraoIncluiFuncao(culto, funcao, departamentos);
}
