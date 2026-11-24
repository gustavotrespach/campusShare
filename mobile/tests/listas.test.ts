import {
  caronaEhProxima,
  nomeCurtoLocal,
  partidaPassada,
  reservaEhProxima,
  separarPorPartida,
  situacaoExibidaCarona,
  textoBotaoAnteriores,
} from '@/utils/listas';
import { aparenciaSelo } from '@/utils/selo-status';

const AGORA = new Date('2026-11-24T12:00:00Z');
const daqui = (horas: number) => new Date(AGORA.getTime() + horas * 3_600_000).toISOString();

describe('nomeCurtoLocal', () => {
  it('tira o sufixo de UF', () => {
    expect(nomeCurtoLocal('ULBRA Torres - RS')).toBe('ULBRA Torres');
    expect(nomeCurtoLocal('Rodoviária de Torres – RS')).toBe('Rodoviária de Torres');
    expect(nomeCurtoLocal('Torres, RS')).toBe('Torres');
  });

  it('mantém a vírgula do bairro e a cidade', () => {
    expect(nomeCurtoLocal('Centro, Passo de Torres - SC')).toBe('Centro, Passo de Torres');
    expect(nomeCurtoLocal('Rua da Praia, 100 — em frente à padaria')).toBe(
      'Rua da Praia, 100 — em frente à padaria',
    );
  });

  it('sem UF (ou com sigla que não é UF), fica como está, só sem espaços sobrando', () => {
    expect(nomeCurtoLocal('  ULBRA   Torres  ')).toBe('ULBRA Torres');
    expect(nomeCurtoLocal('Bloco B - AB')).toBe('Bloco B - AB');
    expect(nomeCurtoLocal('Centro')).toBe('Centro');
  });

  it('nunca devolve vazio', () => {
    expect(nomeCurtoLocal('- RS')).toBe('- RS');
  });
});

describe('partida e situação da carona', () => {
  it('na hora exata da partida a carona já partiu', () => {
    expect(partidaPassada(daqui(0), AGORA)).toBe(true);
    expect(partidaPassada(daqui(0.01), AGORA)).toBe(false);
  });

  it('ABERTA ou LOTADA com partida passada aparece como "Já partiu"; o resto, como está', () => {
    expect(situacaoExibidaCarona({ status: 'ABERTA', data_hora_partida: daqui(-1) }, AGORA)).toBe(
      'JA_PARTIU',
    );
    expect(situacaoExibidaCarona({ status: 'LOTADA', data_hora_partida: daqui(-1) }, AGORA)).toBe(
      'JA_PARTIU',
    );
    expect(situacaoExibidaCarona({ status: 'ABERTA', data_hora_partida: daqui(1) }, AGORA)).toBe(
      'ABERTA',
    );
    expect(
      situacaoExibidaCarona({ status: 'CANCELADA', data_hora_partida: daqui(-1) }, AGORA),
    ).toBe('CANCELADA');
    expect(
      situacaoExibidaCarona({ status: 'CONCLUIDA', data_hora_partida: daqui(-1) }, AGORA),
    ).toBe('CONCLUIDA');
    expect(aparenciaSelo('JA_PARTIU')).toMatchObject({
      rotulo: 'Já partiu',
      icone: 'exit-outline',
    });
  });
});

describe('próximas e anteriores', () => {
  it('carona próxima: ABERTA/LOTADA e futura', () => {
    expect(caronaEhProxima({ status: 'LOTADA', data_hora_partida: daqui(2) }, AGORA)).toBe(true);
    expect(caronaEhProxima({ status: 'ABERTA', data_hora_partida: daqui(-2) }, AGORA)).toBe(false);
    expect(caronaEhProxima({ status: 'CANCELADA', data_hora_partida: daqui(2) }, AGORA)).toBe(
      false,
    );
    expect(caronaEhProxima({ status: 'CONCLUIDA', data_hora_partida: daqui(2) }, AGORA)).toBe(
      false,
    );
  });

  it('reserva próxima: PENDENTE/CONFIRMADA com a carona ativa e futura', () => {
    const base = { status_carona: 'ABERTA' as const, data_hora_partida: daqui(2) };
    expect(reservaEhProxima({ ...base, status_reserva: 'PENDENTE' }, AGORA)).toBe(true);
    expect(reservaEhProxima({ ...base, status_reserva: 'CONFIRMADA' }, AGORA)).toBe(true);
    expect(reservaEhProxima({ ...base, status_reserva: 'CANCELADA' }, AGORA)).toBe(false);
    expect(reservaEhProxima({ ...base, status_reserva: 'EXPIRADA' }, AGORA)).toBe(false);
    expect(
      reservaEhProxima(
        { ...base, status_reserva: 'CONFIRMADA', status_carona: 'CANCELADA' },
        AGORA,
      ),
    ).toBe(false);
    expect(
      reservaEhProxima(
        { ...base, status_reserva: 'CONFIRMADA', data_hora_partida: daqui(-1) },
        AGORA,
      ),
    ).toBe(false);
  });

  it('próximas da mais perto para a mais distante; anteriores da mais recente para a mais antiga', () => {
    const itens = [
      { id: 'semana-passada', status: 'CONCLUIDA' as const, data_hora_partida: daqui(-170) },
      { id: 'amanha', status: 'ABERTA' as const, data_hora_partida: daqui(24) },
      { id: 'ontem', status: 'ABERTA' as const, data_hora_partida: daqui(-20) },
      { id: 'cancelada-futura', status: 'CANCELADA' as const, data_hora_partida: daqui(48) },
      { id: 'daqui-a-pouco', status: 'LOTADA' as const, data_hora_partida: daqui(1) },
    ];

    const { proximas, anteriores } = separarPorPartida(itens, (item) =>
      caronaEhProxima(item, AGORA),
    );

    expect(proximas.map((item) => item.id)).toEqual(['daqui-a-pouco', 'amanha']);
    expect(anteriores.map((item) => item.id)).toEqual([
      'cancelada-futura',
      'ontem',
      'semana-passada',
    ]);
  });

  it('texto do botão das anteriores', () => {
    expect(textoBotaoAnteriores(3, false)).toBe('Ver anteriores (3)');
    expect(textoBotaoAnteriores(3, true)).toBe('Ocultar anteriores');
  });
});
