// T29 — tela "Notificações": lista (não lidas em destaque), tocar marca como lida e abre a tela
// certa, "Marcar todas como lidas", vazio e erro. O service é falso.
import { fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import TelaNotificacoes from '../app/(autenticado)/notificacoes';
import { AppError } from '@/services/erros';
import { listarNotificacoes, marcarComoLidas, type Notificacao } from '@/services/notificacoes';

jest.mock('expo-router', () => require('./apoio/expo-router-falso'));
jest.mock('@/services/notificacoes', () => ({
  listarNotificacoes: jest.fn(),
  marcarComoLidas: jest.fn(),
}));

const minutosAtras = (minutos: number) => new Date(Date.now() - minutos * 60_000).toISOString();

const NOVA_RESERVA: Notificacao = {
  id_notificacao: 'n1',
  tipo: 'NOVA_RESERVA',
  mensagem: 'Bruna reservou uma vaga na sua carona para ULBRA Torres em 26/11 às 19:00.',
  lida: false,
  criado_em: minutosAtras(5),
  id_carona: 'c1',
  id_reserva: 'r1',
};
const CONFIRMADA: Notificacao = {
  id_notificacao: 'n2',
  tipo: 'RESERVA_CONFIRMADA',
  mensagem:
    'Pagamento confirmado: sua vaga na carona para Centro em 27/11 às 08:00 está garantida.',
  lida: true,
  criado_em: minutosAtras(30),
  id_carona: 'c2',
  id_reserva: 'r2',
};
const AVALIACAO: Notificacao = {
  id_notificacao: 'n3',
  tipo: 'AVALIACAO',
  mensagem:
    'Você recebeu uma avaliação de 5 estrelas pela carona para ULBRA Torres em 24/11 às 19:00.',
  lida: false,
  criado_em: minutosAtras(50),
  id_carona: 'c3',
  id_reserva: 'r3',
};

const itens = () =>
  screen.queryAllByRole('button', { name: /(Não lida\. )?.+ (há \d+ min|agora)$/ });

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(marcarComoLidas).mockResolvedValue(1);
});

describe('Notificações', () => {
  it('lista na ordem do service, com o "há N min" e as não lidas anunciadas', async () => {
    jest.mocked(listarNotificacoes).mockResolvedValue([NOVA_RESERVA, CONFIRMADA, AVALIACAO]);
    await render(<TelaNotificacoes />);

    expect(await screen.findByText(NOVA_RESERVA.mensagem)).toBeOnTheScreen();
    expect(itens().map((item) => item.props.accessibilityLabel as string)).toEqual([
      `Não lida. ${NOVA_RESERVA.mensagem} há 5 min`,
      `${CONFIRMADA.mensagem} há 30 min`,
      `Não lida. ${AVALIACAO.mensagem} há 50 min`,
    ]);
    expect(screen.getByText('há 5 min')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: /Marcar todas como lidas/ })).toBeOnTheScreen();
  });

  it('tocar numa não lida marca só ela e abre a carona (motorista)', async () => {
    jest.mocked(listarNotificacoes).mockResolvedValue([NOVA_RESERVA, CONFIRMADA]);
    await render(<TelaNotificacoes />);

    await fireEvent.press(
      await screen.findByRole('button', { name: /^Não lida\. Bruna reservou/ }),
    );

    expect(marcarComoLidas).toHaveBeenCalledWith(['n1']);
    expect(router.push).toHaveBeenCalledWith({ pathname: '/caronas/[id]', params: { id: 'c1' } });
    // Já aparece como lida, sem esperar recarregar
    expect(screen.getByRole('button', { name: /^Bruna reservou/ })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: /Marcar todas como lidas/ })).toBeNull();
  });

  it('tocar numa já lida não chama o servidor e abre a reserva (passageiro)', async () => {
    jest.mocked(listarNotificacoes).mockResolvedValue([CONFIRMADA]);
    await render(<TelaNotificacoes />);

    await fireEvent.press(await screen.findByRole('button', { name: /^Pagamento confirmado/ }));

    expect(marcarComoLidas).not.toHaveBeenCalled();
    expect(router.push).toHaveBeenCalledWith({ pathname: '/reservas/[id]', params: { id: 'r2' } });
  });

  it('a avaliação abre o Perfil, onde está a média', async () => {
    jest.mocked(listarNotificacoes).mockResolvedValue([AVALIACAO]);
    await render(<TelaNotificacoes />);

    await fireEvent.press(
      await screen.findByRole('button', { name: /Você recebeu uma avaliação/ }),
    );

    expect(router.push).toHaveBeenCalledWith('/perfil');
  });

  it('"Marcar todas como lidas" marca no servidor e na lista', async () => {
    jest.mocked(listarNotificacoes).mockResolvedValue([NOVA_RESERVA, CONFIRMADA, AVALIACAO]);
    jest.mocked(marcarComoLidas).mockResolvedValue(2);
    await render(<TelaNotificacoes />);

    await fireEvent.press(await screen.findByRole('button', { name: /Marcar todas como lidas/ }));

    expect(marcarComoLidas).toHaveBeenCalledWith();
    expect(await screen.findByRole('button', { name: /^Bruna reservou/ })).toBeOnTheScreen();
    expect(
      itens().every((item) => !String(item.props.accessibilityLabel).startsWith('Não lida')),
    ).toBe(true);
    expect(screen.queryByRole('button', { name: /Marcar todas como lidas/ })).toBeNull();
  });

  it('erro ao marcar todas: Aviso e a lista como estava', async () => {
    jest.mocked(listarNotificacoes).mockResolvedValue([NOVA_RESERVA]);
    jest
      .mocked(marcarComoLidas)
      .mockRejectedValue(
        new AppError(
          0,
          'SEM_CONEXAO',
          'Não foi possível conectar ao servidor. Verifique sua internet e tente de novo.',
        ),
      );
    await render(<TelaNotificacoes />);

    await fireEvent.press(await screen.findByRole('button', { name: /Marcar todas como lidas/ }));

    expect(
      await screen.findByText(
        'Não foi possível conectar ao servidor. Verifique sua internet e tente de novo.',
      ),
    ).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: /^Não lida\. Bruna reservou/ })).toBeOnTheScreen();
  });

  it('vazio: "Nenhuma notificação", sem o botão de marcar', async () => {
    jest.mocked(listarNotificacoes).mockResolvedValue([]);
    await render(<TelaNotificacoes />);

    expect(await screen.findByText('Nenhuma notificação')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: /Marcar todas como lidas/ })).toBeNull();
  });

  it('erro ao carregar: a frase e "Tentar de novo", que recarrega', async () => {
    jest
      .mocked(listarNotificacoes)
      .mockRejectedValueOnce(
        new AppError(500, 'ERRO_INESPERADO', 'Algo deu errado. Tente novamente em instantes.'),
      )
      .mockResolvedValueOnce([CONFIRMADA]);
    await render(<TelaNotificacoes />);

    expect(
      await screen.findByText('Algo deu errado. Tente novamente em instantes.'),
    ).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: /Tentar de novo/ }));
    expect(await screen.findByText(CONFIRMADA.mensagem)).toBeOnTheScreen();
  });
});
