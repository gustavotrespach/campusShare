import { FunctionsFetchError, FunctionsHttpError } from '@supabase/supabase-js';

import { CODIGO_SEM_CONEXAO } from '@/services/erros';
import { invocarFuncao } from '@/services/funcoes';
import { verificarSaude } from '@/services/sistema';

const mockInvoke = jest.fn();

jest.mock('@/services/supabase', () => ({
  obterSupabase: () => ({ functions: { invoke: mockInvoke } }),
}));

function respostaHttp(status: number, corpo: unknown) {
  return { status, json: async () => corpo };
}

beforeEach(() => {
  mockInvoke.mockReset();
});

describe('invocarFuncao', () => {
  it('devolve o data da Edge Function', async () => {
    mockInvoke.mockResolvedValue({ data: { status: 'ok' }, error: null });

    await expect(verificarSaude()).resolves.toBe('ok');
    expect(mockInvoke).toHaveBeenCalledWith('health', { method: 'GET' });
  });

  it('lê o corpo { error } da resposta não-2xx e lança AppError com o status HTTP', async () => {
    const corpo = { error: { code: 'PAYLOAD_INVALIDO', message: 'Dados inválidos.', details: {} } };
    mockInvoke.mockResolvedValue({
      data: null,
      error: new FunctionsHttpError(respostaHttp(400, corpo)),
    });

    await expect(invocarFuncao('reservar-vaga', { body: {} })).rejects.toMatchObject({
      status: 400,
      code: 'PAYLOAD_INVALIDO',
      message: 'Dados inválidos.',
    });
  });

  it('resposta não-2xx sem JSON vira erro genérico', async () => {
    const semJson = {
      status: 502,
      json: async () => {
        throw new SyntaxError('Unexpected token <');
      },
    };
    mockInvoke.mockResolvedValue({ data: null, error: new FunctionsHttpError(semJson) });

    await expect(invocarFuncao('health')).rejects.toMatchObject({ code: 'ERRO_INESPERADO' });
  });

  it('servidor fora do ar vira SEM_CONEXAO', async () => {
    mockInvoke.mockResolvedValue({
      data: null,
      error: new FunctionsFetchError(new TypeError('Network request failed')),
    });

    await expect(verificarSaude()).rejects.toMatchObject({ status: 0, code: CODIGO_SEM_CONEXAO });
  });

  it('erro lançado ao criar o cliente (ex.: .env ausente) chega como AppError', async () => {
    mockInvoke.mockRejectedValue(new Error('qualquer falha interna'));

    await expect(verificarSaude()).rejects.toMatchObject({ code: 'ERRO_INESPERADO' });
  });
});
