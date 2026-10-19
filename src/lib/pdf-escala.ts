import type { jsPDF as Documento } from "jspdf";

import { dataCurta, hora, juntar, rotuloMes } from "@/lib/dados";
import type { LinhaDaPessoa, TabelaMinisterio } from "@/lib/escala-do-mes";

const IGREJA = "ADCI · Primeira Assembleia de Deus Coqueiral de Itaparica";
const MARGEM = 12;
// Espaco do cabecalho (logo, titulo e subtitulo) no alto de cada pagina.
const TOPO = 26;

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

function cabecalho(doc: Documento, logo: Uint8Array | null, titulo: string, subtitulo: string) {
  let x = MARGEM;
  if (logo) {
    doc.addImage(logo, "PNG", MARGEM, 8, 12, 12, "logo");
    x += 16;
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(17, 17, 17);
  doc.text(titulo, x, 13.5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(110, 110, 110);
  doc.text(subtitulo, x, 18.5);
}

// So depois de tudo desenhado se sabe quantas paginas o documento tem.
function rodape(doc: Documento) {
  const total = doc.getNumberOfPages();
  const gerado = new Date().toLocaleDateString("pt-BR");
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    const largura = doc.internal.pageSize.getWidth();
    const altura = doc.internal.pageSize.getHeight();
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(130, 130, 130);
    doc.text(`Gerado em ${gerado} · escala.adci.org.br`, MARGEM, altura - 7);
    doc.text(`Página ${i} de ${total}`, largura - MARGEM, altura - 7, { align: "right" });
  }
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

/** A escala do mes inteiro: uma pagina (ou mais) por ministerio, deitada. */
export async function pdfDoMes(mes: string, tabelas: TabelaMinisterio[]) {
  const { jsPDF, autoTable, logo } = await prepararPdf();
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4", compress: true });

  tabelas.forEach((t, i) => {
    if (i > 0) doc.addPage();
    const titulo = `${t.depto.nome} · ${rotuloMes(mes)}`;
    autoTable(doc, {
      startY: TOPO,
      margin: { top: TOPO, left: MARGEM, right: MARGEM, bottom: 14 },
      head: [["Data", "Culto", ...t.funcoes.map((f) => f.nome)]],
      // Data e horario na mesma linha, e coluna do culto larga o bastante para
      // "Culto Clamando pelo Impossivel" nao quebrar: assim um mes de quase vinte
      // cultos cabe numa folha so.
      body: t.linhas.map(({ culto, celulas }) => [
        `${dataCurta(culto.data)} · ${hora(culto.horario)}`,
        culto.titulo,
        ...celulas.map((c) => (c.nomes.length > 0 ? c.nomes.join("\n") : c.vale ? "—" : "")),
      ]),
      theme: "grid",
      // Culto nao se divide entre duas paginas: a linha inteira passa para a seguinte.
      rowPageBreak: "avoid",
      styles: {
        font: "helvetica",
        fontSize: t.funcoes.length > 9 ? 7 : 8,
        cellPadding: 1.5,
        valign: "middle",
        textColor: [24, 24, 24],
        lineColor: [215, 215, 215],
        lineWidth: 0.1,
      },
      headStyles: { fillColor: [17, 17, 17], textColor: [255, 255, 255], fontStyle: "bold" },
      columnStyles: {
        0: { cellWidth: 23, fontStyle: "bold" },
        1: { cellWidth: 46, textColor: [90, 90, 90] },
      },
      // Funcao vazia: "—" claro. Funcao que nao existe naquele culto: celula cinza.
      didParseCell: (h) => {
        if (h.section !== "body" || h.column.index < 2) return;
        const celula = t.linhas[h.row.index]?.celulas[h.column.index - 2];
        if (!celula || celula.nomes.length > 0) return;
        if (celula.vale) h.cell.styles.textColor = [170, 170, 170];
        else h.cell.styles.fillColor = [243, 243, 243];
      },
      didDrawPage: () => cabecalho(doc, logo, titulo, `Escala do mês · ${IGREJA}`),
    });
  });

  rodape(doc);
  await entregar(doc, `escala-${slug(rotuloMes(mes))}.pdf`);
}

/** A escala de uma pessoa no mes, em pe. */
export async function pdfDaPessoa(mes: string, nome: string, linhas: LinhaDaPessoa[]) {
  const { jsPDF, autoTable, logo } = await prepararPdf();
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });

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
    theme: "striped",
    styles: { font: "helvetica", fontSize: 10, cellPadding: 2.6, textColor: [24, 24, 24] },
    headStyles: { fillColor: [17, 17, 17], textColor: [255, 255, 255], fontStyle: "bold" },
    alternateRowStyles: { fillColor: [245, 245, 245] },
    columnStyles: {
      0: { cellWidth: 22, fontStyle: "bold" },
      2: { cellWidth: 22 },
      3: { cellWidth: 60 },
    },
    didDrawPage: () => cabecalho(doc, logo, `Escala de ${nome}`, `${rotuloMes(mes)} · ${IGREJA}`),
  });

  rodape(doc);
  await entregar(doc, `escala-${slug(nome)}-${slug(rotuloMes(mes))}.pdf`);
}
