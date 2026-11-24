// Listas "Minhas caronas" e "Minhas reservas" (T41): nome curto do local, separação entre próximas
// e anteriores e o selo "Já partiu". Só exibição: nada aqui muda status nem chama o backend (a
// carona continua ABERTA no banco depois da partida até existir a conclusão, T30).
import type { StatusCarona, StatusReserva } from './reserva';

// Siglas das 27 UFs: só elas são tiradas do fim do nome (ex.: "Bloco AB" fica como está)
const UFS = new Set(
  'AC AL AM AP BA CE DF ES GO MA MG MS MT PA PB PE PI PR RJ RN RO RR RS SC SE SP TO'.split(' '),
);

// " - RS", " – RS", " — RS" ou ", RS" no fim
const SUFIXO_UF = /\s*(?:[-–—]|,)\s*([A-Z]{2})\s*$/;

// "ULBRA Torres - RS" → "ULBRA Torres"; "Centro, Passo de Torres - SC" → "Centro, Passo de Torres"
export function nomeCurtoLocal(local: string): string {
  const limpo = local.replace(/\s+/g, ' ').trim();
  const sufixo = SUFIXO_UF.exec(limpo);
  if (!sufixo || !UFS.has(sufixo[1] ?? '')) {
    return limpo;
  }
  const semUf = limpo.slice(0, sufixo.index).trim();
  return semUf || limpo;
}

// Na hora exata da partida a carona já conta como partida
export function partidaPassada(partida: string, agora: Date = new Date()): boolean {
  return new Date(partida).getTime() <= agora.getTime();
}

const CARONA_ATIVA: readonly StatusCarona[] = ['ABERTA', 'LOTADA'];

export type SituacaoCarona = StatusCarona | 'JA_PARTIU';

// ABERTA ou LOTADA com a partida no passado aparece como "Já partiu"; o resto, como está no banco
export function situacaoExibidaCarona(
  carona: { status: StatusCarona; data_hora_partida: string },
  agora: Date = new Date(),
): SituacaoCarona {
  return CARONA_ATIVA.includes(carona.status) && partidaPassada(carona.data_hora_partida, agora)
    ? 'JA_PARTIU'
    : carona.status;
}

export function caronaEhProxima(
  carona: { status: StatusCarona; data_hora_partida: string },
  agora: Date = new Date(),
): boolean {
  return CARONA_ATIVA.includes(carona.status) && !partidaPassada(carona.data_hora_partida, agora);
}

export function reservaEhProxima(
  reserva: {
    status_reserva: StatusReserva;
    status_carona: StatusCarona;
    data_hora_partida: string;
  },
  agora: Date = new Date(),
): boolean {
  return (
    (reserva.status_reserva === 'PENDENTE' || reserva.status_reserva === 'CONFIRMADA') &&
    caronaEhProxima(
      { status: reserva.status_carona, data_hora_partida: reserva.data_hora_partida },
      agora,
    )
  );
}

// Próximas da mais perto para a mais distante; anteriores da mais recente para a mais antiga
export function separarPorPartida<T extends { data_hora_partida: string }>(
  itens: readonly T[],
  ehProxima: (item: T) => boolean,
): { proximas: T[]; anteriores: T[] } {
  const instante = (item: T) => new Date(item.data_hora_partida).getTime();
  return {
    proximas: itens.filter(ehProxima).sort((a, b) => instante(a) - instante(b)),
    anteriores: itens.filter((item) => !ehProxima(item)).sort((a, b) => instante(b) - instante(a)),
  };
}

export function textoBotaoAnteriores(quantidade: number, expandido: boolean): string {
  return expandido ? 'Ocultar anteriores' : `Ver anteriores (${quantidade})`;
}
