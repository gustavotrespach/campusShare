import {
  apenasDigitos,
  temErros,
  validarCadastro,
  validarEmail,
  validarLogin,
  validarPerfil,
  validarTelefone,
  validarVeiculo,
} from '@/utils/validacao';

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

describe('validarCadastro', () => {
  const valido = {
    nomeCompleto: 'Mariana Souza',
    email: 'mariana@rede.ulbra.br',
    senha: '12345678',
    genero: 'FEMININO' as const,
    telefone: '',
  };

  it('formulário completo e telefone vazio não tem erros', () => {
    expect(validarCadastro(valido)).toEqual({});
  });

  it('aponta cada campo inválido', () => {
    const erros = validarCadastro({
      nomeCompleto: '   ',
      email: 'mariana@',
      senha: '1234567',
      genero: null,
      telefone: '123',
    });

    expect(erros).toEqual({
      nomeCompleto: 'Informe seu nome completo.',
      email: expect.stringMatching(/e-mail válido/),
      senha: 'A senha precisa ter pelo menos 8 caracteres.',
      genero: 'Escolha uma opção.',
      telefone: expect.stringMatching(/DDD/),
    });
  });

  it('nome acima de 120 caracteres é recusado (limite da coluna)', () => {
    expect(validarCadastro({ ...valido, nomeCompleto: 'a'.repeat(121) }).nomeCompleto).toMatch(
      /120/,
    );
  });

  it('senha com exatamente 8 caracteres passa (RN03)', () => {
    expect(validarCadastro({ ...valido, senha: 'abcdefgh' }).senha).toBeUndefined();
  });
});

describe('telefone', () => {
  it.each(['(51) 99999-9999', '51 3333-4444', '+55 51 99999-9999'])('aceita %p', (telefone) => {
    expect(validarTelefone(telefone)).toBeUndefined();
  });

  it.each(['999999999', '1234', '+55 51 99999-9999 99'])('recusa %p', (telefone) => {
    expect(validarTelefone(telefone)).toMatch(/DDD/);
  });

  it('apenasDigitos tira máscara e espaços', () => {
    expect(apenasDigitos('(51) 99999-9999')).toBe('51999999999');
  });
});

describe('validarPerfil', () => {
  it('nome obrigatório e telefone opcional com DDD', () => {
    expect(validarPerfil({ nome_completo: 'Mariana', telefone: '' })).toEqual({});
    expect(validarPerfil({ nome_completo: ' ', telefone: '123' })).toEqual({
      nome_completo: 'Informe seu nome completo.',
      telefone: expect.stringMatching(/DDD/),
    });
  });
});

describe('validarVeiculo', () => {
  const valido = { modelo: 'Chevrolet Onix', placa: 'abc-1d23', cor: 'Prata', consumo_kml: '13,0' };

  it('sem erros com os campos preenchidos (consumo opcional)', () => {
    expect(validarVeiculo(valido)).toEqual({});
    expect(validarVeiculo({ ...valido, consumo_kml: '' })).toEqual({});
  });

  it('aponta cada campo obrigatório vazio', () => {
    expect(validarVeiculo({ modelo: ' ', placa: '', cor: '', consumo_kml: '' })).toEqual({
      modelo: 'Informe o modelo.',
      placa: 'Informe a placa.',
      cor: 'Informe a cor.',
    });
  });

  it('recusa placa fora do formato, consumo inválido e textos acima do tamanho da coluna', () => {
    const erros = validarVeiculo({
      modelo: 'M'.repeat(61),
      placa: 'AB12345',
      cor: 'C'.repeat(31),
      consumo_kml: '0',
    });

    expect(erros).toEqual({
      modelo: 'Use no máximo 60 caracteres.',
      placa: expect.stringMatching(/Placa inválida/),
      cor: 'Use no máximo 30 caracteres.',
      consumo_kml: expect.stringMatching(/km\/l/),
    });
    expect(temErros(erros)).toBe(true);
  });
});
