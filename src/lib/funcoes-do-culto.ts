import type { AjusteFuncao, Culto, Departamento, Funcao } from "@/lib/dados";

// Compara nomes ignorando maiuscula, acento, pontuacao e espaco: "Aúdio" e
// "Áudio" dao a mesma chave, assim como "ADCI 1min", "ADCI 1 min" e "ADCI-1min".
// Foram erros de digitacao no cadastro que motivaram isto — a regra nao pode
// deixar de funcionar por causa de um acento ou de um espaco a mais.
export function chave(texto: string) {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

// Funcoes que so existem num dia da semana, qualquer que seja o ministerio.
// 0 = domingo, 1 = segunda ... 4 = quinta ... 6 = sabado.
const SO_NO_DIA: Record<string, number> = {
  adci1min: 4,
};

// Funcoes de Midia que so existem nos cultos maiores.
const SO_CULTOS_MAIORES = new Set(["foto", "story", "comunicador"]);
// Na EBD a Midia se resume a Som, Aux Som e Data.
const SO_NA_EBD = new Set(["som", "auxsom", "data"]);
// Nunca entram por padrao — so quando alguem acrescenta a mao.
const NUNCA_POR_PADRAO = new Set(["reels"]);

function diaDaSemana(culto: Culto) {
  // Meio-dia evita que o fuso empurre a data para o dia anterior.
  return new Date(`${culto.data}T12:00:00`).getDay();
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
  const nome = chave(funcao.nome);

  // A regra de dia vem antes de tudo e vale em qualquer ministerio. Sem isso, uma
  // funcao de quinta cadastrada na Base cairia no "Base e sempre completa" abaixo
  // e apareceria em todo culto.
  const diaUnico = SO_NO_DIA[nome];
  if (diaUnico !== undefined) return diaDaSemana(culto) === diaUnico;

  const depto = departamentos.find((d) => d.id === funcao.departamento_id);

  // Base, Louvor e qualquer outro ministerio: sempre completos.
  if (!depto || chave(depto.nome) !== "midia") return true;

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
