import { normalizarPlaca, validarPlaca } from '@/utils/placa';

describe('normalizarPlaca', () => {
  it.each([
    ['abc-1d23', 'ABC1D23'],
    ['ABC 1234', 'ABC1234'],
    [' abc1234 ', 'ABC1234'],
    ['AbC-1d23', 'ABC1D23'],
  ])('%p → %p', (digitada, normalizada) => {
    expect(normalizarPlaca(digitada)).toBe(normalizada);
  });
});

describe('validarPlaca (mesmo formato do CHECK do banco)', () => {
  it.each([
    ['ABC1234', 'antiga'],
    ['ABC1D23', 'Mercosul'],
    ['abc1d23', 'minúscula'],
    ['abc-1234', 'com hífen'],
    ['ABC 1D23', 'com espaço'],
  ])('aceita %p (%s)', (placa) => {
    expect(validarPlaca(placa)).toBeUndefined();
  });

  it('vazia pede a placa', () => {
    expect(validarPlaca('  ')).toBe('Informe a placa.');
  });

  it.each(['AB12345', 'ABCD123', 'ABC12D3', 'ABC123', 'ABC12345', '1BC1234'])(
    'recusa %p',
    (placa) => {
      expect(validarPlaca(placa)).toMatch(/Placa inválida/);
    },
  );
});
