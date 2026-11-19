// expo-router falso para testar uma tela sozinha, sem montar o navegador: a navegação vira
// jest.fn (o teste confere para onde a tela mandou) e o foco é a montagem da tela.
import { useEffect, type EffectCallback } from 'react';

export const router = {
  push: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
  navigate: jest.fn(),
};

export const useLocalSearchParams = jest.fn((): Record<string, string> => ({}));

export function useFocusEffect(efeito: EffectCallback): void {
  useEffect(efeito, [efeito]);
}
