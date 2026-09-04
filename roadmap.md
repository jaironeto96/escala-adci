# Roadmap

- [ ] E-mail diário às 07h (Brasília) para cada pessoa escalada no dia, com culto, horário e função
  - Bloqueado: falta configurar um domínio próprio de envio (Gmail não serve como remetente)
  - Depois: scaffold de e-mail transacional + rota `/api/public/hooks/aviso-escala` + cron pg_cron 10:00 UTC
- [ ] SMS com a mesma mensagem — adiado (usuário optou por só e-mail por enquanto; exige conectar Twilio ou GatewayAPI)
