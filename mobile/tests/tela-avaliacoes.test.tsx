// Avaliações pendentes (T30): cards, aviso deixado pela tela de avaliar, vazio, erro e toque.
import { fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import TelaAvaliacoesPendentes from '../app/(autenticado)/avaliacoes/index';
import { listarAvaliacoesPendentes, type AvaliacaoPendente } from '@/services/avaliacoes';
import { AppError } from '@/services/erros';
import { AVISO_AVALIACOES, deixarAviso } from '@/store/avisos';

jest.mock('expo-router', () => require('./apoio/expo-router-falso'));
jest.mock('@/services/avaliacoes', () => ({ listarAvaliacoesPendentes: jest.fn() }));

function pendente(id: string, papel: AvaliacaoPendente['papel'], nome: string): AvaliacaoPendente {
  return {
    id_reserva: id,
    papel,
    nome_avaliado: nome,
    origem: 'Centro, Torres - RS',
    destino: 'ULBRA Torres - RS',
    data_hora_partida: '2026-11-23T12:00:00Z',
    avaliar_ate: '2026-11-30T12:00:00Z',
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('Avaliações pendentes', () => {
  it('cards com "Avaliar <nome>", o papel, "Para <destino curto>", a partida e o prazo', async () => {
    jest
      .mocked(listarAvaliacoesPendentes)
      .mockResolvedValue([
        pendente('r1', 'PASSAGEIRO', 'Marcos'),
        pendente('r2', 'MOTORISTA', 'Paula'),
      ]);
    await render(<TelaAvaliacoesPendentes />);

    expect(await screen.findByText('Avaliar Marcos')).toBeOnTheScreen();
    expect(screen.getByText('seu motorista')).toBeOnTheScreen();
    expect(screen.getByText('Avaliar Paula')).toBeOnTheScreen();
    expect(screen.getByText('seu passageiro')).toBeOnTheScreen();
    expect(screen.getAllByText('Para ULBRA Torres')).toHaveLength(2);
    expect(screen.getAllByText('seg 23/11 · 09:00')).toHaveLength(2);
    expect(screen.getAllByText('Avaliar até seg 30/11 · 09:00')).toHaveLength(2);
    expect(
      screen.getByRole('button', {
        name: 'Avaliar Marcos, seu motorista, carona para ULBRA Torres em seg 23/11 · 09:00, avaliar até seg 30/11 · 09:00',
      }),
    ).toBeOnTheScreen();
  });

  it('tocar no card abre a tela de avaliar', async () => {
    jest
      .mocked(listarAvaliacoesPendentes)
      .mockResolvedValue([pendente('r1', 'PASSAGEIRO', 'Marcos')]);
    await render(<TelaAvaliacoesPendentes />);

    await fireEvent.press(await screen.findByRole('button', { name: /^Avaliar Marcos/ }));

    expect(router.push).toHaveBeenCalledWith({
      pathname: '/avaliacoes/[idReserva]',
      params: { idReserva: 'r1' },
    });
  });

  it('mostra uma vez o aviso deixado pela tela de avaliar', async () => {
    jest.mocked(listarAvaliacoesPendentes).mockResolvedValue([]);
    deixarAviso(AVISO_AVALIACOES, 'Avaliação enviada.');
    await render(<TelaAvaliacoesPendentes />);

    expect(await screen.findByText('Avaliação enviada.')).toBeOnTheScreen();
  });

  it('sem pendências: "Nenhuma avaliação pendente"', async () => {
    jest.mocked(listarAvaliacoesPendentes).mockResolvedValue([]);
    await render(<TelaAvaliacoesPendentes />);

    expect(await screen.findByText('Nenhuma avaliação pendente')).toBeOnTheScreen();
    expect(screen.queryByText('Avaliação enviada.')).toBeNull();
  });

  it('com erro, mostra a mensagem e tenta de novo', async () => {
    jest
      .mocked(listarAvaliacoesPendentes)
      .mockRejectedValueOnce(new AppError(0, 'SEM_CONEXAO', 'Sem conexão com a internet.'))
      .mockResolvedValueOnce([pendente('r1', 'PASSAGEIRO', 'Marcos')]);
    await render(<TelaAvaliacoesPendentes />);

    expect(await screen.findByText('Sem conexão com a internet.')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findByText('Avaliar Marcos')).toBeOnTheScreen();
  });
});
