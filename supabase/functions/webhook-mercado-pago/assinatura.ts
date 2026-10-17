// Validação da assinatura das notificações do Mercado Pago (docs: checkout-api-orders/notifications).
// x-signature: "ts=<segundos>,v1=<hmac hex>". Manifest:
//   id:<data.id da URL>;request-id:<x-request-id>;ts:<ts>;
// Segmento cujo valor está ausente sai do manifest. HMAC-SHA256 com a assinatura secreta, em hex.
// O data.id vale em duas variantes (Fase 13.2): em minúsculas, como manda a documentação, e como
// veio na URL. As notificações reais de order (ids "ORDTST…") falharam com o id em minúsculas;
// o simulador do painel, com id numérico, não mostra a diferença.
// Sem janela de tempo no ts (Fase 13.1): o simulador do painel foi recusado por ela, e o replay
// não tem efeito novo, porque a decisão vem do GET /v1/orders/{id} e a confirmar_pagamento é
// idempotente. O ts continua obrigatório e entra no HMAC exatamente como veio.

export interface PartesAssinatura {
  ts: string;
  v1: string;
}

// 'sem_id': a URL não trouxe data.id e o manifest não tem o segmento id
export type VarianteId = 'minusculas' | 'original' | 'sem_id';

export type ResultadoAssinatura =
  | { valida: true; variante: VarianteId }
  | {
    valida: false;
    motivo: 'segredo_ausente' | 'cabecalho_ausente' | 'hmac_invalido';
  };

function lerPartes(cabecalho: string | null): Map<string, string> {
  const partes = new Map<string, string>();
  for (const trecho of (cabecalho ?? '').split(',')) {
    const [chave, ...resto] = trecho.split('=');
    if (chave && resto.length > 0) {
      partes.set(chave.trim(), resto.join('=').trim());
    }
  }
  return partes;
}

export function lerAssinatura(cabecalho: string | null): PartesAssinatura | null {
  const partes = lerPartes(cabecalho);
  const ts = partes.get('ts');
  const v1 = partes.get('v1');
  return ts && v1 ? { ts, v1 } : null;
}

// Dados para entender o formato real do ts do Mercado Pago, sem nada que ajude a forjar uma
// assinatura: nunca o v1, o segredo, o manifest ou o HMAC calculado.
export function diagnosticarAssinatura(entrada: {
  xSignature: string | null;
  xRequestId: string | null;
  dataId: string | null;
  agoraMs: number;
}): Record<string, number | boolean> {
  const ts = lerPartes(entrada.xSignature).get('ts') ?? '';
  const diagnostico: Record<string, number | boolean> = {
    ts_digitos: ts.replace(/\D/g, '').length,
    id_na_url: Boolean(entrada.dataId),
    tem_request_id: Boolean(entrada.xRequestId),
  };
  if (/^\d+$/.test(ts)) {
    // Até 10 dígitos é segundos (10 dígitos valem até 2286); mais que isso, milissegundos
    const tsMs = ts.length <= 10 ? Number(ts) * 1000 : Number(ts);
    if (Number.isFinite(tsMs)) {
      diagnostico.idade_s = Math.round((entrada.agoraMs - tsMs) / 1000);
    }
  }
  return diagnostico;
}

// Formas do data.id que entram no manifest. Id sem letras maiúsculas (ex.: numérico) tem uma
// variante só, para não calcular o mesmo HMAC duas vezes.
export function variantesDoId(dataId: string | null): [VarianteId, string | null][] {
  if (!dataId) {
    return [['sem_id', null]];
  }
  const minusculas = dataId.toLowerCase();
  return minusculas === dataId
    ? [['minusculas', dataId]]
    : [['minusculas', minusculas], ['original', dataId]];
}

// O id entra como recebido: quem chama escolhe a variante (variantesDoId)
export function montarManifest(
  dataId: string | null,
  requestId: string | null,
  ts: string,
): string {
  let manifest = '';
  if (dataId) {
    manifest += `id:${dataId};`;
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
}): Promise<ResultadoAssinatura> {
  if (!entrada.segredo) {
    return { valida: false, motivo: 'segredo_ausente' };
  }
  const partes = lerAssinatura(entrada.xSignature);
  if (!partes) {
    return { valida: false, motivo: 'cabecalho_ausente' };
  }
  const recebido = partes.v1.toLowerCase();
  // Compara todas as variantes, sem parar na primeira, e todas em tempo constante
  const conferidas: [VarianteId, boolean][] = [];
  for (const [variante, id] of variantesDoId(entrada.dataId)) {
    const esperado = await hmacHex(
      entrada.segredo,
      montarManifest(id, entrada.xRequestId, partes.ts),
    );
    conferidas.push([variante, iguaisEmTempoConstante(esperado, recebido)]);
  }
  const bateu = conferidas.find(([, igual]) => igual);
  return bateu ? { valida: true, variante: bateu[0] } : { valida: false, motivo: 'hmac_invalido' };
}
