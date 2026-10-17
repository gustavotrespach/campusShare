// Polling da tela de pagamento com fake timers: 5 s entre consultas, para ao confirmar, ao sair
// da tela e depois de 15 min.
import {
  acompanharReserva,
  INTERVALO_ACOMPANHAMENTO_MS,
  LIMITE_ACOMPANHAMENTO_MS,
} from '@/utils/acompanhamento-reserva';
import type { StatusReserva } from '@/utils/reserva';

interface Situacao {
  statusReserva: StatusReserva;
}

function respostas(...status: StatusReserva[]): jest.Mock<Promise<Situacao>, []> {
  const fila = [...status];
  return jest.fn(async () => ({ statusReserva: fila.length > 1 ? fila.shift()! : fila[0] }));
}

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

it('usa 5 s de intervalo e 15 min de limite', () => {
  expect(INTERVALO_ACOMPANHAMENTO_MS).toBe(5_000);
  expect(LIMITE_ACOMPANHAMENTO_MS).toBe(15 * 60 * 1000);
});

it('consulta na hora e a cada 5 s, e para quando a reserva vira CONFIRMADA', async () => {
  const consultar = respostas('PENDENTE', 'PENDENTE', 'CONFIRMADA');
  const aoAtualizar = jest.fn();
  acompanharReserva({ consultar, aoAtualizar });

  await jest.advanceTimersByTimeAsync(0);
  expect(consultar).toHaveBeenCalledTimes(1);
  await jest.advanceTimersByTimeAsync(4_999);
  expect(consultar).toHaveBeenCalledTimes(1);
  await jest.advanceTimersByTimeAsync(1);
  expect(consultar).toHaveBeenCalledTimes(2);
  await jest.advanceTimersByTimeAsync(5_000);
  expect(consultar).toHaveBeenCalledTimes(3);
  expect(aoAtualizar).toHaveBeenLastCalledWith({ statusReserva: 'CONFIRMADA' });

  await jest.advanceTimersByTimeAsync(60_000);
  expect(consultar).toHaveBeenCalledTimes(3);
  expect(jest.getTimerCount()).toBe(0);
});

it.each<StatusReserva>(['CANCELADA', 'EXPIRADA'])('para em %s', async (final) => {
  const consultar = respostas('PENDENTE', final);
  const aoAtualizar = jest.fn();
  acompanharReserva({ consultar, aoAtualizar });

  await jest.advanceTimersByTimeAsync(30_000);
  expect(consultar).toHaveBeenCalledTimes(2);
  expect(aoAtualizar).toHaveBeenLastCalledWith({ statusReserva: final });
});

it('para ao sair da tela: nenhuma consulta nova depois do parar', async () => {
  const consultar = respostas('PENDENTE');
  const parar = acompanharReserva({ consultar, aoAtualizar: jest.fn() });

  await jest.advanceTimersByTimeAsync(10_000);
  expect(consultar).toHaveBeenCalledTimes(3);
  parar();
  await jest.advanceTimersByTimeAsync(60_000);
  expect(consultar).toHaveBeenCalledTimes(3);
  expect(jest.getTimerCount()).toBe(0);
});

it('resposta que chega depois de sair da tela não atualiza nada', async () => {
  let responder: (situacao: Situacao) => void = () => undefined;
  const consultar = jest.fn(
    () =>
      new Promise<Situacao>((resolve) => {
        responder = resolve;
      }),
  );
  const aoAtualizar = jest.fn();
  const parar = acompanharReserva({ consultar, aoAtualizar });

  parar();
  responder({ statusReserva: 'CONFIRMADA' });
  await jest.advanceTimersByTimeAsync(10_000);
  expect(aoAtualizar).not.toHaveBeenCalled();
  expect(consultar).toHaveBeenCalledTimes(1);
});

it('respeita o limite de 15 min com a reserva ainda PENDENTE', async () => {
  const consultar = respostas('PENDENTE');
  const aoEsgotar = jest.fn();
  acompanharReserva({ consultar, aoAtualizar: jest.fn(), aoEsgotar });

  await jest.advanceTimersByTimeAsync(LIMITE_ACOMPANHAMENTO_MS - 1);
  expect(aoEsgotar).not.toHaveBeenCalled();
  await jest.advanceTimersByTimeAsync(1);
  expect(aoEsgotar).toHaveBeenCalledTimes(1);
  // Uma consulta imediata e uma a cada 5 s até os 15 min
  expect(consultar).toHaveBeenCalledTimes(
    1 + LIMITE_ACOMPANHAMENTO_MS / INTERVALO_ACOMPANHAMENTO_MS,
  );

  await jest.advanceTimersByTimeAsync(10 * 60 * 1000);
  expect(consultar).toHaveBeenCalledTimes(181);
  expect(aoEsgotar).toHaveBeenCalledTimes(1);
  expect(jest.getTimerCount()).toBe(0);
});

it('falha numa consulta avisa e tenta de novo no próximo ciclo', async () => {
  const consultar = jest
    .fn<Promise<Situacao>, []>()
    .mockRejectedValueOnce(new Error('rede'))
    .mockResolvedValue({ statusReserva: 'CONFIRMADA' });
  const aoFalhar = jest.fn();
  const aoAtualizar = jest.fn();
  acompanharReserva({ consultar, aoAtualizar, aoFalhar });

  await jest.advanceTimersByTimeAsync(0);
  expect(aoFalhar).toHaveBeenCalledTimes(1);
  expect(aoAtualizar).not.toHaveBeenCalled();
  await jest.advanceTimersByTimeAsync(5_000);
  expect(aoAtualizar).toHaveBeenCalledWith({ statusReserva: 'CONFIRMADA' });
  expect(consultar).toHaveBeenCalledTimes(2);
});
