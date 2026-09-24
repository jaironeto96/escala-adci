-- Ajustes de funcao por culto.
--
-- O conjunto padrao de funcoes de cada culto e calculado pelo app, a partir do
-- dia da semana e do horario (src/lib/funcoes-do-culto.ts). Esta tabela guarda so
-- as EXCECOES feitas a mao:
--   incluir = true   acrescenta uma funcao que o padrao nao traria (ex.: Reels)
--   incluir = false  tira uma funcao que o padrao traria (ex.: Comunicador num
--                    domingo especifico)
-- Sem linha aqui, vale a regra. Guardar so excecoes faz uma funcao nova criada em
-- Base ou Louvor aparecer em todos os cultos sem precisar preencher nada.

CREATE TABLE public.culto_funcao_ajustes (
  culto_id   uuid        NOT NULL REFERENCES public.cultos(id)  ON DELETE CASCADE,
  funcao_id  uuid        NOT NULL REFERENCES public.funcoes(id) ON DELETE CASCADE,
  incluir    boolean     NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (culto_id, funcao_id)
);

ALTER TABLE public.culto_funcao_ajustes ENABLE ROW LEVEL SECURITY;

-- Todo mundo logado precisa ler: a grade depende disto para saber o que mostrar.
CREATE POLICY "ver ajustes de funcao" ON public.culto_funcao_ajustes
  FOR SELECT TO authenticated USING (true);

-- Ajustar e trabalho de quem escala — o mesmo criterio da tabela escalas.
CREATE POLICY "ajustar funcoes do culto" ON public.culto_funcao_ajustes
  FOR ALL TO authenticated
  USING      (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderador'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderador'));

-- Corrige o acento digitado no cadastro: "Aúdio" -> "Áudio".
-- ILIKE para pegar a palavra com qualquer combinacao de maiusculas.
UPDATE public.funcoes SET nome = 'Áudio' WHERE nome ILIKE 'aúdio';
