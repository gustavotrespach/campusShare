// Aparência de cada selo de status (DESIGN.md §3.4). A cor nunca é a única pista: todo selo tem
// ícone e texto. Os rótulos de reserva vêm de rotuloStatusReserva, para não duplicar textos.
import type { NomeIcone } from '@/components/icones';
import { tema } from '@/tema';

import { rotuloStatusReserva, type StatusReserva } from './reserva';

export type TipoSelo = StatusReserva | 'SOMENTE_MULHERES';

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
  SOMENTE_MULHERES: {
    icone: 'female-outline',
    fundo: cores.secundariaClara,
    cor: cores.secundariaTexto,
  },
};

export function aparenciaSelo(tipo: TipoSelo): AparenciaSelo {
  const rotulo = tipo === 'SOMENTE_MULHERES' ? 'Somente mulheres' : rotuloStatusReserva(tipo);
  return { rotulo, ...VISUAL[tipo] };
}
