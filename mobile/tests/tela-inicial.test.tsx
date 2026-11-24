// Caronas próximas com a barra de busca de local (T40) e o Início da T43 (próxima viagem, grupos por
// dia, estado vazio). A busca de caronas, o perfil, a próxima viagem e a localização são falsos: o
// teste confere com que coordenada a tela chama a buscar_caronas.
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet, TextInput, type StyleProp, type ViewStyle } from 'react-native';
import type { ReactTestRendererJSON } from 'react-test-renderer';

import { router } from 'expo-router';

import TelaCaronasProximas from '../app/(autenticado)/index';
import { listarAvaliacoesPendentes, type AvaliacaoPendente } from '@/services/avaliacoes';
import { buscarCaronas, type CaronaResumo } from '@/services/caronas';
import { AppError } from '@/services/erros';
import { localizarEndereco, obterLocalizacaoAtual } from '@/services/localizacao';
import { obterProximaViagem } from '@/services/proxima-viagem';
import type { MinhaCarona } from '@/services/caronas';
import type { MinhaReserva } from '@/services/reservas';
import { tema } from '@/tema';
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
jest.mock('@/services/avaliacoes', () => ({ listarAvaliacoesPendentes: jest.fn() }));
jest.mock('@/services/proxima-viagem', () => ({ obterProximaViagem: jest.fn() }));
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
  media_motorista: 4,
  total_avaliacoes_motorista: 1,
  foto_motorista: null,
};

const cardsDeCarona = () => screen.queryAllByRole('button', { name: /^Para .*motorista/ });

const CENTRO = pontoPorId('centro-torres')!;
const ARROIO = pontoPorId('arroio-do-sal')!;

function buscouEm(latitude: number, longitude: number) {
  expect(buscarCaronas).toHaveBeenLastCalledWith(expect.objectContaining({ latitude, longitude }));
}

async function abrirTela() {
  await render(<TelaCaronasProximas />);
  // A primeira busca usa o ponto padrão (Centro de Torres), como antes da barra
  expect(await screen.findByText('Caronas perto de: Centro de Torres')).toBeOnTheScreen();
  expect(await screen.findByRole('button', { name: /^Para ULBRA Torres,/ })).toBeOnTheScreen();
  buscouEm(CENTRO.latitude, CENTRO.longitude);
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(buscarCaronas).mockResolvedValue([CARONA]);
  jest.mocked(listarAvaliacoesPendentes).mockResolvedValue([]);
  jest.mocked(obterProximaViagem).mockResolvedValue(null);
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
    expect(cardsDeCarona()).toHaveLength(1);
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

describe('Caronas próximas: avaliações pendentes (T30)', () => {
  const PENDENTE = {
    id_reserva: 'r1',
    papel: 'PASSAGEIRO',
    nome_avaliado: 'Marcos',
    origem: 'Centro, Torres - RS',
    destino: 'ULBRA Torres - RS',
    data_hora_partida: '2026-11-23T12:00:00Z',
    avaliar_ate: '2026-11-30T12:00:00Z',
  } as AvaliacaoPendente;

  it('com pendências, mostra o aviso com "Avaliar"', async () => {
    jest
      .mocked(listarAvaliacoesPendentes)
      .mockResolvedValue([PENDENTE, { ...PENDENTE, id_reserva: 'r2' }]);
    await abrirTela();

    expect(await screen.findByText('Você tem 2 avaliações pendentes.')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Avaliar' }));
    expect(router.push).toHaveBeenCalledWith('/avaliacoes');
  });

  it('sem pendências, nada aparece', async () => {
    await abrirTela();

    expect(listarAvaliacoesPendentes).toHaveBeenCalled();
    expect(screen.queryByText(/avaliaç(ão|ões) pendente/)).toBeNull();
  });

  it('se a consulta falhar, o aviso só não aparece (sem erro na tela)', async () => {
    jest.mocked(listarAvaliacoesPendentes).mockRejectedValue(new Error('rede'));
    await abrirTela();

    expect(listarAvaliacoesPendentes).toHaveBeenCalled();
    expect(screen.queryByText(/avaliaç(ão|ões) pendente/)).toBeNull();
    expect(screen.queryByText('rede')).toBeNull();
  });
});

type No = ReactTestRendererJSON | string;

function textoDe(no: No): string {
  return typeof no === 'string' ? no : (no.children ?? []).map(textoDe).join('');
}

// Textos na ordem em que aparecem na tela (de cima para baixo): um por componente Text
function textosEmOrdem(): string[] {
  const textos: string[] = [];
  const visitar = (no: No) => {
    if (typeof no === 'string') {
      return;
    }
    if (no.type === 'Text') {
      textos.push(textoDe(no));
      return;
    }
    (no.children ?? []).forEach(visitar);
  };
  const raiz = screen.toJSON() as ReactTestRendererJSON | ReactTestRendererJSON[] | null;
  (Array.isArray(raiz) ? raiz : raiz ? [raiz] : []).forEach(visitar);
  return textos;
}

// O "puxar para atualizar" da lista: o onRefresh do RefreshControl que a ScrollView recebe
interface Elemento {
  props: Record<string, unknown>;
  children: (Elemento | string)[];
}

// paddingBottom do contentContainerStyle da lista
function espacoNoFimDaLista(): unknown {
  const achar = (no: Elemento): unknown => {
    if (no.props.contentContainerStyle) {
      return StyleSheet.flatten(no.props.contentContainerStyle as StyleProp<ViewStyle>)
        ?.paddingBottom;
    }
    for (const filho of no.children) {
      const achado = typeof filho === 'string' ? undefined : achar(filho);
      if (achado !== undefined) {
        return achado;
      }
    }
    return undefined;
  };
  return achar(screen.root as unknown as Elemento);
}

function acharAoAtualizar(no: Elemento): (() => void) | null {
  const controle = no.props.refreshControl as { props?: { onRefresh?: () => void } } | undefined;
  if (controle?.props?.onRefresh) {
    return controle.props.onRefresh;
  }
  for (const filho of no.children) {
    const achado = typeof filho === 'string' ? null : acharAoAtualizar(filho);
    if (achado) {
      return achado;
    }
  }
  return null;
}

describe('Início (T43)', () => {
  // Quarta-feira, 25/11/2026, 12:00 em Brasília
  const AGORA = new Date('2026-11-25T15:00:00Z');

  const RESERVA = {
    id_reserva: 'r1',
    status_reserva: 'CONFIRMADA',
    status_carona: 'ABERTA',
    data_hora_partida: '2026-11-26T12:00:00Z',
    origem: 'Centro, Torres - RS',
    destino: 'ULBRA Torres - RS',
    nome_motorista: 'Marcos',
    media_motorista: 4,
    total_avaliacoes_motorista: 1,
  } as MinhaReserva;

  const MINHA_CARONA = {
    id_carona: 'minha',
    status: 'ABERTA',
    data_hora_partida: '2026-11-25T20:00:00Z',
    origem: 'Centro, Torres - RS',
    destino: 'Praia Grande, Torres - RS',
    vagas_disponiveis: 2,
    vagas_ofertadas: 3,
  } as MinhaCarona;

  beforeEach(() => {
    jest.useFakeTimers({ now: AGORA, advanceTimers: true });
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('ordem: cabeçalho → busca → legenda → próxima viagem → avaliações → filtro → grupos por dia', async () => {
    jest.mocked(obterProximaViagem).mockResolvedValue({ tipo: 'RESERVA', reserva: RESERVA });
    jest
      .mocked(listarAvaliacoesPendentes)
      .mockResolvedValue([{ id_reserva: 'r0' } as AvaliacaoPendente]);
    jest.mocked(buscarCaronas).mockResolvedValue([
      { ...CARONA, id_carona: 'amanha', data_hora_partida: '2026-11-26T11:00:00Z' },
      { ...CARONA, id_carona: 'hoje', data_hora_partida: '2026-11-25T20:00:00Z' },
    ]);
    await render(<TelaCaronasProximas />);
    expect(await screen.findByText('Sua próxima viagem')).toBeOnTheScreen();
    expect(await screen.findByText('Somente mulheres')).toBeOnTheScreen();
    await screen.findByText('Você tem 1 avaliação pendente.');
    await screen.findByRole('header', { name: 'Hoje' });

    const textos = textosEmOrdem();
    const posicao = (texto: string) => {
      const indice = textos.indexOf(texto);
      expect(indice).toBeGreaterThanOrEqual(0);
      return indice;
    };
    const ordem = [
      posicao('Olá, Ana'),
      posicao('Caronas próximas'),
      posicao('Caronas perto de: Centro de Torres'),
      posicao('Sua próxima viagem'),
      posicao('Você tem 1 avaliação pendente.'),
      posicao('Somente mulheres'),
      posicao('Hoje'),
      posicao('Amanhã'),
    ];
    expect([...ordem].sort((a, b) => a - b)).toEqual(ordem);
    // A contagem "N caronas · as mais perto primeiro" saiu: a lista agora é por dia
    expect(screen.queryByText(/as mais perto primeiro/)).toBeNull();
  });

  it('agrupa por dia de Brasília ("Hoje", "Amanhã", "sex 27/11"), cada grupo por horário', async () => {
    jest.mocked(buscarCaronas).mockResolvedValue([
      {
        ...CARONA,
        id_carona: 'sexta',
        destino: 'Sexta - RS',
        data_hora_partida: '2026-11-27T11:00:00Z',
      },
      {
        ...CARONA,
        id_carona: 'hoje-23h30',
        destino: 'Noite - RS',
        data_hora_partida: '2026-11-26T02:30:00Z',
      },
      {
        ...CARONA,
        id_carona: 'amanha',
        destino: 'Manha - RS',
        data_hora_partida: '2026-11-26T12:00:00Z',
      },
      {
        ...CARONA,
        id_carona: 'hoje-17h',
        destino: 'Tarde - RS',
        data_hora_partida: '2026-11-25T20:00:00Z',
      },
    ]);
    await render(<TelaCaronasProximas />);
    await screen.findByRole('header', { name: 'Hoje' });

    expect(screen.getAllByRole('header').map((cabecalho) => cabecalho.props.children)).toEqual([
      'Caronas próximas',
      'Hoje',
      'Amanhã',
      'sex 27/11',
    ]);
    expect(
      cardsDeCarona().map((card) => /^Para (\w+)/.exec(card.props.accessibilityLabel)?.[1]),
    ).toEqual(['Tarde', 'Noite', 'Manha', 'Sexta']);
    expect(screen.getByText('23:30')).toBeOnTheScreen();
  });

  it('"Sua próxima viagem" de reserva abre a tela da reserva', async () => {
    jest.mocked(obterProximaViagem).mockResolvedValue({ tipo: 'RESERVA', reserva: RESERVA });
    await render(<TelaCaronasProximas />);

    await fireEvent.press(
      await screen.findByRole('button', {
        name: /^Sua próxima viagem, Para ULBRA Torres, amanhã às 09:00, com Marcos, nota média 4,0/,
      }),
    );
    expect(router.push).toHaveBeenCalledWith({ pathname: '/reservas/[id]', params: { id: 'r1' } });
  });

  it('"Sua próxima viagem" de carona própria abre o detalhe da carona', async () => {
    jest.mocked(obterProximaViagem).mockResolvedValue({ tipo: 'CARONA', carona: MINHA_CARONA });
    await render(<TelaCaronasProximas />);

    await fireEvent.press(
      await screen.findByRole('button', {
        name: /^Sua próxima viagem, Para Praia Grande, Torres, hoje às 17:00, Você dirige/,
      }),
    );
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/caronas/[id]',
      params: { id: 'minha' },
    });
  });

  it('sem próxima viagem (nenhuma, ou as duas consultas falharam): o card não aparece, sem erro', async () => {
    await render(<TelaCaronasProximas />);
    await screen.findByRole('button', { name: /^Para ULBRA Torres,/ });

    expect(obterProximaViagem).toHaveBeenCalled();
    expect(screen.queryByText('Sua próxima viagem')).toBeNull();
  });

  it('estado vazio: "Nenhuma carona perto de <local>" com uma ação só, "Buscar em outro lugar"', async () => {
    jest.mocked(buscarCaronas).mockResolvedValue([]);
    await render(<TelaCaronasProximas />);

    expect(await screen.findByText('Nenhuma carona perto de Centro de Torres')).toBeOnTheScreen();
    expect(
      screen.getByText('Tente outro lugar ou ofereça uma carona pelo botão abaixo.'),
    ).toBeOnTheScreen();
    expect(screen.queryAllByRole('header').map((cabecalho) => cabecalho.props.children)).toEqual([
      'Caronas próximas',
    ]);

    // "Oferecer carona" é só o botão flutuante (o estado vazio não repete a ação)
    const oferecer = screen.getAllByRole('button', { name: /Oferecer carona/ });
    expect(oferecer).toHaveLength(1);
    await fireEvent.press(oferecer[0]!);
    expect(router.push).toHaveBeenCalledWith('/caronas/publicar');

    // Botão principal do estado vazio (o nome inclui o ícone); o TextInput do jest é um componente
    // falso com focus() no protótipo
    await fireEvent.press(screen.getByRole('button', { name: /Buscar em outro lugar/ }));
    expect(jest.mocked(TextInput.prototype).focus).toHaveBeenCalledTimes(1);
  });

  it('o fim do conteúdo reserva a altura medida do botão flutuante (nada fica embaixo dele)', async () => {
    jest.mocked(buscarCaronas).mockResolvedValue([]);
    await render(<TelaCaronasProximas />);
    await screen.findByText('Nenhuma carona perto de Centro de Torres');

    // Fonte grande do sistema: o botão cresce e o espaço no fim cresce junto
    await fireEvent(screen.getByRole('button', { name: /Oferecer carona/ }), 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: 220, height: 120 } },
    });

    // insets do mock = 0 → 16 (distância da borda) + 120 (botão) + 16 (folga)
    expect(espacoNoFimDaLista()).toBe(tema.espaco.x4 + 120 + tema.espaco.x4);
  });

  it('puxar para atualizar recarrega a lista, o card e o banner', async () => {
    await render(<TelaCaronasProximas />);
    await screen.findByRole('button', { name: /^Para ULBRA Torres,/ });
    const chamadas = () => [
      jest.mocked(buscarCaronas).mock.calls.length,
      jest.mocked(obterProximaViagem).mock.calls.length,
      jest.mocked(listarAvaliacoesPendentes).mock.calls.length,
    ];
    const antes = chamadas();

    const aoAtualizar = acharAoAtualizar(screen.root as unknown as Elemento);
    expect(aoAtualizar).not.toBeNull();
    await act(async () => {
      aoAtualizar?.();
    });
    await screen.findByRole('button', { name: /^Para ULBRA Torres,/ });

    expect(chamadas()).toEqual(antes.map((total) => total + 1));
  });
});
