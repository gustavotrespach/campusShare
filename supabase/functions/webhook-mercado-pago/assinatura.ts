// Validação da assinatura das notificações do Mercado Pago (docs: checkout-api-orders/notifications).
// x-signature: "ts=<milissegundos>,v1=<hmac hex>". Manifest:
//   id:<data.id da URL, em minúsculas>;request-id:<x-request-id>;ts:<ts>;
// Segmento cujo valor está ausente sai do manifest. HMAC-SHA256 com a assinatura secreta, em hex.

// Notificação com ts fora desta janela é recusada (replay). A documentação sugere comparar o ts
// com o horário de recebimento, sem fixar um valor.
export const TOLERANCIA_TS_MS = 10 * 60 * 1000;

export interface PartesAssinatura {
  ts: string;
  v1: string;
}

export type ResultadoAssinatura =
  | { valida: true }
  | {
    valida: false;
    motivo: 'segredo_ausente' | 'cabecalho_ausente' | 'ts_fora_da_janela' | 'hmac_invalido';
  };

export function lerAssinatura(cabecalho: string | null): PartesAssinatura | null {
  if (!cabecalho) {
    return null;
  }
  const partes = new Map<string, string>();
  for (const trecho of cabecalho.split(',')) {
    const [chave, ...resto] = trecho.split('=');
    if (chave && resto.length > 0) {
      partes.set(chave.trim(), resto.join('=').trim());
    }
  }
  const ts = partes.get('ts');
  const v1 = partes.get('v1');
  return ts && v1 ? { ts, v1 } : null;
}

export function montarManifest(
  dataId: string | null,
  requestId: string | null,
  ts: string,
): string {
  let manifest = '';
  if (dataId) {
    manifest += `id:${dataId.toLowerCase()};`;
  }
  if (requestId) {
    manifest += `request-id:${requestId};`;
  }
  return `${manifest}ts:${ts};`;
}

export async function hmacHex(segredo: string, mensagem: string): Promise<string> {
  const codificador = new TextEncoder();
  const chave = await crypto.subtle.importKey(
    'raw',
    codificador.encode(segredo),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const assinatura = await crypto.subtle.sign('HMAC', chave, codificador.encode(mensagem));
  return Array.from(new Uint8Array(assinatura), (byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

// Comparação em tempo constante: o tempo não depende de onde as strings diferem
export function iguaisEmTempoConstante(a: string, b: string): boolean {
  const bytesA = new TextEncoder().encode(a);
  const bytesB = new TextEncoder().encode(b);
  let diferenca = bytesA.length ^ bytesB.length;
  const tamanho = Math.max(bytesA.length, bytesB.length);
  for (let i = 0; i < tamanho; i++) {
    diferenca |= (bytesA[i] ?? 0) ^ (bytesB[i] ?? 0);
  }
  return diferenca === 0;
}

export async function validarAssinatura(entrada: {
  segredo: string;
  xSignature: string | null;
  xRequestId: string | null;
  dataId: string | null;
  agoraMs: number;
  toleranciaMs?: number;
}): Promise<ResultadoAssinatura> {
  if (!entrada.segredo) {
    return { valida: false, motivo: 'segredo_ausente' };
  }
  const partes = lerAssinatura(entrada.xSignature);
  if (!partes) {
    return { valida: false, motivo: 'cabecalho_ausente' };
  }
  const tsMs = Number(partes.ts);
  if (
    !Number.isFinite(tsMs) ||
    Math.abs(entrada.agoraMs - tsMs) > (entrada.toleranciaMs ?? TOLERANCIA_TS_MS)
  ) {
    return { valida: false, motivo: 'ts_fora_da_janela' };
  }
  const esperado = await hmacHex(
    entrada.segredo,
    montarManifest(entrada.dataId, entrada.xRequestId, partes.ts),
  );
  return iguaisEmTempoConstante(esperado, partes.v1.toLowerCase())
    ? { valida: true }
    : { valida: false, motivo: 'hmac_invalido' };
}
