// Busca de local da tela inicial (T40): sugestões sem rede e escolha do resultado do geocodificador.
// Só exibição e escolha de coordenada; quem filtra as caronas pelo raio é a buscar_caronas.
import { PONTOS_FIXOS, type PontoFixo } from './pontos';

export interface Coordenadas {
  latitude: number;
  longitude: number;
}

// Sem Intl nem String.normalize (suporte variável no Hermes): os acentos do português à mão,
// cada letra de COM_ACENTO trocada pela da mesma posição em SEM_ACENTO
const COM_ACENTO = 'áàâãäéèêëíìîïóòôõöúùûüçñ';
const SEM_ACENTO = 'aaaaaeeeeiiiiooooouuuucn';
const ACENTUADAS = new RegExp(`[${COM_ACENTO}]`, 'g');

// "  Três CACHOEIRAS " → "tres cachoeiras": compara sem maiúsculas, acentos nem espaços sobrando
export function normalizarBusca(texto: string): string {
  return texto
    .toLowerCase()
    .replace(ACENTUADAS, (letra) => SEM_ACENTO.charAt(COM_ACENTO.indexOf(letra)))
    .replace(/\s+/g, ' ')
    .trim();
}

// Pontos fixos cujo rótulo ou descrição contém o texto; texto vazio mostra todos
export function filtrarPontos(texto: string): PontoFixo[] {
  const busca = normalizarBusca(texto);
  if (!busca) {
    return [...PONTOS_FIXOS];
  }
  return PONTOS_FIXOS.filter(
    (ponto) =>
      normalizarBusca(ponto.rotulo).includes(busca) ||
      normalizarBusca(ponto.descricao).includes(busca),
  );
}

// Texto igual ao rótulo de um ponto fixo ("ulbra torres") usa o ponto, sem geocodificar
export function pontoPorTexto(texto: string): PontoFixo | undefined {
  const busca = normalizarBusca(texto);
  return PONTOS_FIXOS.find((ponto) => normalizarBusca(ponto.rotulo) === busca);
}

// O geocodificador do aparelho procura no mundo todo: o país vai junto do que o usuário digitou
export function textoParaGeocodificar(texto: string): string {
  const limpo = texto.replace(/\s+/g, ' ').trim();
  return /\bbrasil$/.test(normalizarBusca(limpo)) ? limpo : `${limpo}, Brasil`;
}

const RAIO_TERRA_KM = 6371;

function radianos(graus: number): number {
  return (graus * Math.PI) / 180;
}

// Distância em linha reta (haversine), suficiente para escolher entre resultados
export function distanciaKm(a: Coordenadas, b: Coordenadas): number {
  const dLat = radianos(b.latitude - a.latitude);
  const dLng = radianos(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(radianos(a.latitude)) * Math.cos(radianos(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * RAIO_TERRA_KM * Math.asin(Math.sqrt(h));
}

// Vários lugares com o mesmo nome ("Centro, Brasil"): fica o mais perto da referência
export function maisProximo<T extends Coordenadas>(
  referencia: Coordenadas,
  candidatos: readonly T[],
): T | undefined {
  let melhor: T | undefined;
  let menorDistancia = Infinity;
  for (const candidato of candidatos) {
    const distancia = distanciaKm(referencia, candidato);
    if (distancia < menorDistancia) {
      melhor = candidato;
      menorDistancia = distancia;
    }
  }
  return melhor;
}
