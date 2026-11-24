// Conclusão e avaliações no app (T30): quando mostrar "Concluir carona" e os textos de reputação e
// de pendências. Nenhuma regra de prazo aqui (1 dia para concluir, 7 para avaliar): quem decide é o
// backend, e a tela mostra o hint do erro.
import { situacaoExibidaCarona } from './listas';
import type { StatusCarona } from './reserva';

// Mesma regra de exibição do selo "Já partiu" (T41): carona ativa depois da partida. Se o prazo de
// conclusão já passou, o backend recusa com CONCLUSAO_ENCERRADA.
export function podeConcluirCarona(
  carona: { sou_motorista: boolean; status: StatusCarona; data_hora_partida: string },
  agora: Date = new Date(),
): boolean {
  return carona.sou_motorista && situacaoExibidaCarona(carona, agora) === 'JA_PARTIU';
}

// 4.3 → "4,3"; 5 → "5,0"
export function formatarNota(media: number): string {
  return media.toFixed(1).replace('.', ',');
}

function avaliacoes(total: number): string {
  return total === 1 ? '1 avaliação' : `${total} avaliações`;
}

// "4,3 · 12 avaliações" (a estrela é o ícone ao lado) ou "Sem avaliações ainda"
export function textoReputacao(media: number | null, total: number): string {
  return media === null || total === 0
    ? 'Sem avaliações ainda'
    : `${formatarNota(media)} · ${avaliacoes(total)}`;
}

export function rotuloReputacao(media: number | null, total: number): string {
  return media === null || total === 0
    ? 'Sem avaliações ainda'
    : `Nota média ${formatarNota(media)} de 5, ${avaliacoes(total)}`;
}

// Versão curta, para o card de "Minhas reservas" (T42): "nota média 4,0"
export function rotuloNotaMedia(media: number): string {
  return `nota média ${formatarNota(media)}`;
}

export function textoAvaliacoesPendentes(quantidade: number): string {
  return quantidade === 1
    ? 'Você tem 1 avaliação pendente.'
    : `Você tem ${quantidade} avaliações pendentes.`;
}

export type PapelAvaliador = 'PASSAGEIRO' | 'MOTORISTA';

// O papel é o de quem avalia: o passageiro avalia o motorista dele, e vice-versa
export function descreverAvaliado(papel: PapelAvaliador): string {
  return papel === 'PASSAGEIRO' ? 'seu motorista' : 'seu passageiro';
}

export const CONFIRMACAO_CONCLUIR_CARONA =
  'Confirme que a viagem aconteceu. Depois de concluída, você e os passageiros podem se avaliar.';

export const TAMANHO_MAXIMO_COMENTARIO = 500;
