import { criarDependencias } from './dependencias.ts';
import { criarHandler } from './handler.ts';

// SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são injetadas pelo runtime das Edge Functions.
// MERCADO_PAGO_ACCESS_TOKEN: credencial de TESTE (supabase/functions/.env no local,
// `supabase secrets set` no remoto). MERCADO_PAGO_MODO_TESTE: "false" desliga o pagador de
// teste (APRO); qualquer outro valor, ou ausência, mantém o modo de teste (padrão do projeto).
const handler = criarHandler(
  criarDependencias({
    supabase: {
      url: Deno.env.get('SUPABASE_URL') ?? '',
      chaveServico: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    },
    mercadoPago: {
      accessToken: Deno.env.get('MERCADO_PAGO_ACCESS_TOKEN') ?? '',
      modoTeste: Deno.env.get('MERCADO_PAGO_MODO_TESTE') !== 'false',
    },
  }),
);

Deno.serve(handler);
