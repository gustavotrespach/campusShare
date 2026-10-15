import { armazenamentoSeguro } from '@/services/armazenamento-seguro';

const LIMITE_BYTES_SECURE_STORE = 2048;
const mockGuardado = new Map<string, string>();

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async (chave: string) => mockGuardado.get(chave) ?? null),
  setItemAsync: jest.fn(async (chave: string, valor: string) => {
    mockGuardado.set(chave, valor);
  }),
  deleteItemAsync: jest.fn(async (chave: string) => {
    mockGuardado.delete(chave);
  }),
}));

function bytesUtf8(valor: string): number {
  return new TextEncoder().encode(valor).length;
}

// Sessão realista: JWT + refresh token + usuário com nome acentuado (≈ 4 KB)
function sessaoFalsa(tamanho: number): string {
  const nome = 'Conceição Gonçalves 🚗 ';
  return JSON.stringify({ access_token: 'x'.repeat(tamanho), user: { nome: nome.repeat(40) } });
}

beforeEach(() => {
  mockGuardado.clear();
});

describe('armazenamentoSeguro', () => {
  it('guarda e lê de volta um valor maior que o limite do SecureStore', async () => {
    const sessao = sessaoFalsa(4000);

    await armazenamentoSeguro.setItem('campusshare-sessao', sessao);

    expect(await armazenamentoSeguro.getItem('campusshare-sessao')).toBe(sessao);
    expect(Number(mockGuardado.get('campusshare-sessao_partes'))).toBeGreaterThan(1);
  });

  it('nenhuma parte passa de 2048 bytes, mesmo com acentos e emoji', async () => {
    await armazenamentoSeguro.setItem('campusshare-sessao', sessaoFalsa(4000));

    for (const valor of mockGuardado.values()) {
      expect(bytesUtf8(valor)).toBeLessThanOrEqual(LIMITE_BYTES_SECURE_STORE);
    }
  });

  it('valor menor apaga as partes que sobraram da gravação anterior', async () => {
    await armazenamentoSeguro.setItem('campusshare-sessao', sessaoFalsa(4000));
    await armazenamentoSeguro.setItem('campusshare-sessao', 'curto');

    expect(await armazenamentoSeguro.getItem('campusshare-sessao')).toBe('curto');
    expect([...mockGuardado.keys()]).toEqual([
      'campusshare-sessao_parte_0',
      'campusshare-sessao_partes',
    ]);
  });

  it('removeItem apaga todas as partes (logout limpa o SecureStore)', async () => {
    await armazenamentoSeguro.setItem('campusshare-sessao', sessaoFalsa(4000));

    await armazenamentoSeguro.removeItem('campusshare-sessao');

    expect(mockGuardado.size).toBe(0);
    expect(await armazenamentoSeguro.getItem('campusshare-sessao')).toBeNull();
  });

  it('chave inexistente ou parte faltando devolve null', async () => {
    expect(await armazenamentoSeguro.getItem('nada')).toBeNull();

    await armazenamentoSeguro.setItem('campusshare-sessao', sessaoFalsa(4000));
    mockGuardado.delete('campusshare-sessao_parte_1');

    expect(await armazenamentoSeguro.getItem('campusshare-sessao')).toBeNull();
  });
});
