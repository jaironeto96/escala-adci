import { supabaseAdmin } from "@/integrations/supabase/client.server";

const FUSO = "America/Sao_Paulo";

export type ResumoAviso = {
  data: string;
  cultos: number;
  pessoas: number;
  enviados: number;
  falhas: number;
};

// A data do culto é `date` puro no banco, sem fuso. Comparar com `new Date()`
// do servidor erraria o dia: a Vercel roda em UTC e, depois das 21h de Brasília,
// já virou amanhã lá. en-CA formata como YYYY-MM-DD, igual ao banco.
export function hojeEmSaoPaulo(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: FUSO,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function dataCurta(iso: string) {
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}

function horaCurta(h: string) {
  return h.slice(0, 5);
}

function variavelObrigatoria(nome: string): string {
  const valor = process.env[nome];
  if (!valor) throw new Error(`Variável de ambiente ausente: ${nome}`);
  return valor;
}

async function criarTransporte() {
  // Import dinâmico: o nodemailer usa TCP puro e só existe no runtime Node.
  // Fora deste caminho ele nunca é carregado.
  const { default: nodemailer } = await import("nodemailer");

  return nodemailer.createTransport({
    host: variavelObrigatoria("SMTP_HOST"),
    port: Number(variavelObrigatoria("SMTP_PORT")),
    secure: (process.env["SMTP_SECURE"] ?? "").toLowerCase() === "true",
    auth: {
      user: variavelObrigatoria("SMTP_USER"),
      pass: variavelObrigatoria("SMTP_PASSWORD"),
    },
  });
}

type Item = { culto: string; data: string; horario: string; funcao: string };

function montarTexto(nome: string, itens: Item[]) {
  const linhas = itens.map((i) => `• ${i.funcao} — ${i.culto}, ${horaCurta(i.horario)}`);
  const dia = dataCurta(itens[0]!.data);
  return [
    `Olá, ${nome}!`,
    "",
    `Você está escalado hoje, ${dia}:`,
    "",
    ...linhas,
    "",
    "Que Deus abençoe o seu serviço.",
    "ADCI · Ministérios",
  ].join("\n");
}

function montarHtml(nome: string, itens: Item[]) {
  const dia = dataCurta(itens[0]!.data);
  const linhas = itens
    .map(
      (i) =>
        `<li style="margin-bottom:6px"><strong>${i.funcao}</strong> — ${i.culto}, ${horaCurta(i.horario)}</li>`,
    )
    .join("");
  return [
    `<div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;font-size:15px;line-height:1.6;color:#1a1a1a">`,
    `<p>Olá, ${nome}!</p>`,
    `<p>Você está escalado hoje, <strong>${dia}</strong>:</p>`,
    `<ul style="padding-left:18px">${linhas}</ul>`,
    `<p style="color:#666;font-size:13px;margin-top:24px">Que Deus abençoe o seu serviço.<br>ADCI · Ministérios</p>`,
    `</div>`,
  ].join("");
}

export async function enviarAvisosDoDia(): Promise<ResumoAviso> {
  const data = hojeEmSaoPaulo();
  const vazio: ResumoAviso = { data, cultos: 0, pessoas: 0, enviados: 0, falhas: 0 };

  const { data: cultos, error: erroCultos } = await supabaseAdmin
    .from("cultos")
    .select("id, titulo, data, horario")
    .eq("data", data);
  if (erroCultos) throw erroCultos;
  if (!cultos || cultos.length === 0) return vazio;

  // `aviso_enviado_em` é o que impede alguém de receber o mesmo aviso duas vezes
  // se o cron rodar de novo no mesmo dia.
  const { data: escalas, error: erroEscalas } = await supabaseAdmin
    .from("escalas")
    .select("id, culto_id, funcao_id, pessoa_id")
    .in(
      "culto_id",
      cultos.map((c) => c.id),
    )
    .is("aviso_enviado_em", null);
  if (erroEscalas) throw erroEscalas;
  if (!escalas || escalas.length === 0) return { ...vazio, cultos: cultos.length };

  const { data: funcoes, error: erroFuncoes } = await supabaseAdmin
    .from("funcoes")
    .select("id, nome")
    .in("id", [...new Set(escalas.map((e) => e.funcao_id))]);
  if (erroFuncoes) throw erroFuncoes;

  const { data: pessoas, error: erroPessoas } = await supabaseAdmin
    .from("pessoas")
    .select("id, nome, email, ativo")
    .in("id", [...new Set(escalas.map((e) => e.pessoa_id))]);
  if (erroPessoas) throw erroPessoas;

  const culto = new Map(cultos.map((c) => [c.id, c]));
  const funcao = new Map((funcoes ?? []).map((f) => [f.id, f.nome]));
  const pessoa = new Map((pessoas ?? []).map((p) => [p.id, p]));

  // Quem serve em duas funções no mesmo dia recebe um e-mail só, com as duas.
  const porPessoa = new Map<string, { itens: Item[]; escalaIds: string[] }>();
  for (const e of escalas) {
    const p = pessoa.get(e.pessoa_id);
    const c = culto.get(e.culto_id);
    if (!p || !c || !p.ativo || !p.email) continue;

    const grupo = porPessoa.get(e.pessoa_id) ?? { itens: [], escalaIds: [] };
    grupo.itens.push({
      culto: c.titulo,
      data: c.data,
      horario: c.horario,
      funcao: funcao.get(e.funcao_id) ?? "Escala",
    });
    grupo.escalaIds.push(e.id);
    porPessoa.set(e.pessoa_id, grupo);
  }

  if (porPessoa.size === 0) return { ...vazio, cultos: cultos.length };

  const transporte = await criarTransporte();
  const remetente = variavelObrigatoria("MAIL_FROM");

  let enviados = 0;
  let falhas = 0;
  const entregues: string[] = [];

  for (const [pessoaId, grupo] of porPessoa) {
    const p = pessoa.get(pessoaId)!;
    try {
      await transporte.sendMail({
        from: remetente,
        to: p.email,
        subject: `Você está escalado hoje — ${dataCurta(data)}`,
        text: montarTexto(p.nome, grupo.itens),
        html: montarHtml(p.nome, grupo.itens),
      });
      enviados += 1;
      entregues.push(...grupo.escalaIds);
    } catch (erro) {
      falhas += 1;
      console.error(`[aviso-escala] falha ao enviar para ${p.email}:`, erro);
    }
  }

  // Só marca o que realmente saiu, para que uma falha possa ser reenviada depois.
  if (entregues.length > 0) {
    const { error } = await supabaseAdmin
      .from("escalas")
      .update({ aviso_enviado_em: new Date().toISOString() })
      .in("id", entregues);
    if (error) throw error;
  }

  return {
    data,
    cultos: cultos.length,
    pessoas: porPessoa.size,
    enviados,
    falhas,
  };
}

function json(status: number, corpo: unknown) {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

// Comparação em tempo constante: um `!==` simples vaza, pelo tempo de resposta,
// quantos caracteres do segredo estavam certos. Mesma técnica do cron-auth.ts.
async function segredoConfere(recebido: string, esperado: string): Promise<boolean> {
  const { createHash, timingSafeEqual } = await import("node:crypto");
  const resumo = (v: string) => createHash("sha256").update(v, "utf8").digest();
  return timingSafeEqual(resumo(recebido), resumo(esperado));
}

export async function responderAvisoEscala(request: Request): Promise<Response> {
  const segredo = process.env["CRON_SECRET"];
  if (!segredo) {
    return json(500, { erro: "CRON_SECRET não está configurado no ambiente." });
  }

  const token = /^Bearer ([^s,]+)$/.exec(request.headers.get("authorization") ?? "")?.[1];
  if (!token || !(await segredoConfere(token, segredo))) {
    return json(401, { erro: "Não autorizado." });
  }

  try {
    const resumo = await enviarAvisosDoDia();
    console.log("[aviso-escala]", resumo);
    return json(200, { ok: true, ...resumo });
  } catch (erro) {
    console.error("[aviso-escala] erro:", erro);
    return json(500, {
      ok: false,
      erro: erro instanceof Error ? erro.message : "Erro desconhecido.",
    });
  }
}
