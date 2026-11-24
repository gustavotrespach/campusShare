// T43 — "Sua próxima viagem": as duas consultas que o app já tem, com falha parcial e total.
import { listarMinhasCaronas, type MinhaCarona } from '@/services/caronas';
import { obterProximaViagem } from '@/services/proxima-viagem';
import { listarMinhasReservas, type MinhaReserva } from '@/services/reservas';

jest.mock('@/services/caronas', () => ({ listarMinhasCaronas: jest.fn() }));
jest.mock('@/services/reservas', () => ({ listarMinhasReservas: jest.fn() }));

const daqui = (horas: number) => new Date(Date.now() + horas * 3_600_000).toISOString();

const RESERVA = {
  id_reserva: 'r1',
  status_reserva: 'CONFIRMADA',
  status_carona: 'ABERTA',
  data_hora_partida: daqui(30),
  destino: 'ULBRA Torres - RS',
  nome_motorista: 'Bruno',
  media_motorista: 4,
  total_avaliacoes_motorista: 1,
} as MinhaReserva;

const CARONA = {
  id_carona: 'c1',
  status: 'ABERTA',
  data_hora_partida: daqui(5),
  destino: 'Centro, Torres - RS',
  vagas_disponiveis: 2,
  vagas_ofertadas: 3,
} as MinhaCarona;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('obterProximaViagem', () => {
  it('compara as duas listas e fica com a de partida mais próxima', async () => {
    jest.mocked(listarMinhasReservas).mockResolvedValue([RESERVA]);
    jest.mocked(listarMinhasCaronas).mockResolvedValue([CARONA]);

    expect(await obterProximaViagem()).toEqual({ tipo: 'CARONA', carona: CARONA });
  });

  it('falha nas reservas: usa as caronas', async () => {
    jest.mocked(listarMinhasReservas).mockRejectedValue(new Error('rede'));
    jest.mocked(listarMinhasCaronas).mockResolvedValue([CARONA]);

    expect(await obterProximaViagem()).toEqual({ tipo: 'CARONA', carona: CARONA });
  });

  it('falha nas caronas: usa as reservas', async () => {
    jest.mocked(listarMinhasReservas).mockResolvedValue([RESERVA]);
    jest.mocked(listarMinhasCaronas).mockRejectedValue(new Error('rede'));

    expect(await obterProximaViagem()).toEqual({ tipo: 'RESERVA', reserva: RESERVA });
  });

  it('falha nas duas: null, sem rejeitar', async () => {
    jest.mocked(listarMinhasReservas).mockRejectedValue(new Error('rede'));
    jest.mocked(listarMinhasCaronas).mockRejectedValue(new Error('rede'));

    await expect(obterProximaViagem()).resolves.toBeNull();
  });

  it('nenhuma ativa: null', async () => {
    jest.mocked(listarMinhasReservas).mockResolvedValue([]);
    jest.mocked(listarMinhasCaronas).mockResolvedValue([]);

    expect(await obterProximaViagem()).toBeNull();
  });
});
