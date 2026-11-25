// T29 — notificações: service (cliente Supabase real com fetch simulado) e funções de exibição.
import { resposta, SESSAO } from './apoio/supabase-falso';

import {
  destinoNotificacao,
  iconeNotificacao,
  quandoNotificacao,
  rotuloSininho,
  textoSeloNaoLidas,
} from '@/utils/notificacoes';

type ServicoNotificacoes = typeof import('@/services/notificacoes');
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

function carregar(): { notificacoes: ServicoNotificacoes; auth: ServicoAuth } {
  let modulos: { notificacoes: ServicoNotificacoes; auth: ServicoAuth } | undefined;
  jest.isolateModules(() => {
    modulos = {
      notificacoes: require('@/services/notificacoes') as ServicoNotificacoes,
      auth: require('@/services/auth') as ServicoAuth,
    };
  });
  return modulos as { notificacoes: ServicoNotificacoes; auth: ServicoAuth };
}

async function logado(): Promise<ServicoNotificacoes> {
  const { notificacoes, auth } = carregar();
  mockFetch.mockResolvedValueOnce(resposta(200, SESSAO));
  await auth.entrar('mariana.souza@rede.ulbra.br', 'Senha123!');
  mockFetch.mockReset();
  return notificacoes;
}

function chamada(indice = 0): { url: string; metodo: string; corpo: unknown } {
  const [url, opcoes] = mockFetch.mock.calls[indice] as [
    string,
    { method?: string; body?: string },
  ];
  return {
    url: decodeURIComponent(url),
    metodo: opcoes.method ?? 'GET',
    corpo: opcoes.body ? (JSON.parse(opcoes.body) as unknown) : undefined,
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

const LINHA = {
  id_notificacao: 'n1',
  tipo: 'NOVA_RESERVA',
  mensagem: 'Bruna reservou uma vaga na sua carona para ULBRA Torres em 26/11 às 19:00.',
  lida: false,
  criado_em: '2026-11-25T21:55:00+00:00',
  id_carona: 'c1',
  id_reserva: 'r1',
};

describe('services/notificacoes', () => {
  it('listar: a tabela pela RLS, as 50 mais recentes primeiro, só as colunas da tela', async () => {
    const notificacoes = await logado();
    mockFetch.mockResolvedValueOnce(resposta(200, [LINHA]));

    await expect(notificacoes.listarNotificacoes()).resolves.toEqual([LINHA]);
    const { url, metodo } = chamada();
    expect(metodo).toBe('GET');
    expect(url).toContain('/rest/v1/notificacao?');
    expect(url).toContain(
      'select=id_notificacao,tipo,mensagem,lida,criado_em,id_carona,id_reserva',
    );
    expect(url).toContain('order=criado_em.desc');
    expect(url).toContain('limit=50');
  });

  it('contar: a RPC contar_notificacoes_nao_lidas', async () => {
    const notificacoes = await logado();
    mockFetch.mockResolvedValueOnce(resposta(200, 3));

    await expect(notificacoes.contarNaoLidas()).resolves.toBe(3);
    expect(chamada().url).toContain('/rest/v1/rpc/contar_notificacoes_nao_lidas');
  });

  it('marcar algumas: manda os ids; marcar todas: sem ids', async () => {
    const notificacoes = await logado();
    mockFetch.mockResolvedValueOnce(resposta(200, 1)).mockResolvedValueOnce(resposta(200, 4));

    await expect(notificacoes.marcarComoLidas(['n1'])).resolves.toBe(1);
    await expect(notificacoes.marcarComoLidas()).resolves.toBe(4);
    expect(chamada(0).url).toContain('/rest/v1/rpc/marcar_notificacoes_lidas');
    expect(chamada(0).corpo).toEqual({ p_ids: ['n1'] });
    expect(chamada(1).corpo).toEqual({});
  });

  it('sem sessão: a frase do hint (NAO_AUTENTICADO)', async () => {
    const notificacoes = await logado();
    mockFetch.mockResolvedValueOnce(
      resposta(401, {
        code: 'PT401',
        details: null,
        hint: 'Sua sessão expirou. Entre novamente.',
        message: 'NAO_AUTENTICADO',
      }),
    );

    await expect(notificacoes.contarNaoLidas()).rejects.toMatchObject({
      code: 'NAO_AUTENTICADO',
      message: 'Sua sessão expirou. Entre novamente.',
    });
  });
});

describe('utils/notificacoes', () => {
  it('selo do sininho: nada com 0, o número até 9 e "9+" acima', () => {
    expect(textoSeloNaoLidas(0)).toBeNull();
    expect(textoSeloNaoLidas(3)).toBe('3');
    expect(textoSeloNaoLidas(9)).toBe('9');
    expect(textoSeloNaoLidas(12)).toBe('9+');
  });

  it('rótulo do sininho para o leitor de tela', () => {
    expect(rotuloSininho(0)).toBe('Notificações');
    expect(rotuloSininho(1)).toBe('Notificações, 1 não lida');
    expect(rotuloSininho(12)).toBe('Notificações, 12 não lidas');
  });

  it('quando: "agora", "há 5 min", "hoje", "ontem" e o dia curto (Brasília)', () => {
    // Quarta, 25/11/2026, 19:00 em Brasília
    const agora = new Date('2026-11-25T22:00:00Z');
    expect(quandoNotificacao('2026-11-25T21:59:30Z', agora)).toBe('agora');
    expect(quandoNotificacao('2026-11-25T21:55:00Z', agora)).toBe('há 5 min');
    expect(quandoNotificacao('2026-11-25T17:30:00Z', agora)).toBe('hoje 14:30');
    // 22:00 UTC do dia 24 = 19:00 de Brasília do dia 24
    expect(quandoNotificacao('2026-11-24T22:00:00Z', agora)).toBe('ontem 19:00');
    // 02:30 UTC do dia 25 = 23:30 do dia 24 em Brasília: ainda é "ontem"
    expect(quandoNotificacao('2026-11-25T02:30:00Z', agora)).toBe('ontem 23:30');
    expect(quandoNotificacao('2026-11-22T22:00:00Z', agora)).toBe('dom 22/11 · 19:00');
  });

  it('para onde cada aviso leva', () => {
    const base = { id_carona: 'c1', id_reserva: 'r1' };
    expect(destinoNotificacao({ ...base, tipo: 'RESERVA_CONFIRMADA' })).toEqual({
      pathname: '/reservas/[id]',
      params: { id: 'r1' },
    });
    expect(destinoNotificacao({ ...base, tipo: 'CARONA_CANCELADA' })).toEqual({
      pathname: '/reservas/[id]',
      params: { id: 'r1' },
    });
    expect(destinoNotificacao({ ...base, tipo: 'NOVA_RESERVA' })).toEqual({
      pathname: '/caronas/[id]',
      params: { id: 'c1' },
    });
    expect(destinoNotificacao({ ...base, tipo: 'RESERVA_CANCELADA' })).toEqual({
      pathname: '/caronas/[id]',
      params: { id: 'c1' },
    });
    expect(destinoNotificacao({ ...base, tipo: 'AVALIACAO' })).toBe('/perfil');
    expect(
      destinoNotificacao({ tipo: 'NOVA_RESERVA', id_carona: null, id_reserva: null }),
    ).toBeNull();
  });

  it('um ícone por tipo', () => {
    expect(
      (
        [
          'NOVA_RESERVA',
          'RESERVA_CONFIRMADA',
          'CARONA_CANCELADA',
          'RESERVA_CANCELADA',
          'AVALIACAO',
        ] as const
      ).map(iconeNotificacao),
    ).toEqual([
      'person-add-outline',
      'checkmark-circle-outline',
      'close-circle-outline',
      'remove-circle-outline',
      'star-outline',
    ]);
  });
});
