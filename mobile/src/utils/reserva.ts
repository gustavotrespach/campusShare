// Regras de interface da T25: quando mostrar o botão Reservar, como chamar cada status e a
// mensagem de cada erro da reserva. Nenhuma regra de negócio: o backend decide se a reserva vale.
import type { Database } from '@/types/database';

type Enums = Database['public']['Enums'];
export type StatusReserva = Enums['status_reserva'];
export type StatusPagamento = Enums['status_pagamento'];
export type StatusCarona = Enums['status_carona'];

// O botão é só conveniência: a reservar_vaga recusa os mesmos casos (RN14, RN17)
export function podeReservar(carona: {
  sou_motorista: boolean;
  status: StatusCarona;
  vagas_disponiveis: number;
}): boolean {
  return !carona.sou_motorista && carona.status === 'ABERTA' && carona.vagas_disponiveis > 0;
}

const ROTULO_STATUS_RESERVA: Record<StatusReserva, string> = {
  PENDENTE: 'Aguardando pagamento',
  CONFIRMADA: 'Confirmada',
  CANCELADA: 'Cancelada',
  EXPIRADA: 'Expirada',
};

export function rotuloStatusReserva(status: StatusReserva): string {
  return ROTULO_STATUS_RESERVA[status];
}

// Só PENDENTE ainda pode mudar sozinha (pelo webhook); os outros status são finais para a tela
export function reservaEmAberto(status: StatusReserva): boolean {
  return status === 'PENDENTE';
}

// Mensagens dos erros de reserva (docs/API.md → reservar-vaga). PAGAMENTO_INDISPONIVEL: a
// reservar-vaga já desfez a reserva e devolveu a vaga, então tentar de novo é seguro.
const MENSAGEM_POR_CODIGO: Record<string, string> = {
  RESERVA_DUPLICADA: 'Você já tem uma reserva nesta carona.',
  CARONA_LOTADA: 'Esta carona não tem mais vagas.',
  CARONA_INDISPONIVEL: 'Esta carona não está mais disponível para reserva.',
  CARONA_SOMENTE_MULHERES: 'Esta carona é exclusiva para mulheres.',
  RESERVA_PROPRIA_CARONA: 'Você não pode reservar uma vaga na sua própria carona.',
  PAGAMENTO_INDISPONIVEL: 'Não foi possível gerar o Pix agora. Tente de novo.',
};

export function mensagemDoErroDeReserva(codigo: string): string | null {
  return MENSAGEM_POR_CODIGO[codigo] ?? null;
}

// Erros que pedem um atalho na tela além da mensagem
export function atalhoDoErroDeReserva(codigo: string): 'minhas_reservas' | null {
  return codigo === 'RESERVA_DUPLICADA' ? 'minhas_reservas' : null;
}
