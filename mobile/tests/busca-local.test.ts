import {
  distanciaKm,
  filtrarPontos,
  maisProximo,
  normalizarBusca,
  pontoPorTexto,
  textoParaGeocodificar,
} from '@/utils/busca-local';
import { PONTOS_FIXOS, pontoPorId } from '@/utils/pontos';

const rotulos = (texto: string) => filtrarPontos(texto).map((ponto) => ponto.rotulo);

describe('normalizarBusca', () => {
  it('ignora maiúsculas, acentos e espaços sobrando', () => {
    expect(normalizarBusca('  Três   CACHOEIRAS ')).toBe('tres cachoeiras');
    expect(normalizarBusca('Rodoviária')).toBe('rodoviaria');
    expect(normalizarBusca('ÁÉÍÓÚ âêô ãõ ç ü')).toBe('aeiou aeo ao c u');
  });
});

describe('filtrarPontos', () => {
  it('texto vazio (ou só espaços) mostra todos os pontos fixos', () => {
    expect(filtrarPontos('')).toHaveLength(PONTOS_FIXOS.length);
    expect(filtrarPontos('   ')).toHaveLength(PONTOS_FIXOS.length);
  });

  it('acha sem acento e sem diferenciar maiúsculas', () => {
    expect(rotulos('TRES')).toEqual(['Três Cachoeiras']);
    expect(rotulos('rodoviaria')).toEqual(['Rodoviária de Torres']);
    expect(rotulos('ulbra')).toEqual(['ULBRA Torres']);
  });

  it('procura também na descrição (cidade e estado)', () => {
    expect(rotulos('torres')).toEqual([
      'Centro de Torres',
      'ULBRA Torres',
      'Rodoviária de Torres',
      'Passo de Torres',
    ]);
    expect(rotulos(' sc')).toEqual(['Passo de Torres']);
  });

  it('nenhum ponto com o texto devolve lista vazia', () => {
    expect(filtrarPontos('Praia Grande')).toEqual([]);
  });
});

describe('pontoPorTexto', () => {
  it('só o rótulo inteiro vale como ponto fixo', () => {
    expect(pontoPorTexto('ulbra torres')?.id).toBe('ulbra-torres');
    expect(pontoPorTexto(' Tres  Cachoeiras ')?.id).toBe('tres-cachoeiras');
    expect(pontoPorTexto('ulbra')).toBeUndefined();
  });
});

describe('textoParaGeocodificar', () => {
  it('acrescenta o país, sem repetir', () => {
    expect(textoParaGeocodificar('  Praia  Grande ')).toBe('Praia Grande, Brasil');
    expect(textoParaGeocodificar('Torres, Brasil')).toBe('Torres, Brasil');
    expect(textoParaGeocodificar('Torres brasil')).toBe('Torres brasil');
  });
});

describe('maisProximo', () => {
  const ulbra = pontoPorId('ulbra-torres')!;
  const saoPaulo = { latitude: -23.5505, longitude: -46.6333 };
  const torres = { latitude: -29.3353, longitude: -49.7268 };

  it('escolhe o candidato mais perto da referência', () => {
    expect(maisProximo(ulbra, [saoPaulo, torres])).toBe(torres);
    expect(maisProximo(ulbra, [])).toBeUndefined();
  });

  it('distância em km aproximada (Centro de Torres → Arroio do Sal ≈ 28,6 km)', () => {
    const arroio = pontoPorId('arroio-do-sal')!;
    expect(distanciaKm(torres, arroio)).toBeGreaterThan(28);
    expect(distanciaKm(torres, arroio)).toBeLessThan(29);
  });
});
