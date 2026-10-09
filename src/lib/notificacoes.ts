import { supabase } from "@/integrations/supabase/client";
import { VAPID_PUBLICA } from "@/lib/vapid";

export type EstadoNotificacoes =
  | "ativado"
  | "desativado" // da para ativar com um toque
  | "bloqueado" // a pessoa recusou; so se reverte nos ajustes do aparelho
  | "instalar-no-iphone" // Safari comum no iPhone: precisa instalar o app antes
  | "sem-suporte";

function ehIphone() {
  const ua = navigator.userAgent;
  // iPad recente se apresenta como Mac; o toque denuncia.
  return /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

function abertoComoApp() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function temSuporte() {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

function chaveEmBytes(base64url: string) {
  const preenchido = (base64url + "=".repeat((4 - (base64url.length % 4)) % 4))
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const bruto = atob(preenchido);
  return Uint8Array.from(bruto, (c) => c.charCodeAt(0));
}

async function salvarInscricao(inscricao: PushSubscription) {
  const { data } = await supabase.auth.getUser();
  const usuario = data.user;
  if (!usuario?.email) throw new Error("Entre na sua conta para ativar as notificações.");

  const json = inscricao.toJSON();
  const p256dh = json.keys?.["p256dh"];
  const auth = json.keys?.["auth"];
  if (!json.endpoint || !p256dh || !auth) {
    throw new Error("O navegador não devolveu os dados da inscrição. Tente de novo.");
  }

  const { error } = await supabase.from("push_inscricoes").upsert(
    {
      user_id: usuario.id,
      email: usuario.email.toLowerCase(),
      endpoint: json.endpoint,
      p256dh,
      auth,
    },
    { onConflict: "user_id,endpoint" },
  );
  if (error) throw error;
}

/** Em que situacao este aparelho esta. Nao pede nada ao usuario. */
export async function estadoAtual(): Promise<EstadoNotificacoes> {
  if (!temSuporte()) {
    // No iPhone, pelo Safari comum, o PushManager simplesmente nao existe.
    return ehIphone() && !abertoComoApp() ? "instalar-no-iphone" : "sem-suporte";
  }
  if (Notification.permission === "denied") return "bloqueado";
  if (Notification.permission !== "granted") return "desativado";

  const registro = await navigator.serviceWorker.getRegistration("/");
  const inscricao = await registro?.pushManager.getSubscription();
  return inscricao ? "ativado" : "desativado";
}

/**
 * Pede permissao e inscreve o aparelho. Tem que ser chamado a partir de um toque:
 * o iPhone recusa pedido de permissao que nao venha de uma acao do usuario.
 */
export async function ativarNotificacoes(): Promise<EstadoNotificacoes> {
  const registro = await navigator.serviceWorker.register("/sw.js");
  const permissao = await Notification.requestPermission();
  if (permissao === "denied") return "bloqueado";
  if (permissao !== "granted") return "desativado";

  await navigator.serviceWorker.ready;
  const inscricao =
    (await registro.pushManager.getSubscription()) ??
    (await registro.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: chaveEmBytes(VAPID_PUBLICA),
    }));
  await salvarInscricao(inscricao);
  return "ativado";
}

/**
 * Reenvia a inscricao de quem ja ativou. O endereco de entrega pode mudar com o
 * tempo; mandar de novo a cada abertura mantem o banco em dia sem pedir nada.
 */
export async function sincronizarInscricao() {
  if (!temSuporte() || Notification.permission !== "granted") return;
  const registro = await navigator.serviceWorker.getRegistration("/");
  const inscricao = await registro?.pushManager.getSubscription();
  if (inscricao) await salvarInscricao(inscricao);
}
