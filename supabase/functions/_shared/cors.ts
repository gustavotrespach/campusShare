// O app nativo não envia Origin e não depende de CORS; o cabeçalho só é liberado para as origens
// web listadas em CORS_ORIGENS_PERMITIDAS (separadas por vírgula), em vez de '*' (docs/SECURITY.md).
const CABECALHOS_PERMITIDOS = 'authorization, x-client-info, apikey, content-type';
const METODOS_PERMITIDOS = 'GET, POST, PUT, PATCH, DELETE, OPTIONS';

export function origensPermitidas(): string[] {
  let valor = '';
  try {
    valor = Deno.env.get('CORS_ORIGENS_PERMITIDAS') ?? '';
  } catch {
    // Sem permissão de env (ex.: `deno test` sem --allow-env): nenhuma origem web liberada.
  }
  return valor.split(',').map((origem) => origem.trim()).filter((origem) => origem.length > 0);
}

export function cabecalhosCors(
  origem: string | null,
  permitidas: string[] = origensPermitidas(),
): Record<string, string> {
  if (origem === null || !permitidas.includes(origem)) {
    return {};
  }
  return {
    'Access-Control-Allow-Origin': origem,
    'Access-Control-Allow-Headers': CABECALHOS_PERMITIDOS,
    'Access-Control-Allow-Methods': METODOS_PERMITIDOS,
    Vary: 'Origin',
  };
}
