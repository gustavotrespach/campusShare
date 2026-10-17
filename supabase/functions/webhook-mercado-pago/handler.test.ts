// Testes sem rede e sem permissões (o CI roda `deno test` puro): o fetch é falso e responde no
// formato da API de Orders e do PostgREST local. Passa pelo código real de dependencias.ts,
// orders.ts, assinatura.ts e _shared/supabase-rest.ts.
import { assert, assertEquals, assertFalse } from 'jsr:@std/assert@1.0.19';

import { hmacHex, iguaisEmTempoConstante, montarManifest } from './assinatura.ts';
import { criarDependencias } from './dependencias.ts';
import { criarHandler } from './handler.ts';

// Segredo e token fictícios: só existem neste teste
const SEGREDO = 'segredo-ficticio-de-teste';
const TOKEN_MP = 'APP_USR-TOKEN-FALSO-DO-WEBHOOK-NAO-PODE-VAZAR';
const AGORA = 1_760_720_060_000;
const ID_ORDER = 'ORDTST01M55DT6T80KB4AHXZHKT4J93S';
const ID_PAGAMENTO = '37bae66f-fff4-4111-a7d1-28fe8ff86808';
const REQUEST_ID = 'b6f0c0a2-1111-4222-8333-944455556666';

interface Chamada {
  url: string;
  cabecalhos: Headers;
  corpo: unknown;
}

type Rota = () => Response | Promise<Response>;

function order(status: string, statusDetail: string): Record<string, unknown> {
  return {
    id: ID_ORDER,
    type: 'online',
    status,
    status_detail: statusDetail,
    external_reference: ID_PAGAMENTO,
    total_amount: '5.00',
    total_paid_amount: status === 'processed' ? '5.00' : '0.00',
  };
}

function cenario(trocas: Partial<Record<string, Rota>> = {}, opcoes: { segredo?: string } = {}) {
  const chamadas: Chamada[] = [];
  const logs: string[] = [];
  const rotas: Record<string, Rota> = {
    [`v1/orders/${ID_ORDER}`]: () => Response.json(order('processed', 'accredited')),
    'rpc/confirmar_pagamento': () => Response.json('CONFIRMADO'),
    ...trocas,
  };
  const fetchFalso = async (entrada: RequestInfo | URL, init?: RequestInit) => {
    const url = String(entrada);
    chamadas.push({
      url,
      cabecalhos: new Headers(init?.headers),
      corpo: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined,
    });
    const chave = Object.keys(rotas).find((sufixo) => url.endsWith(sufixo));
    const rota = chave ? rotas[chave] : undefined;
    if (!rota) {
      throw new Error(`rota não simulada: ${url}`);
    }
    return await rota();
  };
  const handler = criarHandler(
    criarDependencias({
      supabase: { url: 'http://kong:8000', chaveServico: 'chave-servico', fetch: fetchFalso },
      orders: { accessToken: TOKEN_MP, timeoutMs: 30, fetch: fetchFalso },
      segredo: opcoes.segredo ?? SEGREDO,
      agoraMs: () => AGORA,
      log: (evento, dados) => logs.push(JSON.stringify({ evento, ...dados })),
      origensCors: [],
    }),
  );
  const chamou = (trecho: string) => chamadas.filter((c) => c.url.includes(trecho));
  return { handler, chamadas, chamou, logs };
}

// Notificação como o Mercado Pago manda: data.id e type na query, x-signature e x-request-id
async function notificacao(opcoes: {
  dataId?: string;
  tipo?: string;
  ts?: number;
  segredo?: string;
  v1?: string;
  semAssinatura?: boolean;
  xSignature?: string;
  idNoManifest?: string;
} = {}): Promise<Request> {
  const dataId = opcoes.dataId ?? ID_ORDER;
  const tipo = opcoes.tipo ?? 'order';
  const ts = String(opcoes.ts ?? AGORA - 5_000);
  const manifest = montarManifest(opcoes.idNoManifest ?? dataId, REQUEST_ID, ts);
  const v1 = opcoes.v1 ?? await hmacHex(opcoes.segredo ?? SEGREDO, manifest);
  const cabecalhos: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-request-id': REQUEST_ID,
  };
  if (!opcoes.semAssinatura) {
    cabecalhos['x-signature'] = opcoes.xSignature ?? `ts=${ts},v1=${v1}`;
  }
  return new Request(
    `http://localhost/webhook-mercado-pago?data.id=${dataId}&type=${tipo}`,
    {
      method: 'POST',
      headers: cabecalhos,
      body: JSON.stringify({
        action: 'order.processed',
        type: tipo,
        data: { id: dataId, status: 'processed', external_reference: 'corpo-nao-e-confiavel' },
      }),
    },
  );
}

// ------------------------------------------------------------
// Assinatura (vetores calculados fora do código, com openssl dgst -sha256 -hmac)
// ------------------------------------------------------------

Deno.test('HMAC-SHA256 em hex confere com o openssl', async () => {
  assertEquals(
    await hmacHex(SEGREDO, 'id:ordtst01abcdef;request-id:req-123;ts:1760720000000;'),
    '835d4ee20d9db5f94ab45466d73dca21c5b3942d6fead9f7abbc01db2f8586b7',
  );
  assertEquals(
    await hmacHex(SEGREDO, 'request-id:req-123;ts:1760720000000;'),
    '9a33d8304820e885985efaa9b9b3c50f098154cf9666aafe768517fb74a854c4',
  );
});

Deno.test('manifest: data.id em minúsculas e segmentos ausentes fora', () => {
  assertEquals(
    montarManifest('ORDTST01ABCDEF', 'req-123', '1760720000000'),
    'id:ordtst01abcdef;request-id:req-123;ts:1760720000000;',
  );
  assertEquals(
    montarManifest(null, 'req-123', '1760720000000'),
    'request-id:req-123;ts:1760720000000;',
  );
  assertEquals(montarManifest('abc', null, '1'), 'id:abc;ts:1;');
});

Deno.test('comparação em tempo constante', () => {
  assert(iguaisEmTempoConstante('abc123', 'abc123'));
  assertFalse(iguaisEmTempoConstante('abc123', 'abc124'));
  assertFalse(iguaisEmTempoConstante('abc', 'abc123'));
  assertFalse(iguaisEmTempoConstante('', 'a'));
});

Deno.test('assinatura válida, com data.id em maiúsculas na URL → confirma (200)', async () => {
  const { handler, chamou } = cenario();
  const resposta = await handler(await notificacao());

  assertEquals(resposta.status, 200);
  assertEquals(await resposta.json(), { recebido: true, resultado: 'CONFIRMADO' });
  assertEquals(chamou('v1/orders').length, 1);
});

// Sem janela de tempo: vale qualquer idade e qualquer unidade do ts, se o HMAC conferir
const TS_ACEITOS: Record<string, number> = {
  'em segundos (10 dígitos)': Math.floor(AGORA / 1000) - 5,
  'antigo (01/01/2021, em ms)': 1_609_459_200_000,
  'antigo (01/01/2021, em segundos)': 1_609_459_200,
  'no futuro (1 h)': AGORA + 60 * 60 * 1000,
};

for (const [nome, ts] of Object.entries(TS_ACEITOS)) {
  Deno.test(`assinatura correta com ts ${nome} → aceita`, async () => {
    const { handler, chamou } = cenario();
    const resposta = await handler(await notificacao({ ts }));

    assertEquals(resposta.status, 200);
    assertEquals((await resposta.json()).resultado, 'CONFIRMADO');
    assertEquals(chamou('v1/orders').length, 1);
  });
}

const ASSINATURAS_RUINS: Record<string, [() => Promise<Request>, string]> = {
  'v1 errado': [() => notificacao({ v1: 'a'.repeat(64) }), 'hmac_invalido'],
  'assinada com outro segredo': [
    () => notificacao({ segredo: 'outro-segredo' }),
    'hmac_invalido',
  ],
  'sem x-signature': [() => notificacao({ semAssinatura: true }), 'cabecalho_ausente'],
  'x-signature sem ts': [
    () => notificacao({ xSignature: `v1=${'a'.repeat(64)}` }),
    'cabecalho_ausente',
  ],
  'x-signature sem v1': [() => notificacao({ xSignature: `ts=${AGORA}` }), 'cabecalho_ausente'],
  'ts trocado depois de assinado': [
    async () => {
      const v1 = await hmacHex(SEGREDO, montarManifest(ID_ORDER, REQUEST_ID, String(AGORA)));
      return notificacao({ xSignature: `ts=${AGORA + 1},v1=${v1}` });
    },
    'hmac_invalido',
  ],
  'manifest com data.id em maiúsculas (fora da regra da documentação)': [
    async () => {
      const ts = String(AGORA - 5_000);
      const v1 = await hmacHex(SEGREDO, `id:${ID_ORDER};request-id:${REQUEST_ID};ts:${ts};`);
      return notificacao({ v1, ts: Number(ts) });
    },
    'hmac_invalido',
  ],
  'data.id trocado depois de assinado': [
    () => notificacao({ idNoManifest: 'ORDTSTOUTRAORDER' }),
    'hmac_invalido',
  ],
};

for (const [nome, [montar, motivo]] of Object.entries(ASSINATURAS_RUINS)) {
  Deno.test(`assinatura ruim (${nome}) → 401 '${motivo}' sem consultar nada`, async () => {
    const { handler, chamadas, logs } = cenario();
    const resposta = await handler(await montar());

    assertEquals(resposta.status, 401);
    assertEquals((await resposta.json()).error.code, 'ASSINATURA_INVALIDA');
    assertEquals(chamadas.length, 0);
    const recusa = logs.map((linha) => JSON.parse(linha)).find((l) =>
      l.evento === 'assinatura_recusada'
    );
    assertEquals(recusa?.motivo, motivo);
  });
}

Deno.test('log de diagnóstico do ts: aceita e recusada, sem v1 nem segredo', async () => {
  const casos: [string, Request, string, Record<string, unknown>][] = [
    [
      'ms, aceita',
      await notificacao({ ts: AGORA - 5_000 }),
      'assinatura_aceita',
      { ts_digitos: 13, idade_s: 5, id_na_url: true, tem_request_id: true },
    ],
    [
      'segundos, aceita',
      await notificacao({ ts: Math.floor(AGORA / 1000) - 120 }),
      'assinatura_aceita',
      { ts_digitos: 10, idade_s: 120, id_na_url: true, tem_request_id: true },
    ],
    [
      'segundos, recusada',
      await notificacao({ ts: Math.floor(AGORA / 1000), v1: 'c'.repeat(64) }),
      'assinatura_recusada',
      {
        motivo: 'hmac_invalido',
        ts_digitos: 10,
        idade_s: 0,
        id_na_url: true,
        tem_request_id: true,
      },
    ],
    [
      'ts não numérico, recusada',
      await notificacao({ xSignature: `ts=abc,v1=${'d'.repeat(64)}` }),
      'assinatura_recusada',
      { motivo: 'hmac_invalido', ts_digitos: 0, id_na_url: true, tem_request_id: true },
    ],
  ];
  for (const [nome, requisicao, evento, esperado] of casos) {
    const v1 = /v1=([^,]+)/.exec(requisicao.headers.get('x-signature') ?? '')?.[1] ?? '';
    const { handler, logs } = cenario();
    await handler(requisicao);

    const linha = logs.find((l) => JSON.parse(l).evento === evento);
    assert(linha, `${nome}: sem log ${evento}`);
    const { evento: _evento, ...dados } = JSON.parse(linha);
    assertEquals(dados, esperado, nome);
    assert(v1.length === 64);
    for (const l of logs) {
      assertFalse(l.includes(v1), `${nome}: v1 no log`);
      assertFalse(l.includes(SEGREDO), `${nome}: segredo no log`);
      assertFalse(l.includes('request-id:'), `${nome}: manifest no log`);
    }
  }
});

Deno.test('log de diagnóstico sem data.id na URL nem x-request-id', async () => {
  const { handler, logs } = cenario();
  await handler(
    new Request('http://localhost/webhook-mercado-pago?type=order', {
      method: 'POST',
      headers: { 'x-signature': `ts=${AGORA},v1=${'e'.repeat(64)}` },
      body: '{}',
    }),
  );
  const dados = JSON.parse(logs[0]);
  assertEquals(dados.evento, 'assinatura_recusada');
  assertEquals(dados.id_na_url, false);
  assertEquals(dados.tem_request_id, false);
});

Deno.test('sem segredo configurado → 401 sem consultar nada', async () => {
  const { handler, chamadas } = cenario({}, { segredo: '' });
  const resposta = await handler(await notificacao());

  assertEquals(resposta.status, 401);
  assertEquals(chamadas.length, 0);
});

Deno.test('GET → 405', async () => {
  const { handler } = cenario();
  const resposta = await handler(new Request('http://localhost/webhook-mercado-pago'));
  assertEquals(resposta.status, 405);
});

// ------------------------------------------------------------
// Fluxo depois da assinatura
// ------------------------------------------------------------

Deno.test('type diferente de order → 200 ignorado, sem consultar a API', async () => {
  const { handler, chamadas } = cenario();
  const resposta = await handler(await notificacao({ tipo: 'payment' }));

  assertEquals(resposta.status, 200);
  assertEquals((await resposta.json()).resultado, 'IGNORADO_TIPO');
  assertEquals(chamadas.length, 0);
});

Deno.test('order paga: consulta a API e confirma com id, external_reference e valor da API', async () => {
  const { handler, chamou } = cenario();
  const resposta = await handler(await notificacao());

  assertEquals(resposta.status, 200);
  const [consulta] = chamou('v1/orders');
  assertEquals(consulta.url, `https://api.mercadopago.com/v1/orders/${ID_ORDER}`);
  assertEquals(consulta.cabecalhos.get('authorization'), `Bearer ${TOKEN_MP}`);
  const [confirmacao] = chamou('rpc/confirmar_pagamento');
  // O external_reference vem da API, não do corpo da notificação ("corpo-nao-e-confiavel")
  assertEquals(confirmacao.corpo, {
    p_id_externo: ID_ORDER,
    p_id_pagamento: ID_PAGAMENTO,
    p_valor: 5,
  });
  assertEquals(confirmacao.cabecalhos.get('authorization'), 'Bearer chave-servico');
});

Deno.test('order ainda não paga (action_required) → 200 sem tocar no banco', async () => {
  for (
    const [status, detalhe] of [
      ['action_required', 'waiting_transfer'],
      ['failed', 'expired'],
      ['canceled', 'canceled'],
      ['processed', 'partially_refunded'],
    ]
  ) {
    const { handler, chamou } = cenario({
      [`v1/orders/${ID_ORDER}`]: () => Response.json(order(status, detalhe)),
    });
    const resposta = await handler(await notificacao());

    assertEquals(resposta.status, 200);
    assertEquals((await resposta.json()).resultado, 'IGNORADO_NAO_PAGA');
    assertEquals(chamou('rpc/confirmar_pagamento').length, 0);
  }
});

Deno.test('order não encontrada (404) → 200 ignorado', async () => {
  const { handler, chamou } = cenario({
    [`v1/orders/${ID_ORDER}`]: () => Response.json({ message: 'not found' }, { status: 404 }),
  });
  const resposta = await handler(await notificacao());

  assertEquals(resposta.status, 200);
  assertEquals((await resposta.json()).resultado, 'IGNORADO_ORDER_NAO_ENCONTRADA');
  assertEquals(chamou('rpc/confirmar_pagamento').length, 0);
});

const FALHAS_DO_MERCADO_PAGO: Record<string, Rota> = {
  'HTTP 503': () => Response.json({ message: `erro ${TOKEN_MP}` }, { status: 503 }),
  'HTTP 401 (token)': () => Response.json({ message: 'unauthorized' }, { status: 401 }),
  'falha de rede': () => Promise.reject(new TypeError('connection refused')),
};

for (const [nome, rota] of Object.entries(FALHAS_DO_MERCADO_PAGO)) {
  Deno.test(`Mercado Pago com ${nome} → 500 para o Mercado Pago tentar de novo`, async () => {
    const { handler, chamou } = cenario({ [`v1/orders/${ID_ORDER}`]: rota });
    const resposta = await handler(await notificacao());

    assertEquals(resposta.status, 500);
    assertEquals(chamou('rpc/confirmar_pagamento').length, 0);
  });
}

Deno.test('notificação repetida → 200 com JA_CONFIRMADO (idempotente)', async () => {
  const { handler } = cenario({ 'rpc/confirmar_pagamento': () => Response.json('JA_CONFIRMADO') });
  const resposta = await handler(await notificacao());

  assertEquals(resposta.status, 200);
  assertEquals((await resposta.json()).resultado, 'JA_CONFIRMADO');
});

Deno.test('divergência de valor → 200 com log (sem loop de retentativa)', async () => {
  const { handler, logs } = cenario({
    'rpc/confirmar_pagamento': () =>
      Response.json({
        code: 'PT409',
        details: null,
        hint: 'O valor pago não confere com o valor da reserva.',
        message: 'VALOR_DIVERGENTE',
      }, { status: 409 }),
  });
  const resposta = await handler(await notificacao());

  assertEquals(resposta.status, 200);
  assertEquals((await resposta.json()).resultado, 'RECUSADO_VALOR_DIVERGENTE');
  assert(logs.some((linha) => linha.includes('confirmacao_recusada')));
});

Deno.test('banco fora do ar ao confirmar → 500', async () => {
  const { handler } = cenario({
    'rpc/confirmar_pagamento': () => new Response('upstream error', { status: 502 }),
  });
  const resposta = await handler(await notificacao());

  assertEquals(resposta.status, 500);
});

Deno.test('order paga sem external_reference válido → 200 ignorado', async () => {
  const { handler, chamou } = cenario({
    [`v1/orders/${ID_ORDER}`]: () =>
      Response.json({ ...order('processed', 'accredited'), external_reference: 'ext_ref_1234' }),
  });
  const resposta = await handler(await notificacao());

  assertEquals(resposta.status, 200);
  assertEquals((await resposta.json()).resultado, 'IGNORADO_SEM_REFERENCIA');
  assertEquals(chamou('rpc/confirmar_pagamento').length, 0);
});

Deno.test('token e segredo nunca aparecem em log nem na resposta', async () => {
  const capturado: string[] = [];
  const originais = { log: console.log, error: console.error, warn: console.warn };
  const capturar = (...partes: unknown[]) => capturado.push(partes.map(String).join(' '));
  console.log = capturar;
  console.error = capturar;
  console.warn = capturar;
  try {
    const casos: [ReturnType<typeof cenario>, Request][] = [
      [cenario(), await notificacao()],
      [cenario(), await notificacao({ v1: 'b'.repeat(64) })],
      [
        cenario({ [`v1/orders/${ID_ORDER}`]: FALHAS_DO_MERCADO_PAGO['HTTP 503'] }),
        await notificacao(),
      ],
      [
        cenario({ 'rpc/confirmar_pagamento': () => new Response('x', { status: 500 }) }),
        await notificacao(),
      ],
    ];
    for (const [{ handler, logs }, requisicao] of casos) {
      const corpo = await (await handler(requisicao)).text();
      assertFalse(corpo.includes(TOKEN_MP));
      assertFalse(corpo.includes(SEGREDO));
      capturado.push(...logs);
    }
  } finally {
    console.log = originais.log;
    console.error = originais.error;
    console.warn = originais.warn;
  }
  assert(capturado.length > 0, 'os cenários deveriam ter gerado log');
  for (const linha of capturado) {
    assertFalse(linha.includes(TOKEN_MP), 'token no log');
    assertFalse(linha.includes(SEGREDO), 'segredo no log');
    assertFalse(linha.includes('APP_USR'), 'prefixo de credencial no log');
  }
});
