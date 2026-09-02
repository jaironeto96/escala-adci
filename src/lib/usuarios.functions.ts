import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type UsuarioAdmin = {
  id: string;
  email: string;
  criado_em: string;
  papel: "admin" | "moderador" | "visualizador";
};

async function garantirAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error) throw error;
  if (!data) throw new Error("Apenas administradores podem gerenciar usuários.");
}

export const listarUsuarios = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<UsuarioAdmin[]> => {
    await garantirAdmin(context as any);
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

    return lista.users.map((u) => {
      const meus = (papeis ?? []).filter((p) => p.user_id === u.id).map((p) => p.role);
      const papel = meus.includes("admin")
        ? "admin"
        : meus.includes("moderador")
          ? "moderador"
          : "visualizador";
      return {
        id: u.id,
        email: u.email ?? "—",
        criado_em: u.created_at,
        papel: papel as UsuarioAdmin["papel"],
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
    await garantirAdmin(context as any);
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
