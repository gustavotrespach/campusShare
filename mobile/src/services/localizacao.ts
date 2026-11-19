import * as Location from 'expo-location';
import { Platform } from 'react-native';

import { maisProximo, textoParaGeocodificar } from '@/utils/busca-local';
import { arredondarCoordenada, ID_PONTO_REFERENCIA, pontoPorId } from '@/utils/pontos';

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

const LOCAL_NAO_ENCONTRADO = new AppError(
  404,
  'LOCAL_NAO_ENCONTRADO',
  'Não encontramos esse lugar. Tente o bairro e a cidade.',
);

const BUSCA_INDISPONIVEL = new AppError(
  503,
  'BUSCA_LOCAL_INDISPONIVEL',
  'Não foi possível buscar esse lugar agora. Confira sua conexão e tente de novo, ou escolha um dos pontos sugeridos.',
);

const PERMISSAO_BUSCA_NEGADA = new AppError(
  403,
  'LOCALIZACAO_NEGADA',
  'No Android, a busca por endereço precisa da permissão de localização. Escolha um dos pontos sugeridos ou permita o acesso nos Ajustes.',
);

// No Android 13+, uma falha do geocodificador pode nunca responder (o expo-location só trata o
// sucesso): depois deste tempo a busca desiste com a mensagem de indisponível
const TEMPO_MAXIMO_GEOCODIFICACAO_MS = 10_000;

function comTempoMaximo<T>(promessa: Promise<T>, milissegundos: number): Promise<T> {
  return new Promise<T>((resolver, rejeitar) => {
    const temporizador = setTimeout(() => rejeitar(BUSCA_INDISPONIVEL), milissegundos);
    promessa.then(
      (valor) => {
        clearTimeout(temporizador);
        resolver(valor);
      },
      (erro: unknown) => {
        clearTimeout(temporizador);
        rejeitar(erro);
      },
    );
  });
}

// Bairro, rua ou cidade digitado → coordenada, pelo geocodificador do próprio aparelho (Apple no
// iOS, o do sistema no Android), sem chave de API. Vários resultados: o mais perto da ULBRA Torres.
export async function localizarEndereco(texto: string): Promise<Coordenadas> {
  // O Android exige a permissão de localização para geocodificar (o iOS não): só pede aqui, quando o
  // usuário confirma uma busca por texto
  if (Platform.OS === 'android') {
    const { granted } = await Location.requestForegroundPermissionsAsync();
    if (!granted) {
      throw PERMISSAO_BUSCA_NEGADA;
    }
  }
  let resultados: Location.LocationGeocodedLocation[];
  try {
    resultados = await comTempoMaximo(
      Location.geocodeAsync(textoParaGeocodificar(texto)),
      TEMPO_MAXIMO_GEOCODIFICACAO_MS,
    );
  } catch {
    // Sem internet, limite de buscas do aparelho ou geocodificador ausente: a mesma mensagem
    throw BUSCA_INDISPONIVEL;
  }
  const validos = resultados.filter(
    (resultado) => Number.isFinite(resultado.latitude) && Number.isFinite(resultado.longitude),
  );
  const referencia = pontoPorId(ID_PONTO_REFERENCIA);
  const escolhido = referencia ? maisProximo(referencia, validos) : validos[0];
  if (!escolhido) {
    throw LOCAL_NAO_ENCONTRADO;
  }
  return {
    latitude: arredondarCoordenada(escolhido.latitude),
    longitude: arredondarCoordenada(escolhido.longitude),
  };
}
