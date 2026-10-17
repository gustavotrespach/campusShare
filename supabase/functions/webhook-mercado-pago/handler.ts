// POST /functions/v1/webhook-mercado-pago — notificação de order do Mercado Pago (T23, RN15, ADR-008).
// verify_jwt = false: o Mercado Pago não manda JWT; a autenticidade vem só da assinatura.
// 1) assinatura válida (senão 401, sem tocar no banco);
// 2) GET /v1/orders/{id} na API (a decisão usa a API, não o corpo);
// 3) order paga (processed/accredited) → confirmar_pagamento, idempotente.
// Responde 200 rápido; 500 só quando vale o Mercado Pago tentar de novo (rede, 5xx, banco fora).
import { AppError } from '../_shared/erros.ts';
import { comTratamentoDeErros } from '../_shared/resposta.ts';

import {
  diagnosticarAssinatura,
  type ResultadoAssinatura,
  validarAssinatura,
} from './assinatura.ts';
import { estaPaga, type ResultadoConsulta } from './orders.ts';

export type Log = (evento: string, dados: Record<string, string | number | boolean>) => void;

export interface Dependencias {
  segredo: string;
  agoraMs: () => number;
  consultarOrder: (idOrder: string) => Promise<ResultadoConsulta>;
  confirmarPagamento: (idOrder: string, idPagamento: string, valor: number) => Promise<string>;
  log: Log;
  origensCors?: string[];
}

const FORMATO_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Registro = Record<string, unknown>;

function ehRegistro(valor: unknown): valor is Registro {
  return typeof valor === 'object' && valor !== null;
}

function texto(valor: unknown): string | null {
  return typeof valor === 'string' && valor.length > 0 ? valor : null;
}

function recebido(resultado: string): Response {
  return Response.json({ recebido: true, resultado }, { status: 200 });
}

async function lerCorpo(req: Request): Promise<Registro> {
  try {
    const corpo: unknown = JSON.parse(await req.text());
    return ehRegistro(corpo) ? corpo : {};
  } catch {
    return {};
  }
}

export function criarHandler(deps: Dependencias): (req: Request) => Promise<Response> {
  return comTratamentoDeErros(async (req: Request): Promise<Response> => {
    if (req.method !== 'POST') {
      throw new AppError(405, 'METODO_NAO_PERMITIDO', 'Use POST.');
    }
    const url = new URL(req.url);
    // A documentação assina o data.id que vem na URL
    const dataIdUrl = url.searchParams.get('data.id');

    const cabecalhos = {
      xSignature: req.headers.get('x-signature'),
      xRequestId: req.headers.get('x-request-id'),
      dataId: dataIdUrl,
    };
    const assinatura: ResultadoAssinatura = await validarAssinatura({
      segredo: deps.segredo,
      ...cabecalhos,
    });
    const diagnostico = diagnosticarAssinatura({ ...cabecalhos, agoraMs: deps.agoraMs() });
    if (!assinatura.valida) {
      deps.log('assinatura_recusada', { motivo: assinatura.motivo, ...diagnostico });
      throw new AppError(401, 'ASSINATURA_INVALIDA', 'Assinatura inválida.');
    }
    deps.log('assinatura_aceita', diagnostico);

    const corpo = await lerCorpo(req);
    const dados = ehRegistro(corpo.data) ? corpo.data : {};
    const tipo = url.searchParams.get('type') ?? texto(corpo.type);
    const idOrder = dataIdUrl ?? texto(dados.id);

    if (tipo !== 'order') {
      deps.log('tipo_ignorado', { tipo: tipo ?? 'ausente' });
      return recebido('IGNORADO_TIPO');
    }
    if (!idOrder) {
      deps.log('notificacao_sem_id', {});
      return recebido('IGNORADO_SEM_ID');
    }

    // Erro de rede ou 5xx lança e vira 500: o Mercado Pago reenvia mais tarde
    const consulta = await deps.consultarOrder(idOrder);
    if (consulta.tipo === 'nao_encontrada') {
      deps.log('order_nao_encontrada', { id_order: idOrder });
      return recebido('IGNORADO_ORDER_NAO_ENCONTRADA');
    }
    const { order } = consulta;
    if (!estaPaga(order)) {
      deps.log('order_nao_paga', {
        id_order: order.id,
        status: order.status,
        status_detail: order.statusDetail,
      });
      return recebido('IGNORADO_NAO_PAGA');
    }

    const valor = Number(order.valorPago);
    if (
      !order.externalReference || !FORMATO_UUID.test(order.externalReference) ||
      !Number.isFinite(valor) || valor <= 0
    ) {
      deps.log('order_paga_sem_referencia', { id_order: order.id });
      return recebido('IGNORADO_SEM_REFERENCIA');
    }

    let resultado: string;
    try {
      resultado = await deps.confirmarPagamento(order.id, order.externalReference, valor);
    } catch (erro) {
      // Divergência de dados (PT4xx): repetir a notificação não resolve; 200 evita o loop de
      // retentativas e o log fica para conferência manual. Falha técnica segue como 500.
      if (erro instanceof AppError && erro.status < 500) {
        deps.log('confirmacao_recusada', {
          id_order: order.id,
          id_pagamento: order.externalReference,
          codigo: erro.code,
        });
        return recebido(`RECUSADO_${erro.code}`);
      }
      throw erro;
    }

    deps.log('pagamento_processado', {
      id_order: order.id,
      id_pagamento: order.externalReference,
      resultado,
    });
    return recebido(resultado);
  }, deps.origensCors);
}
