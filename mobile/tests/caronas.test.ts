// Cliente Supabase real (auth-js + postgrest-js) com SecureStore em memória e fetch simulado.
import { resposta, SESSAO } from './apoio/supabase-falso';

type ServicoCaronas = typeof import('@/services/caronas');
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

const NOVA_CARONA = {
  idVeiculo: 'f1000000-0000-0000-0000-000000000001',
  origem: { descricao: '  Rodoviária de Torres - RS ', latitude: -29.3385, longitude: -49.7355 },
  // Coordenadas do GPS com muitas casas: a coluna guarda 6
  destino: { descricao: 'ULBRA Torres - RS', latitude: -29.329000123, longitude: -49.73650049 },
  partida: new Date('2026-10-21T02:30:00Z'),
  vagas: 3,
  custoTotalCentavos: 2450,
  toleranciaMin: 10,
  somenteMulheres: false,
};

// Linhas no formato real das RPCs locais (numeric vem como número em reais)
const LINHA_BUSCA = {
  id_carona: ID_CARONA,
  origem: 'Rodoviária de Torres - RS',
  origem_lat: -29.3385,
  origem_lng: -49.7355,
  destino: 'ULBRA Torres - RS',
  destino_lat: -29.329,
  destino_lng: -49.7365,
  data_hora_partida: '2026-10-18T15:30:00+00:00',
  vagas_disponiveis: 4,
  tolerancia_min: 15,
  somente_mulheres: false,
  distancia_km: 0.9,
  valor_por_passageiro: 8.33,
  nome_motorista: 'Marina',
  modelo: 'Chevrolet Onix',
  cor: 'Prata',
};

const LINHA_DETALHE = {
  ...LINHA_BUSCA,
  vagas_ofertadas: 4,
  status: 'ABERTA',
  custo_total: 25,
  valor_por_passageiro: 5,
  nome_motorista: 'Marina Motorista',
  placa: 'RST2E34',
  sou_motorista: false,
};

function carregar(): { caronas: ServicoCaronas; auth: ServicoAuth } {
  let modulos: { caronas: ServicoCaronas; auth: ServicoAuth } | undefined;
  jest.isolateModules(() => {
    modulos = {
      caronas: require('@/services/caronas') as ServicoCaronas,
      auth: require('@/services/auth') as ServicoAuth,
    };
  });
  return modulos as { caronas: ServicoCaronas; auth: ServicoAuth };
}

async function logado(): Promise<ServicoCaronas> {
  const { caronas, auth } = carregar();
  mockFetch.mockResolvedValueOnce(resposta(200, SESSAO));
  await auth.entrar('mariana.souza@rede.ulbra.br', 'Senha123!');
  mockFetch.mockReset();
  return caronas;
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

describe('publicarCarona', () => {
  it('chama a RPC com os parâmetros do contrato, custo em reais e sem id_motorista', async () => {
    const caronas = await logado();
    mockFetch.mockResolvedValue(resposta(200, ID_CARONA));

    await expect(caronas.publicarCarona(NOVA_CARONA)).resolves.toBe(ID_CARONA);

    const { url, metodo, corpo } = chamada();
    expect(metodo).toBe('POST');
    expect(url).toContain('/rest/v1/rpc/publicar_carona');
    expect(corpo).toEqual({
      p_id_veiculo: 'f1000000-0000-0000-0000-000000000001',
      p_origem: 'Rodoviária de Torres - RS',
      p_origem_lat: -29.3385,
      p_origem_lng: -49.7355,
      p_destino: 'ULBRA Torres - RS',
      p_destino_lat: -29.329,
      p_destino_lng: -49.7365,
      p_data_hora_partida: '2026-10-21T02:30:00.000Z',
      p_vagas_ofertadas: 3,
      p_custo_total: 24.5,
      p_tolerancia_min: 10,
      p_somente_mulheres: false,
    });
    expect(corpo).not.toHaveProperty('id_motorista');
    expect(corpo).not.toHaveProperty('p_id_motorista');
  });

  it.each([
    ['VAGAS_ACIMA_DO_LIMITE', 'PT422', 'Este veículo comporta no máximo 4 vagas para passageiros.'],
    ['PARTIDA_NO_PASSADO', 'PT400', 'Escolha uma data e hora de partida no futuro.'],
    ['SEM_VEICULO', 'PT422', 'Cadastre um veículo antes de oferecer uma carona.'],
  ])('%s chega com a frase do hint', async (codigo, errcode, hint) => {
    const caronas = await logado();
    const status = Number(errcode.slice(2));
    mockFetch.mockResolvedValue(
      resposta(status, { code: errcode, details: null, hint, message: codigo }),
    );

    await expect(caronas.publicarCarona(NOVA_CARONA)).rejects.toMatchObject({
      status,
      code: codigo,
      message: hint,
    });
  });
});

describe('buscarCaronas', () => {
  it('envia o ponto e o filtro e converte o valor por passageiro para centavos', async () => {
    const caronas = await logado();
    mockFetch.mockResolvedValue(resposta(200, [LINHA_BUSCA]));

    const lista = await caronas.buscarCaronas({
      latitude: -29.33530001,
      longitude: -49.7268,
      somenteMulheres: true,
    });

    const { url, corpo } = chamada();
    expect(url).toContain('/rest/v1/rpc/buscar_caronas');
    expect(corpo).toEqual({
      p_lat: -29.3353,
      p_lng: -49.7268,
      p_somente_mulheres: true,
      p_pagina: 1,
    });
    expect(lista).toHaveLength(1);
    expect(lista[0].valorPorPassageiroCentavos).toBe(833);
    expect(lista[0]).not.toHaveProperty('valor_por_passageiro');
  });

  it('erro de validação do backend chega como AppError', async () => {
    const caronas = await logado();
    mockFetch.mockResolvedValue(
      resposta(400, {
        code: 'PT400',
        details: null,
        hint: 'O raio da busca deve ser de 1 a 50 km.',
        message: 'DADOS_INVALIDOS',
      }),
    );

    await expect(
      caronas.buscarCaronas({ latitude: 0, longitude: 0, somenteMulheres: false }),
    ).rejects.toMatchObject({ status: 400, code: 'DADOS_INVALIDOS' });
  });
});

describe('detalharCarona', () => {
  it('converte valor e custo total para centavos e mantém placa e nome completo', async () => {
    const caronas = await logado();
    mockFetch.mockResolvedValue(resposta(200, [LINHA_DETALHE]));

    const detalhe = await caronas.detalharCarona(ID_CARONA);

    expect(chamada().corpo).toEqual({ p_id_carona: ID_CARONA });
    expect(detalhe).toMatchObject({
      valorPorPassageiroCentavos: 500,
      custoTotalCentavos: 2500,
      placa: 'RST2E34',
      nome_motorista: 'Marina Motorista',
      sou_motorista: false,
    });
  });

  it('CARONA_NAO_ENCONTRADA (404) chega com a frase do hint', async () => {
    const caronas = await logado();
    mockFetch.mockResolvedValue(
      resposta(404, {
        code: 'PT404',
        details: null,
        hint: 'Carona não encontrada ou não está mais disponível.',
        message: 'CARONA_NAO_ENCONTRADA',
      }),
    );

    await expect(caronas.detalharCarona(ID_CARONA)).rejects.toMatchObject({
      status: 404,
      code: 'CARONA_NAO_ENCONTRADA',
      message: 'Carona não encontrada ou não está mais disponível.',
    });
  });

  it('resposta vazia também vira CARONA_NAO_ENCONTRADA', async () => {
    const caronas = await logado();
    mockFetch.mockResolvedValue(resposta(200, []));

    await expect(caronas.detalharCarona(ID_CARONA)).rejects.toMatchObject({
      code: 'CARONA_NAO_ENCONTRADA',
    });
  });
});
