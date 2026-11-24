// Services de avaliação (T30): cliente Supabase real com fetch simulado, como em caronas.test.ts.
import { resposta } from './apoio/supabase-falso';
import { SESSAO } from './apoio/supabase-falso';

type ServicoAvaliacoes = typeof import('@/services/avaliacoes');
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

function carregar(): { avaliacoes: ServicoAvaliacoes; auth: ServicoAuth } {
  let modulos: { avaliacoes: ServicoAvaliacoes; auth: ServicoAuth } | undefined;
  jest.isolateModules(() => {
    modulos = {
      avaliacoes: require('@/services/avaliacoes') as ServicoAvaliacoes,
      auth: require('@/services/auth') as ServicoAuth,
    };
  });
  return modulos as { avaliacoes: ServicoAvaliacoes; auth: ServicoAuth };
}

async function logado(): Promise<ServicoAvaliacoes> {
  const { avaliacoes, auth } = carregar();
  mockFetch.mockResolvedValueOnce(resposta(200, SESSAO));
  await auth.entrar('mariana.souza@rede.ulbra.br', 'Senha123!');
  mockFetch.mockReset();
  return avaliacoes;
}

function chamada(indice = 0): { url: string; metodo: string; corpo: Record<string, unknown> } {
  const [url, opcoes] = mockFetch.mock.calls[indice] as [
    string,
    { method?: string; body?: string },
  ];
  return {
    url: decodeURIComponent(url),
    metodo: opcoes.method ?? 'GET',
    corpo: opcoes.body ? (JSON.parse(opcoes.body) as Record<string, unknown>) : {},
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

const ID_RESERVA = 'a3000000-0000-0000-0000-000000000001';
const ID_USUARIO = 'a0000000-0000-0000-0000-00000000000a';

describe('avaliarParticipante', () => {
  it('manda reserva, nota e o comentário aparado, e devolve o id', async () => {
    const avaliacoes = await logado();
    mockFetch.mockResolvedValue(resposta(200, 'b4000000-0000-0000-0000-000000000001'));

    await expect(avaliacoes.avaliarParticipante(ID_RESERVA, 5, '  Pontual  ')).resolves.toBe(
      'b4000000-0000-0000-0000-000000000001',
    );

    expect(chamada().url).toContain('/rest/v1/rpc/avaliar_participante');
    expect(chamada().corpo).toEqual({
      p_id_reserva: ID_RESERVA,
      p_nota: 5,
      p_comentario: 'Pontual',
    });
  });

  it('sem comentário (ou só espaços), o parâmetro não vai', async () => {
    const avaliacoes = await logado();
    mockFetch.mockResolvedValue(resposta(200, 'id'));

    await avaliacoes.avaliarParticipante(ID_RESERVA, 4, '   ');

    expect(chamada().corpo).toEqual({ p_id_reserva: ID_RESERVA, p_nota: 4 });
  });

  it('prazo encerrado chega com a frase do hint', async () => {
    const avaliacoes = await logado();
    mockFetch.mockResolvedValue(
      resposta(409, {
        code: 'PT409',
        details: null,
        hint: 'O prazo para avaliar esta carona era de 7 dias depois da partida.',
        message: 'PRAZO_AVALIACAO_ENCERRADO',
      }),
    );

    await expect(avaliacoes.avaliarParticipante(ID_RESERVA, 5)).rejects.toMatchObject({
      status: 409,
      code: 'PRAZO_AVALIACAO_ENCERRADO',
      message: 'O prazo para avaliar esta carona era de 7 dias depois da partida.',
    });
  });
});

describe('listarAvaliacoesPendentes', () => {
  const LINHA = {
    id_reserva: ID_RESERVA,
    papel: 'PASSAGEIRO',
    nome_avaliado: 'Marcos',
    origem: 'Centro, Torres - RS',
    destino: 'ULBRA Torres - RS',
    data_hora_partida: '2026-11-23T12:00:00+00:00',
    avaliar_ate: '2026-11-30T12:00:00+00:00',
  };

  it('devolve as pendências com o papel tipado', async () => {
    const avaliacoes = await logado();
    mockFetch.mockResolvedValue(resposta(200, [LINHA]));

    await expect(avaliacoes.listarAvaliacoesPendentes()).resolves.toEqual([LINHA]);
    expect(chamada().url).toContain('/rest/v1/rpc/avaliacoes_pendentes');
  });

  it('papel desconhecido é tratado como resposta inesperada', async () => {
    const avaliacoes = await logado();
    mockFetch.mockResolvedValue(resposta(200, [{ ...LINHA, papel: 'OUTRO' }]));

    await expect(avaliacoes.listarAvaliacoesPendentes()).rejects.toMatchObject({
      code: 'ERRO_INESPERADO',
    });
  });
});

describe('obterPerfilPublico', () => {
  it('converte para o tipo do app, com a média', async () => {
    const avaliacoes = await logado();
    mockFetch.mockResolvedValue(
      resposta(200, [
        {
          id_usuario: ID_USUARIO,
          nome: 'Marcos Motorista',
          media_avaliacoes: 4.3,
          total_avaliacoes: 12,
        },
      ]),
    );

    await expect(avaliacoes.obterPerfilPublico(ID_USUARIO)).resolves.toEqual({
      idUsuario: ID_USUARIO,
      nome: 'Marcos Motorista',
      media: 4.3,
      total: 12,
    });
    expect(chamada().corpo).toEqual({ p_id_usuario: ID_USUARIO });
  });

  it('média null (ninguém avaliou ainda) continua null', async () => {
    const avaliacoes = await logado();
    mockFetch.mockResolvedValue(
      resposta(200, [
        { id_usuario: ID_USUARIO, nome: 'Marcos', media_avaliacoes: null, total_avaliacoes: 0 },
      ]),
    );

    await expect(avaliacoes.obterPerfilPublico(ID_USUARIO)).resolves.toMatchObject({
      media: null,
      total: 0,
    });
  });

  it('usuário inexistente chega com a frase do hint', async () => {
    const avaliacoes = await logado();
    mockFetch.mockResolvedValue(
      resposta(404, {
        code: 'PT404',
        details: null,
        hint: 'Usuário não encontrado.',
        message: 'USUARIO_NAO_ENCONTRADO',
      }),
    );

    await expect(avaliacoes.obterPerfilPublico(ID_USUARIO)).rejects.toMatchObject({
      status: 404,
      code: 'USUARIO_NAO_ENCONTRADO',
      message: 'Usuário não encontrado.',
    });
  });
});
