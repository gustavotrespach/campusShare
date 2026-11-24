// "Minhas reservas" (T41): seções Próximas e Anteriores (recolhida), card "Para X / Saindo de Y",
// valor e status do pagamento, estados vazio e de erro.
import { fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import TelaMinhasReservas from '../app/(autenticado)/reservas/index';
import { AppError } from '@/services/erros';
import { listarMinhasReservas, type MinhaReserva } from '@/services/reservas';

jest.mock('expo-router', () => require('./apoio/expo-router-falso'));
jest.mock('@/services/reservas', () => ({ listarMinhasReservas: jest.fn() }));

const daqui = (horas: number) => new Date(Date.now() + horas * 3_600_000).toISOString();

function reserva(
  id: string,
  status: MinhaReserva['status_reserva'],
  horas: number,
  statusCarona: MinhaReserva['status_carona'] = 'ABERTA',
  media: number | null = null,
  total = 0,
): MinhaReserva {
  return {
    id_reserva: id,
    status_reserva: status,
    reservado_em: daqui(-100),
    status_pagamento: status === 'CONFIRMADA' ? 'APROVADO' : 'PENDENTE',
    valorCentavos: 600,
    id_carona: `c-${id}`,
    origem: `Bairro ${id}, Torres - RS`,
    destino: 'ULBRA Torres - RS',
    data_hora_partida: daqui(horas),
    status_carona: statusCarona,
    nome_motorista: 'Bruno',
    media_motorista: media,
    total_avaliacoes_motorista: total,
  } as MinhaReserva;
}

const cards = () => screen.queryAllByRole('button', { name: /^Para / });

beforeEach(() => {
  jest.clearAllMocks();
});

describe('Minhas reservas', () => {
  it('próximas primeiro (mais perto antes), card com título, origem, data, status e valor', async () => {
    jest
      .mocked(listarMinhasReservas)
      .mockResolvedValue([
        reserva('semana', 'CONFIRMADA', 170),
        reserva('ontem', 'CONFIRMADA', -20),
        reserva('hoje', 'PENDENTE', 3),
        reserva('cancelada', 'CANCELADA', 30),
        reserva('carona-cancelada', 'CONFIRMADA', 10, 'CANCELADA'),
      ]);
    await render(<TelaMinhasReservas />);

    expect(await screen.findByRole('header', { name: 'Próximas' })).toBeOnTheScreen();
    expect(cards().map((card) => card.props.accessibilityLabel as string)).toEqual([
      expect.stringMatching(
        /^Para ULBRA Torres, saindo de Bairro hoje, Torres, .+ · \d{2}:\d{2}, Aguardando pagamento, R\$\s6,00, motorista Bruno$/,
      ),
      expect.stringMatching(/saindo de Bairro semana, .*, Confirmada, /),
    ]);
    expect(screen.getAllByText('Para ULBRA Torres')).toHaveLength(2);
    expect(screen.getByText('Pagar com Pix')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Ver 3 reservas anteriores' })).toBeOnTheScreen();
  });

  it('as anteriores aparecem ao expandir, da mais recente para a mais antiga', async () => {
    jest
      .mocked(listarMinhasReservas)
      .mockResolvedValue([
        reserva('antiga', 'EXPIRADA', -200),
        reserva('ontem', 'CONFIRMADA', -20),
        reserva('amanha', 'CONFIRMADA', 24),
      ]);
    await render(<TelaMinhasReservas />);

    await fireEvent.press(await screen.findByRole('button', { name: 'Ver 2 reservas anteriores' }));

    expect(cards().map((card) => card.props.accessibilityLabel as string)).toEqual([
      expect.stringMatching(/Bairro amanha/),
      expect.stringMatching(/Bairro ontem, .*, Confirmada,/),
      expect.stringMatching(/Bairro antiga, .*, Expirada,/),
    ]);
  });

  it('tocar no card abre o pagamento da reserva', async () => {
    jest.mocked(listarMinhasReservas).mockResolvedValue([reserva('r1', 'CONFIRMADA', 24)]);
    await render(<TelaMinhasReservas />);

    await fireEvent.press(await screen.findByRole('button', { name: /^Para ULBRA Torres/ }));

    expect(router.push).toHaveBeenCalledWith({ pathname: '/reservas/[id]', params: { id: 'r1' } });
  });

  it('sem próximas: estado vazio com "Buscar caronas" e o botão das anteriores', async () => {
    jest.mocked(listarMinhasReservas).mockResolvedValue([reserva('ontem', 'CONFIRMADA', -20)]);
    await render(<TelaMinhasReservas />);

    expect(await screen.findByText('Nenhuma reserva próxima')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Ver 1 reserva anterior' })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: /Buscar caronas/ }));
    expect(router.navigate).toHaveBeenCalledWith('/');
  });

  it('sem nenhuma reserva: "Nenhuma reserva ainda", sem botão de anteriores', async () => {
    jest.mocked(listarMinhasReservas).mockResolvedValue([]);
    await render(<TelaMinhasReservas />);

    expect(await screen.findByText('Nenhuma reserva ainda')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: /anteriores/ })).toBeNull();
  });

  it('com erro, mostra a mensagem e tenta de novo', async () => {
    jest
      .mocked(listarMinhasReservas)
      .mockRejectedValueOnce(new AppError(0, 'SEM_CONEXAO', 'Sem conexão com a internet.'))
      .mockResolvedValueOnce([reserva('r1', 'CONFIRMADA', 24)]);
    await render(<TelaMinhasReservas />);

    expect(await screen.findByText('Sem conexão com a internet.')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findByText('Para ULBRA Torres')).toBeOnTheScreen();
  });

  it('card com nota: "★ 4,0" ao lado do motorista, lida como "nota média 4,0"', async () => {
    jest
      .mocked(listarMinhasReservas)
      .mockResolvedValue([reserva('r1', 'CONFIRMADA', 24, 'ABERTA', 4, 1)]);
    await render(<TelaMinhasReservas />);

    expect(await screen.findByText('Motorista: Bruno')).toBeOnTheScreen();
    expect(screen.getByText('4,0')).toBeOnTheScreen();
    expect(
      screen.getByRole('button', { name: /, motorista Bruno, nota média 4,0$/ }),
    ).toBeOnTheScreen();
  });

  it('card sem nota (motorista sem avaliações): nada ao lado do nome', async () => {
    jest.mocked(listarMinhasReservas).mockResolvedValue([reserva('r1', 'CONFIRMADA', 24)]);
    await render(<TelaMinhasReservas />);

    expect(await screen.findByText('Motorista: Bruno')).toBeOnTheScreen();
    // Nenhuma nota com 1 casa ("4,0"); o valor "R$ 6,00" não conta
    expect(screen.queryByText(/^\d,\d$/)).toBeNull();
    expect(screen.queryByText('Sem avaliações ainda')).toBeNull();
    expect(screen.getByRole('button', { name: /, motorista Bruno$/ })).toBeOnTheScreen();
  });
});
