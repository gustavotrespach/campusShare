import * as Location from 'expo-location';

import { arredondarCoordenada } from '@/utils/pontos';

import { AppError } from './erros';

export interface Coordenadas {
  latitude: number;
  longitude: number;
}

const PERMISSAO_NEGADA = new AppError(
  403,
  'LOCALIZACAO_NEGADA',
  'Sem permissão de localização. Escolha um dos pontos da lista ou permita o acesso nos Ajustes.',
);

const LOCALIZACAO_INDISPONIVEL = new AppError(
  503,
  'LOCALIZACAO_INDISPONIVEL',
  'Não foi possível obter sua localização agora. Escolha um dos pontos da lista.',
);

// Só pede a permissão quando o usuário toca em "Minha localização" (nunca ao abrir o app).
export async function obterLocalizacaoAtual(): Promise<Coordenadas> {
  const { granted } = await Location.requestForegroundPermissionsAsync();
  if (!granted) {
    throw PERMISSAO_NEGADA;
  }
  try {
    // Precisão "balanceada" basta para uma busca em raio de quilômetros e responde mais rápido
    const posicao = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    return {
      latitude: arredondarCoordenada(posicao.coords.latitude),
      longitude: arredondarCoordenada(posicao.coords.longitude),
    };
  } catch {
    throw LOCALIZACAO_INDISPONIVEL;
  }
}
