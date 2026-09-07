import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// A trigger `handle_new_user_voluntario` cria a linha em `pessoas` assim que a
// conta nasce, mas só copia nome e e-mail. O celular informado no cadastro chega
// por aqui — e precisa da chave de serviço, porque escrever em `pessoas` é
// permissão de administrador nas políticas do banco.
export const salvarTelefone = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        telefone: z.string().trim().min(8).max(20),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: usuario, error: erroUsuario } = await supabaseAdmin.auth.admin.getUserById(
      context.userId,
    );
    if (erroUsuario) throw erroUsuario;

    const email = usuario.user?.email;
    if (!email) throw new Error("Esta conta não tem e-mail.");

    const { error } = await supabaseAdmin
      .from("pessoas")
      .update({ telefone: data.telefone })
      .eq("email", email);
    if (error) throw error;

    return { ok: true };
  });
