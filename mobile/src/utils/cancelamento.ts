// Cancelamentos no app (T28): quando mostrar os botões, os textos de confirmação e de resultado e a
// ordem de "Minhas caronas". Nenhuma regra de negócio: quem decide se o cancelamento vale (inclusive
// o prazo de 2 h da RN20 para reserva paga) é o backend, e a tela só mostra o hint do erro.
import { caronaEhProxima, separarPorPartida } from './listas';
import type { StatusCarona, StatusReserva } from './reserva';

const CARONA_ATIVA: readonly StatusCarona[] = ['ABERTA', 'LOTADA'];

function partidaFutura(partida: string, agora: Date): boolean {
  return new Date(partida).getTime() > agora.getTime();
}

// Botão "Cancelar reserva": reserva ainda ativa e carona que não partiu. O limite de 2 h para
// reserva paga não é calculado aqui: o backend recusa com PRAZO_CANCELAMENTO_ENCERRADO.
export function podeCancelarReserva(
  reserva: { statusReserva: StatusReserva; statusCarona: StatusCarona; partida: string },
  agora: Date = new Date(),
): boolean {
  return (
    (reserva.statusReserva === 'PENDENTE' || reserva.statusReserva === 'CONFIRMADA') &&
    CARONA_ATIVA.includes(reserva.statusCarona) &&
    partidaFutura(reserva.partida, agora)
  );
}

// Botão "Cancelar carona": só o motorista, com a carona ativa e antes da partida
export function podeCancelarCarona(
  carona: { sou_motorista: boolean; status: StatusCarona; data_hora_partida: string },
  agora: Date = new Date(),
): boolean {
  return (
    carona.sou_motorista &&
    CARONA_ATIVA.includes(carona.status) &&
    partidaFutura(carona.data_hora_partida, agora)
  );
}

export function confirmacaoCancelarReserva(status: StatusReserva): string {
  return status === 'CONFIRMADA'
    ? 'O valor pago fica registrado para reembolso. Reservas pagas só podem ser canceladas até 2 horas antes da partida.'
    : 'Sua vaga será liberada. Se você já pagou o Pix, o valor fica registrado para reembolso.';
}

export const CONFIRMACAO_CANCELAR_CARONA =
  'Todas as reservas desta carona serão canceladas. Quem já pagou fica com o reembolso registrado.';

// Resultado na tela e no leitor de tela
export function mensagemReservaCancelada(statusAnterior: StatusReserva): string {
  return statusAnterior === 'CONFIRMADA'
    ? 'Reserva cancelada. O valor pago fica registrado para reembolso.'
    : 'Reserva cancelada. Sua vaga foi liberada.';
}

export function mensagemCaronaCancelada(reservasCanceladas: number): string {
  if (reservasCanceladas === 0) {
    return 'Carona cancelada. Ela não tinha reservas.';
  }
  return reservasCanceladas === 1
    ? 'Carona cancelada. 1 reserva cancelada.'
    : `Carona cancelada. ${reservasCanceladas} reservas canceladas.`;
}

// Ativa e futura: ainda pode receber passageiros ou ser cancelada (mesma regra das listas, T41)
export function caronaEmAndamento(
  carona: { status: StatusCarona; data_hora_partida: string },
  agora: Date = new Date(),
): boolean {
  return caronaEhProxima(carona, agora);
}

// "Minhas caronas": primeiro as em andamento (a mais próxima antes), depois as passadas ou
// encerradas (a mais recente antes)
export function ordenarMinhasCaronas<T extends { status: StatusCarona; data_hora_partida: string }>(
  caronas: readonly T[],
  agora: Date = new Date(),
): T[] {
  const { proximas, anteriores } = separarPorPartida(caronas, (carona) =>
    caronaEhProxima(carona, agora),
  );
  return [...proximas, ...anteriores];
}
