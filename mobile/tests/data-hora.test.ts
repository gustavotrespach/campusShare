import {
  formatarDataHoraCompleta,
  formatarDataHoraCurta,
  paraIsoUtc,
  partidaSugerida,
} from '@/utils/data-hora';

describe('exibição em America/Sao_Paulo (UTC−3)', () => {
  it('23:30 de Brasília é 02:30 do dia seguinte em UTC, mas aparece no próprio dia', () => {
    const instante = '2026-10-21T02:30:00Z';
    expect(formatarDataHoraCurta(instante)).toBe('ter 20/10 · 23:30');
    expect(formatarDataHoraCompleta(instante)).toBe('terça-feira, 20/10/2026 às 23:30');
  });

  it('formata o horário do seed (10:30 UTC = 07:30 de Brasília)', () => {
    expect(formatarDataHoraCurta('2026-10-20T10:30:00+00:00')).toBe('ter 20/10 · 07:30');
  });

  it('não depende do fuso do aparelho: aceita Date e string do mesmo instante', () => {
    const instante = new Date(Date.UTC(2026, 0, 1, 2, 5));
    expect(formatarDataHoraCompleta(instante)).toBe('quarta-feira, 31/12/2025 às 23:05');
    expect(formatarDataHoraCompleta(instante.toISOString())).toBe(
      'quarta-feira, 31/12/2025 às 23:05',
    );
  });
});

describe('envio e valor inicial', () => {
  it('envia ISO em UTC', () => {
    expect(paraIsoUtc(new Date('2026-10-20T23:30:00-03:00'))).toBe('2026-10-21T02:30:00.000Z');
  });

  it('sugere a próxima hora cheia depois de daqui a 1 hora', () => {
    const agora = new Date('2026-10-17T14:20:00Z');
    expect(partidaSugerida(agora).toISOString()).toBe('2026-10-17T16:00:00.000Z');
    expect(partidaSugerida(agora).getTime()).toBeGreaterThan(agora.getTime() + 60 * 60 * 1000);
  });
});
