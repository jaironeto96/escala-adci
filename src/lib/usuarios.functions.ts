import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

// O que o middleware de autenticação entrega aos handlers.
type ContextoAutenticado = {
  supabase: SupabaseClient<Database>;
  userId: string;
};

export type UsuarioAdmin = {
  id: string;
  email: string;
  nome: string | null;
  telefone: string | null;
  criado_em: string;
  papel: "admin" | "moderador" | "visualizador";
  suspenso: boolean;
};

// Suspender é um banimento sem prazo prático; "none" devolve o acesso.
const BANIMENTO = "876000h";

async function garantirAdmin(context: ContextoAutenticado) {
  const { data, error } = await context.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Apenas administradores podem gerenciar usuários.");
}

function chaveEmail(email: string | null | undefined) {
  return (email ?? "").trim().toLowerCase();
}

export const listarUsuarios = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<UsuarioAdmin[]> => {
    await garantirAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: lista, error } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 200,
    });
    if (error) throw error;

    const { data: papeis, error: erroPapeis } = await supabaseAdmin
      .from("user_roles")
      .select("user_id, role");
    if (erroPapeis) throw erroPapeis;

    // Nome e celular vivem em `pessoas`, criado por trigger quando a conta nasce.
    // O e-mail é o único elo entre as duas tabelas.
    const { data: pessoas, error: erroPessoas } = await supabaseAdmin
      .from("pessoas")
      .select("nome, email, telefone");
    if (erroPessoas) throw erroPessoas;

    const cadastroPorEmail = new Map((pessoas ?? []).map((p) => [chaveEmail(p.email), p]));

    return lista.users.map((u) => {
      const meus = (papeis ?? []).filter((p) => p.user_id === u.id).map((p) => p.role);
      const papel = meus.includes("admin")
        ? "admin"
        : meus.includes("moderador")
          ? "moderador"
          : "visualizador";

      const cadastro = cadastroPorEmail.get(chaveEmail(u.email));
      const banidoAte = u.banned_until ? new Date(u.banned_until).getTime() : 0;

      return {
        id: u.id,
        email: u.email ?? "—",
        nome: cadastro?.nome ?? null,
        telefone: cadastro?.telefone ?? null,
        criado_em: u.created_at,
        papel: papel as UsuarioAdmin["papel"],
        suspenso: banidoAte > Date.now(),
      };
    });
  });

export const definirPapel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        userId: z.string().uuid(),
        papel: z.enum(["admin", "moderador", "visualizador"]),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await garantirAdmin(context);
    if (data.userId === context.userId) {
      throw new Error("Você não pode alterar o seu próprio nível de acesso.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error: erroDel } = await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", data.userId);
    if (erroDel) throw erroDel;

    const { error } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: data.userId, role: data.papel });
    if (error) throw error;

    return { ok: true };
  });

export const definirStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        userId: z.string().uuid(),
        suspenso: z.boolean(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await garantirAdmin(context);
    if (data.userId === context.userId) {
      throw new Error("Você não pode suspender a sua própria conta.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      ban_duration: data.suspenso ? BANIMENTO : "none",
    });
    if (error) throw error;

    return { ok: true };
  });
