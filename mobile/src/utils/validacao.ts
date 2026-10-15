// Validação local só de formato, para dar retorno rápido antes de chamar o backend.
// Regras de negócio (domínio institucional, duplicidade) são do backend (RN01, AGENTS.md).

import type { Genero } from './genero';

const FORMATO_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const TAMANHO_MINIMO_SENHA = 8;
// Limites das colunas de public.usuario (docs/DATABASE.md)
const TAMANHO_MAXIMO_NOME = 120;
const DIGITOS_TELEFONE = { minimo: 10, maximo: 13 };

export type ErrosDeCampo<Campo extends string> = Partial<Record<Campo, string>>;

export function validarEmail(email: string): string | undefined {
  const valor = email.trim();
  if (valor.length === 0) {
    return 'Informe seu e-mail.';
  }
  if (!FORMATO_EMAIL.test(valor)) {
    return 'Digite um e-mail válido, como nome@instituicao.edu.br.';
  }
  return undefined;
}

export function validarLogin(dados: {
  email: string;
  senha: string;
}): ErrosDeCampo<'email' | 'senha'> {
  const erros: ErrosDeCampo<'email' | 'senha'> = {};
  const erroEmail = validarEmail(dados.email);
  if (erroEmail) {
    erros.email = erroEmail;
  }
  if (dados.senha.length === 0) {
    erros.senha = 'Informe sua senha.';
  }
  return erros;
}

export function temErros<Campo extends string>(erros: ErrosDeCampo<Campo>): boolean {
  return Object.values(erros).some((mensagem) => mensagem !== undefined);
}

export function apenasDigitos(valor: string): string {
  return valor.replace(/\D/g, '');
}

export function validarNome(nome: string): string | undefined {
  const valor = nome.trim();
  if (valor.length === 0) {
    return 'Informe seu nome completo.';
  }
  if (valor.length > TAMANHO_MAXIMO_NOME) {
    return `Use no máximo ${TAMANHO_MAXIMO_NOME} caracteres.`;
  }
  return undefined;
}

// Telefone é opcional; quando informado, DDD + número (10 ou 11 dígitos, até 13 com o +55).
export function validarTelefone(telefone: string): string | undefined {
  if (telefone.trim().length === 0) {
    return undefined;
  }
  const digitos = apenasDigitos(telefone).length;
  if (digitos < DIGITOS_TELEFONE.minimo || digitos > DIGITOS_TELEFONE.maximo) {
    return 'Informe o telefone com DDD, ex.: (51) 99999-9999.';
  }
  return undefined;
}

export type CamposCadastro = 'nomeCompleto' | 'email' | 'senha' | 'genero' | 'telefone';

export function validarCadastro(dados: {
  nomeCompleto: string;
  email: string;
  senha: string;
  genero: Genero | null;
  telefone: string;
}): ErrosDeCampo<CamposCadastro> {
  const erros: ErrosDeCampo<CamposCadastro> = {
    nomeCompleto: validarNome(dados.nomeCompleto),
    email: validarEmail(dados.email),
    telefone: validarTelefone(dados.telefone),
  };
  if (dados.senha.length < TAMANHO_MINIMO_SENHA) {
    erros.senha = `A senha precisa ter pelo menos ${TAMANHO_MINIMO_SENHA} caracteres.`;
  }
  if (dados.genero === null) {
    erros.genero = 'Escolha uma opção.';
  }
  return Object.fromEntries(
    Object.entries(erros).filter(([, mensagem]) => mensagem !== undefined),
  ) as ErrosDeCampo<CamposCadastro>;
}
