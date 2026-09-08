import { createFileRoute, redirect } from "@tanstack/react-router";

import { supabase } from "@/integrations/supabase/client";

// A raiz nao tem tela propria: quem chega pelo link vai direto para onde
// consegue agir. Fica em ssr: false porque a sessao vive no navegador — no
// servidor a checagem sempre daria "sem sessao" e o usuario logado veria a
// tela de login piscar antes de ser redirecionado.
export const Route = createFileRoute("/")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    throw redirect({ to: data.session ? "/escala" : "/auth" });
  },
  component: () => null,
});
