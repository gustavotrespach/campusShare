import { criarDependencias } from './dependencias.ts';
import { criarHandler } from './handler.ts';

// SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são injetadas pelo runtime das Edge Functions.
// MERCADO_PAGO_ACCESS_TOKEN (teste) e MERCADO_PAGO_WEBHOOK_SECRET (assinatura secreta do painel,
// Webhooks): supabase/functions/.env no local, `supabase secrets set` no remoto.
const handler = criarHandler(
  criarDependencias({
    supabase: {
      url: Deno.env.get('SUPABASE_URL') ?? '',
      chaveServico: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    },
    orders: { accessToken: Deno.env.get('MERCADO_PAGO_ACCESS_TOKEN') ?? '' },
    segredo: Deno.env.get('MERCADO_PAGO_WEBHOOK_SECRET') ?? '',
  }),
);

Deno.serve(handler);
