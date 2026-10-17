// Testes sem rede e sem permissões (o CI roda `deno test` puro): o fetch é falso e responde no
// formato da API de Orders e do PostgREST local. Passa pelo código real de dependencias.ts,
// orders.ts, assinatura.ts e _shared/supabase-rest.ts.
import { assert, assertEquals, assertFalse } from 'jsr:@std/assert@1.0.19';

import { hmacHex, iguaisEmTempoConstante, montarManifest, variantesDoId } from './assinatura.ts';
import { criarDependencias } from './dependencias.ts';
import { criarHandler } from './handler.ts';

// Segredo e token fictícios: só existem neste teste
const SEGREDO = 'segredo-ficticio-de-teste';
const TOKEN_MP = 'APP_USR-TOKEN-FALSO-DO-WEBHOOK-NAO-PODE-VAZAR';
const AGORA = 1_760_720_060_000;
// O ts real vem em segundos (Fase 13.1: ts_digitos = 10 nas notificações de produção)
const AGORA_S = Math.floor(AGORA / 1000);
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
  // Como o id entra no manifest: em minúsculas (documentação, padrão) ou como está na URL
  varianteId?: 'minusculas' | 'original';
} = {}): Promise<Request> {
  const dataId = opcoes.dataId ?? ID_ORDER;
  const tipo = opcoes.tipo ?? 'order';
  const ts = String(opcoes.ts ?? AGORA_S - 5);
  const idAssinado = opcoes.idNoManifest ?? dataId;
  const manifest = montarManifest(
    opcoes.varianteId === 'original' ? idAssinado : idAssinado.toLowerCase(),
    REQUEST_ID,
    ts,
  );
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
  // ts em segundos e as duas variantes do id de order
  assertEquals(
    await hmacHex(SEGREDO, 'id:ORDTST01ABCDEF;request-id:req-123;ts:1760720000;'),
    '1eaab64087a5b05f1f8bc9542e3a6b0d65717e1c98669c9197cb8f70c2c6bc3e',
  );
  assertEquals(
    await hmacHex(SEGREDO, 'id:ordtst01abcdef;request-id:req-123;ts:1760720000;'),
    '765200393cb6f6bbb2814785a038590c7f54b986ae92b46ec2c1c024e67dd8fc',
  );
  assertEquals(
    await hmacHex(SEGREDO, 'id:123456;request-id:req-123;ts:1760720000;'),
    'b52eb29342af8d59fc6dcfe2655aa0a7d0e23da14f7efd310f98d7be6925c416',
  );
});

Deno.test('manifest: id como recebido e segmentos ausentes fora', () => {
  assertEquals(
    montarManifest('ORDTST01ABCDEF', 'req-123', '1760720000'),
    'id:ORDTST01ABCDEF;request-id:req-123;ts:1760720000;',
  );
  assertEquals(
    montarManifest(null, 'req-123', '1760720000'),
    'request-id:req-123;ts:1760720000;',
  );
  assertEquals(montarManifest('abc', null, '1'), 'id:abc;ts:1;');
});

Deno.test('variantes do data.id: duas com letras maiúsculas, uma sem', () => {
  assertEquals(variantesDoId('ORDTST01ABCDEF'), [
    ['minusculas', 'ordtst01abcdef'],
    ['original', 'ORDTST01ABCDEF'],
  ]);
  assertEquals(variantesDoId('123456'), [['minusculas', '123456']]);
  assertEquals(variantesDoId('ordtst01abcdef'), [['minusculas', 'ordtst01abcdef']]);
  assertEquals(variantesDoId(null), [['sem_id', null]]);
});

// Vetores do openssl acima, passando pelo handler inteiro
const VETORES: Record<string, [string, string, string]> = {
  'id de order assinado como veio (notificação real)': [
    'ORDTST01ABCDEF',
    '1eaab64087a5b05f1f8bc9542e3a6b0d65717e1c98669c9197cb8f70c2c6bc3e',
    'original',
  ],
  'id de order assinado em minúsculas (documentação)': [
    'ORDTST01ABCDEF',
    '765200393cb6f6bbb2814785a038590c7f54b986ae92b46ec2c1c024e67dd8fc',
    'minusculas',
  ],
  'id numérico (simulador do painel)': [
    '123456',
    'b52eb29342af8d59fc6dcfe2655aa0a7d0e23da14f7efd310f98d7be6925c416',
    'minusculas',
  ],
};

for (const [nome, [dataId, v1, variante]] of Object.entries(VETORES)) {
  Deno.test(`${nome} → aceito, variante '${variante}'`, async () => {
    const { handler, logs } = cenario({
      [`v1/orders/${dataId}`]: () => Response.json({ message: 'not found' }, { status: 404 }),
    });
    const resposta = await handler(
      new Request(`http://localhost/webhook-mercado-pago?data.id=${dataId}&type=order`, {
        method: 'POST',
        headers: { 'x-signature': `ts=1760720000,v1=${v1}`, 'x-request-id': 'req-123' },
        body: '{}',
      }),
    );

    assertEquals(resposta.status, 200);
    const aceita = logs.map((l) => JSON.parse(l)).find((l) => l.evento === 'assinatura_aceita');
    assertEquals(aceita?.variante_id, variante);
  });
}

Deno.test('id de order com outra caixa (nenhuma variante) → 401 hmac_invalido', async () => {
  // Assinado com "OrdTst01AbcDef": nem minúsculas nem a forma da URL ("ORDTST01ABCDEF")
  const v1 = await hmacHex(SEGREDO, 'id:OrdTst01AbcDef;request-id:req-123;ts:1760720000;');
  const { handler, chamadas, logs } = cenario();
  const resposta = await handler(
    new Request('http://localhost/webhook-mercado-pago?data.id=ORDTST01ABCDEF&type=order', {
      method: 'POST',
      headers: { 'x-signature': `ts=1760720000,v1=${v1}`, 'x-request-id': 'req-123' },
      body: '{}',
    }),
  );

  assertEquals(resposta.status, 401);
  assertEquals(chamadas.length, 0);
  assert(logs.some((l) => l.includes('"motivo":"hmac_invalido"')));
});

Deno.test('sem data.id na URL: assinatura sem o segmento id → variante sem_id', async () => {
  const ts = String(AGORA_S);
  const v1 = await hmacHex(SEGREDO, montarManifest(null, REQUEST_ID, ts));
  const { handler, logs } = cenario();
  const resposta = await handler(
    new Request('http://localhost/webhook-mercado-pago?type=order', {
      method: 'POST',
      headers: { 'x-signature': `ts=${ts},v1=${v1}`, 'x-request-id': REQUEST_ID },
      body: JSON.stringify({ type: 'order', data: { id: ID_ORDER } }),
    }),
  );

  assertEquals(resposta.status, 200);
  const aceita = logs.map((l) => JSON.parse(l)).find((l) => l.evento === 'assinatura_aceita');
  assertEquals(aceita?.variante_id, 'sem_id');
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
      {
        variante_id: 'minusculas',
        ts_digitos: 13,
        idade_s: 5,
        id_na_url: true,
        tem_request_id: true,
      },
    ],
    [
      'segundos, aceita (id original)',
      await notificacao({ ts: AGORA_S - 120, varianteId: 'original' }),
      'assinatura_aceita',
      {
        variante_id: 'original',
        ts_digitos: 10,
        idade_s: 120,
        id_na_url: true,
        tem_request_id: true,
      },
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
    // Só os campos do diagnóstico do ts; os do hmac_invalido têm teste próprio abaixo
    const dados = JSON.parse(linha);
    const conferidos = Object.fromEntries(Object.keys(esperado).map((k) => [k, dados[k]]));
    assertEquals(conferidos, esperado, nome);
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

// ------------------------------------------------------------
// Log de diagnóstico do hmac_invalido (Fase 13.3)
// ------------------------------------------------------------

const CAMPOS_HMAC_INVALIDO = [
  'query',
  'data_id_url',
  'request_id',
  'ts',
  'v1_prefixo',
  'chaves_assinatura',
  'corpo_data_id',
  'corpo_type',
  'corpo_action',
  'corpo_live_mode',
  'corpo_user_id',
];

// Como uma notificação real de order chega, com campos do corpo que não podem ir para o log
function notificacaoReal(v1: string): { requisicao: Request; corpo: string } {
  const corpo = JSON.stringify({
    action: 'order.processed',
    api_version: 'v1',
    application_id: '1234567890123456',
    date_created: '2026-10-17T20:10:00Z',
    live_mode: false,
    type: 'order',
    user_id: 987654321,
    data: {
      id: ID_ORDER,
      external_reference: 'referencia-do-corpo-nao-vai-para-o-log',
      status: 'processed',
      total_amount: '5.00',
    },
  });
  const requisicao = new Request(
    `http://localhost/webhook-mercado-pago?data.id=${ID_ORDER}&type=order`,
    {
      method: 'POST',
      headers: { 'x-signature': `ts=${AGORA_S},v1=${v1}`, 'x-request-id': REQUEST_ID },
      body: corpo,
    },
  );
  return { requisicao, corpo };
}

Deno.test('hmac_invalido registra o que entra na assinatura, sem v1 inteiro nem corpo', async () => {
  const v1 = '0123abcd' + 'f'.repeat(56);
  const { requisicao, corpo } = notificacaoReal(v1);
  const { handler, logs } = cenario();
  const resposta = await handler(requisicao);

  assertEquals(resposta.status, 401);
  const recusa = JSON.parse(logs.find((l) => l.includes('assinatura_recusada')) ?? '{}');
  const registrados = Object.fromEntries(CAMPOS_HMAC_INVALIDO.map((k) => [k, recusa[k]]));
  assertEquals(registrados, {
    query: `?data.id=${ID_ORDER}&type=order`,
    data_id_url: ID_ORDER,
    request_id: REQUEST_ID,
    ts: String(AGORA_S),
    v1_prefixo: '0123abcd',
    chaves_assinatura: 'ts,v1',
    corpo_data_id: ID_ORDER,
    corpo_type: 'order',
    corpo_action: 'order.processed',
    corpo_live_mode: false,
    corpo_user_id: 987654321,
  });
  assertEquals(recusa.motivo, 'hmac_invalido');
  assertEquals(recusa.v1_prefixo.length, 8);
  for (const linha of logs) {
    assertFalse(linha.includes(v1), 'v1 inteiro no log');
    assertFalse(linha.includes(SEGREDO), 'segredo no log');
    assertFalse(linha.includes(corpo), 'corpo inteiro no log');
    assertFalse(linha.includes('referencia-do-corpo'), 'campo do corpo fora da lista no log');
    assertFalse(linha.includes('application_id'), 'campo do corpo fora da lista no log');
    assertFalse(linha.includes('request-id:'), 'manifest no log');
  }
});

Deno.test('hmac_invalido sem corpo JSON: só os campos que existem', async () => {
  const { handler, logs } = cenario();
  await handler(
    new Request(`http://localhost/webhook-mercado-pago?data.id=${ID_ORDER}`, {
      method: 'POST',
      headers: { 'x-signature': `v1=${'9'.repeat(64)},ts=${AGORA_S},extra=1` },
      body: 'não é json',
    }),
  );
  const recusa = JSON.parse(logs[0]);
  assertEquals(recusa.motivo, 'hmac_invalido');
  assertEquals(recusa.chaves_assinatura, 'v1,ts,extra');
  assertEquals(recusa.v1_prefixo, '99999999');
  for (const campo of ['request_id', 'corpo_data_id', 'corpo_type', 'corpo_user_id']) {
    assertFalse(campo in recusa, `${campo} deveria estar ausente`);
  }
});

Deno.test('hmac_invalido corta valores longos vindos de fora', async () => {
  const idLongo = 'X'.repeat(500);
  const { handler, logs } = cenario();
  await handler(
    new Request(`http://localhost/webhook-mercado-pago?data.id=${idLongo}`, {
      method: 'POST',
      headers: { 'x-signature': `ts=${AGORA_S},v1=${'1'.repeat(64)}` },
      body: '{}',
    }),
  );
  const recusa = JSON.parse(logs[0]);
  assertEquals(recusa.data_id_url.length, 200);
  assertEquals(recusa.query.length, 200);
});

Deno.test('assinatura válida e outros motivos de recusa não registram esses campos', async () => {
  const casos: [string, Request][] = [
    ['válida', await notificacao()],
    ['cabecalho_ausente', await notificacao({ semAssinatura: true })],
  ];
  for (const [nome, requisicao] of casos) {
    const { handler, logs } = cenario();
    await handler(requisicao);
    assert(logs.length > 0);
    for (const linha of logs) {
      const dados = JSON.parse(linha);
      for (const campo of CAMPOS_HMAC_INVALIDO) {
        assertFalse(campo in dados, `${nome}: ${campo} em ${dados.evento}`);
      }
    }
  }
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

Deno.test('consulta com HTTP 400 (id inválido, ex.: simulador) → 200 sem tocar no banco', async () => {
  const { handler, chamou, logs } = cenario({
    [`v1/orders/${ID_ORDER}`]: () => Response.json({ message: 'bad request' }, { status: 400 }),
  });
  const resposta = await handler(await notificacao());

  assertEquals(resposta.status, 200);
  assertEquals((await resposta.json()).resultado, 'IGNORADO_ORDER_INVALIDA');
  assertEquals(chamou('rpc/confirmar_pagamento').length, 0);
  assert(logs.some((l) => l.includes('order_invalida')));
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
  'HTTP 403 (token sem permissão)': () => Response.json({ message: 'forbidden' }, { status: 403 }),
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
