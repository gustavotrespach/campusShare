import type { CamposPublicacao } from './validacao';

// Em qual campo do formulário de publicar cada erro do backend aparece; o resto vai para o aviso
// geral (DADOS_INVALIDOS já traz no hint a frase do campo).
const CAMPO_POR_CODIGO: Record<string, CamposPublicacao> = {
  SEM_VEICULO: 'veiculo',
  VEICULO_NAO_ENCONTRADO: 'veiculo',
  VAGAS_ACIMA_DO_LIMITE: 'vagas',
  PARTIDA_NO_PASSADO: 'partida',
};

export function campoDoErroDePublicacao(codigo: string): CamposPublicacao | null {
  return CAMPO_POR_CODIGO[codigo] ?? null;
}
