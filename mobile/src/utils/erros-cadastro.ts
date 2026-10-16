import type { CamposCadastro } from './validacao';

// Em qual campo do formulário de cadastro cada erro do backend aparece; o resto vai para o aviso geral.
const CAMPO_POR_CODIGO: Record<string, CamposCadastro> = {
  DOMINIO_INVALIDO: 'email',
  user_already_exists: 'email',
  email_exists: 'email',
  email_address_invalid: 'email',
  weak_password: 'senha',
};

export function campoDoErroDeCadastro(codigo: string): CamposCadastro | null {
  return CAMPO_POR_CODIGO[codigo] ?? null;
}
