// Erro esperado de uma Edge Function: o handler comum (resposta.ts) converte em
// { error: { code, message, details } } com o status HTTP indicado (ver docs/API.md).
export class AppError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: Record<string, unknown>;

  constructor(
    status: number,
    code: string,
    message: string,
    details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export interface CorpoErro {
  error: {
    code: string;
    message: string;
    details: Record<string, unknown>;
  };
}

export const CODIGO_ERRO_INTERNO = 'ERRO_INTERNO';
export const MENSAGEM_ERRO_INTERNO = 'Erro inesperado. Tente novamente em instantes.';

export function corpoErro(erro: AppError): CorpoErro {
  return { error: { code: erro.code, message: erro.message, details: erro.details } };
}
