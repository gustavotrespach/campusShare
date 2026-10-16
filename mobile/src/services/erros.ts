import { isAuthError } from '@supabase/supabase-js';

// Erro único que telas e componentes recebem dos services (docs/API.md → "Padrão de erro").
export class AppError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
  }
}

export const CODIGO_SEM_CONEXAO = 'SEM_CONEXAO';
export const CODIGO_ERRO_INESPERADO = 'ERRO_INESPERADO';

const MENSAGEM_SEM_CONEXAO =
  'Não foi possível conectar ao servidor. Verifique sua internet e tente de novo.';
const MENSAGEM_ERRO_INESPERADO = 'Algo deu errado. Tente novamente em instantes.';

// Frases para os códigos do Supabase Auth; o hook de domínio manda o código em `message`.
const ERROS_AUTH: Record<string, { status?: number; mensagem: string }> = {
  DOMINIO_INVALIDO: { status: 422, mensagem: 'Use o e-mail da sua instituição de ensino.' },
  invalid_credentials: { status: 401, mensagem: 'E-mail ou senha incorretos.' },
  email_not_confirmed: {
    mensagem: 'Confirme seu e-mail antes de entrar: abra o link que enviamos para você.',
  },
  user_already_exists: { status: 409, mensagem: 'Já existe uma conta com este e-mail.' },
  email_exists: { status: 409, mensagem: 'Já existe uma conta com este e-mail.' },
  weak_password: { mensagem: 'A senha precisa ter pelo menos 8 caracteres.' },
  email_address_invalid: { mensagem: 'Confira o e-mail informado.' },
  validation_failed: { mensagem: 'Confira os dados informados.' },
  over_email_send_rate_limit: {
    mensagem: 'Muitos e-mails enviados. Aguarde alguns minutos e tente de novo.',
  },
  over_request_rate_limit: { mensagem: 'Muitas tentativas. Aguarde alguns minutos.' },
  otp_expired: { mensagem: 'O link de confirmação expirou ou já foi usado. Peça um novo.' },
  session_not_found: { status: 401, mensagem: 'Sua sessão expirou. Entre novamente.' },
  refresh_token_not_found: { status: 401, mensagem: 'Sua sessão expirou. Entre novamente.' },
};

// Erros de banco que não são do domínio (PTxxx) mas o app precisa distinguir.
const ERROS_POSTGRES: Record<string, { status: number; code: string; mensagem: string }> = {
  '42501': { status: 403, code: 'PERMISSAO_NEGADA', mensagem: 'Você não tem permissão para isso.' },
  PGRST116: { status: 404, code: 'NAO_ENCONTRADO', mensagem: 'Registro não encontrado.' },
};

type Registro = Record<string, unknown>;

function ehRegistro(valor: unknown): valor is Registro {
  return typeof valor === 'object' && valor !== null;
}

function texto(valor: unknown): string | null {
  return typeof valor === 'string' && valor.trim().length > 0 ? valor : null;
}

function ehFalhaDeRede(erro: unknown): boolean {
  if (!ehRegistro(erro)) {
    return false;
  }
  if (erro.name === 'AuthRetryableFetchError' && erro.status === 0) {
    return true;
  }
  if (erro.name === 'FunctionsFetchError') {
    return true;
  }
  const mensagem = texto(erro.message) ?? '';
  return /network request failed|failed to fetch|fetch failed|network error/i.test(mensagem);
}

function codigoDoAuth(erro: Registro): string {
  const codigo = texto(erro.code);
  const mensagem = texto(erro.message);
  // O hook de domínio responde com error_code 'unknown' e o código do domínio em message.
  if (mensagem && ERROS_AUTH[mensagem] && (!codigo || codigo === 'unknown')) {
    return mensagem;
  }
  return codigo ?? '';
}

function deAuth(erro: Registro): AppError {
  const codigoOriginal = codigoDoAuth(erro);
  const conhecido = ERROS_AUTH[codigoOriginal];
  const status = typeof erro.status === 'number' && erro.status > 0 ? erro.status : 500;
  if (!conhecido) {
    return new AppError(status, codigoOriginal || 'ERRO_AUTENTICACAO', MENSAGEM_ERRO_INESPERADO);
  }
  return new AppError(conhecido.status ?? status, codigoOriginal, conhecido.mensagem);
}

// Edge Function: { status, error: { code, message } } — o service junta o status HTTP ao corpo.
function deEdgeFunction(erro: Registro): AppError | null {
  const corpo = erro.error;
  if (typeof erro.status !== 'number' || !ehRegistro(corpo)) {
    return null;
  }
  const codigo = texto(corpo.code);
  const mensagem = texto(corpo.message);
  if (!codigo || !mensagem) {
    return null;
  }
  return new AppError(erro.status, codigo, mensagem);
}

// PostgREST / função SQL: raise exception '<CODIGO>' using errcode = 'PT4xx', hint = '<frase>'.
function dePostgrest(erro: Registro): AppError | null {
  const codigoPg = texto(erro.code);
  if (!codigoPg || !('hint' in erro) || !('details' in erro)) {
    return null;
  }
  const dominio = /^PT(\d{3})$/.exec(codigoPg);
  if (dominio) {
    const codigo = texto(erro.message) ?? CODIGO_ERRO_INESPERADO;
    return new AppError(Number(dominio[1]), codigo, texto(erro.hint) ?? MENSAGEM_ERRO_INESPERADO);
  }
  const conhecido = ERROS_POSTGRES[codigoPg];
  if (conhecido) {
    return new AppError(conhecido.status, conhecido.code, conhecido.mensagem);
  }
  return new AppError(500, CODIGO_ERRO_INESPERADO, MENSAGEM_ERRO_INESPERADO);
}

export function normalizarErro(erro: unknown): AppError {
  if (erro instanceof AppError) {
    return erro;
  }
  if (ehFalhaDeRede(erro)) {
    return new AppError(0, CODIGO_SEM_CONEXAO, MENSAGEM_SEM_CONEXAO);
  }
  if (isAuthError(erro)) {
    return deAuth(erro as unknown as Registro);
  }
  if (ehRegistro(erro)) {
    const convertido = deEdgeFunction(erro) ?? dePostgrest(erro);
    if (convertido) {
      return convertido;
    }
  }
  // Detalhe técnico nunca vai para a tela.
  return new AppError(500, CODIGO_ERRO_INESPERADO, MENSAGEM_ERRO_INESPERADO);
}
