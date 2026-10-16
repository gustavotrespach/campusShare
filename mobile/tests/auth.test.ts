// Usa o cliente Supabase real (auth-js) com SecureStore em memória e fetch simulado: prova o
// mapeamento de erros do login, a persistência da sessão e a limpeza no logout.
import { CODIGO_SEM_CONEXAO } from '@/services/erros';

import { ACCESS_TOKEN, ID_USUARIO, resposta, SESSAO } from './apoio/supabase-falso';

type ServicoAuth = typeof import('@/services/auth');

const mockSecureStore = new Map<string, string>();

const URL_CONFIRMACAO = 'exp://Gustavos-MacBook-Pro.local:8081/--/confirmacao';

jest.mock('@/services/links', () => ({
  urlDeConfirmacao: () => 'exp://Gustavos-MacBook-Pro.local:8081/--/confirmacao',
}));

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
      resposta(400, {
        code: 400,
        error_code: 'invalid_credentials',
        msg: 'Invalid login credentials',
      }),
    );

    await expect(carregarServico().entrar('aluno@rede.ulbra.br', 'errada')).rejects.toMatchObject({
      status: 401,
      code: 'invalid_credentials',
      message: 'E-mail ou senha incorretos.',
    });
  });

  it('e-mail não confirmado mostra mensagem clara pedindo a confirmação', async () => {
    mockFetch.mockResolvedValue(
      resposta(400, { code: 400, error_code: 'email_not_confirmed', msg: 'Email not confirmed' }),
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

const DADOS_CADASTRO = {
  nomeCompleto: '  Mariana Souza ',
  email: ' Mariana.Souza@REDE.ULBRA.BR',
  senha: 'Senha123!',
  genero: 'FEMININO' as const,
  telefone: '(51) 99999-9999',
};

function corpoEnviado(indice = 0): Record<string, unknown> {
  const [, opcoes] = mockFetch.mock.calls[indice] as [string, { body: string }];
  return JSON.parse(opcoes.body) as Record<string, unknown>;
}

describe('cadastrar', () => {
  it('envia metadados do perfil e o redirect do link de confirmação', async () => {
    mockFetch.mockResolvedValue(resposta(200, { ...SESSAO.user, email_confirmed_at: null }));

    await carregarServico().cadastrar(DADOS_CADASTRO);

    const [url] = mockFetch.mock.calls[0] as [string];
    expect(url).toContain('/auth/v1/signup');
    expect(decodeURIComponent(url)).toContain(`redirect_to=${URL_CONFIRMACAO}`);
    expect(corpoEnviado()).toMatchObject({
      email: 'mariana.souza@rede.ulbra.br',
      password: 'Senha123!',
      data: { nome_completo: 'Mariana Souza', genero: 'FEMININO', telefone: '51999999999' },
    });
  });

  it('telefone vazio não é enviado', async () => {
    mockFetch.mockResolvedValue(resposta(200, { ...SESSAO.user, email_confirmed_at: null }));

    await carregarServico().cadastrar({ ...DADOS_CADASTRO, telefone: ' ' });

    expect(corpoEnviado().data).toEqual({ nome_completo: 'Mariana Souza', genero: 'FEMININO' });
  });

  it('e-mail já cadastrado e não confirmado (200 sem revelar a conta) resolve como sucesso', async () => {
    mockFetch.mockResolvedValue(resposta(200, { ...SESSAO.user, identities: [] }));

    await expect(carregarServico().cadastrar(DADOS_CADASTRO)).resolves.toBeUndefined();
  });

  it.each([
    [
      'domínio fora da instituição (hook)',
      resposta(422, { code: 422, error_code: 'unknown', msg: 'DOMINIO_INVALIDO' }),
      { status: 422, code: 'DOMINIO_INVALIDO' },
    ],
    [
      'e-mail já confirmado',
      resposta(422, {
        code: 422,
        error_code: 'user_already_exists',
        msg: 'User already registered',
      }),
      { status: 409, code: 'user_already_exists' },
    ],
    [
      'senha fraca',
      resposta(422, {
        code: 422,
        error_code: 'weak_password',
        msg: 'Password should be at least 8 characters.',
        weak_password: { reasons: ['length'] },
      }),
      { code: 'weak_password' },
    ],
  ])('%s vira AppError com o código certo', async (_caso, respostaAuth, esperado) => {
    mockFetch.mockResolvedValue(respostaAuth);

    await expect(carregarServico().cadastrar(DADOS_CADASTRO)).rejects.toMatchObject(esperado);
  });
});

describe('reenviarConfirmacao', () => {
  it('pede novo e-mail de signup com o mesmo redirect', async () => {
    mockFetch.mockResolvedValue(resposta(200, {}));

    await carregarServico().reenviarConfirmacao(' Mariana.Souza@rede.ulbra.br ');

    const [url] = mockFetch.mock.calls[0] as [string];
    expect(url).toContain('/auth/v1/resend');
    expect(decodeURIComponent(url)).toContain(`redirect_to=${URL_CONFIRMACAO}`);
    expect(corpoEnviado()).toMatchObject({ email: 'mariana.souza@rede.ulbra.br', type: 'signup' });
  });

  it('limite de envios vira mensagem em pt-BR', async () => {
    mockFetch.mockResolvedValue(
      resposta(429, { code: 429, error_code: 'over_email_send_rate_limit', msg: 'rate limit' }),
    );

    await expect(carregarServico().reenviarConfirmacao('a@b.com')).rejects.toMatchObject({
      code: 'over_email_send_rate_limit',
      message: expect.stringMatching(/aguarde/i),
    });
  });
});

describe('confirmarPorLink', () => {
  it('abre a sessão com os tokens do fragmento e guarda no SecureStore', async () => {
    mockFetch.mockImplementation(async (url: string) =>
      String(url).includes('/auth/v1/user') ? resposta(200, SESSAO.user) : resposta(404, {}),
    );
    const url = `${URL_CONFIRMACAO}#access_token=${ACCESS_TOKEN}&refresh_token=refresh-falso&type=signup`;

    const sessao = await carregarServico().confirmarPorLink(url);

    expect(sessao.user.id).toBe(ID_USUARIO);
    expect(sessao.refresh_token).toBe('refresh-falso');
    expect((await carregarServico().obterSessao())?.access_token).toBe(ACCESS_TOKEN);
  });

  it('link expirado ou já usado vira mensagem clara, sem chamar o servidor', async () => {
    const url =
      'campusshare:#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired';

    await expect(carregarServico().confirmarPorLink(url)).rejects.toMatchObject({
      code: 'otp_expired',
      message: expect.stringMatching(/expirou/),
    });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('link sem tokens é recusado', async () => {
    await expect(
      carregarServico().confirmarPorLink('campusshare://confirmacao'),
    ).rejects.toMatchObject({ code: 'LINK_INVALIDO' });
  });
});
