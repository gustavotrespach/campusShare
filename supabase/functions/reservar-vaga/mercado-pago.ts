// Cobrança Pix pela API de Orders do Mercado Pago (Checkout Transparente), com fetch direto.
// Docs: /developers/pt/docs/checkout-api-orders/payment-integration/pix e
// /developers/pt/docs/checkout-api-orders/integration-test/pix.
// Erros daqui nunca levam o token nem o corpo da resposta: só status HTTP e ids.

const URL_ORDERS = 'https://api.mercadopago.com/v1/orders';
const TIMEOUT_PADRAO_MS = 10_000;

// Modo de teste (sandbox): first_name "APRO" faz o Pix ser aprovado automaticamente depois de
// criado; o e-mail é o do exemplo da documentação de testes.
const PAGADOR_DE_TESTE = { email: 'test@testuser.com', first_name: 'APRO' };

export interface ConfigMercadoPago {
  accessToken: string;
  modoTeste: boolean;
  timeoutMs?: number;
  urlOrders?: string;
  fetch?: typeof fetch;
}

export interface PedidoPix {
  idPagamento: string;
  valorCentavos: number;
  email: string | null;
  primeiroNome: string | null;
}

export interface CobrancaPix {
  idOrder: string;
  status: string;
  qrCode: string;
  qrCodeBase64: string | null;
  ticketUrl: string | null;
}

// Falha esperada da cobrança: a Edge Function desfaz a reserva e responde 502.
export class FalhaCobranca extends Error {
  constructor(motivo: string) {
    super(motivo);
    this.name = 'FalhaCobranca';
  }
}

type Registro = Record<string, unknown>;

function ehRegistro(valor: unknown): valor is Registro {
  return typeof valor === 'object' && valor !== null;
}

function texto(valor: unknown): string | null {
  return typeof valor === 'string' && valor.length > 0 ? valor : null;
}

// A API recebe valores como string com 2 casas ("6.00"); a conta é feita em centavos inteiros.
export function valorEmTexto(centavos: number): string {
  if (!Number.isInteger(centavos) || centavos <= 0) {
    throw new FalhaCobranca('valor da cobrança inválido');
  }
  return `${Math.floor(centavos / 100)}.${String(centavos % 100).padStart(2, '0')}`;
}

export function montarOrder(pedido: PedidoPix, modoTeste: boolean): Registro {
  const valor = valorEmTexto(pedido.valorCentavos);
  let pagador: Registro;
  if (modoTeste) {
    pagador = PAGADOR_DE_TESTE;
  } else {
    if (!pedido.email) {
      throw new FalhaCobranca('usuário sem e-mail para a cobrança');
    }
    pagador = pedido.primeiroNome
      ? { email: pedido.email, first_name: pedido.primeiroNome }
      : { email: pedido.email };
  }
  return {
    type: 'online',
    processing_mode: 'automatic',
    // O id do pagamento liga a order ao banco também no webhook (T23)
    external_reference: pedido.idPagamento,
    total_amount: valor,
    payer: pagador,
    transactions: {
      payments: [{ amount: valor, payment_method: { id: 'pix', type: 'bank_transfer' } }],
    },
  };
}

function lerCobranca(corpo: unknown): CobrancaPix {
  if (!ehRegistro(corpo)) {
    throw new FalhaCobranca('resposta do Mercado Pago não é JSON');
  }
  const idOrder = texto(corpo.id);
  const transacoes = ehRegistro(corpo.transactions) ? corpo.transactions : {};
  const pagamentos = Array.isArray(transacoes.payments) ? transacoes.payments : [];
  const pagamento: unknown = pagamentos[0];
  const metodo = ehRegistro(pagamento) && ehRegistro(pagamento.payment_method)
    ? pagamento.payment_method
    : {};
  const qrCode = texto(metodo.qr_code);
  if (!idOrder || !qrCode) {
    throw new FalhaCobranca('resposta do Mercado Pago sem id ou sem QR Code');
  }
  return {
    idOrder,
    status: texto(corpo.status) ?? 'desconhecido',
    qrCode,
    // No sandbox o qr_code_base64 pode vir vazio (exemplo da documentação de testes)
    qrCodeBase64: texto(metodo.qr_code_base64),
    ticketUrl: texto(metodo.ticket_url),
  };
}

export async function criarCobrancaPix(
  config: ConfigMercadoPago,
  pedido: PedidoPix,
): Promise<CobrancaPix> {
  if (!config.accessToken) {
    throw new FalhaCobranca('MERCADO_PAGO_ACCESS_TOKEN ausente');
  }
  const corpoOrder = montarOrder(pedido, config.modoTeste);
  const buscar = config.fetch ?? fetch;
  let resposta: Response;
  try {
    resposta = await buscar(config.urlOrders ?? URL_ORDERS, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.accessToken}`,
        'Content-Type': 'application/json',
        // Obrigatório na API de Orders; o id do pagamento torna a criação idempotente
        'X-Idempotency-Key': pedido.idPagamento,
      },
      body: JSON.stringify(corpoOrder),
      signal: AbortSignal.timeout(config.timeoutMs ?? TIMEOUT_PADRAO_MS),
    });
  } catch (erro) {
    const motivo = erro instanceof DOMException && erro.name === 'TimeoutError'
      ? 'tempo esgotado'
      : 'falha de rede';
    throw new FalhaCobranca(`Mercado Pago indisponível (${motivo})`);
  }
  if (!resposta.ok) {
    // Corpo descartado: pode ecoar dados do pedido
    await resposta.body?.cancel();
    throw new FalhaCobranca(`Mercado Pago respondeu HTTP ${resposta.status}`);
  }
  let corpo: unknown;
  try {
    corpo = await resposta.json();
  } catch {
    throw new FalhaCobranca('resposta do Mercado Pago não é JSON');
  }
  return lerCobranca(corpo);
}
