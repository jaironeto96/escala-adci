// Chave publica do par VAPID, usada pelo navegador para se inscrever e pelo servidor
// para assinar as notificacoes. E publica por natureza; a privada correspondente fica
// so na Vercel, em VAPID_PRIVATE_KEY. Arquivo proprio para o servidor poder importar
// a chave sem carregar o cliente do Supabase do navegador junto.
export const VAPID_PUBLICA =
  "BPn1U_tiNENBoLuU-eGvp9_CynDf30wTNqRP_Yoac3sebOs4et0jgc2OzTJFEfMs86wP2Bww7KkkRblp9lRbC5Q";
