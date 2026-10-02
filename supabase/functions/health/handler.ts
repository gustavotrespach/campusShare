import { comTratamentoDeErros } from '../_shared/resposta.ts';

// Separado do index.ts para ser testável sem subir um servidor (Deno.serve).
export const handler = comTratamentoDeErros(() => {
  return Response.json({ status: 'ok' }, { status: 200 });
});
