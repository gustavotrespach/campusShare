import * as Location from 'expo-location';

import { obterLocalizacaoAtual } from '@/services/localizacao';

jest.mock('expo-location', () => ({
  Accuracy: { Balanced: 3 },
  requestForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
}));

const pedirPermissao = Location.requestForegroundPermissionsAsync as jest.Mock;
const posicaoAtual = Location.getCurrentPositionAsync as jest.Mock;

beforeEach(() => {
  pedirPermissao.mockReset();
  posicaoAtual.mockReset();
});

describe('obterLocalizacaoAtual', () => {
  it('com permissão, devolve as coordenadas com 6 casas', async () => {
    pedirPermissao.mockResolvedValue({ granted: true });
    posicaoAtual.mockResolvedValue({ coords: { latitude: -29.335312345, longitude: -49.72681 } });

    await expect(obterLocalizacaoAtual()).resolves.toEqual({
      latitude: -29.335312,
      longitude: -49.72681,
    });
  });

  it('permissão negada vira LOCALIZACAO_NEGADA, sem pedir a posição', async () => {
    pedirPermissao.mockResolvedValue({ granted: false });

    await expect(obterLocalizacaoAtual()).rejects.toMatchObject({ code: 'LOCALIZACAO_NEGADA' });
    expect(posicaoAtual).not.toHaveBeenCalled();
  });

  it('falha do GPS vira LOCALIZACAO_INDISPONIVEL', async () => {
    pedirPermissao.mockResolvedValue({ granted: true });
    posicaoAtual.mockRejectedValue(new Error('timeout'));

    await expect(obterLocalizacaoAtual()).rejects.toMatchObject({
      code: 'LOCALIZACAO_INDISPONIVEL',
    });
  });
});
