import { assertEquals, assertFalse, assertStringIncludes } from 'jsr:@std/assert@1.0.19';
import { stub } from 'jsr:@std/testing@1.0.17/mock';

import { cabecalhosCors } from './cors.ts';
import { AppError, CODIGO_ERRO_INTERNO, MENSAGEM_ERRO_INTERNO } from './erros.ts';
import { comTratamentoDeErros } from './resposta.ts';
import { CODIGO_PAYLOAD_INVALIDO, validarCorpo, z } from './validacao.ts';

const schemaExemplo = z.object({
  id_carona: z.uuid(),
  vagas: z.int().min(1).max(7),
  veiculo: z.object({ placa: z.string().regex(/^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/) }),
});

const handlerExemplo = comTratamentoDeErros(async (req) => {
  const corpo = await validarCorpo(req, schemaExemplo);
  return Response.json({ data: corpo }, { status: 201 });
});

function post(corpo: string, cabecalhos: Record<string, string> = {}): Request {
  return new Request('http://localhost/exemplo', {
    method: 'POST',
    body: corpo,
    headers: cabecalhos,
  });
}

Deno.test('payload válido chega ao handler', async () => {
  const corpo = {
    id_carona: 'd2000000-0000-4000-8000-000000000001',
    vagas: 2,
    veiculo: { placa: 'ABC1D23' },
  };

  const resposta = await handlerExemplo(post(JSON.stringify(corpo)));

  assertEquals(resposta.status, 201);
  assertEquals(await resposta.json(), { data: corpo });
});

Deno.test('payload inválido responde 400 com os campos inválidos', async () => {
  const resposta = await handlerExemplo(
    post(JSON.stringify({ id_carona: 'nao-e-uuid', vagas: 0, veiculo: { placa: 'abc-1234' } })),
  );
  const { error } = await resposta.json();

  assertEquals(resposta.status, 400);
  assertEquals(error.code, CODIGO_PAYLOAD_INVALIDO);
  assertEquals(Object.keys(error.details.campos).sort(), ['id_carona', 'vagas', 'veiculo.placa']);
});

Deno.test('campo obrigatório ausente aparece em details.campos', async () => {
  const resposta = await handlerExemplo(post(JSON.stringify({ vagas: 3 })));
  const { error } = await resposta.json();

  assertEquals(resposta.status, 400);
  assertEquals(Object.keys(error.details.campos).sort(), ['id_carona', 'veiculo']);
});

Deno.test('corpo que não é JSON responde 400', async () => {
  const resposta = await handlerExemplo(post('{ isto não é json'));
  const { error } = await resposta.json();

  assertEquals(resposta.status, 400);
  assertEquals(error.code, CODIGO_PAYLOAD_INVALIDO);
  assertEquals(error.details, {});
});

Deno.test('AppError responde com o status, código, mensagem e details do erro', async () => {
  const handler = comTratamentoDeErros(() => {
    throw new AppError(409, 'CARONA_LOTADA', 'Esta carona não tem mais vagas.', { vagas: 0 });
  });

  const resposta = await handler(new Request('http://localhost/exemplo'));

  assertEquals(resposta.status, 409);
  assertEquals(await resposta.json(), {
    error: {
      code: 'CARONA_LOTADA',
      message: 'Esta carona não tem mais vagas.',
      details: { vagas: 0 },
    },
  });
});

Deno.test('erro não tratado responde 500 genérico, sem vazar a mensagem original', async () => {
  const handler = comTratamentoDeErros(() => {
    throw new Error('falha de conexão com senha=segredo123');
  });
  const consoleError = stub(console, 'error');

  try {
    const resposta = await handler(new Request('http://localhost/exemplo'));
    const texto = await resposta.text();

    assertEquals(resposta.status, 500);
    assertEquals(JSON.parse(texto), {
      error: { code: CODIGO_ERRO_INTERNO, message: MENSAGEM_ERRO_INTERNO, details: {} },
    });
    assertFalse(texto.includes('segredo123'));
    assertEquals(consoleError.calls.length, 1);
    assertStringIncludes(String(consoleError.calls[0].args[0]), 'falha de conexão');
  } finally {
    consoleError.restore();
  }
});

Deno.test('valor lançado que não é Error também responde 500 genérico', async () => {
  const handler = comTratamentoDeErros(() => {
    throw 'texto solto';
  });
  const consoleError = stub(console, 'error');

  try {
    const resposta = await handler(new Request('http://localhost/exemplo'));
    const { error } = await resposta.json();

    assertEquals(resposta.status, 500);
    assertEquals(error.code, CODIGO_ERRO_INTERNO);
  } finally {
    consoleError.restore();
  }
});

Deno.test('CORS só libera origens da lista', () => {
  const permitidas = ['http://localhost:8081'];

  assertEquals(
    cabecalhosCors('http://localhost:8081', permitidas)['Access-Control-Allow-Origin'],
    'http://localhost:8081',
  );
  assertEquals(cabecalhosCors('https://site-malicioso.com', permitidas), {});
  assertEquals(cabecalhosCors(null, permitidas), {});
});

Deno.test('respostas de erro também levam os cabeçalhos de CORS da origem permitida', async () => {
  const handler = comTratamentoDeErros(
    async (req) => {
      await validarCorpo(req, schemaExemplo);
      return new Response(null, { status: 204 });
    },
    ['http://localhost:8081', 'http://localhost:19006'],
  );

  const resposta = await handler(post('{}', { origin: 'http://localhost:19006' }));
  await resposta.body?.cancel();

  assertEquals(resposta.status, 400);
  assertEquals(resposta.headers.get('access-control-allow-origin'), 'http://localhost:19006');
});
