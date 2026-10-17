import type { Database } from '@/types/database';
import { reaisParaCentavos } from '@/utils/dinheiro';
import { mensagemDoErroDeReserva, type StatusPagamento, type StatusReserva } from '@/utils/reserva';

import { AppError, CODIGO_ERRO_INESPERADO, normalizarErro } from './erros';
import { invocarFuncao } from './funcoes';
import { obterSupabase } from './supabase';

type LinhaMinhasReservas = Database['public']['Functions']['minhas_reservas']['Returns'][number];

export interface Pix {
  qrCode: string;
  qrCodeBase64: string;
  ticketUrl: string | null;
}

export interface ReservaCriada {
  idReserva: string;
  idPagamento: string;
  valorCentavos: number;
  status: StatusReserva;
  pix: Pix;
}

// Dinheiro no app em centavos: a conversão do decimal do banco fica só nos services
export type MinhaReserva = Omit<LinhaMinhasReservas, 'valor'> & { valorCentavos: number };

export interface SituacaoReserva {
  statusReserva: StatusReserva;
  statusPagamento: StatusPagamento | null;
  valorCentavos: number;
}

const RESPOSTA_INESPERADA = new AppError(
  500,
  CODIGO_ERRO_INESPERADO,
  'Algo deu errado. Tente novamente em instantes.',
);

const RESERVA_NAO_ENCONTRADA = new AppError(
  404,
  'RESERVA_NAO_ENCONTRADA',
  'Reserva não encontrada.',
);

type Registro = Record<string, unknown>;

function ehRegistro(valor: unknown): valor is Registro {
  return typeof valor === 'object' && valor !== null;
}

function texto(valor: unknown): string | null {
  return typeof valor === 'string' && valor.length > 0 ? valor : null;
}

// Resposta 201 da reservar-vaga: { data: { id_reserva, id_pagamento, valor_centavos, status,
// pix: { qr_code, qr_code_base64, ticket_url } } }. Conferida campo a campo antes de virar tipo.
function lerReservaCriada(corpo: unknown): ReservaCriada {
  const dados = ehRegistro(corpo) && ehRegistro(corpo.data) ? corpo.data : null;
  const pix = dados && ehRegistro(dados.pix) ? dados.pix : null;
  const idReserva = dados ? texto(dados.id_reserva) : null;
  const idPagamento = dados ? texto(dados.id_pagamento) : null;
  const qrCode = pix ? texto(pix.qr_code) : null;
  const qrCodeBase64 = pix ? texto(pix.qr_code_base64) : null;
  const valorCentavos = dados?.valor_centavos;
  if (
    !dados ||
    !pix ||
    !idReserva ||
    !idPagamento ||
    !qrCode ||
    !qrCodeBase64 ||
    typeof valorCentavos !== 'number' ||
    !Number.isInteger(valorCentavos) ||
    valorCentavos <= 0
  ) {
    throw RESPOSTA_INESPERADA;
  }
  return {
    idReserva,
    idPagamento,
    // Já vem em centavos (inteiro) da Edge Function
    valorCentavos,
    status: dados.status === 'CONFIRMADA' ? 'CONFIRMADA' : 'PENDENTE',
    pix: { qrCode, qrCodeBase64, ticketUrl: texto(pix.ticket_url) },
  };
}

function erroDeReserva(falha: unknown): AppError {
  const erro = normalizarErro(falha);
  const mensagem = mensagemDoErroDeReserva(erro.code);
  return mensagem ? new AppError(erro.status, erro.code, mensagem) : erro;
}

// O passageiro é o usuário do JWT (a Edge Function valida); o app só manda a carona
export async function reservarVaga(idCarona: string): Promise<ReservaCriada> {
  try {
    const corpo = await invocarFuncao<unknown>('reservar-vaga', {
      method: 'POST',
      body: { id_carona: idCarona },
    });
    return lerReservaCriada(corpo);
  } catch (falha) {
    throw erroDeReserva(falha);
  }
}

export async function listarMinhasReservas(): Promise<MinhaReserva[]> {
  try {
    const { data, error } = await obterSupabase().rpc('minhas_reservas');
    if (error) {
      throw error;
    }
    return data.map(({ valor, ...linha }) => ({
      ...linha,
      valorCentavos: reaisParaCentavos(valor),
    }));
  } catch (falha) {
    throw normalizarErro(falha);
  }
}

// Leitura direta pela RLS: o passageiro lê a própria reserva e o pagamento dela
export async function consultarStatusReserva(idReserva: string): Promise<SituacaoReserva> {
  try {
    const { data, error } = await obterSupabase()
      .from('reserva')
      .select('status, valor_individual, pagamento(status, valor)')
      .eq('id_reserva', idReserva)
      .maybeSingle();
    if (error) {
      throw error;
    }
    if (!data) {
      throw RESERVA_NAO_ENCONTRADA;
    }
    // pagamento.id_reserva é UNIQUE: o PostgREST devolve objeto; a lista cobre versões antigas
    const pagamento = Array.isArray(data.pagamento) ? data.pagamento[0] : data.pagamento;
    return {
      statusReserva: data.status,
      statusPagamento: pagamento?.status ?? null,
      valorCentavos: reaisParaCentavos(pagamento?.valor ?? data.valor_individual),
    };
  } catch (falha) {
    throw normalizarErro(falha);
  }
}
