import { cabecalhosCors, origensPermitidas } from './cors.ts';
import { AppError, CODIGO_ERRO_INTERNO, corpoErro, MENSAGEM_ERRO_INTERNO } from './erros.ts';

export type Handler = (req: Request) => Response | Promise<Response>;

function comCabecalhos(resposta: Response, extras: Record<string, string>): Response {
  const cabecalhos = new Headers(resposta.headers);
  for (const [nome, valor] of Object.entries(extras)) {
    cabecalhos.set(nome, valor);
  }
  return new Response(resposta.body, {
    status: resposta.status,
    statusText: resposta.statusText,
    headers: cabecalhos,
  });
}

function respostaDeErro(erro: unknown): Response {
  if (erro instanceof AppError) {
    return Response.json(corpoErro(erro), { status: erro.status });
  }
  // Detalhe só no log do Supabase; o cliente recebe mensagem genérica (docs/SECURITY.md).
  // Loga só nome, mensagem e stack: o erro não deve carregar dados pessoais nem tokens.
  if (erro instanceof Error) {
    console.error(`[${erro.name}] ${erro.message}\n${erro.stack ?? ''}`);
  } else {
    console.error('Erro não tratado sem instância de Error');
  }
  const interno = new AppError(500, CODIGO_ERRO_INTERNO, MENSAGEM_ERRO_INTERNO);
  return Response.json(corpoErro(interno), { status: 500 });
}

// Envolve o handler de toda Edge Function: responde o preflight de CORS e converte qualquer
// erro no formato { error: { code, message, details } }.
export function comTratamentoDeErros(
  handler: Handler,
  origens: string[] = origensPermitidas(),
): (req: Request) => Promise<Response> {
  return async (req: Request): Promise<Response> => {
    const cors = cabecalhosCors(req.headers.get('origin'), origens);
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }
    let resposta: Response;
    try {
      resposta = await handler(req);
    } catch (erro) {
      resposta = respostaDeErro(erro);
    }
    return comCabecalhos(resposta, cors);
  };
}
