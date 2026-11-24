// Tela inicial (T43): caronas agrupadas por dia e o card "Sua próxima viagem". Só exibição: os
// dados vêm prontos da buscar_caronas, da minhas_reservas e da lista de caronas do motorista; o
// "agora" é injetável para os testes.
import { chaveDiaBrasilia, rotuloDia } from './data-hora';
import { caronaEhProxima, reservaEhProxima } from './listas';
import type { StatusCarona, StatusReserva } from './reserva';

export interface GrupoDoDia<T> {
  // "2026-11-25" (dia de Brasília)
  chave: string;
  // "Hoje", "Amanhã" ou "qua 26/11"
  titulo: string;
  itens: T[];
}

function instante(item: { data_hora_partida: string }): number {
  return new Date(item.data_hora_partida).getTime();
}

// Grupos em ordem cronológica e, dentro de cada um, por horário. A busca devolve as caronas pela
// distância; aqui só se reordena o que veio (o empate de horário mantém a ordem da busca).
export function agruparPorDia<T extends { data_hora_partida: string }>(
  itens: readonly T[],
  agora: Date = new Date(),
): GrupoDoDia<T>[] {
  const ordenados = [...itens].sort((a, b) => instante(a) - instante(b));
  const grupos: GrupoDoDia<T>[] = [];
  for (const item of ordenados) {
    const chave = chaveDiaBrasilia(item.data_hora_partida);
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.chave === chave) {
      ultimo.itens.push(item);
    } else {
      grupos.push({ chave, titulo: rotuloDia(item.data_hora_partida, agora), itens: [item] });
    }
  }
  return grupos;
}

// O mínimo que o card precisa de cada lista (MinhaReserva e MinhaCarona têm isto e mais)
export interface ReservaParaProxima {
  id_reserva: string;
  status_reserva: StatusReserva;
  status_carona: StatusCarona;
  data_hora_partida: string;
}

export interface CaronaParaProxima {
  id_carona: string;
  status: StatusCarona;
  data_hora_partida: string;
}

export type ProximaViagem<R extends ReservaParaProxima, C extends CaronaParaProxima> =
  { tipo: 'RESERVA'; reserva: R } | { tipo: 'CARONA'; carona: C };

// A de partida mais próxima entre a reserva ativa (PENDENTE/CONFIRMADA, carona ABERTA/LOTADA e
// futura) e a carona própria ativa e futura, com as mesmas regras de "Próximas" da T41. No empate
// de horário, a reserva vem primeiro. Nenhuma das duas: null (o card não aparece).
export function escolherProximaViagem<R extends ReservaParaProxima, C extends CaronaParaProxima>(
  reservas: readonly R[],
  caronas: readonly C[],
  agora: Date = new Date(),
): ProximaViagem<R, C> | null {
  const reserva = reservas
    .filter((item) => reservaEhProxima(item, agora))
    .sort((a, b) => instante(a) - instante(b))[0];
  const carona = caronas
    .filter((item) => caronaEhProxima(item, agora))
    .sort((a, b) => instante(a) - instante(b))[0];
  if (reserva && (!carona || instante(reserva) <= instante(carona))) {
    return { tipo: 'RESERVA', reserva };
  }
  return carona ? { tipo: 'CARONA', carona } : null;
}

// "Você dirige · 2 de 3 vagas livres"
export function textoVoceDirige(carona: {
  vagas_disponiveis: number;
  vagas_ofertadas: number;
}): string {
  return `Você dirige · ${carona.vagas_disponiveis} de ${carona.vagas_ofertadas} vagas livres`;
}

// Estado vazio da lista: "Nenhuma carona perto de Centro de Torres"
export function tituloSemCaronas(local: string | null): string {
  return local ? `Nenhuma carona perto de ${local}` : 'Nenhuma carona por aqui';
}
