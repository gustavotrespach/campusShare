// Regras de interface da T19: validação do formulário de publicar, campo de cada erro do
// backend e exibição do filtro "Somente mulheres".
import { campoDoErroDePublicacao } from '@/utils/erros-carona';
import { mostrarFiltroSomenteMulheres } from '@/utils/genero';
import { arredondarCoordenada, PONTOS_FIXOS } from '@/utils/pontos';
import { temErros, validarPublicacao } from '@/utils/validacao';

const AGORA = new Date('2026-10-17T12:00:00Z');
const VALIDO = {
  idVeiculo: 'f1000000-0000-0000-0000-000000000001',
  origem: { descricao: 'Centro, Torres - RS' },
  destino: { descricao: 'ULBRA Torres - RS' },
  partida: new Date('2026-10-18T10:30:00Z'),
  custoTotal: '24,00',
};

describe('validarPublicacao (só formato; RN04 a RN06 são do backend)', () => {
  it('sem erros com tudo preenchido', () => {
    expect(validarPublicacao(VALIDO, AGORA)).toEqual({});
  });

  it('aponta cada campo ausente', () => {
    const erros = validarPublicacao(
      { idVeiculo: null, origem: null, destino: null, partida: null, custoTotal: '' },
      AGORA,
    );
    expect(erros).toEqual({
      veiculo: 'Escolha o veículo.',
      origem: 'Escolha a origem.',
      destino: 'Escolha o destino.',
      partida: 'Escolha a data e a hora de partida.',
      custo_total: 'Informe o custo total da viagem.',
    });
    expect(temErros(erros)).toBe(true);
  });

  it('partida agora ou no passado é recusada', () => {
    expect(validarPublicacao({ ...VALIDO, partida: AGORA }, AGORA).partida).toBe(
      'Escolha uma data e hora de partida no futuro.',
    );
  });

  it('descrição vazia ou com mais de 200 caracteres é recusada', () => {
    expect(validarPublicacao({ ...VALIDO, origem: { descricao: '  ' } }, AGORA).origem).toBe(
      'Descreva o local.',
    );
    expect(
      validarPublicacao({ ...VALIDO, destino: { descricao: 'x'.repeat(201) } }, AGORA).destino,
    ).toBe('Use no máximo 200 caracteres.');
  });

  it.each(['0', '0,00', 'abc', '24,555'])('custo %p é recusado', (custoTotal) => {
    expect(validarPublicacao({ ...VALIDO, custoTotal }, AGORA).custo_total).toBe(
      'Informe um valor em reais, ex.: 24,00.',
    );
  });
});

describe('campoDoErroDePublicacao', () => {
  it.each([
    ['VAGAS_ACIMA_DO_LIMITE', 'vagas'],
    ['PARTIDA_NO_PASSADO', 'partida'],
    ['SEM_VEICULO', 'veiculo'],
    ['VEICULO_NAO_ENCONTRADO', 'veiculo'],
  ])('%s aparece no campo %s', (codigo, campo) => {
    expect(campoDoErroDePublicacao(codigo)).toBe(campo);
  });

  it.each(['DADOS_INVALIDOS', 'NAO_AUTENTICADO', 'SEM_CONEXAO'])(
    '%s vai para o aviso geral',
    (codigo) => {
      expect(campoDoErroDePublicacao(codigo)).toBeNull();
    },
  );
});

describe('mostrarFiltroSomenteMulheres', () => {
  it('aparece só para FEMININO', () => {
    expect(mostrarFiltroSomenteMulheres('FEMININO')).toBe(true);
  });

  it.each(['MASCULINO', 'OUTRO', 'NAO_INFORMADO', null, undefined] as const)(
    'não aparece para %p',
    (genero) => {
      expect(mostrarFiltroSomenteMulheres(genero)).toBe(false);
    },
  );
});

describe('pontos fixos', () => {
  it('têm no máximo 6 casas e ficam no sul do Brasil', () => {
    for (const ponto of PONTOS_FIXOS) {
      expect(arredondarCoordenada(ponto.latitude)).toBe(ponto.latitude);
      expect(arredondarCoordenada(ponto.longitude)).toBe(ponto.longitude);
      expect(ponto.latitude).toBeGreaterThan(-31);
      expect(ponto.latitude).toBeLessThan(-28);
    }
  });

  it('arredonda o GPS para 6 casas', () => {
    expect(arredondarCoordenada(-29.335312345)).toBe(-29.335312);
  });
});
