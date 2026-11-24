// Aparência de cada selo de status (DESIGN.md §3.4). A cor nunca é a única pista: todo selo tem
// ícone e texto. Os rótulos de reserva vêm de rotuloStatusReserva, para não duplicar textos.
// Os status de carona (T28, Minhas caronas) dividem o CANCELADA com a reserva: mesmo selo.
import type { NomeIcone } from '@/components/icones';
import { tema } from '@/tema';

import { rotuloStatusReserva, type StatusCarona, type StatusReserva } from './reserva';

// JA_PARTIU (T41): carona ABERTA/LOTADA com a partida no passado; só exibição
export type TipoSelo = StatusReserva | StatusCarona | 'JA_PARTIU' | 'SOMENTE_MULHERES';

export interface AparenciaSelo {
  rotulo: string;
  icone: NomeIcone;
  fundo: string;
  cor: string;
}

const { cores } = tema;

const VISUAL: Record<TipoSelo, Omit<AparenciaSelo, 'rotulo'>> = {
  PENDENTE: { icone: 'time-outline', fundo: cores.alertaClaro, cor: cores.alerta },
  CONFIRMADA: { icone: 'checkmark-circle', fundo: cores.sucessoClaro, cor: cores.sucesso },
  CANCELADA: { icone: 'close-circle', fundo: cores.erroClaro, cor: cores.erro },
  EXPIRADA: { icone: 'hourglass-outline', fundo: cores.neutroClaro, cor: cores.neutro },
  ABERTA: { icone: 'lock-open-outline', fundo: cores.primariaClara, cor: cores.primaria },
  LOTADA: { icone: 'people', fundo: cores.alertaClaro, cor: cores.alerta },
  CONCLUIDA: { icone: 'flag-outline', fundo: cores.neutroClaro, cor: cores.neutro },
  JA_PARTIU: { icone: 'exit-outline', fundo: cores.neutroClaro, cor: cores.neutro },
  SOMENTE_MULHERES: {
    icone: 'female-outline',
    fundo: cores.secundariaClara,
    cor: cores.secundariaTexto,
  },
};

const ROTULO_PROPRIO: Partial<Record<TipoSelo, string>> = {
  ABERTA: 'Aberta',
  LOTADA: 'Lotada',
  CONCLUIDA: 'Concluída',
  JA_PARTIU: 'Já partiu',
  SOMENTE_MULHERES: 'Somente mulheres',
};

function ehStatusReserva(tipo: TipoSelo): tipo is StatusReserva {
  return (
    tipo === 'PENDENTE' || tipo === 'CONFIRMADA' || tipo === 'CANCELADA' || tipo === 'EXPIRADA'
  );
}

export function aparenciaSelo(tipo: TipoSelo): AparenciaSelo {
  const rotulo = ehStatusReserva(tipo) ? rotuloStatusReserva(tipo) : (ROTULO_PROPRIO[tipo] ?? tipo);
  return { rotulo, ...VISUAL[tipo] };
}
