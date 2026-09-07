import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import {
  definirPapel,
  definirStatus,
  listarUsuarios,
  type UsuarioAdmin,
} from "@/lib/usuarios.functions";
import { usePapel } from "@/hooks/usePapel";

export const Route = createFileRoute("/_authenticated/usuarios")({
  head: () => ({
    meta: [
      { title: "Usuários e acessos · Escala de cultos" },
      {
        name: "description",
        content:
          "Área do administrador para aprovar ou suspender contas e definir quem é administrador, moderador ou visualizador da escala.",
      },
      { property: "og:title", content: "Usuários e acessos · Escala de cultos" },
      {
        property: "og:description",
        content: "Aprove, suspenda e defina o nível de acesso de cada conta.",
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

const pilula = "rounded-full px-3 py-1 text-[11px] ring-1 transition-colors";
const inerte = "bg-surface2 text-muted ring-line hover:text-ink";

function UsuariosPage() {
  const { ehAdmin, carregando } = usePapel();
  const qc = useQueryClient();
  const buscar = useServerFn(listarUsuarios);
  const alterar = useServerFn(definirPapel);
  const alterarStatus = useServerFn(definirStatus);

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

  const status = useMutation({
    mutationFn: (v: { userId: string; suspenso: boolean }) => alterarStatus({ data: v }),
    onSuccess: (_resultado, v) => {
      qc.invalidateQueries({ queryKey: ["usuarios_admin"] });
      toast.success(v.suspenso ? "Conta suspensa." : "Conta aprovada.");
    },
    onError: (e: Error) => toast.error(e.message || "Não foi possível alterar a conta."),
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

  const suspensas = usuarios.filter((u) => u.suspenso).length;

  return (
    <>
      <section className="rise mb-8">
        <h1 className="font-display text-4xl font-light tracking-tight">Usuários e acessos</h1>
        <p className="label-mono mt-3">
          {usuarios.length} contas
          {suspensas > 0 ? ` · ${suspensas} suspensa${suspensas > 1 ? "s" : ""}` : ""}
        </p>
      </section>

      <section className="rise space-y-2" style={{ animationDelay: "120ms" }}>
        {isLoading ? <p className="text-[13px] text-muted">Carregando contas…</p> : null}
        {usuarios.map((u) => (
          <div
            key={u.id}
            className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-xl border border-line bg-surface px-4 py-3"
          >
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2 truncate text-[13px] font-medium">
                <span className="truncate">{u.nome ?? u.email}</span>
                {u.suspenso ? (
                  <span className="shrink-0 rounded-full bg-amber/12 px-2 py-0.5 font-mono text-[10px] text-amber ring-1 ring-amber/25">
                    suspensa
                  </span>
                ) : null}
              </p>
              <p className="truncate font-mono text-[11px] text-muted">
                {u.email}
                {u.telefone ? ` · ${u.telefone}` : ""}
                {` · desde ${new Date(u.criado_em).toLocaleDateString("pt-BR")}`}
              </p>
            </div>

            <div className="flex flex-wrap gap-1.5">
              <button
                disabled={!u.suspenso || status.isPending}
                onClick={() => status.mutate({ userId: u.id, suspenso: false })}
                title="Libera o acesso desta conta"
                className={`${pilula} ${
                  u.suspenso ? inerte : "bg-olive/12 text-olive ring-olive/25"
                }`}
              >
                Aprovar
              </button>
              <button
                disabled={u.suspenso || status.isPending}
                onClick={() => status.mutate({ userId: u.id, suspenso: true })}
                title="Bloqueia o acesso desta conta"
                className={`${pilula} ${
                  u.suspenso ? "bg-amber/12 text-amber ring-amber/25" : inerte
                }`}
              >
                Suspender
              </button>
            </div>

            <div className="flex flex-wrap gap-1.5 border-line md:border-l md:pl-4">
              {PAPEIS.map((p) => {
                const on = u.papel === p.id;
                return (
                  <button
                    key={p.id}
                    disabled={on || salvar.isPending}
                    onClick={() => salvar.mutate({ userId: u.id, papel: p.id })}
                    title={p.desc}
                    className={`${pilula} ${on ? "bg-clay/12 text-clay ring-clay/25" : inerte}`}
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
