CREATE TYPE public.app_role AS ENUM ('admin', 'moderador', 'visualizador');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE POLICY "usuarios veem suas roles" ON public.user_roles
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin gerencia roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
GRANT INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;

-- substitui políticas permissivas
DROP POLICY IF EXISTS "auth manage cultos" ON public.cultos;
DROP POLICY IF EXISTS "auth manage departamentos" ON public.departamentos;
DROP POLICY IF EXISTS "auth manage funcoes" ON public.funcoes;
DROP POLICY IF EXISTS "auth manage pessoas" ON public.pessoas;
DROP POLICY IF EXISTS "auth manage pessoa_departamentos" ON public.pessoa_departamentos;
DROP POLICY IF EXISTS "auth manage pessoa_funcoes" ON public.pessoa_funcoes;
DROP POLICY IF EXISTS "auth manage escalas" ON public.escalas;

CREATE POLICY "ver cultos" ON public.cultos FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin gerencia cultos" ON public.cultos FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "ver departamentos" ON public.departamentos FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin gerencia departamentos" ON public.departamentos FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "ver funcoes" ON public.funcoes FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin gerencia funcoes" ON public.funcoes FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "ver pessoas" ON public.pessoas FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin gerencia pessoas" ON public.pessoas FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "ver pessoa_departamentos" ON public.pessoa_departamentos FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin gerencia pessoa_departamentos" ON public.pessoa_departamentos FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "ver pessoa_funcoes" ON public.pessoa_funcoes FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin gerencia pessoa_funcoes" ON public.pessoa_funcoes FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "ver escalas" ON public.escalas FOR SELECT TO authenticated USING (true);
CREATE POLICY "escalar" ON public.escalas FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderador'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderador'));

-- admin inicial + papel padrão para novos usuários
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role FROM auth.users WHERE email = 'jaironeto32@gmail.com'
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, CASE WHEN NEW.email = 'jaironeto32@gmail.com' THEN 'admin'::public.app_role ELSE 'visualizador'::public.app_role END)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created_role
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_role();