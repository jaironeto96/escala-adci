-- Envio do aviso as 7h em ponto, agendado pelo proprio Supabase.
--
-- O agendador da Vercel, no plano gratuito, dispara em qualquer momento dentro da
-- hora marcada — o aviso chegava as 7h53. O pg_cron do Supabase roda no minuto
-- exato e chama a mesma rota do app.
--
-- O agendamento da Vercel continua como reserva. Se este falhar, o de la ainda
-- entrega dentro da hora. Se este funcionar, o de la encontra todo mundo ja
-- avisado e nao manda nada de novo — cada escala e marcada ao ser avisada.
--
-- RODAR UMA VEZ SO. Antes, troque COLE_AQUI_O_CRON_SECRET pelo valor do
-- CRON_SECRET cadastrado na Vercel.

-- 1) Extensoes: agendador (pg_cron) e chamadas HTTP (pg_net).
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;
grant usage on schema cron to postgres;
grant all privileges on all tables in schema cron to postgres;

-- 2) O segredo que a rota exige, guardado no cofre do Supabase (Vault), e nao
--    escrito no agendamento, onde ficaria visivel.
select vault.create_secret('COLE_AQUI_O_CRON_SECRET', 'cron_secret');

-- 3) Todo dia as 10:00 UTC, que e 07:00 em Brasilia.
--    O limite de 2 minutos substitui o padrao do pg_net, de 2 segundos: enviar
--    e-mail e notificacao para varios escalados leva mais que isso.
select cron.schedule(
  'aviso-escala-7h',
  '0 10 * * *',
  $$
  select net.http_get(
    url := 'https://escala.adci.org.br/api/aviso-escala',
    headers := jsonb_build_object(
      'Authorization',
      'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    timeout_milliseconds := 120000
  );
  $$
);
