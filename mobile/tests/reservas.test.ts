// Cliente Supabase real (auth-js, postgrest-js e functions-js) com SecureStore em memória e fetch
// simulado, nos formatos que o Supabase local e a reservar-vaga devolvem.
import { resposta, SESSAO } from './apoio/supabase-falso';

type ServicoReservas = typeof import('@/services/reservas');
type ServicoAuth = typeof import('@/services/auth');

const mockSecureStore = new Map<string, string>();

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async (chave: string) => mockSecureStore.get(chave) ?? null),
  setItemAsync: jest.fn(async (chave: string, valor: string) => {
    mockSecureStore.set(chave, valor);
  }),
  deleteItemAsync: jest.fn(async (chave: string) => {
    mockSecureStore.delete(chave);
  }),
}));

const mockFetch = jest.fn();

const ID_CARONA = 'd2000000-0000-0000-0000-000000000003';
const ID_RESERVA = '5a1e7c3e-0000-4000-8000-000000000001';
const ID_PAGAMENTO = '5a1e7c3e-0000-4000-8000-000000000002';

// A Edge Function responde JSON com Content-Type: o functions-js decide o parse por ele
function respostaFuncao(status: number, corpo: unknown) {
  const base = resposta(status, corpo);
  return {
    ...base,
    headers: {
      get: (nome: string) =>
        nome.toLowerCase() === 'content-type' ? 'application/json' : base.headers.get(nome),
    },
  };
}

const CRIADA = {
  data: {
    id_reserva: ID_RESERVA,
    id_pagamento: ID_PAGAMENTO,
    valor_centavos: 500,
    status: 'PENDENTE',
    pix: {
      qr_code: '00020126580014br.gov.bcb.pix0136pix-ficticio',
      qr_code_base64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB',
      ticket_url: 'https://www.mercadopago.com.br/sandbox/payments/1/ticket',
    },
  },
};

function erroDaFuncao(status: number, code: string, message: string) {
  return respostaFuncao(status, { error: { code, message, details: null } });
}

function carregar(): { reservas: ServicoReservas; auth: ServicoAuth } {
  let modulos: { reservas: ServicoReservas; auth: ServicoAuth } | undefined;
  jest.isolateModules(() => {
    modulos = {
      reservas: require('@/services/reservas') as ServicoReservas,
      auth: require('@/services/auth') as ServicoAuth,
    };
  });
  return modulos as { reservas: ServicoReservas; auth: ServicoAuth };
}

async function logado(): Promise<ServicoReservas> {
  const { reservas, auth } = carregar();
  mockFetch.mockResolvedValueOnce(resposta(200, SESSAO));
  await auth.entrar('mariana.souza@rede.ulbra.br', 'Senha123!');
  mockFetch.mockReset();
  return reservas;
}

function chamada(indice = 0): {
  url: string;
  metodo: string;
  corpo: Record<string, unknown>;
  cabecalhos: Record<string, string>;
} {
  const [url, opcoes] = mockFetch.mock.calls[indice] as [
    string,
    { method?: string; body?: string; headers?: Headers | Record<string, string> },
  ];
  const cabecalhos =
    opcoes.headers instanceof Headers
      ? Object.fromEntries(opcoes.headers.entries())
      : Object.fromEntries(
          Object.entries(opcoes.headers ?? {}).map(([k, v]) => [k.toLowerCase(), v]),
        );
  return {
    url: decodeURIComponent(url),
    metodo: opcoes.method ?? 'GET',
    corpo:
      typeof opcoes.body === 'string' ? (JSON.parse(opcoes.body) as Record<string, unknown>) : {},
    cabecalhos,
  };
}

beforeAll(() => {
  process.env.EXPO_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:54321';
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_teste';
  globalThis.fetch = mockFetch as unknown as typeof fetch;
});

beforeEach(() => {
  mockSecureStore.clear();
  mockFetch.mockReset();
});

describe('reservarVaga', () => {
  it('chama a reservar-vaga só com a carona e devolve a reserva com o Pix, em centavos', async () => {
    const reservas = await logado();
    mockFetch.mockResolvedValue(respostaFuncao(201, CRIADA));

    await expect(reservas.reservarVaga(ID_CARONA)).resolves.toEqual({
      idReserva: ID_RESERVA,
      idPagamento: ID_PAGAMENTO,
      valorCentavos: 500,
      status: 'PENDENTE',
      pix: {
        qrCode: CRIADA.data.pix.qr_code,
        qrCodeBase64: CRIADA.data.pix.qr_code_base64,
        ticketUrl: CRIADA.data.pix.ticket_url,
      },
    });

    const { url, metodo, corpo, cabecalhos } = chamada();
    expect(url).toBe('http://127.0.0.1:54321/functions/v1/reservar-vaga');
    expect(metodo).toBe('POST');
    // O passageiro é o usuário do JWT: o app não manda id_passageiro nem valor
    expect(corpo).toEqual({ id_carona: ID_CARONA });
    expect(cabecalhos.authorization).toBe(`Bearer ${SESSAO.access_token}`);
  });

  it.each([
    [409, 'RESERVA_DUPLICADA', 'Você já tem uma reserva nesta carona.'],
    [409, 'CARONA_LOTADA', 'Esta carona não tem mais vagas.'],
    [409, 'CARONA_INDISPONIVEL', 'Esta carona não está mais disponível para reserva.'],
    [403, 'CARONA_SOMENTE_MULHERES', 'Esta carona é exclusiva para mulheres.'],
    [422, 'RESERVA_PROPRIA_CARONA', 'Você não pode reservar uma vaga na sua própria carona.'],
    [502, 'PAGAMENTO_INDISPONIVEL', 'Não foi possível gerar o Pix agora. Tente de novo.'],
    [503, 'PAGAMENTO_INDISPONIVEL', 'Não foi possível gerar o Pix agora. Tente de novo.'],
  ])('HTTP %i %s vira AppError com mensagem clara', async (status, codigo, mensagem) => {
    const reservas = await logado();
    mockFetch.mockResolvedValue(erroDaFuncao(status, codigo, 'frase do backend'));

    await expect(reservas.reservarVaga(ID_CARONA)).rejects.toMatchObject({
      status,
      code: codigo,
      message: mensagem,
    });
  });

  it('código sem mensagem própria mantém a frase do backend', async () => {
    const reservas = await logado();
    mockFetch.mockResolvedValue(
      erroDaFuncao(422, 'VALOR_ABAIXO_DO_MINIMO', 'O valor por passageiro é menor que R$ 0,01.'),
    );

    await expect(reservas.reservarVaga(ID_CARONA)).rejects.toMatchObject({
      code: 'VALOR_ABAIXO_DO_MINIMO',
      message: 'O valor por passageiro é menor que R$ 0,01.',
    });
  });

  it.each([
    ['sem pix', { data: { ...CRIADA.data, pix: undefined } }],
    ['valor que não é inteiro', { data: { ...CRIADA.data, valor_centavos: 5.5 } }],
    ['valor em reais como texto', { data: { ...CRIADA.data, valor_centavos: '5.00' } }],
    ['sem data', { id_reserva: ID_RESERVA }],
  ])('resposta fora do contrato (%s) vira erro inesperado', async (_nome, corpo) => {
    const reservas = await logado();
    mockFetch.mockResolvedValue(respostaFuncao(201, corpo));

    await expect(reservas.reservarVaga(ID_CARONA)).rejects.toMatchObject({
      code: 'ERRO_INESPERADO',
    });
  });

  it('sem conexão vira SEM_CONEXAO', async () => {
    const reservas = await logado();
    mockFetch.mockRejectedValue(new TypeError('Network request failed'));

    await expect(reservas.reservarVaga(ID_CARONA)).rejects.toMatchObject({ code: 'SEM_CONEXAO' });
  });
});

describe('listarMinhasReservas', () => {
  it('chama a RPC e converte o valor de reais para centavos', async () => {
    const reservas = await logado();
    const linha = {
      id_reserva: ID_RESERVA,
      status_reserva: 'CONFIRMADA',
      reservado_em: '2026-10-17T20:00:00+00:00',
      status_pagamento: 'APROVADO',
      valor: 8.33,
      id_carona: ID_CARONA,
      origem: 'Rodoviária de Torres - RS',
      destino: 'ULBRA Torres - RS',
      data_hora_partida: '2026-10-18T15:30:00+00:00',
      status_carona: 'ABERTA',
      nome_motorista: 'Marina',
    };
    mockFetch.mockResolvedValue(resposta(200, [linha, { ...linha, valor: 6 }]));

    const lista = await reservas.listarMinhasReservas();

    const { url, metodo, corpo } = chamada();
    expect(url).toContain('/rest/v1/rpc/minhas_reservas');
    expect(metodo).toBe('POST');
    // Nenhum id de usuário: a função usa o auth.uid()
    expect(corpo).toEqual({});
    expect(lista.map((r) => r.valorCentavos)).toEqual([833, 600]);
    expect(lista[0]).not.toHaveProperty('valor');
    expect(lista[0]).toMatchObject({ status_reserva: 'CONFIRMADA', nome_motorista: 'Marina' });
  });

  it('erro da RPC chega como AppError', async () => {
    const reservas = await logado();
    mockFetch.mockResolvedValue(
      resposta(401, {
        code: 'PT401',
        details: null,
        hint: 'Sua sessão expirou. Entre novamente.',
        message: 'NAO_AUTENTICADO',
      }),
    );

    await expect(reservas.listarMinhasReservas()).rejects.toMatchObject({
      status: 401,
      code: 'NAO_AUTENTICADO',
    });
  });
});

describe('consultarStatusReserva', () => {
  it('lê a reserva e o pagamento pela RLS e devolve o valor em centavos', async () => {
    const reservas = await logado();
    mockFetch.mockResolvedValue(
      resposta(200, [
        { status: 'CONFIRMADA', valor_individual: 5, pagamento: { status: 'APROVADO', valor: 5 } },
      ]),
    );

    await expect(reservas.consultarStatusReserva(ID_RESERVA)).resolves.toEqual({
      statusReserva: 'CONFIRMADA',
      statusPagamento: 'APROVADO',
      valorCentavos: 500,
    });
    const { url, metodo } = chamada();
    expect(metodo).toBe('GET');
    expect(url).toContain('/rest/v1/reserva?');
    expect(url).toContain('select=status,valor_individual,pagamento(status,valor)');
    expect(url).toContain(`id_reserva=eq.${ID_RESERVA}`);
  });

  it('aceita o pagamento embutido como lista e cai no valor da reserva sem pagamento', async () => {
    const reservas = await logado();
    mockFetch.mockResolvedValueOnce(
      resposta(200, [
        { status: 'PENDENTE', valor_individual: 6, pagamento: [{ status: 'PENDENTE', valor: 6 }] },
      ]),
    );
    await expect(reservas.consultarStatusReserva(ID_RESERVA)).resolves.toEqual({
      statusReserva: 'PENDENTE',
      statusPagamento: 'PENDENTE',
      valorCentavos: 600,
    });

    mockFetch.mockResolvedValueOnce(
      resposta(200, [{ status: 'CANCELADA', valor_individual: 6.5, pagamento: null }]),
    );
    await expect(reservas.consultarStatusReserva(ID_RESERVA)).resolves.toEqual({
      statusReserva: 'CANCELADA',
      statusPagamento: null,
      valorCentavos: 650,
    });
  });

  it('reserva de outro usuário (a RLS não devolve linha) vira RESERVA_NAO_ENCONTRADA', async () => {
    const reservas = await logado();
    mockFetch.mockResolvedValue(resposta(200, []));

    await expect(reservas.consultarStatusReserva(ID_RESERVA)).rejects.toMatchObject({
      status: 404,
      code: 'RESERVA_NAO_ENCONTRADA',
    });
  });
});
