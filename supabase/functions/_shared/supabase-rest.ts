// Acesso ao Supabase pelas Edge Functions com fetch direto (sem SDK): validar o JWT do usuário no
// Auth e chamar funções SQL (RPC) com a service_role. A chave de serviço só existe aqui, no
// servidor (docs/SECURITY.md); nunca no app.
import { AppError } from './erros.ts';

export interface ConfigSupabase {
  url: string;
  chaveServico: string;
  fetch?: typeof fetch;
}

export interface UsuarioAutenticado {
  id: string;
  email: string | null;
  nomeCompleto: string | null;
}

const SESSAO_EXPIRADA = 'Sua sessão expirou. Entre novamente.';

type Registro = Record<string, unknown>;

function ehRegistro(valor: unknown): valor is Registro {
  return typeof valor === 'object' && valor !== null;
}

function texto(valor: unknown): string | null {
  return typeof valor === 'string' && valor.trim().length > 0 ? valor : null;
}

async function lerJson(resposta: Response): Promise<unknown> {
  try {
    return await resposta.json();
  } catch {
    return null;
  }
}

// Mesmo que auth.getUser(token): o Auth confere assinatura e validade e devolve o usuário.
export async function usuarioDoToken(
  config: ConfigSupabase,
  token: string,
): Promise<UsuarioAutenticado> {
  const buscar = config.fetch ?? fetch;
  const resposta = await buscar(`${config.url}/auth/v1/user`, {
    headers: { apikey: config.chaveServico, Authorization: `Bearer ${token}` },
  });
  if (resposta.status === 401 || resposta.status === 403) {
    throw new AppError(401, 'NAO_AUTENTICADO', SESSAO_EXPIRADA);
  }
  if (!resposta.ok) {
    throw new Error(`Auth respondeu HTTP ${resposta.status} ao validar o token`);
  }
  const corpo = await lerJson(resposta);
  const id = ehRegistro(corpo) ? texto(corpo.id) : null;
  if (!ehRegistro(corpo) || !id) {
    throw new AppError(401, 'NAO_AUTENTICADO', SESSAO_EXPIRADA);
  }
  const metadados = ehRegistro(corpo.user_metadata) ? corpo.user_metadata : {};
  return { id, email: texto(corpo.email), nomeCompleto: texto(metadados.nome_completo) };
}

// Chama uma função SQL como service_role. Erros do domínio (PTxxx, docs/API.md) viram AppError
// com o status do errcode, o código em `code` e a frase do hint em `message`; outros erros viram
// erro interno (o detalhe técnico não vai para o app nem para o log).
export async function chamarRpc(
  config: ConfigSupabase,
  nome: string,
  parametros: Record<string, unknown>,
): Promise<unknown> {
  const buscar = config.fetch ?? fetch;
  const resposta = await buscar(`${config.url}/rest/v1/rpc/${nome}`, {
    method: 'POST',
    headers: {
      apikey: config.chaveServico,
      Authorization: `Bearer ${config.chaveServico}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(parametros),
  });
  const corpo = await lerJson(resposta);
  if (resposta.ok) {
    return corpo;
  }
  const codigoPg = ehRegistro(corpo) ? texto(corpo.code) : null;
  const dominio = codigoPg ? /^PT(\d{3})$/.exec(codigoPg) : null;
  if (dominio && ehRegistro(corpo)) {
    throw new AppError(
      Number(dominio[1]),
      texto(corpo.message) ?? 'ERRO_INTERNO',
      texto(corpo.hint) ?? 'Erro inesperado. Tente novamente em instantes.',
    );
  }
  throw new Error(`RPC ${nome} falhou: HTTP ${resposta.status} (${codigoPg ?? 'sem código'})`);
}
