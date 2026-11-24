// T44 — service da foto de perfil: galeria (simulada), redução para 512 px em JPEG (manipulador
// simulado), envio ao Storage no caminho fixo com upsert, RPCs, URL autenticada e erros. Cliente
// Supabase real (auth-js, storage-js e postgrest-js) com SecureStore em memória e fetch simulado.
import { ACCESS_TOKEN, ID_USUARIO, resposta, SESSAO } from './apoio/supabase-falso';

type ServicoFoto = typeof import('@/services/foto-perfil');
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

const mockLaunchImageLibrary = jest.fn();
jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: (...args: unknown[]) => mockLaunchImageLibrary(...args),
}));

// manipulate(uri).resize(...).renderAsync() → imagem com saveAsync(opções)
const mockManipulate = jest.fn();
const mockResize = jest.fn();
const mockSaveAsync = jest.fn();
jest.mock('expo-image-manipulator', () => ({
  SaveFormat: { JPEG: 'jpeg', PNG: 'png' },
  ImageManipulator: {
    manipulate: (uri: string) => {
      mockManipulate(uri);
      return {
        resize: (tamanho: unknown) => {
          mockResize(tamanho);
          return { renderAsync: async () => ({ saveAsync: mockSaveAsync }) };
        },
      };
    },
  },
}));

const mockFetch = jest.fn();

// "AAAA" em base64 = 3 bytes zero; o tamanho decodificado é 3/4 do texto
const base64DeBytes = (bytes: number) => 'A'.repeat(Math.ceil(bytes / 3) * 4);
// 4 bytes conhecidos: 0xFF 0xD8 0xFF 0xE0 (começo de um JPEG)
const JPEG_PEQUENO = '/9j/4A==';
const URI_GALERIA = 'file:///galeria/foto.heic';

function carregar(): { foto: ServicoFoto; auth: ServicoAuth } {
  let modulos: { foto: ServicoFoto; auth: ServicoAuth } | undefined;
  jest.isolateModules(() => {
    modulos = {
      foto: require('@/services/foto-perfil') as ServicoFoto,
      auth: require('@/services/auth') as ServicoAuth,
    };
  });
  return modulos as { foto: ServicoFoto; auth: ServicoAuth };
}

async function logado(): Promise<ServicoFoto> {
  const { foto, auth } = carregar();
  mockFetch.mockResolvedValueOnce(resposta(200, SESSAO));
  await auth.entrar('mariana.souza@rede.ulbra.br', 'Senha123!');
  mockFetch.mockReset();
  return foto;
}

interface Chamada {
  url: string;
  metodo: string;
  headers: Record<string, string>;
  corpo: unknown;
}

function chamada(indice: number): Chamada {
  const [url, opcoes] = mockFetch.mock.calls[indice] as [
    string,
    { method?: string; headers?: Record<string, string> | Headers; body?: unknown },
  ];
  const headers: Record<string, string> = {};
  if (opcoes.headers instanceof Headers) {
    opcoes.headers.forEach((valor, chave) => {
      headers[chave.toLowerCase()] = valor;
    });
  } else {
    for (const [chave, valor] of Object.entries(opcoes.headers ?? {})) {
      headers[chave.toLowerCase()] = valor;
    }
  }
  return {
    url: decodeURIComponent(url),
    metodo: opcoes.method ?? 'GET',
    headers,
    corpo: opcoes.body,
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
  jest.clearAllMocks();
  mockSaveAsync.mockResolvedValue({ uri: 'file:///cache/avatar.jpg', base64: JPEG_PEQUENO });
});

describe('escolherFotoDaGaleria', () => {
  it('abre só imagens, com corte quadrado, e devolve o arquivo escolhido', async () => {
    const { foto } = carregar();
    mockLaunchImageLibrary.mockResolvedValue({ canceled: false, assets: [{ uri: URI_GALERIA }] });

    await expect(foto.escolherFotoDaGaleria()).resolves.toBe(URI_GALERIA);
    expect(mockLaunchImageLibrary).toHaveBeenCalledWith({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });
  });

  it('cancelar a escolha devolve null', async () => {
    const { foto } = carregar();
    mockLaunchImageLibrary.mockResolvedValue({ canceled: true, assets: null });

    await expect(foto.escolherFotoDaGaleria()).resolves.toBeNull();
  });

  it('sem acesso às fotos: frase que diz onde liberar', async () => {
    const { foto } = carregar();
    mockLaunchImageLibrary.mockRejectedValue(new Error('Missing photo library permission'));

    await expect(foto.escolherFotoDaGaleria()).rejects.toMatchObject({
      code: 'GALERIA_NEGADA',
      message:
        'Sem acesso às suas fotos. Permita o acesso às fotos do CampusShare nos Ajustes do celular.',
    });
  });
});

describe('prepararFoto (512×512 em JPEG, até 1 MB)', () => {
  it('reduz para 512×512 e salva em JPEG com qualidade 0,8', async () => {
    const { foto } = carregar();

    const bytes = await foto.prepararFoto(URI_GALERIA);

    expect(mockManipulate).toHaveBeenCalledWith(URI_GALERIA);
    expect(mockResize).toHaveBeenCalledWith({ width: 512, height: 512 });
    expect(mockSaveAsync).toHaveBeenCalledTimes(1);
    expect(mockSaveAsync).toHaveBeenCalledWith({ compress: 0.8, format: 'jpeg', base64: true });
    expect(Array.from(bytes)).toEqual([0xff, 0xd8, 0xff, 0xe0]);
  });

  it('acima de 1 MB, comprime de novo com qualidade menor', async () => {
    const { foto } = carregar();
    mockSaveAsync
      .mockResolvedValueOnce({ uri: 'a', base64: base64DeBytes(1024 * 1024 + 3) })
      .mockResolvedValueOnce({ uri: 'b', base64: JPEG_PEQUENO });

    const bytes = await foto.prepararFoto(URI_GALERIA);

    expect(
      mockSaveAsync.mock.calls.map(([opcoes]) => (opcoes as { compress: number }).compress),
    ).toEqual([0.8, 0.6]);
    expect(bytes.byteLength).toBe(4);
  });

  it('ainda acima de 1 MB depois de 0,4: FOTO_GRANDE', async () => {
    const { foto } = carregar();
    mockSaveAsync.mockResolvedValue({ uri: 'a', base64: base64DeBytes(1024 * 1024 + 3) });

    await expect(foto.prepararFoto(URI_GALERIA)).rejects.toMatchObject({ code: 'FOTO_GRANDE' });
    expect(mockSaveAsync).toHaveBeenCalledTimes(3);
  });

  it('imagem que o manipulador não abre: FOTO_ILEGIVEL', async () => {
    const { foto } = carregar();
    mockResize.mockImplementationOnce(() => {
      throw new Error('formato não suportado');
    });

    await expect(foto.prepararFoto(URI_GALERIA)).rejects.toMatchObject({ code: 'FOTO_ILEGIVEL' });
  });
});

describe('enviarFotoPerfil', () => {
  it('envia os bytes para fotos-perfil/<uid>/avatar.jpg com upsert e JPEG, e chama a RPC', async () => {
    const foto = await logado();
    mockFetch
      .mockResolvedValueOnce(
        resposta(200, { Id: 'obj', Key: `fotos-perfil/${ID_USUARIO}/avatar.jpg` }),
      )
      .mockResolvedValueOnce(resposta(200, '2026-11-24T19:40:00+00:00'));

    await foto.enviarFotoPerfil(URI_GALERIA);

    const envio = chamada(0);
    expect(envio.metodo).toBe('POST');
    expect(envio.url).toBe(
      `http://127.0.0.1:54321/storage/v1/object/fotos-perfil/${ID_USUARIO}/avatar.jpg`,
    );
    expect(envio.headers['x-upsert']).toBe('true');
    expect(envio.headers['content-type']).toBe('image/jpeg');
    expect(envio.headers.authorization).toBe(`Bearer ${ACCESS_TOKEN}`);
    expect(envio.corpo).toBeInstanceOf(ArrayBuffer);
    expect(Array.from(new Uint8Array(envio.corpo as ArrayBuffer))).toEqual([
      0xff, 0xd8, 0xff, 0xe0,
    ]);

    const rpc = chamada(1);
    expect(rpc.metodo).toBe('POST');
    expect(rpc.url).toContain('/rest/v1/rpc/definir_foto_perfil');
  });

  it('o Storage recusa por tamanho (413): FOTO_GRANDE, sem chamar a RPC', async () => {
    const foto = await logado();
    mockFetch.mockResolvedValueOnce(
      resposta(413, {
        statusCode: '413',
        error: 'Payload too large',
        message: 'The object exceeded the maximum allowed size',
      }),
    );

    await expect(foto.enviarFotoPerfil(URI_GALERIA)).rejects.toMatchObject({
      code: 'FOTO_GRANDE',
      message: 'Essa foto ficou grande demais. Escolha outra imagem.',
    });
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('sem internet: SEM_CONEXAO', async () => {
    const foto = await logado();
    mockFetch.mockRejectedValueOnce(new TypeError('Network request failed'));

    await expect(foto.enviarFotoPerfil(URI_GALERIA)).rejects.toMatchObject({
      code: 'SEM_CONEXAO',
    });
  });

  it('a RPC não acha o arquivo: a frase do hint (FOTO_NAO_ENVIADA)', async () => {
    const foto = await logado();
    mockFetch.mockResolvedValueOnce(resposta(200, { Id: 'obj', Key: 'k' })).mockResolvedValueOnce(
      resposta(409, {
        code: 'PT409',
        details: null,
        hint: 'A foto não chegou ao servidor. Tente enviar de novo.',
        message: 'FOTO_NAO_ENVIADA',
      }),
    );

    await expect(foto.enviarFotoPerfil(URI_GALERIA)).rejects.toMatchObject({
      status: 409,
      code: 'FOTO_NAO_ENVIADA',
      message: 'A foto não chegou ao servidor. Tente enviar de novo.',
    });
  });

  it('sem sessão: NAO_AUTENTICADO, sem enviar nada', async () => {
    const { foto } = carregar();

    await expect(foto.enviarFotoPerfil(URI_GALERIA)).rejects.toMatchObject({
      code: 'NAO_AUTENTICADO',
    });
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

describe('removerFotoPerfil', () => {
  it('apaga o arquivo pela API do Storage e depois chama remover_foto_perfil', async () => {
    const foto = await logado();
    mockFetch
      .mockResolvedValueOnce(resposta(200, [{ name: `${ID_USUARIO}/avatar.jpg` }]))
      .mockResolvedValueOnce(resposta(204, null));

    await foto.removerFotoPerfil();

    const remocao = chamada(0);
    expect(remocao.metodo).toBe('DELETE');
    expect(remocao.url).toBe('http://127.0.0.1:54321/storage/v1/object/fotos-perfil');
    expect(JSON.parse(remocao.corpo as string)).toEqual({
      prefixes: [`${ID_USUARIO}/avatar.jpg`],
    });
    expect(chamada(1).url).toContain('/rest/v1/rpc/remover_foto_perfil');
  });
});

describe('urlFotoPerfil e obterMinhaFoto', () => {
  it('endpoint autenticado do Storage com o token da sessão e a chave publicável', async () => {
    const foto = await logado();

    await expect(foto.urlFotoPerfil(`${ID_USUARIO}/avatar.jpg?v=1795521600`)).resolves.toEqual({
      uri: `http://127.0.0.1:54321/storage/v1/object/authenticated/fotos-perfil/${ID_USUARIO}/avatar.jpg?v=1795521600`,
      headers: { Authorization: `Bearer ${ACCESS_TOKEN}`, apikey: 'sb_publishable_teste' },
    });
    // Sem nenhuma chamada de rede: o token já está na sessão
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('sem sessão, não monta a URL', async () => {
    const { foto } = carregar();

    await expect(foto.urlFotoPerfil('x/avatar.jpg?v=1')).rejects.toMatchObject({
      code: 'NAO_AUTENTICADO',
    });
  });

  it('a própria foto vem do perfil_publico do usuário da sessão', async () => {
    const foto = await logado();
    mockFetch.mockResolvedValueOnce(
      resposta(200, [
        {
          id_usuario: ID_USUARIO,
          nome: 'Mariana',
          media_avaliacoes: null,
          total_avaliacoes: 0,
          foto_caminho: `${ID_USUARIO}/avatar.jpg?v=1795521600`,
        },
      ]),
    );

    await expect(foto.obterMinhaFoto()).resolves.toBe(`${ID_USUARIO}/avatar.jpg?v=1795521600`);
    expect(JSON.parse(chamada(0).corpo as string)).toEqual({ p_id_usuario: ID_USUARIO });
  });
});
