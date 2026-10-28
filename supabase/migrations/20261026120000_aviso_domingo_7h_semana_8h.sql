-- Aviso do dia: domingo as 7h, de segunda a sabado as 8h — em ponto, pelo pg_cron
-- do Supabase. Substitui o agendamento unico das 7h (20261009150000).
--
-- Domingo e mais cedo por causa da EBD, as 8h30. Nos outros dias o primeiro culto
-- e a noite, e as 8h o aviso nao chega cedo demais.
--
-- Serve tanto para quem ja rodou o agendamento das 7h quanto para quem nunca
-- rodou: liga as extensoes se faltarem, grava o segredo (trocando o antigo, se
-- houver) e troca o agendamento antigo pelos dois novos. Rodar de novo nao estraga
-- nada.
--
-- Antes de rodar, troque COLE_AQUI_O_CRON_SECRET pelo CRON_SECRET da Vercel. Ele
-- esta marcado como "Sensitive" la, e a Vercel nao mostra mais o valor: se
-- ninguem tiver anotado, crie uma senha nova, grave-a no CRON_SECRET da Vercel,
-- publique de novo (Redeploy) e use a mesma aqui.
--
-- O pg_cron do Supabase conta as horas em UTC: 10h UTC = 7h em Brasilia, 11h UTC
-- = 8h. No dia da semana, 0 e domingo e 1-6 e de segunda a sabado.
--
-- O agendamento da Vercel (vercel.json) segue as mesmas horas, como reserva: no
-- plano gratuito ele dispara em algum momento dentro da hora, encontra todo mundo
-- ja avisado e nao manda nada de novo.

-- 1) Extensoes: agendador (pg_cron) e chamadas HTTP (pg_net).
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;
grant usage on schema cron to postgres;
grant all privileges on all tables in schema cron to postgres;

-- 2) O segredo da rota, no cofre do Supabase (Vault). Se ja existir, e trocado —
--    a senha so aparece uma vez, aqui.
do $$
declare
  senha text := 'COLE_AQUI_O_CRON_SECRET';
begin
  if exists (select 1 from vault.secrets where name = 'cron_secret') then
    perform vault.update_secret((select id from vault.secrets where name = 'cron_secret'), senha);
  else
    perform vault.create_secret(senha, 'cron_secret');
  end if;
end
$$;

-- 3) Tira o agendamento antigo, das 7h todo dia, se existir.
select cron.unschedule('aviso-escala-7h')
where exists (select 1 from cron.job where jobname = 'aviso-escala-7h');

-- 4) Domingo, 10h UTC = 7h em Brasilia.
select cron.schedule(
  'aviso-escala-domingo',
  '0 10 * * 0',
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

-- 5) Segunda a sabado, 11h UTC = 8h em Brasilia.
select cron.schedule(
  'aviso-escala-semana',
  '0 11 * * 1-6',
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
