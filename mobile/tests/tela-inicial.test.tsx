// Caronas próximas com a barra de busca de local (T40). A busca de caronas, o perfil e a
// localização são falsos: o teste confere com que coordenada a tela chama a buscar_caronas.
import { fireEvent, render, screen } from '@testing-library/react-native';

import TelaCaronasProximas from '../app/(autenticado)/index';
import { buscarCaronas, type CaronaResumo } from '@/services/caronas';
import { AppError } from '@/services/erros';
import { localizarEndereco, obterLocalizacaoAtual } from '@/services/localizacao';
import { pontoPorId } from '@/utils/pontos';

jest.mock('expo-router', () => require('./apoio/expo-router-falso'));
jest.mock(
  'react-native-safe-area-context',
  () => require('react-native-safe-area-context/jest/mock').default,
);
jest.mock('@/services/caronas', () => ({ buscarCaronas: jest.fn() }));
jest.mock('@/services/perfil', () => ({
  obterMeuPerfil: jest.fn(async () => ({ nome_completo: 'Ana Souza', genero: 'FEMININO' })),
}));
jest.mock('@/services/localizacao', () => ({
  localizarEndereco: jest.fn(),
  obterLocalizacaoAtual: jest.fn(),
}));

const CARONA: CaronaResumo = {
  id_carona: 'c1',
  data_hora_partida: '2026-11-25T15:30:00Z',
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
};

const CENTRO = pontoPorId('centro-torres')!;
const ARROIO = pontoPorId('arroio-do-sal')!;

function buscouEm(latitude: number, longitude: number) {
  expect(buscarCaronas).toHaveBeenLastCalledWith(expect.objectContaining({ latitude, longitude }));
}

async function abrirTela() {
  await render(<TelaCaronasProximas />);
  // A primeira busca usa o ponto padrão (Centro de Torres), como antes da barra
  expect(await screen.findByText('Caronas perto de: Centro de Torres')).toBeOnTheScreen();
  await screen.findByText('1 carona · as mais perto primeiro');
  buscouEm(CENTRO.latitude, CENTRO.longitude);
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(buscarCaronas).mockResolvedValue([CARONA]);
});

describe('Caronas próximas: barra de busca de local (tela 5)', () => {
  it('mostra a barra com placeholder, "Minha localização" e nenhum chip "Perto de"', async () => {
    await abrirTela();

    const barra = screen.getByLabelText('Buscar local');
    expect(barra).toHaveProp('placeholder', 'Buscar perto de… (bairro, rua ou cidade)');
    expect(screen.getByRole('button', { name: 'Minha localização' })).toBeOnTheScreen();
    expect(screen.queryByText('Perto de')).toBeNull();
    expect(screen.queryAllByRole('radio')).toHaveLength(0);
  });

  it('com foco, sugere "Minha localização" e os pontos; o texto filtra sem acento', async () => {
    await abrirTela();
    const barra = screen.getByLabelText('Buscar local');

    await fireEvent(barra, 'focus');
    expect(
      screen.getByRole('button', { name: 'Minha localização, Usa o GPS do celular' }),
    ).toBeOnTheScreen();
    expect(
      screen.getByRole('button', { name: 'ULBRA Torres, ULBRA Torres - RS' }),
    ).toBeOnTheScreen();
    expect(
      screen.getByRole('button', { name: 'Arroio do Sal, Centro, Arroio do Sal - RS' }),
    ).toBeOnTheScreen();

    await fireEvent.changeText(barra, 'TRES');
    expect(
      screen.getByRole('button', { name: 'Três Cachoeiras, Centro, Três Cachoeiras - RS' }),
    ).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: /^ULBRA Torres,/ })).toBeNull();
    expect(screen.getByRole('button', { name: /^Buscar “TRES”/ })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Limpar busca' })).toBeOnTheScreen();
  });

  it('tocar numa sugestão busca pelas coordenadas do ponto, sem geocodificar', async () => {
    await abrirTela();

    await fireEvent(screen.getByLabelText('Buscar local'), 'focus');
    await fireEvent.press(
      screen.getByRole('button', { name: 'Arroio do Sal, Centro, Arroio do Sal - RS' }),
    );

    expect(await screen.findByText('Caronas perto de: Arroio do Sal')).toBeOnTheScreen();
    buscouEm(ARROIO.latitude, ARROIO.longitude);
    expect(localizarEndereco).not.toHaveBeenCalled();
  });

  it('texto livre confirmado no teclado é geocodificado e vira o centro da busca', async () => {
    jest.mocked(localizarEndereco).mockResolvedValue({ latitude: -29.1912, longitude: -49.9512 });
    await abrirTela();
    const barra = screen.getByLabelText('Buscar local');

    await fireEvent.changeText(barra, 'Praia Grande');
    await fireEvent(barra, 'submitEditing');

    expect(localizarEndereco).toHaveBeenCalledWith('Praia Grande');
    expect(await screen.findByText('Caronas perto de: Praia Grande')).toBeOnTheScreen();
    buscouEm(-29.1912, -49.9512);
  });

  it('o nome inteiro de um ponto fixo usa o ponto, sem geocodificar', async () => {
    await abrirTela();
    const barra = screen.getByLabelText('Buscar local');

    await fireEvent.changeText(barra, 'arroio do sal');
    await fireEvent(barra, 'submitEditing');

    expect(await screen.findByText('Caronas perto de: Arroio do Sal')).toBeOnTheScreen();
    expect(localizarEndereco).not.toHaveBeenCalled();
  });

  it('local não encontrado mostra o Aviso e mantém a lista e o centro anteriores', async () => {
    jest
      .mocked(localizarEndereco)
      .mockRejectedValue(
        new AppError(
          404,
          'LOCAL_NAO_ENCONTRADO',
          'Não encontramos esse lugar. Tente o bairro e a cidade.',
        ),
      );
    await abrirTela();
    const chamadasAntes = jest.mocked(buscarCaronas).mock.calls.length;
    const barra = screen.getByLabelText('Buscar local');

    await fireEvent.changeText(barra, 'Xyzzy');
    await fireEvent(barra, 'submitEditing');

    expect(
      await screen.findByText('Não encontramos esse lugar. Tente o bairro e a cidade.'),
    ).toBeOnTheScreen();
    expect(screen.getByText('Caronas perto de: Centro de Torres')).toBeOnTheScreen();
    expect(screen.getByText('1 carona · as mais perto primeiro')).toBeOnTheScreen();
    expect(screen.getByLabelText('Buscar local')).toHaveDisplayValue('Xyzzy');
    expect(buscarCaronas).toHaveBeenCalledTimes(chamadasAntes);
  });

  it('"Minha localização" pede a localização só no toque e busca por ela', async () => {
    jest
      .mocked(obterLocalizacaoAtual)
      .mockResolvedValue({ latitude: -29.3301, longitude: -49.7302 });
    await abrirTela();
    expect(obterLocalizacaoAtual).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByRole('button', { name: 'Minha localização' }));

    expect(await screen.findByText('Caronas perto de: sua localização')).toBeOnTheScreen();
    buscouEm(-29.3301, -49.7302);
  });
});
