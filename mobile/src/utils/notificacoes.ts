// Exibição das notificações (T29): selo do sininho, rótulos, ícones, "há 5 min" e para onde cada
// aviso leva. Só exibição: quem decide quando avisar é o backend (gatilhos).
import type { NomeIcone } from '@/components/icones';

import { chaveDiaBrasilia, formatarDataHoraCurta, formatarHora } from './data-hora';

export type TipoNotificacao =
  'NOVA_RESERVA' | 'RESERVA_CONFIRMADA' | 'CARONA_CANCELADA' | 'RESERVA_CANCELADA' | 'AVALIACAO';

// Selo do sininho: nada com 0, o número até 9 e "9+" acima
export function textoSeloNaoLidas(quantidade: number): string | null {
  if (quantidade <= 0) {
    return null;
  }
  return quantidade > 9 ? '9+' : String(quantidade);
}

// "Notificações", "Notificações, 1 não lida", "Notificações, 12 não lidas"
export function rotuloSininho(quantidade: number): string {
  if (quantidade <= 0) {
    return 'Notificações';
  }
  return quantidade === 1 ? 'Notificações, 1 não lida' : `Notificações, ${quantidade} não lidas`;
}

const ICONES: Record<TipoNotificacao, NomeIcone> = {
  NOVA_RESERVA: 'person-add-outline',
  RESERVA_CONFIRMADA: 'checkmark-circle-outline',
  CARONA_CANCELADA: 'close-circle-outline',
  RESERVA_CANCELADA: 'remove-circle-outline',
  AVALIACAO: 'star-outline',
};

export function iconeNotificacao(tipo: TipoNotificacao): NomeIcone {
  return ICONES[tipo];
}

const MINUTO_MS = 60 * 1000;
const DIA_MS = 24 * 60 * MINUTO_MS;

// "agora", "há 5 min", "hoje 14:30", "ontem 19:00" ou "sáb 22/11 · 19:00" (dia de Brasília)
export function quandoNotificacao(criadoEm: string, agora: Date = new Date()): string {
  const passados = agora.getTime() - new Date(criadoEm).getTime();
  if (passados < MINUTO_MS) {
    return 'agora';
  }
  if (passados < 60 * MINUTO_MS) {
    return `há ${Math.floor(passados / MINUTO_MS)} min`;
  }
  const dia = chaveDiaBrasilia(criadoEm);
  if (dia === chaveDiaBrasilia(agora)) {
    return `hoje ${formatarHora(criadoEm)}`;
  }
  if (dia === chaveDiaBrasilia(new Date(agora.getTime() - DIA_MS))) {
    return `ontem ${formatarHora(criadoEm)}`;
  }
  return formatarDataHoraCurta(criadoEm);
}

export type DestinoNotificacao =
  | { pathname: '/reservas/[id]'; params: { id: string } }
  | { pathname: '/caronas/[id]'; params: { id: string } }
  | '/perfil';

// O passageiro vai para a reserva dele; o motorista, para a carona; a avaliação, para o Perfil
// (onde está a própria média). Sem o id (carona ou reserva apagada), não navega.
export function destinoNotificacao(notificacao: {
  tipo: TipoNotificacao;
  id_carona: string | null;
  id_reserva: string | null;
}): DestinoNotificacao | null {
  switch (notificacao.tipo) {
    case 'RESERVA_CONFIRMADA':
    case 'CARONA_CANCELADA':
      return notificacao.id_reserva
        ? { pathname: '/reservas/[id]', params: { id: notificacao.id_reserva } }
        : null;
    case 'NOVA_RESERVA':
    case 'RESERVA_CANCELADA':
      return notificacao.id_carona
        ? { pathname: '/caronas/[id]', params: { id: notificacao.id_carona } }
        : null;
    case 'AVALIACAO':
      return '/perfil';
  }
}
