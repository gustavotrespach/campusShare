// Detalhe da carona com o "Cancelar carona" do motorista (T28): quando o botão aparece, a
// confirmação, o sucesso com a contagem e o recarregamento, e o erro com o hint do backend.
import { Alert, AccessibilityInfo, type AlertButton } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { useLocalSearchParams } from 'expo-router';

import TelaDetalheCarona from '../app/(autenticado)/caronas/[id]';
import { cancelarCarona, detalharCarona, type CaronaDetalhe } from '@/services/caronas';
import { AppError } from '@/services/erros';

jest.mock('expo-router', () => require('./apoio/expo-router-falso'));
jest.mock(
  'react-native-safe-area-context',
  () => require('react-native-safe-area-context/jest/mock').default,
);
jest.mock('@/services/caronas', () => ({ cancelarCarona: jest.fn(), detalharCarona: jest.fn() }));
jest.mock('@/services/reservas', () => ({ reservarVaga: jest.fn() }));

const daqui = (horas: number) => new Date(Date.now() + horas * 3_600_000).toISOString();

function detalhe(alteracoes: Partial<CaronaDetalhe> = {}): CaronaDetalhe {
  return {
    id_carona: 'c1',
    origem: 'Centro, Torres - RS',
    origem_lat: -29.3353,
    origem_lng: -49.7268,
    destino: 'ULBRA Torres - RS',
    destino_lat: -29.329,
    destino_lng: -49.7365,
    data_hora_partida: daqui(24),
    vagas_disponiveis: 1,
    vagas_ofertadas: 3,
    tolerancia_min: 10,
    somente_mulheres: false,
    status: 'ABERTA',
    nome_motorista: 'Ana Souza',
    modelo: 'Onix',
    cor: 'Prata',
    placa: 'IYK4B21',
    sou_motorista: true,
    // Reputação do motorista (T30); a tela ainda não mostra (Fase 34)
    media_motorista: 4.3,
    total_avaliacoes_motorista: 3,
    valorPorPassageiroCentavos: 600,
    custoTotalCentavos: 2400,
    ...alteracoes,
  };
}

function responderAlerta(texto: string) {
  return jest.spyOn(Alert, 'alert').mockImplementation((_titulo, _mensagem, botoes) => {
    (botoes as AlertButton[]).find((botao) => botao.text === texto)?.onPress?.();
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.restoreAllMocks();
  jest.mocked(useLocalSearchParams).mockReturnValue({ id: 'c1' });
});

describe('Cancelar carona (detalhe da carona)', () => {
  it('motorista confirma, a carona é cancelada com a contagem e a tela recarrega CANCELADA', async () => {
    jest
      .mocked(detalharCarona)
      .mockResolvedValueOnce(detalhe())
      .mockResolvedValueOnce(detalhe({ status: 'CANCELADA' }));
    jest.mocked(cancelarCarona).mockResolvedValue(2);
    const alerta = responderAlerta('Cancelar carona');
    const anuncio = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    await render(<TelaDetalheCarona />);

    await fireEvent.press(await screen.findByRole('button', { name: /Cancelar carona/ }));

    expect(alerta).toHaveBeenCalledWith(
      'Cancelar carona',
      'Todas as reservas desta carona serão canceladas. Quem já pagou fica com o reembolso registrado.',
      expect.any(Array),
    );
    expect(cancelarCarona).toHaveBeenCalledWith('c1');
    expect(await screen.findByText('Carona cancelada. 2 reservas canceladas.')).toBeOnTheScreen();
    expect(await screen.findByText('Situação: Cancelada.')).toBeOnTheScreen();
    expect(detalharCarona).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole('button', { name: /Cancelar carona/ })).toBeNull();
    expect(anuncio).toHaveBeenCalledWith('Carona cancelada. 2 reservas canceladas.');
  });

  it('erro do backend aparece com o hint e a carona continua', async () => {
    jest.mocked(detalharCarona).mockResolvedValue(detalhe({ status: 'LOTADA' }));
    jest
      .mocked(cancelarCarona)
      .mockRejectedValue(
        new AppError(
          409,
          'CANCELAMENTO_ENCERRADO',
          'Esta carona já partiu ou foi encerrada; não dá mais para cancelar.',
        ),
      );
    responderAlerta('Cancelar carona');
    await render(<TelaDetalheCarona />);

    await fireEvent.press(await screen.findByRole('button', { name: /Cancelar carona/ }));

    expect(
      await screen.findByText('Esta carona já partiu ou foi encerrada; não dá mais para cancelar.'),
    ).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: /Cancelar carona/ })).toBeOnTheScreen();
  });

  it.each([
    ['passageiro', { sou_motorista: false }],
    ['carona CANCELADA', { status: 'CANCELADA' as const }],
    ['carona CONCLUIDA', { status: 'CONCLUIDA' as const }],
    ['partida já passou', { data_hora_partida: daqui(-1) }],
  ])('sem botão: %s', async (_caso, alteracoes) => {
    jest.mocked(detalharCarona).mockResolvedValue(detalhe(alteracoes));
    await render(<TelaDetalheCarona />);

    expect(await screen.findByText('Valor por passageiro')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: /Cancelar carona/ })).toBeNull();
  });

  it.each([
    ['ABERTA', 'ABERTA' as const],
    ['LOTADA', 'LOTADA' as const],
  ])(
    'carona %s com a partida no passado aparece como "Já partiu" (só exibição)',
    async (_s, status) => {
      jest
        .mocked(detalharCarona)
        .mockResolvedValue(detalhe({ status, sou_motorista: false, data_hora_partida: daqui(-2) }));
      await render(<TelaDetalheCarona />);

      expect(await screen.findByText('Situação: Já partiu.')).toBeOnTheScreen();
      expect(screen.queryByText(/Situação: (Aberta|Lotada)/)).toBeNull();
      expect(cancelarCarona).not.toHaveBeenCalled();
    },
  );

  it('carona ABERTA e futura não mostra situação', async () => {
    jest.mocked(detalharCarona).mockResolvedValue(detalhe({ sou_motorista: false }));
    await render(<TelaDetalheCarona />);

    expect(await screen.findByText('Valor por passageiro')).toBeOnTheScreen();
    expect(screen.queryByText(/^Situação:/)).toBeNull();
  });
});
