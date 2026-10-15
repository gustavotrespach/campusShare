// Validação local só de formato, para dar retorno rápido antes de chamar o backend.
// Regras de negócio (domínio institucional, duplicidade) são do backend (RN01, AGENTS.md).

const FORMATO_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
