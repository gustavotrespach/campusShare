// "Minhas caronas" (T28): lista na ordem do service, estados vazio e de erro, e o toque no card.
import { fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import TelaMinhasCaronas from '../app/(autenticado)/caronas/minhas';
import { listarMinhasCaronas, type MinhaCarona } from '@/services/caronas';
import { AppError } from '@/services/erros';

jest.mock('expo-router', () => require('./apoio/expo-router-falso'));
jest.mock('@/services/caronas', () => ({ listarMinhasCaronas: jest.fn() }));

const daqui = (horas: number) => new Date(Date.now() + horas * 3_600_000).toISOString();

function carona(id: string, status: MinhaCarona['status'], horas: number, livres = 2): MinhaCarona {
  return {
    id_carona: id,
    origem: `Origem ${id}`,
    destino: 'ULBRA Torres - RS',
    data_hora_partida: daqui(horas),
    vagas_disponiveis: livres,
    vagas_ofertadas: 3,
    status,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('Minhas caronas', () => {
  it('mostra os cards na ordem do service, com status, rota e vagas livres', async () => {
    jest
      .mocked(listarMinhasCaronas)
      .mockResolvedValue([
        carona('hoje', 'LOTADA', 3, 0),
        carona('amanha', 'ABERTA', 24),
        carona('antiga', 'CANCELADA', -48),
      ]);
    await render(<TelaMinhasCaronas />);

    const cards = await screen.findAllByRole('button', { name: /vagas livres$/ });
    expect(cards.map((card) => card.props.accessibilityLabel as string)).toEqual([
      expect.stringMatching(
        /^Lotada, .*, de Origem hoje para ULBRA Torres - RS, 0 de 3 vagas livres$/,
      ),
      expect.stringMatching(
        /^Aberta, .*, de Origem amanha para ULBRA Torres - RS, 2 de 3 vagas livres$/,
      ),
      expect.stringMatching(/^Cancelada, .*, de Origem antiga/),
    ]);
    expect(screen.getByText('Lotada')).toBeOnTheScreen();
    expect(screen.getByText('0 de 3 vagas livres')).toBeOnTheScreen();
  });

  it('tocar no card abre o detalhe da carona', async () => {
    jest.mocked(listarMinhasCaronas).mockResolvedValue([carona('c1', 'ABERTA', 24)]);
    await render(<TelaMinhasCaronas />);

    await fireEvent.press(await screen.findByRole('button', { name: /^Aberta,/ }));

    expect(router.push).toHaveBeenCalledWith({ pathname: '/caronas/[id]', params: { id: 'c1' } });
  });

  it('sem caronas: estado vazio com "Oferecer carona"', async () => {
    jest.mocked(listarMinhasCaronas).mockResolvedValue([]);
    await render(<TelaMinhasCaronas />);

    expect(await screen.findByText('Você ainda não ofereceu caronas')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: /Oferecer carona/ }));
    expect(router.push).toHaveBeenCalledWith('/caronas/publicar');
  });

  it('com erro, mostra a mensagem e tenta de novo', async () => {
    jest
      .mocked(listarMinhasCaronas)
      .mockRejectedValueOnce(new AppError(0, 'SEM_CONEXAO', 'Sem conexão com a internet.'))
      .mockResolvedValueOnce([carona('c1', 'ABERTA', 24)]);
    await render(<TelaMinhasCaronas />);

    expect(await screen.findByText('Não foi possível carregar')).toBeOnTheScreen();
    expect(screen.getByText('Sem conexão com a internet.')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findByRole('button', { name: /^Aberta,/ })).toBeOnTheScreen();
  });
});
