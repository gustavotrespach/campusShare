// Pontos fixos da região para origem, destino e busca enquanto não há mapa (T27, pós-AP2).
// Coordenadas aproximadas, com no máximo 6 casas (coluna decimal(9,6)). As três de Torres são as
// mesmas do supabase/seed.sql, para a busca da demo encontrar as caronas de exemplo.

export interface Local {
  descricao: string;
  latitude: number;
  longitude: number;
}

export interface PontoFixo extends Local {
  id: string;
  // Rótulo curto para os seletores
  rotulo: string;
}

export const PONTOS_FIXOS: readonly PontoFixo[] = [
  {
    id: 'centro-torres',
    rotulo: 'Centro de Torres',
    descricao: 'Centro, Torres - RS',
    latitude: -29.3353,
    longitude: -49.7268,
  },
  {
    id: 'ulbra-torres',
    rotulo: 'ULBRA Torres',
    descricao: 'ULBRA Torres - RS',
    latitude: -29.329,
    longitude: -49.7365,
  },
  {
    id: 'rodoviaria-torres',
    rotulo: 'Rodoviária de Torres',
    descricao: 'Rodoviária de Torres - RS',
    latitude: -29.3385,
    longitude: -49.7355,
  },
  {
    id: 'passo-de-torres',
    rotulo: 'Passo de Torres',
    descricao: 'Centro, Passo de Torres - SC',
    latitude: -29.3098,
    longitude: -49.7224,
  },
  {
    id: 'arroio-do-sal',
    rotulo: 'Arroio do Sal',
    descricao: 'Centro, Arroio do Sal - RS',
    latitude: -29.5506,
    longitude: -49.8885,
  },
  {
    id: 'tres-cachoeiras',
    rotulo: 'Três Cachoeiras',
    descricao: 'Centro, Três Cachoeiras - RS',
    latitude: -29.4486,
    longitude: -49.9269,
  },
];

export const ID_PONTO_PADRAO = 'centro-torres';
export const ID_MINHA_LOCALIZACAO = 'minha-localizacao';

export function pontoPorId(id: string): PontoFixo | undefined {
  return PONTOS_FIXOS.find((ponto) => ponto.id === id);
}

// O GPS devolve muitas casas; a coluna guarda 6 (≈ 11 cm)
export function arredondarCoordenada(valor: number): number {
  return Math.round(valor * 1e6) / 1e6;
}
