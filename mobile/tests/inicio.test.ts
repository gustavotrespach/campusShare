// T43 — tela inicial: cabeçalhos "Hoje"/"Amanhã"/"sex 27/11" no dia de Brasília, agrupamento das
// caronas por dia, escolha da "Sua próxima viagem" e os textos do card e do estado vazio.
import { descreverQuandoRelativo, formatarQuandoRelativo, rotuloDia } from '@/utils/data-hora';
import { descreverCarona } from '@/utils/exibicao-carona';
import {
  agruparPorDia,
  escolherProximaViagem,
  textoVoceDirige,
  tituloSemCaronas,
  type CaronaParaProxima,
  type ReservaParaProxima,
} from '@/utils/inicio';

// Quarta-feira, 25/11/2026, 12:00 em Brasília
const AGORA = new Date('2026-11-25T15:00:00Z');

const partida = (id: string, data_hora_partida: string) => ({ id, data_hora_partida });

describe('rotuloDia e quando relativo (dia de Brasília)', () => {
  it('"Hoje", "Amanhã" e, depois, o dia curto', () => {
    expect(rotuloDia('2026-11-25T20:00:00Z', AGORA)).toBe('Hoje');
    expect(rotuloDia('2026-11-26T12:00:00Z', AGORA)).toBe('Amanhã');
    expect(rotuloDia('2026-11-27T11:00:00Z', AGORA)).toBe('sex 27/11');
    expect(rotuloDia('2026-12-02T11:00:00Z', AGORA)).toBe('qua 02/12');
  });

  it('meia-noite de Brasília, não de UTC: 23:30 de hoje continua "Hoje" e 00:30 já é "Amanhã"', () => {
    // 02:30 UTC do dia 26 = 23:30 de Brasília do dia 25
    expect(rotuloDia('2026-11-26T02:30:00Z', AGORA)).toBe('Hoje');
    // 03:30 UTC do dia 26 = 00:30 de Brasília do dia 26
    expect(rotuloDia('2026-11-26T03:30:00Z', AGORA)).toBe('Amanhã');
  });

  it('"agora" depois das 21:00 de Brasília (UTC já virou o dia)', () => {
    // 22:00 de Brasília do dia 25 = 01:00 UTC do dia 26
    const noite = new Date('2026-11-26T01:00:00Z');
    expect(rotuloDia('2026-11-26T02:30:00Z', noite)).toBe('Hoje');
    // Mesmo dia UTC do "agora", mas 01:00 do dia 26 em Brasília
    expect(rotuloDia('2026-11-26T04:00:00Z', noite)).toBe('Amanhã');
    // 23:00 de Brasília do dia 26 = 02:00 UTC do dia 27
    expect(rotuloDia('2026-11-27T02:00:00Z', noite)).toBe('Amanhã');
    expect(rotuloDia('2026-11-27T03:00:00Z', noite)).toBe('sex 27/11');
  });

  it('card "Sua próxima viagem": "hoje 17:00", "amanhã 09:00", "sex 27/11 08:00"', () => {
    expect(formatarQuandoRelativo('2026-11-25T20:00:00Z', AGORA)).toBe('hoje 17:00');
    expect(formatarQuandoRelativo('2026-11-26T12:00:00Z', AGORA)).toBe('amanhã 09:00');
    expect(formatarQuandoRelativo('2026-11-27T11:00:00Z', AGORA)).toBe('sex 27/11 08:00');
    expect(descreverQuandoRelativo('2026-11-25T20:00:00Z', AGORA)).toBe('hoje às 17:00');
    expect(descreverQuandoRelativo('2026-11-27T11:00:00Z', AGORA)).toBe('sex 27/11 às 08:00');
  });
});

describe('agruparPorDia', () => {
  it('grupos em ordem cronológica e, dentro de cada um, por horário', () => {
    // A busca devolve pela distância: a ordem de entrada não é a do tempo
    const caronas = [
      partida('dez', '2026-12-02T11:00:00Z'),
      partida('amanha-9h', '2026-11-26T12:00:00Z'),
      partida('hoje-23h30', '2026-11-26T02:30:00Z'),
      partida('sexta', '2026-11-27T11:00:00Z'),
      partida('amanha-0h30', '2026-11-26T03:30:00Z'),
      partida('hoje-17h', '2026-11-25T20:00:00Z'),
    ];

    const grupos = agruparPorDia(caronas, AGORA);

    expect(
      grupos.map(({ chave, titulo, itens }) => [chave, titulo, itens.map((c) => c.id)]),
    ).toEqual([
      ['2026-11-25', 'Hoje', ['hoje-17h', 'hoje-23h30']],
      ['2026-11-26', 'Amanhã', ['amanha-0h30', 'amanha-9h']],
      ['2026-11-27', 'sex 27/11', ['sexta']],
      ['2026-12-02', 'qua 02/12', ['dez']],
    ]);
  });

  it('empate de horário mantém a ordem da busca (a mais perto primeiro); não altera a entrada', () => {
    const caronas = [
      partida('perto', '2026-11-25T20:00:00Z'),
      partida('longe', '2026-11-25T20:00:00Z'),
    ];

    expect(agruparPorDia(caronas, AGORA)[0]?.itens.map((c) => c.id)).toEqual(['perto', 'longe']);
    expect(caronas.map((c) => c.id)).toEqual(['perto', 'longe']);
  });

  it('lista vazia: nenhum grupo', () => {
    expect(agruparPorDia([], AGORA)).toEqual([]);
  });
});

describe('escolherProximaViagem', () => {
  const reserva = (
    id: string,
    data_hora_partida: string,
    status_reserva: ReservaParaProxima['status_reserva'] = 'CONFIRMADA',
    status_carona: ReservaParaProxima['status_carona'] = 'ABERTA',
  ): ReservaParaProxima => ({ id_reserva: id, status_reserva, status_carona, data_hora_partida });
  const carona = (
    id: string,
    data_hora_partida: string,
    status: CaronaParaProxima['status'] = 'ABERTA',
  ): CaronaParaProxima => ({ id_carona: id, status, data_hora_partida });

  it('só reservas: a de partida mais próxima', () => {
    const escolha = escolherProximaViagem(
      [
        reserva('depois', '2026-11-27T11:00:00Z'),
        reserva('antes', '2026-11-26T12:00:00Z', 'PENDENTE'),
      ],
      [],
      AGORA,
    );
    expect(escolha).toEqual({
      tipo: 'RESERVA',
      reserva: expect.objectContaining({ id_reserva: 'antes' }),
    });
  });

  it('a carona própria vence quando parte antes da reserva', () => {
    const escolha = escolherProximaViagem(
      [reserva('r', '2026-11-27T11:00:00Z')],
      [carona('c', '2026-11-26T12:00:00Z', 'LOTADA')],
      AGORA,
    );
    expect(escolha).toEqual({
      tipo: 'CARONA',
      carona: expect.objectContaining({ id_carona: 'c' }),
    });
  });

  it('a reserva vence quando parte antes da carona própria; no empate, a reserva', () => {
    expect(
      escolherProximaViagem(
        [reserva('r', '2026-11-26T12:00:00Z')],
        [carona('c', '2026-11-27T11:00:00Z')],
        AGORA,
      )?.tipo,
    ).toBe('RESERVA');
    expect(
      escolherProximaViagem(
        [reserva('r', '2026-11-26T12:00:00Z')],
        [carona('c', '2026-11-26T12:00:00Z')],
        AGORA,
      )?.tipo,
    ).toBe('RESERVA');
  });

  it('ignora o que não é "próxima" (T41): passada, cancelada, expirada, concluída', () => {
    const escolha = escolherProximaViagem(
      [
        reserva('passada', '2026-11-25T14:00:00Z'),
        reserva('cancelada', '2026-11-26T12:00:00Z', 'CANCELADA'),
        reserva('expirada', '2026-11-26T12:00:00Z', 'EXPIRADA'),
        reserva('carona-cancelada', '2026-11-26T12:00:00Z', 'CONFIRMADA', 'CANCELADA'),
      ],
      [
        carona('concluida', '2026-11-26T12:00:00Z', 'CONCLUIDA'),
        carona('ja-partiu', '2026-11-25T14:59:00Z'),
        carona('valida', '2026-11-28T11:00:00Z'),
      ],
      AGORA,
    );
    expect(escolha).toEqual({
      tipo: 'CARONA',
      carona: expect.objectContaining({ id_carona: 'valida' }),
    });
  });

  it('nenhuma reserva ou carona ativa: null (o card não aparece)', () => {
    expect(escolherProximaViagem([], [], AGORA)).toBeNull();
    expect(
      escolherProximaViagem([reserva('passada', '2026-11-24T11:00:00Z')], [], AGORA),
    ).toBeNull();
  });
});

describe('textos do card e do estado vazio', () => {
  it('"Você dirige · N de M vagas livres"', () => {
    expect(textoVoceDirige({ vagas_disponiveis: 2, vagas_ofertadas: 3 })).toBe(
      'Você dirige · 2 de 3 vagas livres',
    );
  });

  it('"Nenhuma carona perto de <local>"', () => {
    expect(tituloSemCaronas('Centro de Torres')).toBe('Nenhuma carona perto de Centro de Torres');
    expect(tituloSemCaronas(null)).toBe('Nenhuma carona por aqui');
  });
});

describe('descreverCarona (leitor de tela lê o card numa frase)', () => {
  const carona = {
    data_hora_partida: '2026-11-25T20:00:00Z',
    origem: 'Centro, Torres - RS',
    destino: 'ULBRA Torres - RS',
    distancia_km: 0.4,
    valorPorPassageiroCentavos: 600,
    vagas_disponiveis: 2,
    nome_motorista: 'Bruno',
    media_motorista: 4,
    somente_mulheres: false,
  };

  it('com a nota do motorista', () => {
    expect(descreverCarona(carona, AGORA)).toBe(
      'Para ULBRA Torres, saindo de Centro, Torres, a 0,4 km, hoje às 17:00, R$ 6,00 por pessoa, ' +
        '2 vagas, motorista Bruno, nota média 4,0',
    );
  });

  it('sem avaliações, sem nota; somente mulheres no fim', () => {
    expect(
      descreverCarona(
        { ...carona, media_motorista: null, somente_mulheres: true, vagas_disponiveis: 1 },
        AGORA,
      ),
    ).toBe(
      'Para ULBRA Torres, saindo de Centro, Torres, a 0,4 km, hoje às 17:00, R$ 6,00 por pessoa, ' +
        '1 vaga, motorista Bruno, somente mulheres',
    );
  });
});
