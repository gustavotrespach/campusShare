// Tela de avaliar (T30): estrelas, comentário com contador, botão sem nota, envio e erros.
import { AccessibilityInfo } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';

import TelaAvaliar from '../app/(autenticado)/avaliacoes/[idReserva]';
import {
  avaliarParticipante,
  listarAvaliacoesPendentes,
  type AvaliacaoPendente,
} from '@/services/avaliacoes';
import { AppError } from '@/services/erros';
import { AVISO_AVALIACOES, consumirAviso } from '@/store/avisos';

jest.mock('expo-router', () => require('./apoio/expo-router-falso'));
jest.mock('@/services/avaliacoes', () => ({
  avaliarParticipante: jest.fn(),
  listarAvaliacoesPendentes: jest.fn(),
}));

const PENDENTE: AvaliacaoPendente = {
  id_reserva: 'r1',
  papel: 'PASSAGEIRO',
  nome_avaliado: 'Marcos',
  origem: 'Centro, Torres - RS',
  destino: 'ULBRA Torres - RS',
  data_hora_partida: '2026-11-23T12:00:00Z',
  avaliar_ate: '2026-11-30T12:00:00Z',
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.restoreAllMocks();
  consumirAviso(AVISO_AVALIACOES);
  jest.mocked(useLocalSearchParams).mockReturnValue({ idReserva: 'r1' });
  jest.mocked(listarAvaliacoesPendentes).mockResolvedValue([PENDENTE]);
});

describe('Avaliar', () => {
  it('mostra quem é avaliado; sem nota, "Enviar avaliação" fica desabilitado', async () => {
    await render(<TelaAvaliar />);

    expect(await screen.findByRole('header', { name: 'Avaliar Marcos' })).toBeOnTheScreen();
    expect(screen.getByText(/seu motorista na carona para ULBRA Torres/)).toBeOnTheScreen();
    expect(screen.getAllByRole('radio')).toHaveLength(5);
    expect(screen.getByRole('button', { name: 'Enviar avaliação' })).toBeDisabled();
  });

  it('escolher a nota marca a estrela e libera o envio', async () => {
    await render(<TelaAvaliar />);

    await fireEvent.press(await screen.findByRole('radio', { name: 'Nota 4 de 5' }));

    expect(screen.getByRole('radio', { name: 'Nota 4 de 5' })).toBeSelected();
    expect(screen.getByRole('radio', { name: 'Nota 5 de 5' })).not.toBeSelected();
    expect(screen.getByText('4 de 5')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Enviar avaliação' })).toBeEnabled();
  });

  it('o comentário tem contador até 500', async () => {
    await render(<TelaAvaliar />);
    const campo = await screen.findByLabelText('Comentário (opcional)');

    expect(screen.getByText('0/500')).toBeOnTheScreen();
    await fireEvent.changeText(campo, 'Pontual');
    expect(screen.getByText('7/500')).toBeOnTheScreen();
    expect(campo).toHaveProp('maxLength', 500);
  });

  it('envia nota e comentário, deixa o aviso para a lista e volta', async () => {
    jest.mocked(avaliarParticipante).mockResolvedValue('a1');
    const anuncio = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    await render(<TelaAvaliar />);

    await fireEvent.press(await screen.findByRole('radio', { name: 'Nota 5 de 5' }));
    await fireEvent.changeText(screen.getByLabelText('Comentário (opcional)'), 'Pontual');
    await fireEvent.press(screen.getByRole('button', { name: 'Enviar avaliação' }));

    expect(avaliarParticipante).toHaveBeenCalledWith('r1', 5, 'Pontual');
    expect(router.back).toHaveBeenCalled();
    expect(consumirAviso(AVISO_AVALIACOES)).toBe('Avaliação enviada.');
    expect(anuncio).toHaveBeenCalledWith('Avaliação enviada.');
  });

  it('erro de prazo mostra o hint do backend e fica na tela', async () => {
    jest
      .mocked(avaliarParticipante)
      .mockRejectedValue(
        new AppError(
          409,
          'PRAZO_AVALIACAO_ENCERRADO',
          'O prazo para avaliar esta carona era de 7 dias depois da partida.',
        ),
      );
    await render(<TelaAvaliar />);

    await fireEvent.press(await screen.findByRole('radio', { name: 'Nota 3 de 5' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Enviar avaliação' }));

    expect(
      await screen.findByText('O prazo para avaliar esta carona era de 7 dias depois da partida.'),
    ).toBeOnTheScreen();
    expect(router.back).not.toHaveBeenCalled();
    expect(consumirAviso(AVISO_AVALIACOES)).toBeNull();
  });

  it('reserva que não está mais pendente: "Avaliação indisponível" com Voltar', async () => {
    jest.mocked(listarAvaliacoesPendentes).mockResolvedValue([]);
    await render(<TelaAvaliar />);

    expect(await screen.findByText('Avaliação indisponível')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Voltar' }));
    expect(router.back).toHaveBeenCalled();
  });
});
