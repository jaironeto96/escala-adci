-- Aparelhos que aceitaram receber notificacoes do app.
--
-- Cada linha e um aparelho de um usuario: o mesmo voluntario pode ter o celular e
-- o computador inscritos. O endereco (endpoint) e as chaves vem do navegador no
-- momento em que a pessoa toca em "Ativar notificacoes".
--
-- O e-mail fica aqui para o envio das 7h encontrar os aparelhos de cada escalado:
-- e o elo com a tabela pessoas, como em todo o resto do app.

CREATE TABLE public.push_inscricoes (
  user_id    uuid        NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint   text        NOT NULL,
  email      text        NOT NULL DEFAULT lower(auth.jwt() ->> 'email'),
  p256dh     text        NOT NULL,
  auth       text        NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, endpoint)
);

CREATE INDEX push_inscricoes_email ON public.push_inscricoes (email);

ALTER TABLE public.push_inscricoes ENABLE ROW LEVEL SECURITY;

-- Cada um ve e mexe so nos proprios aparelhos, e so com o proprio e-mail: ninguem
-- consegue inscrever o aparelho dele para receber os avisos de outra pessoa.
-- O envio das 7h le tudo pela chave de servico, que ignora estas regras.
CREATE POLICY "meus aparelhos" ON public.push_inscricoes
  FOR ALL TO authenticated
  USING      (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid() AND email = lower(auth.jwt() ->> 'email'));

NOTIFY pgrst, 'reload schema';
