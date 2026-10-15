// Lê o retorno do Supabase Auth no link de confirmação de e-mail:
//   sucesso: <redirect>#access_token=...&refresh_token=...&type=signup
//   erro:    <redirect>#error=access_denied&error_code=otp_expired&error_description=...
// Parse manual (sem URLSearchParams) porque o do React Native não lê todos os formatos.

export type LinkConfirmacao =
  | { tipo: 'sessao'; accessToken: string; refreshToken: string }
  | { tipo: 'erro'; codigo: string; descricao: string };

function decodificar(valor: string): string {
  try {
    return decodeURIComponent(valor.replace(/\+/g, ' '));
  } catch {
    return valor;
  }
}

function lerParametros(trecho: string, destino: Map<string, string>): void {
  for (const par of trecho.split('&')) {
    const igual = par.indexOf('=');
    if (igual > 0) {
      destino.set(decodificar(par.slice(0, igual)), decodificar(par.slice(igual + 1)));
    }
  }
}

export function lerLinkDeConfirmacao(url: string): LinkConfirmacao | null {
  const inicioFragmento = url.indexOf('#');
  const semFragmento = inicioFragmento >= 0 ? url.slice(0, inicioFragmento) : url;
  const fragmento = inicioFragmento >= 0 ? url.slice(inicioFragmento + 1) : '';
  const inicioQuery = semFragmento.indexOf('?');
  const query = inicioQuery >= 0 ? semFragmento.slice(inicioQuery + 1) : '';

  // O fragmento vem por último para prevalecer sobre a query (é onde o Auth coloca a sessão).
  const parametros = new Map<string, string>();
  lerParametros(query, parametros);
  lerParametros(fragmento, parametros);

  const codigoErro = parametros.get('error_code') ?? parametros.get('error');
  if (codigoErro) {
    return {
      tipo: 'erro',
      codigo: codigoErro,
      descricao: parametros.get('error_description') ?? '',
    };
  }
  const accessToken = parametros.get('access_token');
  const refreshToken = parametros.get('refresh_token');
  if (accessToken && refreshToken) {
    return { tipo: 'sessao', accessToken, refreshToken };
  }
  return null;
}
