// "Minhas caronas" (T28, T41): seções Próximas e Anteriores (recolhida), card "Para X / Saindo de
// Y", selo "Já partiu", estados vazio e de erro, e o toque no card.
import { fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import TelaMinhasCaronas from '../app/(autenticado)/caronas/minhas';
import { listarMinhasCaronas, type MinhaCarona } from '@/services/caronas';
import { AppError } from '@/services/erros';

jest.mock('expo-router', () => require('./apoio/expo-router-falso'));
jest.mock('@/services/caronas', () => ({ listarMinhasCaronas: jest.fn() }));

const daqui = (horas: number) => new Date(Date.now() + horas * 3_600_000).toISOString();

function carona(
  id: string,
  status: MinhaCarona['status'],
  horas: number,
  destino = 'ULBRA Torres - RS',
): MinhaCarona {
  return {
    id_carona: id,
    origem: `Bairro ${id}, Torres - RS`,
    destino,
    data_hora_partida: daqui(horas),
    vagas_disponiveis: 2,
    vagas_ofertadas: 3,
    status,
  };
}

const cards = () => screen.queryAllByRole('button', { name: /^Para / });

beforeEach(() => {
  jest.clearAllMocks();
});

describe('Minhas caronas', () => {
  it('mostra as próximas (mais perto antes) e recolhe as anteriores', async () => {
    jest
      .mocked(listarMinhasCaronas)
      .mockResolvedValue([
        carona('ontem', 'ABERTA', -20),
        carona('amanha', 'ABERTA', 24),
        carona('hoje', 'LOTADA', 3, 'Rodoviária de Torres - RS'),
        carona('cancelada', 'CANCELADA', -48),
      ]);
    await render(<TelaMinhasCaronas />);

    expect(await screen.findByRole('header', { name: 'Próximas' })).toBeOnTheScreen();
    expect(cards().map((card) => card.props.accessibilityLabel as string)).toEqual([
      expect.stringMatching(
        /^Para Rodoviária de Torres, saindo de Bairro hoje, Torres, .+ · \d{2}:\d{2}, Lotada, 2 de 3 vagas livres$/,
      ),
      expect.stringMatching(/^Para ULBRA Torres, saindo de Bairro amanha, Torres, .+, Aberta, /),
    ]);
    expect(screen.getByText('Para Rodoviária de Torres')).toBeOnTheScreen();
    expect(screen.getByText('Saindo de Bairro hoje, Torres')).toBeOnTheScreen();
    // Anteriores recolhidas por padrão
    expect(screen.queryByText(/Bairro ontem/)).toBeNull();
    expect(screen.getByRole('button', { name: 'Ver 2 caronas anteriores' })).toBeOnTheScreen();
    expect(screen.getByText('Ver anteriores (2)')).toBeOnTheScreen();
  });

  it('"Ver anteriores" mostra as passadas (mais recente antes), com "Já partiu"; "Ocultar" recolhe', async () => {
    jest
      .mocked(listarMinhasCaronas)
      .mockResolvedValue([
        carona('semana', 'CONCLUIDA', -170),
        carona('ontem', 'ABERTA', -20),
        carona('amanha', 'ABERTA', 24),
      ]);
    await render(<TelaMinhasCaronas />);

    await fireEvent.press(await screen.findByRole('button', { name: 'Ver 2 caronas anteriores' }));

    expect(screen.getByRole('header', { name: 'Anteriores' })).toBeOnTheScreen();
    expect(cards().map((card) => card.props.accessibilityLabel as string)).toEqual([
      expect.stringMatching(/saindo de Bairro amanha, .*, Aberta,/),
      expect.stringMatching(/saindo de Bairro ontem, .*, Já partiu,/),
      expect.stringMatching(/saindo de Bairro semana, .*, Concluída,/),
    ]);
    expect(screen.getByText('Já partiu')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Ocultar caronas anteriores' }));
    expect(screen.queryByText(/Bairro ontem/)).toBeNull();
  });

  it('sem anteriores, o botão não aparece', async () => {
    jest.mocked(listarMinhasCaronas).mockResolvedValue([carona('amanha', 'ABERTA', 24)]);
    await render(<TelaMinhasCaronas />);

    expect(await screen.findByText('Para ULBRA Torres')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: /anteriores/ })).toBeNull();
  });

  it('sem próximas: estado vazio com "Oferecer carona" e o botão das anteriores logo abaixo', async () => {
    jest.mocked(listarMinhasCaronas).mockResolvedValue([carona('ontem', 'ABERTA', -20)]);
    await render(<TelaMinhasCaronas />);

    expect(await screen.findByText('Nenhuma carona próxima')).toBeOnTheScreen();
    expect(screen.queryByRole('header', { name: 'Próximas' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Ver 1 carona anterior' })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: /Oferecer carona/ }));
    expect(router.push).toHaveBeenCalledWith('/caronas/publicar');
  });

  it('sem nenhuma carona: o estado vazio de sempre', async () => {
    jest.mocked(listarMinhasCaronas).mockResolvedValue([]);
    await render(<TelaMinhasCaronas />);

    expect(await screen.findByText('Você ainda não ofereceu caronas')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: /anteriores/ })).toBeNull();
  });

  it('tocar no card abre o detalhe da carona', async () => {
    jest.mocked(listarMinhasCaronas).mockResolvedValue([carona('c1', 'ABERTA', 24)]);
    await render(<TelaMinhasCaronas />);

    await fireEvent.press(await screen.findByRole('button', { name: /^Para ULBRA Torres/ }));

    expect(router.push).toHaveBeenCalledWith({ pathname: '/caronas/[id]', params: { id: 'c1' } });
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
    expect(await screen.findByText('Para ULBRA Torres')).toBeOnTheScreen();
  });
});
