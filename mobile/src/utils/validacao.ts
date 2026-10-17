// Validação local só de formato, para dar retorno rápido antes de chamar o backend.
// Regras de negócio (domínio institucional, duplicidade) são do backend (RN01, AGENTS.md).

import { validarConsumo } from './consumo';
import type { Genero } from './genero';
import { validarPlaca } from './placa';

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

export type CamposPerfil = 'nome_completo' | 'telefone';

export function validarPerfil(dados: {
  nome_completo: string;
  telefone: string;
}): ErrosDeCampo<CamposPerfil> {
  const erros: ErrosDeCampo<CamposPerfil> = {};
  const erroNome = validarNome(dados.nome_completo);
  const erroTelefone = validarTelefone(dados.telefone);
  if (erroNome) {
    erros.nome_completo = erroNome;
  }
  if (erroTelefone) {
    erros.telefone = erroTelefone;
  }
  return erros;
}

// Limites das colunas de public.veiculo (docs/DATABASE.md)
const TAMANHO_MAXIMO_MODELO = 60;
const TAMANHO_MAXIMO_COR = 30;

function validarTextoObrigatorio(
  valor: string,
  vazio: string,
  tamanhoMaximo: number,
): string | undefined {
  const texto = valor.trim();
  if (texto.length === 0) {
    return vazio;
  }
  if (texto.length > tamanhoMaximo) {
    return `Use no máximo ${tamanhoMaximo} caracteres.`;
  }
  return undefined;
}

export type CamposVeiculo = 'modelo' | 'placa' | 'cor' | 'consumo_kml';

// Lugares vêm de um seletor de 2 a 8 e motorização de uma lista: não há o que validar neles.
export function validarVeiculo(dados: {
  modelo: string;
  placa: string;
  cor: string;
  consumo_kml: string;
}): ErrosDeCampo<CamposVeiculo> {
  const erros: ErrosDeCampo<CamposVeiculo> = {
    modelo: validarTextoObrigatorio(dados.modelo, 'Informe o modelo.', TAMANHO_MAXIMO_MODELO),
    placa: validarPlaca(dados.placa),
    cor: validarTextoObrigatorio(dados.cor, 'Informe a cor.', TAMANHO_MAXIMO_COR),
    consumo_kml: validarConsumo(dados.consumo_kml),
  };
  return Object.fromEntries(
    Object.entries(erros).filter(([, mensagem]) => mensagem !== undefined),
  ) as ErrosDeCampo<CamposVeiculo>;
}
