import { temErros, validarEmail, validarLogin } from '@/utils/validacao';

describe('validarEmail (só formato)', () => {
  it.each(['aluno@rede.ulbra.br', 'Nome.Sobrenome@qualquer.edu.br', '  aluno@exemplo.com  '])(
    'aceita %p',
    (email) => {
      expect(validarEmail(email)).toBeUndefined();
    },
  );

  it.each([
    ['', 'Informe seu e-mail.'],
    ['   ', 'Informe seu e-mail.'],
    ['aluno', expect.stringMatching(/e-mail válido/)],
    ['aluno@', expect.stringMatching(/e-mail válido/)],
    ['aluno@rede', expect.stringMatching(/e-mail válido/)],
    ['alu no@rede.ulbra.br', expect.stringMatching(/e-mail válido/)],
  ])('recusa %p', (email, mensagem) => {
    expect(validarEmail(email)).toEqual(mensagem);
  });

  it('não decide domínio: outro domínio passa no formato (quem recusa é o backend, RN01)', () => {
    expect(validarEmail('aluno@gmail.com')).toBeUndefined();
  });
});

describe('validarLogin', () => {
  it('sem erros quando e-mail e senha estão preenchidos', () => {
    const erros = validarLogin({ email: 'aluno@rede.ulbra.br', senha: 'qualquer' });

    expect(erros).toEqual({});
    expect(temErros(erros)).toBe(false);
  });

  it('aponta os dois campos quando estão vazios', () => {
    const erros = validarLogin({ email: '', senha: '' });

    expect(erros).toEqual({ email: 'Informe seu e-mail.', senha: 'Informe sua senha.' });
    expect(temErros(erros)).toBe(true);
  });
});
