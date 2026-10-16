import { assertEquals } from 'jsr:@std/assert@1.0.19';

import { handler } from './handler.ts';

Deno.test('GET /health responde 200 com { status: "ok" } em JSON', async () => {
  const resposta = await handler(new Request('http://localhost/health'));

  assertEquals(resposta.status, 200);
  assertEquals(resposta.headers.get('content-type'), 'application/json');
  assertEquals(await resposta.json(), { status: 'ok' });
});

Deno.test('OPTIONS /health responde o preflight com 204', async () => {
  const resposta = await handler(new Request('http://localhost/health', { method: 'OPTIONS' }));

  assertEquals(resposta.status, 204);
  assertEquals(await resposta.text(), '');
});
