import { assertEquals } from 'jsr:@std/assert@1';

import { handler } from './handler.ts';

Deno.test('GET /health responde 200 com { status: "ok" } em JSON', async () => {
  const resposta = handler(new Request('http://localhost/health'));

  assertEquals(resposta.status, 200);
  assertEquals(resposta.headers.get('content-type'), 'application/json');
  assertEquals(await resposta.json(), { status: 'ok' });
});
