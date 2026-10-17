// Testes sem rede e sem permissões (o CI roda `deno test` puro): o fetch é falso e responde no
// formato do Supabase local e da API de Orders. Passa pelo código real de montagem das
// requisições (dependencias.ts, supabase-rest.ts e mercado-pago.ts).
import { assert, assertEquals, assertFalse } from 'jsr:@std/assert@1.0.19';

import { criarDependencias } from './dependencias.ts';
import { criarHandler } from './handler.ts';
import { montarOrder, valorEmTexto } from './mercado-pago.ts';

const TOKEN_MP = 'APP_USR-TOKEN-FALSO-DE-TESTE-NAO-PODE-VAZAR';
const JWT_USUARIO = 'jwt-do-passageiro';
const ID_USUARIO = 'b0000000-0000-0000-0000-00000000000b';
const ID_CARONA = 'd2000000-0000-0000-0000-000000000003';
const ID_RESERVA = 'c1000000-0000-0000-0000-000000000001';
const ID_PAGAMENTO = 'c2000000-0000-0000-0000-000000000001';
const ID_ORDER = 'ORD01JTESTE0000000000000000';

interface Chamada {
  url: string;
  metodo: string;
  cabecalhos: Headers;
  corpo: unknown;
}

type Rota = (chamada: Chamada, sinal: AbortSignal | null) => Response | Promise<Response>;

const ORDER_CRIADA = {
  id: ID_ORDER,
  type: 'online',
  status: 'action_required',
  status_detail: 'waiting_transfer',
  external_reference: ID_PAGAMENTO,
  transactions: {
    payments: [{
      id: 'PAY01JTESTE',
      amount: '8.33',
      status: 'action_required',
      payment_method: {
        id: 'pix',
        type: 'bank_transfer',
        ticket_url: 'https://www.mercadopago.com.br/sandbox/payments/123/ticket',
        qr_code: '00020126580014br.gov.bcb.pix0136teste',
        qr_code_base64: '',
      },
    }],
  },
};

function rotasPadrao(): Record<string, Rota> {
  return {
    'auth/v1/user': (c) =>
      c.cabecalhos.get('authorization') === `Bearer ${JWT_USUARIO}`
        ? Response.json({
          id: ID_USUARIO,
          email: 'passageiro@rede.ulbra.br',
          user_metadata: { nome_completo: 'Paulo Passageiro' },
        })
        : Response.json({ code: 401, msg: 'invalid JWT' }, { status: 401 }),
    'rpc/reservar_vaga': () =>
      Response.json([{
        id_reserva: ID_RESERVA,
        id_pagamento: ID_PAGAMENTO,
        valor_individual: 8.33,
        taxa_plataforma: 0.83,
        valor_repassado: 7.5,
        status: 'PENDENTE',
      }]),
    'rpc/registrar_cobranca': () => new Response(null, { status: 204 }),
    'rpc/desfazer_reserva_sem_cobranca': () => Response.json(true),
    'v1/orders': () => Response.json(ORDER_CRIADA, { status: 201 }),
  };
}

function cenario(trocas: Partial<Record<string, Rota>> = {}, opcoes: { token?: string } = {}) {
  const chamadas: Chamada[] = [];
  const logs: string[] = [];
  const rotas = { ...rotasPadrao(), ...trocas };
  const fetchFalso = async (entrada: RequestInfo | URL, init?: RequestInit) => {
    const url = String(entrada);
    const chamada: Chamada = {
      url,
      metodo: init?.method ?? 'GET',
      cabecalhos: new Headers(init?.headers),
      corpo: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined,
    };
    chamadas.push(chamada);
    const chave = Object.keys(rotas).find((sufixo) => url.endsWith(sufixo));
    const rota = chave ? rotas[chave] : undefined;
    if (!rota) {
      throw new Error(`rota não simulada: ${url}`);
    }
    return await rota(chamada, init?.signal ?? null);
  };
  const handler = criarHandler(
    criarDependencias({
      supabase: { url: 'http://kong:8000', chaveServico: 'chave-servico', fetch: fetchFalso },
      mercadoPago: {
        accessToken: opcoes.token ?? TOKEN_MP,
        modoTeste: true,
        timeoutMs: 30,
        fetch: fetchFalso,
      },
      log: (evento, dados) => logs.push(JSON.stringify({ evento, ...dados })),
      origensCors: [],
    }),
  );
  const chamou = (sufixo: string) => chamadas.filter((c) => c.url.endsWith(sufixo));
  return { handler, chamadas, chamou, logs };
}

function requisicao(corpo: unknown, jwt: string | null = JWT_USUARIO, metodo = 'POST'): Request {
  const cabecalhos: Record<string, string> = { 'Content-Type': 'application/json' };
  if (jwt) {
    cabecalhos.Authorization = `Bearer ${jwt}`;
  }
  return new Request('http://localhost/reservar-vaga', {
    method: metodo,
    headers: cabecalhos,
    body: metodo === 'POST' ? JSON.stringify(corpo) : undefined,
  });
}

Deno.test('sem JWT → 401 sem chamar nada', async () => {
  const { handler, chamadas } = cenario();
  const resposta = await handler(requisicao({ id_carona: ID_CARONA }, null));

  assertEquals(resposta.status, 401);
  assertEquals((await resposta.json()).error.code, 'NAO_AUTENTICADO');
  assertEquals(chamadas.length, 0);
});

Deno.test('JWT recusado pelo Auth → 401', async () => {
  const { handler, chamou } = cenario();
  const resposta = await handler(requisicao({ id_carona: ID_CARONA }, 'jwt-falsificado'));

  assertEquals(resposta.status, 401);
  assertEquals((await resposta.json()).error.code, 'NAO_AUTENTICADO');
  assertEquals(chamou('rpc/reservar_vaga').length, 0);
});

Deno.test('corpo inválido → 400 (id não uuid, ou passageiro no corpo)', async () => {
  for (
    const corpo of [
      { id_carona: 'abc' },
      {},
      { id_carona: ID_CARONA, id_passageiro: 'a0000000-0000-0000-0000-00000000000a' },
    ]
  ) {
    const { handler, chamou } = cenario();
    const resposta = await handler(requisicao(corpo));

    assertEquals(resposta.status, 400);
    assertEquals((await resposta.json()).error.code, 'PAYLOAD_INVALIDO');
    assertEquals(chamou('rpc/reservar_vaga').length, 0);
  }
});

Deno.test('GET → 405', async () => {
  const { handler } = cenario();
  const resposta = await handler(requisicao(null, JWT_USUARIO, 'GET'));
  assertEquals(resposta.status, 405);
});

Deno.test('erro PTxxx da reservar_vaga chega ao app com o mesmo status e a frase', async () => {
  const { handler, chamou } = cenario({
    'rpc/reservar_vaga': () =>
      Response.json({
        code: 'PT409',
        details: null,
        hint: 'Esta carona não tem mais vagas.',
        message: 'CARONA_LOTADA',
      }, { status: 409 }),
  });
  const resposta = await handler(requisicao({ id_carona: ID_CARONA }));

  assertEquals(resposta.status, 409);
  assertEquals((await resposta.json()).error, {
    code: 'CARONA_LOTADA',
    message: 'Esta carona não tem mais vagas.',
    details: {},
  });
  assertEquals(chamou('v1/orders').length, 0);
});

Deno.test('sucesso: passageiro do JWT, order de teste idempotente e resposta em centavos', async () => {
  const { handler, chamou } = cenario();
  const resposta = await handler(requisicao({ id_carona: ID_CARONA }));

  assertEquals(resposta.status, 201);
  assertEquals(await resposta.json(), {
    data: {
      id_reserva: ID_RESERVA,
      id_pagamento: ID_PAGAMENTO,
      valor_centavos: 833,
      status: 'PENDENTE',
      pix: {
        qr_code: '00020126580014br.gov.bcb.pix0136teste',
        qr_code_base64: null,
        ticket_url: 'https://www.mercadopago.com.br/sandbox/payments/123/ticket',
      },
    },
  });

  const [reserva] = chamou('rpc/reservar_vaga');
  assertEquals(reserva.corpo, { p_id_carona: ID_CARONA, p_id_passageiro: ID_USUARIO });
  assertEquals(reserva.cabecalhos.get('authorization'), 'Bearer chave-servico');

  const [order] = chamou('v1/orders');
  assertEquals(order.metodo, 'POST');
  assertEquals(order.cabecalhos.get('authorization'), `Bearer ${TOKEN_MP}`);
  assertEquals(order.cabecalhos.get('x-idempotency-key'), ID_PAGAMENTO);
  assertEquals(order.corpo, {
    type: 'online',
    processing_mode: 'automatic',
    external_reference: ID_PAGAMENTO,
    total_amount: '8.33',
    payer: { email: 'test@testuser.com', first_name: 'APRO' },
    transactions: {
      payments: [{ amount: '8.33', payment_method: { id: 'pix', type: 'bank_transfer' } }],
    },
  });

  const [registro] = chamou('rpc/registrar_cobranca');
  assertEquals(registro.corpo, { p_id_pagamento: ID_PAGAMENTO, p_id_externo: ID_ORDER });
  assertEquals(chamou('rpc/desfazer_reserva_sem_cobranca').length, 0);
});

Deno.test('fora do modo de teste, o pagador é o usuário (e-mail e primeiro nome)', () => {
  const pedido = {
    idPagamento: ID_PAGAMENTO,
    valorCentavos: 600,
    email: 'passageiro@rede.ulbra.br',
    primeiroNome: 'Paulo',
  };
  assertEquals(montarOrder(pedido, false).payer, {
    email: 'passageiro@rede.ulbra.br',
    first_name: 'Paulo',
  });
  assertEquals(montarOrder(pedido, true).payer, {
    email: 'test@testuser.com',
    first_name: 'APRO',
  });
});

Deno.test('valores vão como string com 2 casas, calculados em centavos', () => {
  assertEquals(valorEmTexto(833), '8.33');
  assertEquals(valorEmTexto(600), '6.00');
  assertEquals(valorEmTexto(5), '0.05');
  assertEquals(valorEmTexto(123456), '1234.56');
});

const FALHAS_DA_COBRANCA: Record<string, Rota> = {
  'Mercado Pago com erro HTTP 500': () =>
    Response.json({ message: `internal error ${TOKEN_MP}` }, { status: 500 }),
  'Mercado Pago recusa o token (401)': () =>
    Response.json({ message: 'invalid access token' }, { status: 401 }),
  'resposta sem QR Code': () =>
    Response.json({ ...ORDER_CRIADA, transactions: { payments: [{ payment_method: {} }] } }),
  'tempo esgotado': (_chamada, sinal) =>
    new Promise<Response>((_resolve, rejeitar) => {
      sinal?.addEventListener('abort', () => rejeitar(sinal.reason));
    }),
};

for (const [nome, rota] of Object.entries(FALHAS_DA_COBRANCA)) {
  Deno.test(`${nome} → reserva desfeita e 502`, async () => {
    const { handler, chamou } = cenario({ 'v1/orders': rota });
    const resposta = await handler(requisicao({ id_carona: ID_CARONA }));

    assertEquals(resposta.status, 502);
    assertEquals((await resposta.json()).error, {
      code: 'PAGAMENTO_INDISPONIVEL',
      message: 'Não foi possível gerar o Pix agora. Tente de novo em instantes.',
      details: {},
    });
    const [desfazer] = chamou('rpc/desfazer_reserva_sem_cobranca');
    assertEquals(desfazer.corpo, { p_id_reserva: ID_RESERVA });
    assertEquals(chamou('rpc/registrar_cobranca').length, 0);
  });
}

Deno.test('falha ao registrar a cobrança → reserva desfeita e 502', async () => {
  const { handler, chamou } = cenario({
    'rpc/registrar_cobranca': () =>
      Response.json({
        code: 'PT409',
        details: null,
        hint: 'Esta cobrança já pertence a outro pagamento.',
        message: 'COBRANCA_DUPLICADA',
      }, { status: 409 }),
  });
  const resposta = await handler(requisicao({ id_carona: ID_CARONA }));

  assertEquals(resposta.status, 502);
  assertEquals(chamou('rpc/desfazer_reserva_sem_cobranca').length, 1);
});

Deno.test('sem token do Mercado Pago configurado → 503 sem reservar', async () => {
  const { handler, chamou } = cenario({}, { token: '' });
  const resposta = await handler(requisicao({ id_carona: ID_CARONA }));

  assertEquals(resposta.status, 503);
  assertEquals(chamou('rpc/reservar_vaga').length, 0);
});

Deno.test('o token do Mercado Pago nunca aparece em log nem na resposta', async () => {
  const capturado: string[] = [];
  const originais = { log: console.log, error: console.error, warn: console.warn };
  const capturar = (...partes: unknown[]) => capturado.push(partes.map(String).join(' '));
  console.log = capturar;
  console.error = capturar;
  console.warn = capturar;
  try {
    const casos = [
      cenario(),
      cenario({ 'v1/orders': FALHAS_DA_COBRANCA['Mercado Pago com erro HTTP 500'] }),
      cenario({ 'v1/orders': FALHAS_DA_COBRANCA['tempo esgotado'] }),
      cenario({ 'rpc/desfazer_reserva_sem_cobranca': () => new Response('x', { status: 500 }) }),
    ];
    for (const { handler, logs } of casos) {
      const resposta = await handler(requisicao({ id_carona: ID_CARONA }));
      assertFalse((await resposta.text()).includes(TOKEN_MP));
      capturado.push(...logs);
    }
  } finally {
    console.log = originais.log;
    console.error = originais.error;
    console.warn = originais.warn;
  }
  assert(capturado.length > 0, 'os cenários deveriam ter gerado log');
  for (const linha of capturado) {
    assertFalse(linha.includes(TOKEN_MP), `token vazou no log: ${linha.slice(0, 40)}…`);
    assertFalse(linha.includes('APP_USR'), 'prefixo de credencial no log');
  }
});
