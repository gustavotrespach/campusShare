import {
  AuthApiError,
  AuthRetryableFetchError,
  FunctionsFetchError,
  PostgrestError,
} from '@supabase/supabase-js';

import {
  AppError,
  CODIGO_ERRO_INESPERADO,
  CODIGO_SEM_CONEXAO,
  normalizarErro,
} from '@/services/erros';

describe('normalizarErro — PostgREST / função SQL', () => {
  it('converte PTxxx em status, código do domínio e frase do hint', () => {
    const erro = new PostgrestError({
      message: 'CARONA_LOTADA',
      code: 'PT409',
      hint: 'Esta carona não tem mais vagas.',
      details: '',
    });

    expect(normalizarErro(erro)).toMatchObject({
      status: 409,
      code: 'CARONA_LOTADA',
      message: 'Esta carona não tem mais vagas.',
    });
  });

  it('aceita o erro como objeto simples (formato devolvido pelo supabase-js)', () => {
    const erro = {
      message: 'PRECO_ACIMA_DO_TETO',
      code: 'PT422',
      hint: 'Valor acima do teto.',
      details: null,
    };

    expect(normalizarErro(erro)).toMatchObject({ status: 422, code: 'PRECO_ACIMA_DO_TETO' });
  });

  it('permissão negada (RLS / grant) vira 403 PERMISSAO_NEGADA', () => {
    const erro = {
      message: 'permission denied for table usuario',
      code: '42501',
      hint: null,
      details: null,
    };

    expect(normalizarErro(erro)).toMatchObject({ status: 403, code: 'PERMISSAO_NEGADA' });
  });

  it('erro de banco desconhecido vira mensagem genérica, sem detalhe técnico', () => {
    const erro = {
      message: 'duplicate key value violates unique constraint "usuario_pkey"',
      code: '23505',
      hint: null,
      details: 'Key (id_usuario)=(...) already exists.',
    };

    const convertido = normalizarErro(erro);
    expect(convertido).toMatchObject({ status: 500, code: CODIGO_ERRO_INESPERADO });
    expect(convertido.message).not.toMatch(/duplicate|constraint|usuario_pkey/);
  });
});

describe('normalizarErro — Edge Function', () => {
  it('usa status, code e message do corpo { error: { code, message, details } }', () => {
    const erro = {
      status: 400,
      error: { code: 'PAYLOAD_INVALIDO', message: 'Dados inválidos.', details: { campos: {} } },
    };

    expect(normalizarErro(erro)).toMatchObject({
      status: 400,
      code: 'PAYLOAD_INVALIDO',
      message: 'Dados inválidos.',
    });
  });

  it('corpo sem code/message cai no erro genérico', () => {
    expect(normalizarErro({ status: 502, error: {} })).toMatchObject({
      status: 500,
      code: CODIGO_ERRO_INESPERADO,
    });
  });
});

describe('normalizarErro — Supabase Auth', () => {
  it('DOMINIO_INVALIDO do hook vem em message com error_code "unknown"', () => {
    const erro = new AuthApiError('DOMINIO_INVALIDO', 422, 'unknown');

    expect(normalizarErro(erro)).toMatchObject({
      status: 422,
      code: 'DOMINIO_INVALIDO',
      message: 'Use o e-mail da sua instituição de ensino.',
    });
  });

  it('invalid_credentials (400) vira 401 com mensagem genérica', () => {
    const erro = new AuthApiError('Invalid login credentials', 400, 'invalid_credentials');

    expect(normalizarErro(erro)).toMatchObject({
      status: 401,
      code: 'invalid_credentials',
      message: 'E-mail ou senha incorretos.',
    });
  });

  it('email_not_confirmed mantém o status e explica o que fazer', () => {
    const erro = new AuthApiError('Email not confirmed', 400, 'email_not_confirmed');

    const convertido = normalizarErro(erro);
    expect(convertido).toMatchObject({ status: 400, code: 'email_not_confirmed' });
    expect(convertido.message).toMatch(/confirme seu e-mail/i);
  });

  it('user_already_exists e weak_password ganham frases em pt-BR', () => {
    expect(
      normalizarErro(new AuthApiError('User already registered', 422, 'user_already_exists')),
    ).toMatchObject({ status: 409, code: 'user_already_exists' });
    expect(
      normalizarErro(new AuthApiError('Password should be...', 422, 'weak_password')).message,
    ).toBe('A senha precisa ter pelo menos 8 caracteres.');
  });

  it('código do Auth desconhecido não vaza a mensagem em inglês', () => {
    const convertido = normalizarErro(
      new AuthApiError('Something internal', 500, 'unexpected_failure'),
    );

    expect(convertido).toMatchObject({ status: 500, code: 'unexpected_failure' });
    expect(convertido.message).not.toMatch(/internal/i);
  });
});

describe('normalizarErro — falha de rede', () => {
  it.each([
    ['fetch do React Native', new TypeError('Network request failed')],
    ['Auth sem resposta', new AuthRetryableFetchError('Network request failed', 0)],
    ['Edge Function sem resposta', new FunctionsFetchError(new TypeError('Failed to fetch'))],
    [
      'PostgREST sem resposta',
      { message: 'TypeError: Network request failed', code: '', hint: '', details: '' },
    ],
  ])('%s vira status 0 SEM_CONEXAO em pt-BR', (_caso, erro) => {
    expect(normalizarErro(erro)).toMatchObject({
      status: 0,
      code: CODIGO_SEM_CONEXAO,
      message: expect.stringMatching(/conectar ao servidor/),
    });
  });
});

describe('normalizarErro — outros', () => {
  it('AppError passa direto', () => {
    const erro = new AppError(409, 'RESERVA_DUPLICADA', 'Você já reservou esta carona.');

    expect(normalizarErro(erro)).toBe(erro);
  });

  it.each([[new Error('stack trace com detalhe')], ['texto solto'], [null], [undefined], [42]])(
    'erro desconhecido (%p) vira mensagem genérica',
    (erro) => {
      expect(normalizarErro(erro)).toMatchObject({
        status: 500,
        code: CODIGO_ERRO_INESPERADO,
        message: 'Algo deu errado. Tente novamente em instantes.',
      });
    },
  );
});
