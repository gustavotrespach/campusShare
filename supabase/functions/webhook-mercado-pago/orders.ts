// Consulta da order na API do Mercado Pago (GET /v1/orders/{id}): a confirmação usa o que a API
// diz, nunca só o corpo da notificação (docs/SECURITY.md). Erros não levam o token nem o corpo.

const URL_ORDERS = 'https://api.mercadopago.com/v1/orders';
const TIMEOUT_PADRAO_MS = 10_000;

export interface ConfigOrders {
  accessToken: string;
  timeoutMs?: number;
  urlOrders?: string;
  fetch?: typeof fetch;
}

export interface OrderConsultada {
  id: string;
  status: string;
  statusDetail: string;
  externalReference: string | null;
  // Valor pago em reais, como a API devolve ("5.00")
  valorPago: string | null;
}

// 'invalida': a API recusou o id com HTTP 400 (ex.: "123456" do simulador do painel). Fica
// separada de 'nao_encontrada' só para o log: as duas viram 200, porque reenviar não muda nada.
export type ResultadoConsulta =
  | { tipo: 'encontrada'; order: OrderConsultada }
  | { tipo: 'nao_encontrada' }
  | { tipo: 'invalida' };

type Registro = Record<string, unknown>;

function ehRegistro(valor: unknown): valor is Registro {
  return typeof valor === 'object' && valor !== null;
}

function texto(valor: unknown): string | null {
  return typeof valor === 'string' && valor.length > 0 ? valor : null;
}

// Tabela de status da documentação: só processed/accredited é pagamento creditado
export function estaPaga(order: OrderConsultada): boolean {
  return order.status === 'processed' && order.statusDetail === 'accredited';
}

// Lança Error em falha de rede, timeout ou resposta diferente de 200/400/404 (401, 403, 5xx): o
// webhook responde 500 e o Mercado Pago tenta de novo mais tarde.
export async function consultarOrder(
  config: ConfigOrders,
  idOrder: string,
): Promise<ResultadoConsulta> {
  if (!config.accessToken) {
    throw new Error('MERCADO_PAGO_ACCESS_TOKEN ausente');
  }
  const buscar = config.fetch ?? fetch;
  let resposta: Response;
  try {
    resposta = await buscar(
      `${config.urlOrders ?? URL_ORDERS}/${encodeURIComponent(idOrder)}`,
      {
        headers: { Authorization: `Bearer ${config.accessToken}` },
        signal: AbortSignal.timeout(config.timeoutMs ?? TIMEOUT_PADRAO_MS),
      },
    );
  } catch (erro) {
    const motivo = erro instanceof DOMException && erro.name === 'TimeoutError'
      ? 'tempo esgotado'
      : 'falha de rede';
    throw new Error(`Mercado Pago indisponível (${motivo})`);
  }
  if (resposta.status === 404) {
    await resposta.body?.cancel();
    return { tipo: 'nao_encontrada' };
  }
  if (resposta.status === 400) {
    await resposta.body?.cancel();
    return { tipo: 'invalida' };
  }
  if (!resposta.ok) {
    await resposta.body?.cancel();
    throw new Error(`Mercado Pago respondeu HTTP ${resposta.status} à consulta da order`);
  }
  let corpo: unknown;
  try {
    corpo = await resposta.json();
  } catch {
    throw new Error('resposta da order não é JSON');
  }
  const id = ehRegistro(corpo) ? texto(corpo.id) : null;
  if (!ehRegistro(corpo) || !id) {
    throw new Error('resposta da order sem id');
  }
  return {
    tipo: 'encontrada',
    order: {
      id,
      status: texto(corpo.status) ?? '',
      statusDetail: texto(corpo.status_detail) ?? '',
      externalReference: texto(corpo.external_reference),
      valorPago: texto(corpo.total_paid_amount),
    },
  };
}
