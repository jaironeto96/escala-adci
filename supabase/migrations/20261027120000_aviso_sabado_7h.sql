-- Sabado passa para as 7h, como o domingo. De segunda a sexta continua as 8h.
--
-- Troca os dois agendamentos de 20261026120000 por outros dois, com nomes que dizem
-- os dias. O segredo do cofre (cron_secret) nao muda.
--
-- Horas em UTC: 10h = 7h em Brasilia, 11h = 8h. Dia da semana: 0 = domingo,
-- 6 = sabado, 1-5 = segunda a sexta.

select cron.unschedule('aviso-escala-domingo')
where exists (select 1 from cron.job where jobname = 'aviso-escala-domingo');

select cron.unschedule('aviso-escala-semana')
where exists (select 1 from cron.job where jobname = 'aviso-escala-semana');

-- Sabado e domingo, 7h em Brasilia.
select cron.schedule(
  'aviso-escala-sab-dom-7h',
  '0 10 * * 0,6',
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

-- Segunda a sexta, 8h em Brasilia.
select cron.schedule(
  'aviso-escala-seg-sex-8h',
  '0 11 * * 1-5',
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
