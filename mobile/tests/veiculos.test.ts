// Cliente Supabase real (auth-js + postgrest-js) com SecureStore em memória e fetch simulado.
import { resposta, SESSAO } from './apoio/supabase-falso';

type ServicoVeiculos = typeof import('@/services/veiculos');
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

const ID_VEICULO = 'f1000000-0000-0000-0000-000000000001';

const LINHA_VEICULO = {
  id_veiculo: ID_VEICULO,
  modelo: 'Chevrolet Onix',
  placa: 'ABC1D23',
  cor: 'Prata',
  qtd_lugares: 5,
  motorizacao: '1.0',
  consumo_kml: 13,
};

const DADOS = {
  modelo: '  Chevrolet Onix ',
  placa: 'abc-1d23',
  cor: ' Prata',
  qtd_lugares: 5,
  motorizacao: '1.0',
  consumo_kml: '13,0',
};

// Formatos reais do PostgREST local (capturados com curl no Supabase local, T16)
const ERRO_PLACA_DUPLICADA = {
  code: '23505',
  details: null,
  hint: null,
  message: 'duplicate key value violates unique constraint "veiculo_placa_key"',
};

const ERRO_VEICULO_EM_USO = {
  code: 'PT409',
  details: null,
  hint: 'Este veículo está em uma carona ativa. Cancele ou conclua a carona antes de excluí-lo.',
  message: 'VEICULO_EM_USO',
};

const ERRO_VEICULO_COM_HISTORICO = {
  code: 'PT409',
  details: null,
  hint: 'Este veículo tem caronas registradas no histórico e não pode ser excluído.',
  message: 'VEICULO_COM_HISTORICO',
};

function carregar(): { veiculos: ServicoVeiculos; auth: ServicoAuth } {
  let modulos: { veiculos: ServicoVeiculos; auth: ServicoAuth } | undefined;
  jest.isolateModules(() => {
    modulos = {
      veiculos: require('@/services/veiculos') as ServicoVeiculos,
      auth: require('@/services/auth') as ServicoAuth,
    };
  });
  return modulos as { veiculos: ServicoVeiculos; auth: ServicoAuth };
}

async function logado(): Promise<ServicoVeiculos> {
  const { veiculos, auth } = carregar();
  mockFetch.mockResolvedValueOnce(resposta(200, SESSAO));
  await auth.entrar('mariana.souza@rede.ulbra.br', 'Senha123!');
  mockFetch.mockReset();
  return veiculos;
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

describe('listarMeusVeiculos e obterVeiculo', () => {
  it('lista as colunas do veículo ordenadas pelo modelo (a RLS filtra o dono)', async () => {
    const veiculos = await logado();
    mockFetch.mockResolvedValue(resposta(200, [LINHA_VEICULO]));

    await expect(veiculos.listarMeusVeiculos()).resolves.toEqual([LINHA_VEICULO]);
    const { url, metodo } = chamada();
    expect(metodo).toBe('GET');
    expect(url).toContain(
      '/rest/v1/veiculo?select=id_veiculo,modelo,placa,cor,qtd_lugares,motorizacao,consumo_kml',
    );
    expect(url).toContain('order=modelo.asc');
    expect(url).not.toContain('id_motorista');
  });

  it('obterVeiculo sem linha visível vira VEICULO_NAO_ENCONTRADO', async () => {
    const veiculos = await logado();
    mockFetch.mockResolvedValue(resposta(200, []));

    await expect(veiculos.obterVeiculo(ID_VEICULO)).rejects.toMatchObject({
      status: 404,
      code: 'VEICULO_NAO_ENCONTRADO',
      message: 'Veículo não encontrado.',
    });
    expect(chamada().url).toContain(`id_veiculo=eq.${ID_VEICULO}`);
  });
});

describe('cadastrarVeiculo', () => {
  // Com .single() o PostgREST responde um objeto, não uma lista
  it('envia o veículo normalizado e nunca id_motorista (default auth.uid() no banco)', async () => {
    const veiculos = await logado();
    mockFetch.mockResolvedValue(resposta(201, LINHA_VEICULO));
    // Campos extras que um app adulterado tentaria mandar: não podem chegar ao banco
    const adulterado = {
      ...DADOS,
      id_motorista: 'b0000000-0000-0000-0000-00000000000b',
      id_veiculo: 'a1000000-0000-0000-0000-000000000001',
    };

    await expect(veiculos.cadastrarVeiculo(adulterado)).resolves.toEqual(LINHA_VEICULO);

    const { metodo, corpo } = chamada();
    expect(metodo).toBe('POST');
    expect(corpo).toEqual({
      modelo: 'Chevrolet Onix',
      placa: 'ABC1D23',
      cor: 'Prata',
      qtd_lugares: 5,
      motorizacao: '1.0',
      consumo_kml: 13,
    });
    expect(corpo).not.toHaveProperty('id_motorista');
  });

  it('motorização e consumo vazios vão como null; consumo com vírgula vira número de 1 casa', async () => {
    const veiculos = await logado();
    mockFetch.mockResolvedValue(resposta(201, LINHA_VEICULO));

    await veiculos.cadastrarVeiculo({ ...DADOS, motorizacao: null, consumo_kml: '' });
    expect(chamada(0).corpo).toMatchObject({ motorizacao: null, consumo_kml: null });

    await veiculos.cadastrarVeiculo({ ...DADOS, consumo_kml: '12,47' });
    expect(chamada(1).corpo).toMatchObject({ consumo_kml: 12.5 });
  });

  it('placa duplicada (23505 em veiculo_placa_key) vira PLACA_DUPLICADA com frase clara', async () => {
    const veiculos = await logado();
    mockFetch.mockResolvedValue(resposta(409, ERRO_PLACA_DUPLICADA));

    await expect(veiculos.cadastrarVeiculo(DADOS)).rejects.toMatchObject({
      status: 409,
      code: veiculos.CODIGO_PLACA_DUPLICADA,
      message: 'Esta placa já está cadastrada.',
    });
  });

  it('outro 23505 continua genérico (não é placa)', async () => {
    const veiculos = await logado();
    mockFetch.mockResolvedValue(
      resposta(409, { ...ERRO_PLACA_DUPLICADA, message: 'duplicate key value violates "outra"' }),
    );

    await expect(veiculos.cadastrarVeiculo(DADOS)).rejects.toMatchObject({
      code: 'ERRO_INESPERADO',
    });
  });
});

describe('atualizarVeiculo', () => {
  it('filtra pelo id_veiculo e não envia id_motorista', async () => {
    const veiculos = await logado();
    mockFetch.mockResolvedValue(resposta(200, [{ ...LINHA_VEICULO, cor: 'Grafite' }]));

    const atualizado = await veiculos.atualizarVeiculo(ID_VEICULO, { ...DADOS, cor: 'Grafite' });

    const { url, metodo, corpo } = chamada();
    expect(metodo).toBe('PATCH');
    expect(url).toContain(`id_veiculo=eq.${ID_VEICULO}`);
    expect(corpo).toMatchObject({ cor: 'Grafite', placa: 'ABC1D23' });
    expect(corpo).not.toHaveProperty('id_motorista');
    expect(atualizado.cor).toBe('Grafite');
  });

  it('nenhuma linha afetada (veículo de outro, filtrado pela RLS) vira "Veículo não encontrado."', async () => {
    const veiculos = await logado();
    mockFetch.mockResolvedValue(resposta(200, []));

    await expect(veiculos.atualizarVeiculo(ID_VEICULO, DADOS)).rejects.toMatchObject({
      status: 404,
      code: 'VEICULO_NAO_ENCONTRADO',
    });
  });

  it('placa duplicada na edição também vira PLACA_DUPLICADA', async () => {
    const veiculos = await logado();
    mockFetch.mockResolvedValue(resposta(409, ERRO_PLACA_DUPLICADA));

    await expect(veiculos.atualizarVeiculo(ID_VEICULO, DADOS)).rejects.toMatchObject({
      code: veiculos.CODIGO_PLACA_DUPLICADA,
    });
  });
});

describe('excluirVeiculo', () => {
  it('exclui pelo id_veiculo', async () => {
    const veiculos = await logado();
    mockFetch.mockResolvedValue(resposta(200, [{ id_veiculo: ID_VEICULO }]));

    await expect(veiculos.excluirVeiculo(ID_VEICULO)).resolves.toBeUndefined();
    const { url, metodo } = chamada();
    expect(metodo).toBe('DELETE');
    expect(url).toContain(`id_veiculo=eq.${ID_VEICULO}`);
  });

  it('nenhuma linha afetada vira "Veículo não encontrado."', async () => {
    const veiculos = await logado();
    mockFetch.mockResolvedValue(resposta(200, []));

    await expect(veiculos.excluirVeiculo(ID_VEICULO)).rejects.toMatchObject({
      status: 404,
      code: 'VEICULO_NAO_ENCONTRADO',
    });
  });

  it.each([
    ['VEICULO_EM_USO', ERRO_VEICULO_EM_USO],
    ['VEICULO_COM_HISTORICO', ERRO_VEICULO_COM_HISTORICO],
  ])('%s (409) chega com a frase do hint', async (codigo, corpo) => {
    const veiculos = await logado();
    mockFetch.mockResolvedValue(resposta(409, corpo));

    await expect(veiculos.excluirVeiculo(ID_VEICULO)).rejects.toMatchObject({
      status: 409,
      code: codigo,
      message: corpo.hint,
    });
  });
});
