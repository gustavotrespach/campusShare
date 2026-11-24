// Detalhe da reserva (Pagamento da reserva) com o "Cancelar reserva" (T28). Os services são falsos:
// o teste confere quando o botão aparece, a confirmação, o sucesso e o erro com o hint do backend.
import { Alert, AccessibilityInfo, type AlertButton } from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { useLocalSearchParams } from 'expo-router';

import TelaPagamentoReserva from '../app/(autenticado)/reservas/[id]';
import { AppError } from '@/services/erros';
import {
  cancelarReserva,
  consultarStatusReserva,
  listarMinhasReservas,
  type MinhaReserva,
  type SituacaoReserva,
} from '@/services/reservas';
import { guardarPix, obterPix } from '@/store/pix';

jest.mock('expo-router', () => require('./apoio/expo-router-falso'));
jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn() }));
jest.mock('@/services/reservas', () => ({
  cancelarReserva: jest.fn(),
  consultarStatusReserva: jest.fn(),
  listarMinhasReservas: jest.fn(),
}));

const ID = 'a3000000-0000-0000-0000-000000000001';
const daqui = (horas: number) => new Date(Date.now() + horas * 3_600_000).toISOString();

function situacao(statusReserva: SituacaoReserva['statusReserva']): SituacaoReserva {
  return {
    statusReserva,
    statusPagamento: statusReserva === 'CONFIRMADA' ? 'APROVADO' : 'PENDENTE',
    valorCentavos: 600,
  };
}

function naLista(partida: string, statusCarona: MinhaReserva['status_carona'] = 'ABERTA') {
  return {
    id_reserva: ID,
    status_reserva: 'PENDENTE',
    reservado_em: daqui(-0.1),
    status_pagamento: 'PENDENTE',
    valorCentavos: 600,
    id_carona: 'c1',
    origem: 'Centro, Torres - RS',
    destino: 'ULBRA Torres - RS',
    data_hora_partida: partida,
    status_carona: statusCarona,
    nome_motorista: 'Bruno',
  } as MinhaReserva;
}

// Espera a minhas_reservas responder (e o React aplicar) antes de conferir a ausência do botão
async function listaCarregada() {
  await waitFor(() => expect(listarMinhasReservas).toHaveBeenCalled());
  await act(async () => {
    await jest.mocked(listarMinhasReservas).mock.results[0]?.value?.catch(() => undefined);
  });
}

// Responde ao Alert como se o usuário tocasse no botão com esse texto
function responderAlerta(texto: string) {
  return jest.spyOn(Alert, 'alert').mockImplementation((_titulo, _mensagem, botoes) => {
    (botoes as AlertButton[]).find((botao) => botao.text === texto)?.onPress?.();
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.restoreAllMocks();
  jest.mocked(useLocalSearchParams).mockReturnValue({ id: ID });
});

describe('Cancelar reserva (detalhe da reserva)', () => {
  it('PENDENTE: confirma, cancela, mostra CANCELADA, anuncia e apaga o Pix', async () => {
    guardarPix({
      idReserva: ID,
      idPagamento: 'p1',
      valorCentavos: 600,
      status: 'PENDENTE',
      pix: { qrCode: '000201', qrCodeBase64: 'iVBOR', ticketUrl: null },
    });
    jest.mocked(consultarStatusReserva).mockResolvedValue(situacao('PENDENTE'));
    jest.mocked(listarMinhasReservas).mockResolvedValue([naLista(daqui(5))]);
    jest.mocked(cancelarReserva).mockResolvedValue('CANCELADA');
    const alerta = responderAlerta('Cancelar reserva');
    const anuncio = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    await render(<TelaPagamentoReserva />);

    await fireEvent.press(await screen.findByRole('button', { name: /Cancelar reserva/ }));

    expect(alerta).toHaveBeenCalledWith(
      'Cancelar reserva',
      'Sua vaga será liberada. Se você já pagou o Pix, o valor fica registrado para reembolso.',
      expect.any(Array),
    );
    expect(cancelarReserva).toHaveBeenCalledWith(ID);
    expect(await screen.findByText('Reserva cancelada. Sua vaga foi liberada.')).toBeOnTheScreen();
    expect(screen.getByText('Cancelada')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: /Cancelar reserva/ })).toBeNull();
    expect(screen.queryByText('Aguardando a confirmação do pagamento…')).toBeNull();
    expect(anuncio).toHaveBeenCalledWith('Reserva cancelada. Sua vaga foi liberada.');
    expect(obterPix(ID)).toBeNull();
  });

  it('"Voltar" no diálogo não cancela', async () => {
    jest.mocked(consultarStatusReserva).mockResolvedValue(situacao('PENDENTE'));
    jest.mocked(listarMinhasReservas).mockResolvedValue([naLista(daqui(5))]);
    responderAlerta('Voltar');
    await render(<TelaPagamentoReserva />);

    await fireEvent.press(await screen.findByRole('button', { name: /Cancelar reserva/ }));

    expect(cancelarReserva).not.toHaveBeenCalled();
  });

  it('CONFIRMADA: avisa do reembolso e das 2 h; erro de prazo mostra o hint do backend', async () => {
    jest.mocked(consultarStatusReserva).mockResolvedValue(situacao('CONFIRMADA'));
    jest.mocked(listarMinhasReservas).mockResolvedValue([naLista(daqui(1))]);
    jest
      .mocked(cancelarReserva)
      .mockRejectedValue(
        new AppError(
          409,
          'PRAZO_CANCELAMENTO_ENCERRADO',
          'Reservas pagas só podem ser canceladas até 2 horas antes da partida.',
        ),
      );
    const alerta = responderAlerta('Cancelar reserva');
    await render(<TelaPagamentoReserva />);

    expect(await screen.findByText('Pagamento confirmado!')).toBeOnTheScreen();
    await fireEvent.press(await screen.findByRole('button', { name: /Cancelar reserva/ }));

    expect(alerta).toHaveBeenCalledWith(
      'Cancelar reserva',
      'O valor pago fica registrado para reembolso. Reservas pagas só podem ser canceladas até 2 horas antes da partida.',
      expect.any(Array),
    );
    expect(
      await screen.findByText(
        'Reservas pagas só podem ser canceladas até 2 horas antes da partida.',
      ),
    ).toBeOnTheScreen();
    // Nada muda na tela: a reserva continua confirmada
    expect(screen.getByText('Pagamento confirmado!')).toBeOnTheScreen();
  });

  it('CONFIRMADA cancelada: a frase fala do reembolso', async () => {
    jest.mocked(consultarStatusReserva).mockResolvedValue(situacao('CONFIRMADA'));
    jest.mocked(listarMinhasReservas).mockResolvedValue([naLista(daqui(5))]);
    jest.mocked(cancelarReserva).mockResolvedValue('CANCELADA');
    responderAlerta('Cancelar reserva');
    await render(<TelaPagamentoReserva />);

    await fireEvent.press(await screen.findByRole('button', { name: /Cancelar reserva/ }));

    expect(
      await screen.findByText('Reserva cancelada. O valor pago fica registrado para reembolso.'),
    ).toBeOnTheScreen();
  });

  it.each([
    ['reserva já CANCELADA', 'CANCELADA' as const, daqui(5), 'ABERTA' as const],
    ['reserva EXPIRADA', 'EXPIRADA' as const, daqui(5), 'ABERTA' as const],
    ['carona que já partiu', 'PENDENTE' as const, daqui(-1), 'ABERTA' as const],
    ['carona cancelada pelo motorista', 'PENDENTE' as const, daqui(5), 'CANCELADA' as const],
  ])('sem botão: %s', async (_caso, status, partida, statusCarona) => {
    jest.mocked(consultarStatusReserva).mockResolvedValue(situacao(status));
    jest.mocked(listarMinhasReservas).mockResolvedValue([naLista(partida, statusCarona)]);
    await render(<TelaPagamentoReserva />);

    await screen.findByText('Valor da sua vaga');
    await listaCarregada();
    expect(screen.queryByRole('button', { name: /Cancelar reserva/ })).toBeNull();
  });

  it('sem a partida (minhas_reservas falhou), o botão não aparece e o resto da tela segue', async () => {
    jest.mocked(consultarStatusReserva).mockResolvedValue(situacao('PENDENTE'));
    jest.mocked(listarMinhasReservas).mockRejectedValue(new Error('rede'));
    await render(<TelaPagamentoReserva />);

    expect(await screen.findByText('Aguardando a confirmação do pagamento…')).toBeOnTheScreen();
    await listaCarregada();
    expect(screen.queryByRole('button', { name: /Cancelar reserva/ })).toBeNull();
  });
});
