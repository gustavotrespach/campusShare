import { campoDoErroDeCadastro } from '@/utils/erros-cadastro';

describe('campoDoErroDeCadastro', () => {
  it.each([
    ['DOMINIO_INVALIDO', 'email'],
    ['user_already_exists', 'email'],
    ['email_exists', 'email'],
    ['email_address_invalid', 'email'],
    ['weak_password', 'senha'],
  ])('%s aparece no campo %s', (codigo, campo) => {
    expect(campoDoErroDeCadastro(codigo)).toBe(campo);
  });

  it.each(['SEM_CONEXAO', 'over_email_send_rate_limit', 'ERRO_INESPERADO'])(
    '%s vai para o aviso geral',
    (codigo) => {
      expect(campoDoErroDeCadastro(codigo)).toBeNull();
    },
  );
});
