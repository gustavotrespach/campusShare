import {
  consumoSugerido,
  ehMotorizacao,
  formatarConsumo,
  lerConsumo,
  MOTORIZACOES,
  validarConsumo,
} from '@/utils/consumo';

describe('consumoSugerido', () => {
  it.each([
    ['1.0', 13],
    ['1.6', 11],
    ['2.0', 9.5],
  ])('motorização %p sugere %p km/l', (motorizacao, consumo) => {
    expect(consumoSugerido(motorizacao)).toBe(consumo);
  });

  it('toda motorização da lista tem sugestão', () => {
    for (const motorizacao of MOTORIZACOES) {
      expect(consumoSugerido(motorizacao)).toBeGreaterThan(0);
    }
  });

  it.each([null, '3.0', 'outra'])('sem sugestão para %p', (motorizacao) => {
    expect(consumoSugerido(motorizacao)).toBeNull();
    expect(ehMotorizacao(motorizacao)).toBe(false);
  });
});

describe('lerConsumo e formatarConsumo (vírgula ou ponto, 1 casa)', () => {
  it.each([
    ['12,5', 12.5],
    ['12.5', 12.5],
    ['13', 13],
    [' 9,46 ', 9.5],
    ['10,04', 10],
  ])('%p → %p', (texto, valor) => {
    expect(lerConsumo(texto)).toBe(valor);
  });

  it('vazio é null (campo opcional)', () => {
    expect(lerConsumo('  ')).toBeNull();
  });

  it.each(['abc', '12,5,1', '-3', '1e2'])('%p não é número', (texto) => {
    expect(lerConsumo(texto)).toBeNaN();
  });

  it('formata em pt-BR com 1 casa', () => {
    expect(formatarConsumo(13)).toBe('13,0');
    expect(formatarConsumo(11.5)).toBe('11,5');
    expect(formatarConsumo(null)).toBe('');
  });
});

describe('validarConsumo', () => {
  it.each(['', '12,5', '0,1', '99,9'])('aceita %p', (texto) => {
    expect(validarConsumo(texto)).toBeUndefined();
  });

  it.each(['0', '0,04', '100', 'abc', '-1'])('recusa %p', (texto) => {
    expect(validarConsumo(texto)).toMatch(/km\/l/);
  });
});
