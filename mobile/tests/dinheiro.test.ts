import { centavosParaReais, formatarReais, lerReais, reaisParaCentavos } from '@/utils/dinheiro';

describe('lerReais (texto digitado → centavos)', () => {
  it.each([
    ['24', 2400],
    ['24,5', 2450],
    ['24,50', 2450],
    ['24.50', 2450],
    ['R$ 24,00', 2400],
    ['0,01', 1],
    ['4,35', 435],
    ['1.234,56', 123456],
    ['  12,3 ', 1230],
  ])('%p → %p centavos', (texto, centavos) => {
    expect(lerReais(texto)).toBe(centavos);
  });

  it('vazio é null', () => {
    expect(lerReais('  ')).toBeNull();
    expect(lerReais('R$')).toBeNull();
  });

  it.each(['abc', '24,555', '24,5,0', '-5', '1.23,45', '12,', ',5'])('%p é inválido', (texto) => {
    expect(lerReais(texto)).toBeNaN();
  });
});

describe('conversão na fronteira com o backend', () => {
  it('centavos → reais', () => {
    expect(centavosParaReais(2450)).toBe(24.5);
    expect(centavosParaReais(1)).toBe(0.01);
  });

  it('reais → centavos sem erro de float', () => {
    expect(reaisParaCentavos(8.33)).toBe(833);
    expect(reaisParaCentavos(4.35)).toBe(435);
    expect(reaisParaCentavos(6)).toBe(600);
  });
});

describe('formatarReais', () => {
  it.each([
    [600, 'R$ 6,00'],
    [833, 'R$ 8,33'],
    [5, 'R$ 0,05'],
    [0, 'R$ 0,00'],
    [123456, 'R$ 1.234,56'],
    [100000000, 'R$ 1.000.000,00'],
  ])('%p centavos → %p', (centavos, texto) => {
    expect(formatarReais(centavos)).toBe(texto);
  });
});
