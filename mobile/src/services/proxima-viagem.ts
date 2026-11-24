import { escolherProximaViagem, type ProximaViagem } from '@/utils/inicio';

import { listarMinhasCaronas, type MinhaCarona } from './caronas';
import { listarMinhasReservas, type MinhaReserva } from './reservas';

export type ViagemDoInicio = ProximaViagem<MinhaReserva, MinhaCarona>;

// Card "Sua próxima viagem" da tela inicial (T43): as duas listas que o app já usa (minhas_reservas
// e as caronas do motorista pela RLS), sem chamada nova. Uma falha usa só a outra; as duas falhando,
// o card não aparece (null) e a tela não mostra erro. Nunca rejeita.
export async function obterProximaViagem(): Promise<ViagemDoInicio | null> {
  const [reservas, caronas] = await Promise.allSettled([
    listarMinhasReservas(),
    listarMinhasCaronas(),
  ]);
  if (reservas.status === 'rejected' && caronas.status === 'rejected') {
    return null;
  }
  return escolherProximaViagem(
    reservas.status === 'fulfilled' ? reservas.value : [],
    caronas.status === 'fulfilled' ? caronas.value : [],
  );
}
