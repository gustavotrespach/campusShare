// Cliente Supabase real (auth-js + postgrest-js) com SecureStore em memória e fetch simulado.
import { resposta, SESSAO, ID_USUARIO } from './apoio/supabase-falso';

type ServicoPerfil = typeof import('@/services/perfil');
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

const LINHA_PERFIL = {
  nome_completo: 'Mariana Souza',
  email_institucional: 'mariana.souza@rede.ulbra.br',
  genero: 'FEMININO',
  telefone: '51999999999',
  instituicao: { nome: 'Universidade Luterana do Brasil (ULBRA)' },
};

// Formato real do PostgREST local para coluna sem GRANT UPDATE (inclui uma dica técnica no hint).
const ERRO_SEM_PERMISSAO = {
  code: '42501',
  details: null,
  hint: 'Grant the required privileges to the current role with: GRANT UPDATE ON public.usuario TO authenticated;',
  message: 'permission denied for table usuario',
};

function carregar(): { perfil: ServicoPerfil; auth: ServicoAuth } {
  let modulos: { perfil: ServicoPerfil; auth: ServicoAuth } | undefined;
  jest.isolateModules(() => {
    modulos = {
      perfil: require('@/services/perfil') as ServicoPerfil,
      auth: require('@/services/auth') as ServicoAuth,
    };
  });
  return modulos as { perfil: ServicoPerfil; auth: ServicoAuth };
}

async function logado(): Promise<ServicoPerfil> {
  const { perfil, auth } = carregar();
  mockFetch.mockResolvedValueOnce(resposta(200, SESSAO));
  await auth.entrar('mariana.souza@rede.ulbra.br', 'Senha123!');
  mockFetch.mockReset();
  return perfil;
}

function chamada(indice = 0): { url: string; metodo: string; corpo: unknown } {
  const [url, opcoes] = mockFetch.mock.calls[indice] as [
    string,
    { method?: string; body?: string },
  ];
  return {
    url: decodeURIComponent(url),
    metodo: opcoes.method ?? 'GET',
    corpo: opcoes.body ? JSON.parse(opcoes.body) : undefined,
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

describe('obterMeuPerfil', () => {
  it('lê a própria linha de usuario com o nome da instituição', async () => {
    const perfil = await logado();
    mockFetch.mockResolvedValue(resposta(200, [LINHA_PERFIL]));

    await expect(perfil.obterMeuPerfil()).resolves.toEqual({
      ...LINHA_PERFIL,
      instituicao: 'Universidade Luterana do Brasil (ULBRA)',
    });
    const { url, metodo } = chamada();
    expect(metodo).toBe('GET');
    expect(url).toContain(
      '/rest/v1/usuario?select=nome_completo,email_institucional,genero,telefone,instituicao(nome)',
    );
  });

  it('sem linha visível (RLS) vira PERFIL_NAO_ENCONTRADO', async () => {
    const perfil = await logado();
    mockFetch.mockResolvedValue(resposta(200, []));

    await expect(perfil.obterMeuPerfil()).rejects.toMatchObject({
      status: 404,
      code: 'PERFIL_NAO_ENCONTRADO',
    });
  });
});

describe('atualizarPerfil', () => {
  it('envia só nome, gênero e telefone, filtrando pelo usuário da sessão', async () => {
    const perfil = await logado();
    mockFetch.mockResolvedValue(resposta(200, [{ ...LINHA_PERFIL, nome_completo: 'Mariana S.' }]));
    const alteracoes = {
      nome_completo: '  Mariana S. ',
      genero: 'FEMININO' as const,
      telefone: '(51) 99999-9999',
      // Campos extras que um app adulterado tentaria mandar: não podem chegar ao banco
      email_institucional: 'outra@rede.ulbra.br',
      id_instituicao: 999,
    };

    const atualizado = await perfil.atualizarPerfil(alteracoes);

    const { url, metodo, corpo } = chamada();
    expect(metodo).toBe('PATCH');
    expect(url).toContain(`id_usuario=eq.${ID_USUARIO}`);
    expect(corpo).toEqual({
      nome_completo: 'Mariana S.',
      genero: 'FEMININO',
      telefone: '51999999999',
    });
    expect(atualizado.nome_completo).toBe('Mariana S.');
  });

  it('telefone vazio vira null (apaga o telefone)', async () => {
    const perfil = await logado();
    mockFetch.mockResolvedValue(resposta(200, [{ ...LINHA_PERFIL, telefone: null }]));

    await perfil.atualizarPerfil({ nome_completo: 'Mariana', genero: 'OUTRO', telefone: '  ' });

    expect(chamada().corpo).toMatchObject({ telefone: null });
  });

  it('permissão negada vira PERMISSAO_NEGADA sem vazar a dica técnica do banco', async () => {
    const perfil = await logado();
    mockFetch.mockResolvedValue(resposta(403, ERRO_SEM_PERMISSAO));

    const erro = await perfil
      .atualizarPerfil({ nome_completo: 'X', genero: 'OUTRO', telefone: null })
      .catch((falha: unknown) => falha);

    expect(erro).toMatchObject({ status: 403, code: 'PERMISSAO_NEGADA' });
    expect(String((erro as Error).message)).not.toMatch(/grant|privileges/i);
  });

  it('linha filtrada pela RLS (0 linhas) vira PERFIL_NAO_ENCONTRADO', async () => {
    const perfil = await logado();
    mockFetch.mockResolvedValue(resposta(200, []));

    await expect(
      perfil.atualizarPerfil({ nome_completo: 'X', genero: 'OUTRO', telefone: null }),
    ).rejects.toMatchObject({ code: 'PERFIL_NAO_ENCONTRADO' });
  });

  it('sem sessão não chama o banco', async () => {
    const { perfil } = carregar();

    await expect(
      perfil.atualizarPerfil({ nome_completo: 'X', genero: 'OUTRO', telefone: null }),
    ).rejects.toMatchObject({ status: 401, code: 'session_not_found' });
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
