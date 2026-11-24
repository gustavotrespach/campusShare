// T43 — componentes da tela inicial: "Sua próxima viagem" (reserva x carona própria) e o card de
// carona com a nota do motorista.
import { fireEvent, render, screen } from '@testing-library/react-native';

import { ItemCarona } from '@/components/ItemCarona';
import { ProximaViagem } from '@/components/ProximaViagem';
import type { CaronaResumo, MinhaCarona } from '@/services/caronas';
import type { MinhaReserva } from '@/services/reservas';

// Quarta-feira, 25/11/2026, 12:00 em Brasília
const AGORA = new Date('2026-11-25T15:00:00Z');

const RESERVA = {
  id_reserva: 'r1',
  status_reserva: 'CONFIRMADA',
  status_carona: 'ABERTA',
  status_pagamento: 'APROVADO',
  data_hora_partida: '2026-11-26T12:00:00Z',
  origem: 'Centro, Torres - RS',
  destino: 'ULBRA Torres - RS',
  nome_motorista: 'Marcos',
  media_motorista: 4,
  total_avaliacoes_motorista: 1,
  valorCentavos: 600,
} as MinhaReserva;

const CARONA = {
  id_carona: 'c1',
  status: 'LOTADA',
  data_hora_partida: '2026-11-25T20:00:00Z',
  origem: 'Centro, Torres - RS',
  destino: 'Praia Grande, Torres - RS',
  vagas_disponiveis: 0,
  vagas_ofertadas: 3,
} as MinhaCarona;

describe('ProximaViagem', () => {
  it('reserva: destino e dia relativo, motorista com a nota, selo da reserva; toque abre', async () => {
    const aoAbrir = jest.fn();
    await render(
      <ProximaViagem
        viagem={{ tipo: 'RESERVA', reserva: RESERVA }}
        aoAbrir={aoAbrir}
        agora={AGORA}
      />,
    );

    expect(screen.getByText('Sua próxima viagem')).toBeOnTheScreen();
    expect(screen.getByText('Para ULBRA Torres · amanhã 09:00')).toBeOnTheScreen();
    expect(screen.getByText('com Marcos')).toBeOnTheScreen();
    expect(screen.getByText('4,0')).toBeOnTheScreen();
    expect(screen.getByText('Confirmada')).toBeOnTheScreen();
    const card = screen.getByRole('button', {
      name: 'Sua próxima viagem, Para ULBRA Torres, amanhã às 09:00, com Marcos, nota média 4,0, Confirmada',
    });
    expect(card).toHaveProp('accessibilityHint', 'Abre a sua reserva');

    await fireEvent.press(card);
    expect(aoAbrir).toHaveBeenCalledTimes(1);
  });

  it('reserva com motorista sem avaliações: sem estrela nem nota', async () => {
    await render(
      <ProximaViagem
        viagem={{
          tipo: 'RESERVA',
          reserva: { ...RESERVA, media_motorista: null, total_avaliacoes_motorista: 0 },
        }}
        aoAbrir={jest.fn()}
        agora={AGORA}
      />,
    );

    expect(screen.getByText('com Marcos')).toBeOnTheScreen();
    expect(screen.queryByText(/^\d,\d$/)).toBeNull();
    expect(
      screen.getByRole('button', {
        name: 'Sua próxima viagem, Para ULBRA Torres, amanhã às 09:00, com Marcos, Confirmada',
      }),
    ).toBeOnTheScreen();
  });

  it('carona própria: "Você dirige · N de M vagas livres" e o selo da carona', async () => {
    const aoAbrir = jest.fn();
    await render(
      <ProximaViagem viagem={{ tipo: 'CARONA', carona: CARONA }} aoAbrir={aoAbrir} agora={AGORA} />,
    );

    expect(screen.getByText('Para Praia Grande, Torres · hoje 17:00')).toBeOnTheScreen();
    expect(screen.getByText('Você dirige · 0 de 3 vagas livres')).toBeOnTheScreen();
    expect(screen.getByText('Lotada')).toBeOnTheScreen();
    const card = screen.getByRole('button', {
      name: 'Sua próxima viagem, Para Praia Grande, Torres, hoje às 17:00, Você dirige · 0 de 3 vagas livres, Lotada',
    });
    expect(card).toHaveProp('accessibilityHint', 'Abre os detalhes da sua carona');

    await fireEvent.press(card);
    expect(aoAbrir).toHaveBeenCalledTimes(1);
  });
});

describe('ItemCarona (card da tela inicial)', () => {
  const carona: CaronaResumo = {
    id_carona: 'c1',
    data_hora_partida: '2026-11-25T20:00:00Z',
    origem: 'Centro, Torres - RS',
    destino: 'ULBRA Torres - RS',
    origem_lat: -29.3353,
    origem_lng: -49.7268,
    destino_lat: -29.329,
    destino_lng: -49.7365,
    distancia_km: 0.4,
    nome_motorista: 'Bruno',
    modelo: 'Onix',
    cor: 'Prata',
    somente_mulheres: false,
    tolerancia_min: 10,
    vagas_disponiveis: 2,
    valorPorPassageiroCentavos: 600,
    media_motorista: 4.3,
    total_avaliacoes_motorista: 3,
    foto_motorista: null,
  };

  beforeAll(() => {
    jest.useFakeTimers({ now: AGORA, advanceTimers: true });
  });
  afterAll(() => {
    jest.useRealTimers();
  });

  it('título "Para <destino>", origem com distância, hora, vagas, valor e motorista com a nota', async () => {
    const aoAbrir = jest.fn();
    await render(<ItemCarona carona={carona} aoAbrir={aoAbrir} />);

    expect(screen.getByText('Para ULBRA Torres')).toBeOnTheScreen();
    expect(screen.getByText('Saindo de Centro, Torres · a 0,4 km')).toBeOnTheScreen();
    expect(screen.getByText('17:00')).toBeOnTheScreen();
    expect(screen.getByText('2 vagas')).toBeOnTheScreen();
    expect(screen.getByText('R$ 6,00')).toBeOnTheScreen();
    expect(screen.getByText('Bruno')).toBeOnTheScreen();
    expect(screen.getByText('4,3')).toBeOnTheScreen();
    expect(screen.getByText('Onix prata')).toBeOnTheScreen();

    // Uma frase só para o leitor de tela
    const card = screen.getByRole('button', {
      name:
        'Para ULBRA Torres, saindo de Centro, Torres, a 0,4 km, hoje às 17:00, R$ 6,00 por pessoa, ' +
        '2 vagas, motorista Bruno, nota média 4,3',
    });
    await fireEvent.press(card);
    expect(aoAbrir).toHaveBeenCalledTimes(1);
  });

  it('motorista sem avaliações: nenhuma estrela nem nota', async () => {
    await render(
      <ItemCarona
        carona={{ ...carona, media_motorista: null, total_avaliacoes_motorista: 0 }}
        aoAbrir={jest.fn()}
      />,
    );

    expect(screen.getByText('Bruno')).toBeOnTheScreen();
    expect(screen.queryByText(/^\d,\d$/)).toBeNull();
    expect(screen.getByRole('button', { name: /motorista Bruno$/ })).toBeOnTheScreen();
  });

  it('somente mulheres: selo no card e no fim da frase', async () => {
    await render(<ItemCarona carona={{ ...carona, somente_mulheres: true }} aoAbrir={jest.fn()} />);

    expect(screen.getByText('Somente mulheres')).toBeOnTheScreen();
    expect(
      screen.getByRole('button', { name: /nota média 4,3, somente mulheres$/ }),
    ).toBeOnTheScreen();
  });
});
