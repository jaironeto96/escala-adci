import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { definirPapel, listarUsuarios, type UsuarioAdmin } from "@/lib/usuarios.functions";
import { usePapel } from "@/hooks/usePapel";

export const Route = createFileRoute("/_authenticated/usuarios")({
  head: () => ({
    meta: [
      { title: "Usuários e acessos · Escala de cultos" },
      {
        name: "description",
        content:
          "Área do administrador para definir quem é administrador, moderador ou visualizador da escala.",
      },
      { property: "og:title", content: "Usuários e acessos · Escala de cultos" },
      {
        property: "og:description",
        content: "Defina administradores, moderadores e visualizadores da escala.",
      },
    ],
  }),
  component: UsuariosPage,
});

const PAPEIS = [
  { id: "admin", rotulo: "Administrador", desc: "altera tudo" },
  { id: "moderador", rotulo: "Moderador", desc: "escala e desescala" },
  { id: "visualizador", rotulo: "Visualizador", desc: "somente leitura" },
] as const;

function UsuariosPage() {
  const { ehAdmin, carregando } = usePapel();
  const qc = useQueryClient();
  const buscar = useServerFn(listarUsuarios);
  const alterar = useServerFn(definirPapel);

  const { data: usuarios = [], isLoading } = useQuery({
    queryKey: ["usuarios_admin"],
    queryFn: () => buscar() as Promise<UsuarioAdmin[]>,
    enabled: ehAdmin,
  });

  const salvar = useMutation({
    mutationFn: (v: { userId: string; papel: UsuarioAdmin["papel"] }) => alterar({ data: v }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["usuarios_admin"] });
      toast.success("Nível de acesso atualizado.");
    },
    onError: (e: Error) => toast.error(e.message || "Não foi possível alterar o acesso."),
  });

  if (carregando) return null;

  if (!ehAdmin) {
    return (
      <section className="rise rounded-xl border border-line bg-surface p-6">
        <h1 className="font-display text-2xl font-light">Acesso restrito</h1>
        <p className="mt-2 text-[13px] text-muted">
          Apenas o administrador pode gerenciar níveis de acesso.
        </p>
      </section>
    );
  }

  return (
    <>
      <section className="rise mb-8">
        <h1 className="font-display text-4xl font-light tracking-tight">Usuários e acessos</h1>
        <p className="label-mono mt-3">{usuarios.length} contas</p>
      </section>

      <section className="rise space-y-2" style={{ animationDelay: "120ms" }}>
        {isLoading ? <p className="text-[13px] text-muted">Carregando contas…</p> : null}
        {usuarios.map((u) => (
          <div
            key={u.id}
            className="flex flex-wrap items-center gap-4 rounded-xl border border-line bg-surface px-4 py-3"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium">{u.email}</p>
              <p className="font-mono text-[11px] text-muted">
                desde {new Date(u.criado_em).toLocaleDateString("pt-BR")}
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {PAPEIS.map((p) => {
                const on = u.papel === p.id;
                return (
                  <button
                    key={p.id}
                    disabled={on || salvar.isPending}
                    onClick={() => salvar.mutate({ userId: u.id, papel: p.id })}
                    title={p.desc}
                    className={`rounded-full px-3 py-1 text-[11px] ring-1 transition-colors ${
                      on
                        ? "bg-clay/12 text-clay ring-clay/25"
                        : "bg-surface2 text-muted ring-line hover:text-ink"
                    }`}
                  >
                    {p.rotulo}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </section>
    </>
  );
}
