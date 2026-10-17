// Pix da reserva recém-criada, só em memória e indexado pelo id_reserva. O código Pix não é salvo
// no banco nem no aparelho: fechar o app perde o QR, e a tela de pagamento mostra só o status
// (a recuperação da cobrança fica para depois da AP2). A imagem base64 não vai por parâmetro de
// rota, que é texto na URL.
import type { ReservaCriada } from '@/services/reservas';

const reservas = new Map<string, ReservaCriada>();

export function guardarPix(reserva: ReservaCriada): void {
  reservas.set(reserva.idReserva, reserva);
}

export function obterPix(idReserva: string): ReservaCriada | null {
  return reservas.get(idReserva) ?? null;
}

// Depois da confirmação o QR não serve mais
export function descartarPix(idReserva: string): void {
  reservas.delete(idReserva);
}

export function limparPix(): void {
  reservas.clear();
}
