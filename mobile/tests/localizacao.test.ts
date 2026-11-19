import * as Location from 'expo-location';
import { Platform } from 'react-native';

import { localizarEndereco, obterLocalizacaoAtual } from '@/services/localizacao';

jest.mock('expo-location', () => ({
  Accuracy: { Balanced: 3 },
  requestForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
  geocodeAsync: jest.fn(),
}));

const pedirPermissao = Location.requestForegroundPermissionsAsync as jest.Mock;
const posicaoAtual = Location.getCurrentPositionAsync as jest.Mock;
const geocodificar = Location.geocodeAsync as jest.Mock;

beforeEach(() => {
  pedirPermissao.mockReset();
  posicaoAtual.mockReset();
  geocodificar.mockReset();
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

describe('localizarEndereco (T40)', () => {
  const PRAIA_GRANDE = { latitude: -29.1912346, longitude: -49.9512346, altitude: 0, accuracy: 50 };

  describe('no iOS (padrão do jest-expo)', () => {
    it('acha o lugar sem pedir permissão, com ", Brasil" e 6 casas', async () => {
      geocodificar.mockResolvedValue([PRAIA_GRANDE]);

      await expect(localizarEndereco('Praia Grande')).resolves.toEqual({
        latitude: -29.191235,
        longitude: -49.951235,
      });
      expect(geocodificar).toHaveBeenCalledWith('Praia Grande, Brasil');
      expect(pedirPermissao).not.toHaveBeenCalled();
    });

    it('vários resultados: fica o mais perto da ULBRA Torres', async () => {
      geocodificar.mockResolvedValue([
        { latitude: -23.5505, longitude: -46.6333 },
        { latitude: -29.3353, longitude: -49.7268 },
        { latitude: -30.0346, longitude: -51.2177 },
      ]);

      await expect(localizarEndereco('Centro')).resolves.toEqual({
        latitude: -29.3353,
        longitude: -49.7268,
      });
    });

    it('nenhum resultado vira LOCAL_NAO_ENCONTRADO com a frase da tela', async () => {
      geocodificar.mockResolvedValue([]);

      await expect(localizarEndereco('Xyzzy')).rejects.toMatchObject({
        code: 'LOCAL_NAO_ENCONTRADO',
        message: 'Não encontramos esse lugar. Tente o bairro e a cidade.',
      });
    });

    it('erro do geocodificador (sem internet, limite de buscas) vira BUSCA_LOCAL_INDISPONIVEL', async () => {
      geocodificar.mockRejectedValue(new Error('Error while geocoding a location'));

      await expect(localizarEndereco('Praia Grande')).rejects.toMatchObject({
        code: 'BUSCA_LOCAL_INDISPONIVEL',
      });
    });

    it('geocodificador que não responde desiste depois de 10 s', async () => {
      jest.useFakeTimers();
      try {
        geocodificar.mockReturnValue(new Promise(() => {}));
        const busca = localizarEndereco('Praia Grande');
        const verificacao = expect(busca).rejects.toMatchObject({
          code: 'BUSCA_LOCAL_INDISPONIVEL',
        });

        await jest.advanceTimersByTimeAsync(10_000);
        await verificacao;
      } finally {
        jest.useRealTimers();
      }
    });
  });

  describe('no Android', () => {
    beforeEach(() => {
      jest.replaceProperty(Platform, 'OS', 'android');
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('pede a permissão antes de geocodificar (exigência do Android)', async () => {
      pedirPermissao.mockResolvedValue({ granted: true });
      geocodificar.mockResolvedValue([PRAIA_GRANDE]);

      await expect(localizarEndereco('Praia Grande')).resolves.toMatchObject({
        latitude: -29.191235,
      });
      expect(pedirPermissao).toHaveBeenCalled();
    });

    it('permissão negada explica o motivo e não geocodifica', async () => {
      pedirPermissao.mockResolvedValue({ granted: false });

      await expect(localizarEndereco('Praia Grande')).rejects.toMatchObject({
        code: 'LOCALIZACAO_NEGADA',
        message: expect.stringContaining('No Android, a busca por endereço precisa da permissão'),
      });
      expect(geocodificar).not.toHaveBeenCalled();
    });
  });
});
