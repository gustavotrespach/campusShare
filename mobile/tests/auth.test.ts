// Usa o cliente Supabase real (auth-js) com SecureStore em memória e fetch simulado: prova o
// mapeamento de erros do login, a persistência da sessão e a limpeza no logout.
import { CODIGO_SEM_CONEXAO } from '@/services/erros';

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

interface RespostaFalsa {
  ok: boolean;
  status: number;
  statusText: string;
  headers: { get: (nome: string) => string | null };
  json: () => Promise<unknown>;
  text: () => Promise<string>;
}

function resposta(status: number, corpo: unknown): RespostaFalsa {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: '',
    headers: {
      get: (nome) => (nome.toLowerCase() === 'x-supabase-api-version' ? '2024-01-01' : null),
    },
    json: async () => corpo,
    text: async () => JSON.stringify(corpo),
  };
}

function base64Url(valor: object): string {
  return btoa(JSON.stringify(valor)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

const AGORA = Math.floor(Date.now() / 1000);
const ID_USUARIO = 'e0000000-0000-0000-0000-000000000001';
const ACCESS_TOKEN = [
  base64Url({ alg: 'HS256', typ: 'JWT' }),
  base64Url({ sub: ID_USUARIO, exp: AGORA + 3600, role: 'authenticated' }),
  'assinatura',
].join('.');

// Usuário com metadados longos: a sessão passa de 2048 bytes e precisa ser dividida em partes.
const SESSAO = {
  access_token: ACCESS_TOKEN,
  token_type: 'bearer',
  expires_in: 3600,
  expires_at: AGORA + 3600,
  refresh_token: 'refresh-falso',
  user: {
    id: ID_USUARIO,
    aud: 'authenticated',
    role: 'authenticated',
    email: 'mariana.souza@rede.ulbra.br',
    email_confirmed_at: new Date().toISOString(),
    app_metadata: { provider: 'email', providers: ['email'] },
    user_metadata: { nome_completo: 'Mariana Conceição Gonçalves de Souza '.repeat(40) },
    created_at: new Date().toISOString(),
  },
};

const mockFetch = jest.fn();

function carregarServico(): ServicoAuth {
  let servico: ServicoAuth | undefined;
  jest.isolateModules(() => {
    servico = require('@/services/auth') as ServicoAuth;
  });
  return servico as ServicoAuth;
}

function chamadasPara(trecho: string): number {
  return mockFetch.mock.calls.filter(([url]) => String(url).includes(trecho)).length;
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

describe('entrar — mapeamento de erros do login', () => {
  it('credenciais erradas viram 401 com mensagem genérica', async () => {
    mockFetch.mockResolvedValue(
      resposta(400, { code: 'invalid_credentials', msg: 'Invalid login credentials' }),
    );

    await expect(carregarServico().entrar('aluno@rede.ulbra.br', 'errada')).rejects.toMatchObject({
      status: 401,
      code: 'invalid_credentials',
      message: 'E-mail ou senha incorretos.',
    });
  });

  it('e-mail não confirmado mostra mensagem clara pedindo a confirmação', async () => {
    mockFetch.mockResolvedValue(
      resposta(400, { code: 'email_not_confirmed', msg: 'Email not confirmed' }),
    );

    await expect(
      carregarServico().entrar('aluno@rede.ulbra.br', 'Senha123!'),
    ).rejects.toMatchObject({
      code: 'email_not_confirmed',
      message: expect.stringMatching(/confirme seu e-mail/i),
    });
  });

  it('sem conexão vira SEM_CONEXAO com mensagem de rede', async () => {
    mockFetch.mockRejectedValue(new TypeError('Network request failed'));

    await expect(
      carregarServico().entrar('aluno@rede.ulbra.br', 'Senha123!'),
    ).rejects.toMatchObject({
      status: 0,
      code: CODIGO_SEM_CONEXAO,
      message: expect.stringMatching(/conectar ao servidor/),
    });
  });

  it('envia o e-mail sem espaços e em minúsculas', async () => {
    mockFetch.mockResolvedValue(resposta(200, SESSAO));

    await carregarServico().entrar('  Mariana.Souza@REDE.ULBRA.BR ', 'Senha123!');

    const [url, opcoes] = mockFetch.mock.calls[0] as [string, { body: string }];
    expect(url).toContain('/auth/v1/token?grant_type=password');
    expect(JSON.parse(opcoes.body)).toMatchObject({ email: 'mariana.souza@rede.ulbra.br' });
  });
});

describe('sessão persistente e logout', () => {
  it('login guarda a sessão no SecureStore em partes de até 2048 bytes', async () => {
    mockFetch.mockResolvedValue(resposta(200, SESSAO));

    const sessao = await carregarServico().entrar('mariana.souza@rede.ulbra.br', 'Senha123!');

    expect(sessao.user.email).toBe('mariana.souza@rede.ulbra.br');
    expect(Number(mockSecureStore.get('campusshare-sessao_partes'))).toBeGreaterThan(1);
    for (const valor of mockSecureStore.values()) {
      expect(new TextEncoder().encode(valor).length).toBeLessThanOrEqual(2048);
    }
  });

  it('ao reabrir o app (novo cliente), a sessão salva continua valendo', async () => {
    mockFetch.mockResolvedValue(resposta(200, SESSAO));
    await carregarServico().entrar('mariana.souza@rede.ulbra.br', 'Senha123!');

    const sessao = await carregarServico().obterSessao();

    expect(sessao?.user.id).toBe(ID_USUARIO);
    expect(sessao?.access_token).toBe(ACCESS_TOKEN);
  });

  it('sair revoga no servidor e apaga todas as partes do SecureStore', async () => {
    mockFetch.mockResolvedValue(resposta(200, SESSAO));
    const servico = carregarServico();
    await servico.entrar('mariana.souza@rede.ulbra.br', 'Senha123!');
    mockFetch.mockResolvedValue(resposta(204, {}));

    await servico.sair();

    expect(chamadasPara('/auth/v1/logout')).toBe(1);
    expect(mockSecureStore.size).toBe(0);
    expect(await carregarServico().obterSessao()).toBeNull();
  });

  it('sem internet, sair ainda limpa a sessão do aparelho', async () => {
    mockFetch.mockResolvedValue(resposta(200, SESSAO));
    const servico = carregarServico();
    await servico.entrar('mariana.souza@rede.ulbra.br', 'Senha123!');
    mockFetch.mockRejectedValue(new TypeError('Network request failed'));

    await servico.sair();

    expect(mockSecureStore.size).toBe(0);
    expect(await servico.obterSessao()).toBeNull();
  });

  it('observarSessao avisa o login e o logout', async () => {
    const servico = carregarServico();
    const eventos: (string | null)[] = [];
    const cancelar = servico.observarSessao((sessao) => eventos.push(sessao?.user.id ?? null));

    mockFetch.mockResolvedValue(resposta(200, SESSAO));
    await servico.entrar('mariana.souza@rede.ulbra.br', 'Senha123!');
    mockFetch.mockResolvedValue(resposta(204, {}));
    await servico.sair();
    cancelar();

    expect(eventos).toContain(ID_USUARIO);
    expect(eventos[eventos.length - 1]).toBeNull();
  });
});
