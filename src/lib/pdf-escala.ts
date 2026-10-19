import type { jsPDF as Documento } from "jspdf";
import type { CellHookData } from "jspdf-autotable";

import { dataCurta, hora, juntar, rotuloMes, type Culto } from "@/lib/dados";
import type { LinhaDaPessoa, TabelaMinisterio } from "@/lib/escala-do-mes";

const IGREJA = "ADCI · Primeira Assembleia de Deus Coqueiral de Itaparica";
const MARGEM = 12;
// Espaco do cabecalho (faixa, logo, titulo e subtitulo) no alto de cada pagina.
const TOPO = 28;
// Respiro lateral dentro de cada celula, em mm.
const RESPIRO = 1.8;
// Milimetros por ponto tipografico.
const PT = 0.3528;

type Rgb = [number, number, number];

// O papel e branco; o resto vem do app (src/styles.css), convertido de oklch.
const ESCURO: Rgb = [18, 18, 21]; // --surface: o fundo das telas do app
const TEXTO: Rgb = [28, 28, 32];
const APAGADO: Rgb = [118, 118, 126];
const LINHA: Rgb = [226, 226, 230];
const AUSENTE: Rgb = [241, 241, 242];
const VAZIO: Rgb = [190, 190, 196];

// Cores dos ministerios. "base" e a do app; "texto", a mesma mais escura, legivel
// em letra pequena sobre o branco; "tinta", a cor bem diluida das linhas alternadas.
const CORES: Record<string, { base: Rgb; texto: Rgb; tinta: Rgb }> = {
  clay: { base: [207, 112, 67], texto: [164, 73, 23], tinta: [251, 244, 240] },
  mut: { base: [154, 160, 176], texto: [115, 121, 136], tinta: [247, 247, 249] },
  amber: { base: [207, 154, 78], texto: [165, 114, 32], tinta: [251, 247, 241] },
  olive: { base: [148, 160, 110], texto: [109, 121, 72], tinta: [246, 247, 243] },
  stone: { base: [142, 142, 148], texto: [104, 104, 109], tinta: [246, 246, 246] },
};
const corDe = (nome: string | undefined) => CORES[nome ?? "stone"] ?? CORES["stone"]!;
const CLAY = CORES["clay"]!;

type Pacote = {
  jsPDF: typeof Documento;
  autoTable: (typeof import("jspdf-autotable"))["autoTable"];
  logo: Uint8Array | null;
};

let pacote: Promise<Pacote> | null = null;

// O gerador de PDF pesa algumas centenas de KB: so e baixado na tela da Escala do
// mes, e nao no app inteiro. A tela chama isto ao abrir, para que no clique tudo ja
// esteja pronto — no celular, a tela de compartilhar so abre se for chamada logo
// depois do toque, sem esperar download.
export function prepararPdf() {
  if (!pacote) {
    pacote = Promise.all([
      import("jspdf"),
      import("jspdf-autotable"),
      fetch("/icon-192.png")
        .then((r) => (r.ok ? r.arrayBuffer() : null))
        .then((b) => (b ? new Uint8Array(b) : null))
        .catch(() => null),
    ]).then(([{ jsPDF }, { autoTable }, logo]) => ({ jsPDF, autoTable, logo }));
    // Sem internet na hora? A proxima tentativa busca de novo.
    pacote.catch(() => {
      pacote = null;
    });
  }
  return pacote;
}

// Faixa na cor do ministerio, logo da igreja, "Midia  Outubro 2026" e a igreja.
function cabecalho(
  doc: Documento,
  logo: Uint8Array | null,
  acento: Rgb,
  titulo: string,
  destaque: string,
  subtitulo: string,
) {
  doc.setFillColor(...acento);
  doc.rect(0, 0, doc.internal.pageSize.getWidth(), 2.2, "F");

  let x = MARGEM;
  if (logo) {
    doc.addImage(logo, "PNG", MARGEM, 8.5, 12.5, 12.5, "logo");
    x += 17;
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.setTextColor(...ESCURO);
  doc.text(titulo, x, 15);
  const largura = doc.getTextWidth(titulo);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...CLAY.texto);
  doc.text(destaque, x + largura + 2.5, 15);

  doc.setFontSize(8.3);
  doc.setTextColor(...APAGADO);
  doc.text(subtitulo, x, 20.3);
}

// So depois de tudo desenhado se sabe quantas paginas o documento tem.
function rodape(doc: Documento, legenda: boolean) {
  const total = doc.getNumberOfPages();
  const gerado = new Date().toLocaleDateString("pt-BR");
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    const largura = doc.internal.pageSize.getWidth();
    const y = doc.internal.pageSize.getHeight() - 7;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...APAGADO);
    doc.text(`Gerado em ${gerado} · escala.adci.org.br`, MARGEM, y);
    doc.text(`Página ${i} de ${total}`, largura - MARGEM, y, { align: "right" });

    if (legenda) {
      // "—  sem ninguém    [cinza]  fora deste culto", no meio do rodape.
      const meio = largura / 2;
      doc.setTextColor(...VAZIO);
      doc.text("—", meio - 30, y);
      doc.setTextColor(...APAGADO);
      doc.text("função sem ninguém", meio - 26, y);
      doc.setFillColor(...AUSENTE);
      doc.setDrawColor(...LINHA);
      doc.rect(meio + 4, y - 2.4, 3.2, 3.2, "FD");
      doc.text("função que não faz parte do culto", meio + 9, y);
    }
  }
}

// O sublinhado na cor do ministerio, embaixo da linha escura de titulos.
function sublinhar(doc: Documento, h: CellHookData, acento: Rgb) {
  if (h.section !== "head") return;
  doc.setFillColor(...acento);
  doc.rect(h.cell.x, h.cell.y + h.cell.height - 0.8, h.cell.width, 0.8, "F");
}

// Nomes de uma celula em linhas: "Bruno Lima · Elisa Prado" dividem a linha quando
// cabem na coluna; nome que nao cabe desce inteiro para a linha de baixo. Tres
// vozes no Vocal ocupam duas linhas, e nao tres — e o mes cabe numa folha.
function quebrarNomes(doc: Documento, nomes: string[], largura: number, tam: number) {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(tam);
  const linhas: string[] = [];
  for (const nome of nomes) {
    const ultima = linhas[linhas.length - 1];
    const junto = ultima === undefined ? null : `${ultima} · ${nome}`;
    if (junto && doc.getTextWidth(junto) <= largura) linhas[linhas.length - 1] = junto;
    else linhas.push(nome);
  }
  return linhas;
}

// Maior letra (de `max` ate `min`) em que todos os textos cabem numa linha so.
// Se nem a menor couber, a tabela quebra a linha — melhor que cortar o nome.
function maiorQueCabe(
  doc: Documento,
  textos: string[],
  largura: number,
  estilo: "normal" | "bold",
  max: number,
  min: number,
) {
  doc.setFont("helvetica", estilo);
  for (let tam = max; tam > min; tam -= 0.25) {
    doc.setFontSize(tam);
    if (textos.every((t) => doc.getTextWidth(t) <= largura)) return tam;
  }
  return min;
}

// "Outubro 2026" → "outubro-2026"; "Eloah Meireles" → "eloah-meireles".
function slug(texto: string) {
  return texto
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// No celular, abre a tela de compartilhar: o PDF vai direto para o WhatsApp, e no
// iPhone tem "Salvar em Arquivos" — baixar arquivo pelo app instalado na tela de
// inicio do iPhone nem sempre funciona. No computador, baixa.
async function entregar(doc: Documento, arquivo: string) {
  const pdf = new File([doc.output("blob")], arquivo, { type: "application/pdf" });
  const celular = window.matchMedia("(pointer: coarse)").matches;
  if (celular && navigator.canShare?.({ files: [pdf] })) {
    try {
      await navigator.share({ files: [pdf] });
      return;
    } catch (erro) {
      // Fechou a tela de compartilhar: a pessoa desistiu, nao e para baixar.
      if (erro instanceof DOMException && erro.name === "AbortError") return;
    }
  }
  doc.save(arquivo);
}

// Tamanho do nome do culto, embaixo da data, na primeira coluna.
const TAM_CULTO = 6.8;

// Primeira coluna: "Dom 04" em negrito e o horario em laranja, com o nome do culto
// embaixo. A tabela so sabe escrever um estilo por celula, entao esta e desenhada
// a mao — o texto padrao e apagado antes (em willDrawCell).
function desenharCulto(doc: Documento, h: CellHookData, culto: Culto, tam: number) {
  const x = h.cell.x + RESPIRO;
  const alto = tam * PT * 1.25 + TAM_CULTO * PT;
  const topo = h.cell.y + (h.cell.height - alto) / 2;
  const dia = dataCurta(culto.data);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(tam);
  doc.setTextColor(...TEXTO);
  doc.text(dia, x, topo, { baseline: "top" });
  const largura = doc.getTextWidth(dia);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...CLAY.texto);
  doc.text(hora(culto.horario), x + largura + 1.8, topo, { baseline: "top" });

  doc.setFontSize(TAM_CULTO);
  doc.setTextColor(...APAGADO);
  doc.text(culto.titulo, x, topo + tam * PT * 1.25, { baseline: "top" });
}

/** A escala do mes: uma pagina por ministerio, deitada. */
export async function pdfDoMes(mes: string, tabelas: TabelaMinisterio[]) {
  const { jsPDF, autoTable, logo } = await prepararPdf();
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4", compress: true });
  const util = doc.internal.pageSize.getWidth() - 2 * MARGEM;

  tabelas.forEach((t, i) => {
    if (i > 0) doc.addPage();
    const cor = corDe(t.depto.cor);

    // Primeira coluna na medida do nome de culto mais comprido; o resto da folha
    // se divide por igual entre as funcoes, para as colunas ficarem alinhadas.
    doc.setFont("helvetica", "normal");
    doc.setFontSize(TAM_CULTO);
    const maiorCulto = Math.max(24, ...t.linhas.map((l) => doc.getTextWidth(l.culto.titulo)));
    const colCulto = Math.min(Math.max(maiorCulto + 2 * RESPIRO + 1, 32), 52);
    const colFuncao = (util - colCulto) / t.funcoes.length;

    const nomes = t.linhas.flatMap((l) => l.celulas.flatMap((c) => c.nomes));
    let tamNome = maiorQueCabe(doc, nomes, colFuncao - 2 * RESPIRO, "normal", 8.5, 6.5);
    const tamFuncao = maiorQueCabe(
      doc,
      t.funcoes.map((f) => f.nome),
      colFuncao - 2 * RESPIRO,
      "bold",
      8,
      6.5,
    );

    // O mes inteiro numa folha so: o respiro de cima e de baixo de cada linha se
    // ajusta ao numero de cultos (e de nomes empilhados) — e, se nem o minimo
    // bastar, a letra diminui um pouco. So passa para a folha seguinte se nem
    // assim couber.
    const alturaUtil = doc.internal.pageSize.getHeight() - TOPO - 14 - 10; // 10: titulos
    const larguraNome = colFuncao - 2 * RESPIRO;
    const montar = (tam: number) =>
      t.linhas.map((l) => l.celulas.map((c) => quebrarNomes(doc, c.nomes, larguraNome, tam)));
    let celulas = montar(tamNome);
    let respiroV = 2.2;
    for (;;) {
      // A primeira coluna tem sempre duas linhas: data e nome do culto.
      const texto = celulas.reduce(
        (soma, linha) => soma + Math.max(2, ...linha.map((c) => c.length)) * tamNome * 1.15 * PT,
        0,
      );
      respiroV = (alturaUtil - texto) / (2 * t.linhas.length);
      if (respiroV >= 1 || tamNome <= 6.5) break;
      tamNome -= 0.25;
      celulas = montar(tamNome);
    }
    respiroV = Math.min(Math.max(respiroV, 0.8), 2.2);

    autoTable(doc, {
      startY: TOPO,
      margin: { top: TOPO, left: MARGEM, right: MARGEM, bottom: 14 },
      head: [["Culto", ...t.funcoes.map((f) => f.nome)]],
      body: t.linhas.map(({ culto, celulas: doCulto }, r) => [
        // Duas linhas curtas, so para a altura da celula sair certa: o conteudo de
        // fato e desenhado por desenharCulto. (Com o nome do culto aqui, na letra dos
        // nomes, ele quebrava em tres linhas e esticava a linha inteira.)
        `${dataCurta(culto.data)}\n${hora(culto.horario)}`,
        ...doCulto.map((c, j) =>
          c.nomes.length > 0 ? celulas[r]![j]!.join("\n") : c.vale ? "—" : "",
        ),
      ]),
      theme: "plain",
      // Culto nao se divide entre duas paginas: a linha inteira passa para a seguinte.
      rowPageBreak: "avoid",
      styles: {
        font: "helvetica",
        fontSize: tamNome,
        cellPadding: { top: respiroV, bottom: respiroV, left: RESPIRO, right: RESPIRO },
        halign: "center",
        valign: "middle",
        textColor: TEXTO,
        lineColor: LINHA,
        lineWidth: { bottom: 0.15, right: 0.1 },
      },
      headStyles: {
        fillColor: ESCURO,
        textColor: [255, 255, 255],
        fontStyle: "bold",
        fontSize: tamFuncao,
        cellPadding: { top: 2.8, bottom: 3.4, left: RESPIRO, right: RESPIRO },
        lineWidth: 0,
      },
      alternateRowStyles: { fillColor: cor.tinta },
      columnStyles: Object.fromEntries([
        [0, { cellWidth: colCulto, halign: "left" }],
        ...t.funcoes.map((_, j) => [j + 1, { cellWidth: colFuncao }]),
      ]),
      didParseCell: (h) => {
        if (h.column.index === 0) {
          h.cell.styles.halign = "left";
          return;
        }
        if (h.section !== "body") return;
        // Funcao vazia: "—" claro. Funcao que nao existe naquele culto: celula cinza.
        const celula = t.linhas[h.row.index]?.celulas[h.column.index - 1];
        if (!celula || celula.nomes.length > 0) return;
        if (celula.vale) h.cell.styles.textColor = VAZIO;
        else h.cell.styles.fillColor = AUSENTE;
      },
      willDrawCell: (h) => {
        if (h.section === "body" && h.column.index === 0) h.cell.text = [];
      },
      didDrawCell: (h) => {
        sublinhar(doc, h, cor.base);
        if (h.section !== "body" || h.column.index !== 0) return;
        const culto = t.linhas[h.row.index]?.culto;
        if (culto) desenharCulto(doc, h, culto, tamNome);
      },
      didDrawPage: () =>
        cabecalho(doc, logo, cor.base, t.depto.nome, rotuloMes(mes), `Escala do mês · ${IGREJA}`),
    });
  });

  rodape(doc, true);
  // Um ministerio so (filtrado, ou o unico com gente no mes): o nome vai no arquivo.
  const quem = tabelas.length === 1 ? `${slug(tabelas[0]!.depto.nome)}-` : "";
  await entregar(doc, `escala-${quem}${slug(rotuloMes(mes))}.pdf`);
}

/** A escala de uma pessoa no mes, em pe. Com ministerio, so as funcoes dele. */
export async function pdfDaPessoa(
  mes: string,
  nome: string,
  linhas: LinhaDaPessoa[],
  ministerio?: { nome: string; cor: string },
) {
  const { jsPDF, autoTable, logo } = await prepararPdf();
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });
  const cor = ministerio ? corDe(ministerio.cor) : CLAY;
  // Texto de cada coluna alinhado do mesmo jeito no titulo e nas linhas.
  const alinhamento = ["center", "left", "center", "center"] as const;

  autoTable(doc, {
    startY: TOPO,
    margin: { top: TOPO, left: MARGEM, right: MARGEM, bottom: 14 },
    head: [["Data", "Culto", "Horário", "Função"]],
    body: linhas.map(({ culto, funcoes }) => [
      dataCurta(culto.data),
      culto.titulo,
      hora(culto.horario),
      juntar(funcoes),
    ]),
    theme: "plain",
    styles: {
      font: "helvetica",
      fontSize: 10,
      cellPadding: { top: 3.4, bottom: 3.4, left: 3, right: 3 },
      valign: "middle",
      textColor: TEXTO,
      lineColor: LINHA,
      lineWidth: { bottom: 0.15 },
    },
    headStyles: {
      fillColor: ESCURO,
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 9.5,
      cellPadding: { top: 3, bottom: 3.6, left: 3, right: 3 },
      lineWidth: 0,
    },
    alternateRowStyles: { fillColor: cor.tinta },
    columnStyles: {
      0: { cellWidth: 24, fontStyle: "bold" },
      2: { cellWidth: 22, textColor: CLAY.texto },
      3: { cellWidth: 62, fontStyle: "bold" },
    },
    didParseCell: (h) => {
      h.cell.styles.halign = alinhamento[h.column.index] ?? "left";
    },
    didDrawCell: (h) => sublinhar(doc, h, cor.base),
    didDrawPage: () =>
      cabecalho(
        doc,
        logo,
        cor.base,
        nome,
        rotuloMes(mes),
        `Escala pessoal${ministerio ? ` · ${ministerio.nome}` : ""} · ${IGREJA}`,
      ),
  });

  // "9 cultos no mês", logo abaixo da tabela.
  const fim = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY;
  if (fim) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...APAGADO);
    doc.text(
      `${linhas.length} ${linhas.length === 1 ? "culto" : "cultos"} no mês`,
      MARGEM + 3,
      fim + 6,
    );
  }

  rodape(doc, false);
  const ondeServe = ministerio ? `-${slug(ministerio.nome)}` : "";
  await entregar(doc, `escala-${slug(nome)}${ondeServe}-${slug(rotuloMes(mes))}.pdf`);
}
