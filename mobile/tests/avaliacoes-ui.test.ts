import {
  descreverAvaliado,
  formatarNota,
  podeConcluirCarona,
  rotuloReputacao,
  textoAvaliacoesPendentes,
  textoReputacao,
} from '@/utils/avaliacoes';

const AGORA = new Date('2026-11-24T12:00:00Z');
const daqui = (horas: number) => new Date(AGORA.getTime() + horas * 3_600_000).toISOString();

describe('podeConcluirCarona', () => {
  const carona = { sou_motorista: true, status: 'ABERTA' as const, data_hora_partida: daqui(-2) };

  it('motorista, carona ativa e partida já passada (mesma regra do "Já partiu")', () => {
    expect(podeConcluirCarona(carona, AGORA)).toBe(true);
    expect(podeConcluirCarona({ ...carona, status: 'LOTADA' }, AGORA)).toBe(true);
  });

  it('não calcula o prazo de 1 dia: 3 dias depois ainda mostra (o backend recusa)', () => {
    expect(podeConcluirCarona({ ...carona, data_hora_partida: daqui(-72) }, AGORA)).toBe(true);
  });

  it('passageiro, antes da partida ou carona encerrada: sem botão', () => {
    expect(podeConcluirCarona({ ...carona, sou_motorista: false }, AGORA)).toBe(false);
    expect(podeConcluirCarona({ ...carona, data_hora_partida: daqui(1) }, AGORA)).toBe(false);
    expect(podeConcluirCarona({ ...carona, status: 'CONCLUIDA' }, AGORA)).toBe(false);
    expect(podeConcluirCarona({ ...carona, status: 'CANCELADA' }, AGORA)).toBe(false);
  });
});

describe('textos de reputação', () => {
  it('vírgula decimal e singular certo', () => {
    expect(formatarNota(4.3)).toBe('4,3');
    expect(formatarNota(5)).toBe('5,0');
    expect(textoReputacao(4.3, 12)).toBe('4,3 · 12 avaliações');
    expect(textoReputacao(5, 1)).toBe('5,0 · 1 avaliação');
    expect(rotuloReputacao(4.3, 12)).toBe('Nota média 4,3 de 5, 12 avaliações');
  });

  it('média null ou total 0: "Sem avaliações ainda"', () => {
    expect(textoReputacao(null, 0)).toBe('Sem avaliações ainda');
    expect(rotuloReputacao(null, 0)).toBe('Sem avaliações ainda');
  });
});

describe('pendências', () => {
  it('banner com singular certo e papel do avaliado', () => {
    expect(textoAvaliacoesPendentes(1)).toBe('Você tem 1 avaliação pendente.');
    expect(textoAvaliacoesPendentes(3)).toBe('Você tem 3 avaliações pendentes.');
    expect(descreverAvaliado('PASSAGEIRO')).toBe('seu motorista');
    expect(descreverAvaliado('MOTORISTA')).toBe('seu passageiro');
  });
});
