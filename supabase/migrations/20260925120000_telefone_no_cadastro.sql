-- O telefone informado no cadastro passa a ser gravado pelo banco, junto com o
-- nome, no mesmo instante em que a conta e criada.
--
-- Antes ele ia por uma segunda chamada do app, feita depois do cadastro. Ela
-- falhava de dois jeitos: nem acontecia quando a confirmacao de e-mail estava
-- ligada (o app parava antes de chega-la), e dependia da chave de servico, que so
-- foi configurada depois. O nome nunca teve esse problema porque sempre veio por
-- esta rotina.

CREATE OR REPLACE FUNCTION public.handle_new_user_voluntario()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.pessoas (nome, email, telefone)
  VALUES (
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.email,
    NULLIF(trim(NEW.raw_user_meta_data->>'telefone'), '')
  )
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.handle_new_user_voluntario() FROM anon, authenticated, public;

-- Recupera o telefone de quem ja se cadastrou. Ele nunca se perdeu: ficou guardado
-- nos dados da conta de login, so nao tinha sido copiado para o voluntario.
-- Nao sobrescreve telefone que alguem ja preencheu a mao em Voluntarios.
--
-- O RETURNING lista quem teve o telefone recuperado.
UPDATE public.pessoas p
SET telefone = trim(u.raw_user_meta_data->>'telefone')
FROM auth.users u
WHERE lower(p.email) = lower(u.email)
  AND coalesce(trim(p.telefone), '') = ''
  AND coalesce(trim(u.raw_user_meta_data->>'telefone'), '') <> ''
RETURNING p.nome, p.telefone;
