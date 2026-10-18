// T32 — lógica de exibição da identidade visual: hora e dia separados, iniciais do Avatar, textos
// do card de carona, aparência dos selos de status e o anúncio da confirmação.
import { tema } from '@/tema';
import { formatarDataLonga, formatarDiaCurto, formatarHora } from '@/utils/data-hora';
import {
  descreverCarona,
  descreverVeiculo,
  textoContagemCaronas,
  textoDistancia,
  textoVagas,
} from '@/utils/exibicao-carona';
import { iniciais, primeiroNome } from '@/utils/nome';
import { confirmouAgora } from '@/utils/reserva';
import { aparenciaSelo } from '@/utils/selo-status';

describe('formatarHora e formatarDiaCurto (horário de Brasília)', () => {
  it('separa hora e dia do card: domingo 18/10/2026 às 12:30', () => {
    expect(formatarHora('2026-10-18T15:30:00Z')).toBe('12:30');
    expect(formatarDiaCurto('2026-10-18T15:30:00Z')).toBe('dom 18/10');
  });

  it('a partida das 02:30 UTC ainda é o dia anterior em Brasília', () => {
    expect(formatarHora('2026-10-19T02:30:00Z')).toBe('23:30');
    expect(formatarDiaCurto('2026-10-19T02:30:00Z')).toBe('dom 18/10');
  });

  it('completa com zero à esquerda', () => {
    expect(formatarHora('2026-03-02T10:05:00Z')).toBe('07:05');
    expect(formatarDiaCurto('2026-03-02T10:05:00Z')).toBe('seg 02/03');
  });

  it('aceita Date', () => {
    expect(formatarHora(new Date('2026-10-18T15:30:00Z'))).toBe('12:30');
  });

  it('formatarDataLonga mostra o dia por extenso, sem a hora', () => {
    expect(formatarDataLonga('2026-10-18T15:30:00Z')).toBe('domingo, 18/10/2026');
    expect(formatarDataLonga('2026-10-17T02:59:00Z')).toBe('sexta-feira, 16/10/2026');
  });
});

describe('iniciais e primeiroNome', () => {
  it('primeira e última palavra do nome', () => {
    expect(iniciais('Ana Souza')).toBe('AS');
    expect(iniciais('Marina Motorista Silva')).toBe('MS');
    expect(iniciais('  júlia   rocha ')).toBe('JR');
  });

  it('só o primeiro nome (lista da busca, decisão de 17/10): uma letra', () => {
    expect(iniciais('Marina')).toBe('M');
  });

  it('sem nome não quebra', () => {
    expect(iniciais('')).toBe('');
    expect(iniciais('   ')).toBe('');
  });

  it('primeiroNome para a saudação', () => {
    expect(primeiroNome('Júlia Rocha')).toBe('Júlia');
    expect(primeiroNome('  Marina ')).toBe('Marina');
    expect(primeiroNome('')).toBe('');
    expect(primeiroNome(null)).toBe('');
  });
});

describe('textos do card de carona', () => {
  const carona = {
    data_hora_partida: '2026-10-18T15:30:00Z',
    origem: 'Centro de Torres',
    destino: 'ULBRA Torres',
    valorPorPassageiroCentavos: 600,
    vagas_disponiveis: 2,
    nome_motorista: 'Ana',
  };

  it('vagas no singular e no plural', () => {
    expect(textoVagas(1)).toBe('1 vaga');
    expect(textoVagas(2)).toBe('2 vagas');
  });

  it('distância com vírgula', () => {
    expect(textoDistancia(0.44)).toBe('a 0,4 km');
    expect(textoDistancia(12)).toBe('a 12,0 km');
  });

  it('veículo com a cor em minúsculas', () => {
    expect(descreverVeiculo('Onix', 'Prata')).toBe('Onix prata');
    expect(descreverVeiculo('Onix', 'Prata', ' · ')).toBe('Onix · prata');
  });

  it('contagem acima da lista; nada com a lista vazia', () => {
    expect(textoContagemCaronas(3)).toBe('3 caronas · as mais perto primeiro');
    expect(textoContagemCaronas(1)).toBe('1 carona · as mais perto primeiro');
    expect(textoContagemCaronas(0)).toBeNull();
  });

  it('descrição do card para o leitor de tela', () => {
    expect(descreverCarona(carona)).toBe(
      'Carona dom 18/10 às 12:30, de Centro de Torres para ULBRA Torres, R$ 6,00 por pessoa, ' +
        '2 vagas, motorista Ana',
    );
  });
});

describe('SeloStatus: rótulo, ícone e cor por status', () => {
  const { cores } = tema;

  it.each([
    ['PENDENTE', 'Aguardando pagamento', 'time-outline', cores.alertaClaro, cores.alerta],
    ['CONFIRMADA', 'Confirmada', 'checkmark-circle', cores.sucessoClaro, cores.sucesso],
    ['CANCELADA', 'Cancelada', 'close-circle', cores.erroClaro, cores.erro],
    ['EXPIRADA', 'Expirada', 'hourglass-outline', cores.neutroClaro, cores.neutro],
    [
      'SOMENTE_MULHERES',
      'Somente mulheres',
      'female-outline',
      cores.secundariaClara,
      cores.secundariaTexto,
    ],
  ] as const)('%s', (tipo, rotulo, icone, fundo, cor) => {
    expect(aparenciaSelo(tipo)).toEqual({ rotulo, icone, fundo, cor });
  });

  it('o coral de destaque nunca é cor de texto (contraste 3:1)', () => {
    expect(aparenciaSelo('SOMENTE_MULHERES').cor).not.toBe(cores.secundaria);
  });
});

describe('confirmouAgora (anúncio da confirmação na tela de pagamento)', () => {
  it('anuncia só a passagem de PENDENTE para CONFIRMADA', () => {
    expect(confirmouAgora('PENDENTE', 'CONFIRMADA')).toBe(true);
  });

  it('abrir uma reserva já confirmada não anuncia', () => {
    expect(confirmouAgora(null, 'CONFIRMADA')).toBe(false);
    expect(confirmouAgora('CONFIRMADA', 'CONFIRMADA')).toBe(false);
  });

  it('outros status não anunciam', () => {
    expect(confirmouAgora('PENDENTE', 'PENDENTE')).toBe(false);
    expect(confirmouAgora('PENDENTE', 'EXPIRADA')).toBe(false);
  });
});
