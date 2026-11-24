import {
  caronaEmAndamento,
  confirmacaoCancelarReserva,
  mensagemCaronaCancelada,
  mensagemReservaCancelada,
  ordenarMinhasCaronas,
  podeCancelarCarona,
  podeCancelarReserva,
} from '@/utils/cancelamento';
import { aparenciaSelo } from '@/utils/selo-status';

const AGORA = new Date('2026-11-24T12:00:00Z');
const daqui = (horas: number) => new Date(AGORA.getTime() + horas * 3_600_000).toISOString();

describe('podeCancelarReserva', () => {
  it('PENDENTE e CONFIRMADA com carona ativa e futura mostram o botão', () => {
    for (const statusReserva of ['PENDENTE', 'CONFIRMADA'] as const) {
      expect(
        podeCancelarReserva({ statusReserva, statusCarona: 'LOTADA', partida: daqui(1) }, AGORA),
      ).toBe(true);
    }
  });

  it('não calcula o prazo de 2 h da RN20: reserva paga a 1 h da partida ainda mostra o botão', () => {
    // Quem recusa é o backend (PRAZO_CANCELAMENTO_ENCERRADO), com a frase do hint
    expect(
      podeCancelarReserva(
        { statusReserva: 'CONFIRMADA', statusCarona: 'ABERTA', partida: daqui(1) },
        AGORA,
      ),
    ).toBe(true);
  });

  it('reserva encerrada, carona encerrada ou partida passada escondem o botão', () => {
    expect(
      podeCancelarReserva(
        { statusReserva: 'CANCELADA', statusCarona: 'ABERTA', partida: daqui(5) },
        AGORA,
      ),
    ).toBe(false);
    expect(
      podeCancelarReserva(
        { statusReserva: 'EXPIRADA', statusCarona: 'ABERTA', partida: daqui(5) },
        AGORA,
      ),
    ).toBe(false);
    expect(
      podeCancelarReserva(
        { statusReserva: 'PENDENTE', statusCarona: 'CANCELADA', partida: daqui(5) },
        AGORA,
      ),
    ).toBe(false);
    expect(
      podeCancelarReserva(
        { statusReserva: 'CONFIRMADA', statusCarona: 'ABERTA', partida: daqui(-0.1) },
        AGORA,
      ),
    ).toBe(false);
  });
});

describe('podeCancelarCarona', () => {
  const carona = { sou_motorista: true, status: 'ABERTA' as const, data_hora_partida: daqui(1) };

  it('só o motorista, com a carona ABERTA ou LOTADA e futura', () => {
    expect(podeCancelarCarona(carona, AGORA)).toBe(true);
    expect(podeCancelarCarona({ ...carona, status: 'LOTADA' }, AGORA)).toBe(true);
    expect(podeCancelarCarona({ ...carona, sou_motorista: false }, AGORA)).toBe(false);
    expect(podeCancelarCarona({ ...carona, status: 'CANCELADA' }, AGORA)).toBe(false);
    expect(podeCancelarCarona({ ...carona, status: 'CONCLUIDA' }, AGORA)).toBe(false);
    expect(podeCancelarCarona({ ...carona, data_hora_partida: daqui(-1) }, AGORA)).toBe(false);
  });
});

describe('textos', () => {
  it('confirmação de reserva: PENDENTE fala da vaga; CONFIRMADA, do reembolso e das 2 h', () => {
    expect(confirmacaoCancelarReserva('PENDENTE')).toBe(
      'Sua vaga será liberada. Se você já pagou o Pix, o valor fica registrado para reembolso.',
    );
    expect(confirmacaoCancelarReserva('CONFIRMADA')).toBe(
      'O valor pago fica registrado para reembolso. Reservas pagas só podem ser canceladas até 2 horas antes da partida.',
    );
  });

  it('resultado do cancelamento', () => {
    expect(mensagemReservaCancelada('PENDENTE')).toBe('Reserva cancelada. Sua vaga foi liberada.');
    expect(mensagemReservaCancelada('CONFIRMADA')).toBe(
      'Reserva cancelada. O valor pago fica registrado para reembolso.',
    );
    expect(mensagemCaronaCancelada(0)).toBe('Carona cancelada. Ela não tinha reservas.');
    expect(mensagemCaronaCancelada(1)).toBe('Carona cancelada. 1 reserva cancelada.');
    expect(mensagemCaronaCancelada(3)).toBe('Carona cancelada. 3 reservas canceladas.');
  });
});

describe('ordenarMinhasCaronas', () => {
  it('em andamento primeiro (a mais próxima antes), depois passadas e encerradas (a mais recente antes)', () => {
    const caronas = [
      { id: 'passada', status: 'CONCLUIDA' as const, data_hora_partida: daqui(-48) },
      { id: 'ontem-aberta', status: 'ABERTA' as const, data_hora_partida: daqui(-20) },
      { id: 'amanha', status: 'ABERTA' as const, data_hora_partida: daqui(24) },
      { id: 'cancelada-futura', status: 'CANCELADA' as const, data_hora_partida: daqui(30) },
      { id: 'hoje', status: 'LOTADA' as const, data_hora_partida: daqui(3) },
    ];

    expect(ordenarMinhasCaronas(caronas, AGORA).map((carona) => carona.id)).toEqual([
      'hoje',
      'amanha',
      'cancelada-futura',
      'ontem-aberta',
      'passada',
    ]);
    expect(caronaEmAndamento(caronas[1], AGORA)).toBe(false);
  });
});

describe('selo dos status de carona', () => {
  it('cada status tem rótulo e ícone; CANCELADA é o mesmo selo da reserva', () => {
    expect(aparenciaSelo('ABERTA')).toMatchObject({ rotulo: 'Aberta', icone: 'lock-open-outline' });
    expect(aparenciaSelo('LOTADA')).toMatchObject({ rotulo: 'Lotada', icone: 'people' });
    expect(aparenciaSelo('CONCLUIDA')).toMatchObject({
      rotulo: 'Concluída',
      icone: 'flag-outline',
    });
    expect(aparenciaSelo('CANCELADA')).toMatchObject({
      rotulo: 'Cancelada',
      icone: 'close-circle',
    });
    expect(aparenciaSelo('PENDENTE').rotulo).toBe('Aguardando pagamento');
  });
});
