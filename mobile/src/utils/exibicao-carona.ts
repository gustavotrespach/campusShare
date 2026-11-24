// Textos de exibição das caronas (T32). Só formatação: os números vêm do backend.
import { rotuloNotaMedia } from './avaliacoes';
import { descreverQuandoRelativo } from './data-hora';
import { formatarReais } from './dinheiro';
import { nomeCurtoLocal } from './listas';

export function textoVagas(vagas: number): string {
  return vagas === 1 ? '1 vaga' : `${vagas} vagas`;
}

// "a 0,4 km"
export function textoDistancia(km: number): string {
  return `a ${km.toFixed(1).replace('.', ',')} km`;
}

// Card: "Onix prata"; detalhe: "Onix · prata"
export function descreverVeiculo(modelo: string, cor: string, separador = ' '): string {
  return `${modelo}${separador}${cor.toLocaleLowerCase('pt-BR')}`;
}

// Leitor de tela lê o card inteiro numa frase (T43): "Para ULBRA Torres, saindo de Centro, Torres,
// a 0,4 km, hoje às 12:30, R$ 6,00 por pessoa, 2 vagas, motorista Bruno, nota média 4,0"
export function descreverCarona(
  carona: {
    data_hora_partida: string;
    origem: string;
    destino: string;
    distancia_km: number;
    valorPorPassageiroCentavos: number;
    vagas_disponiveis: number;
    nome_motorista: string;
    media_motorista: number | null;
    somente_mulheres: boolean;
  },
  agora: Date = new Date(),
): string {
  return [
    `Para ${nomeCurtoLocal(carona.destino)}`,
    `saindo de ${nomeCurtoLocal(carona.origem)}`,
    textoDistancia(carona.distancia_km),
    descreverQuandoRelativo(carona.data_hora_partida, agora),
    `${formatarReais(carona.valorPorPassageiroCentavos)} por pessoa`,
    textoVagas(carona.vagas_disponiveis),
    `motorista ${carona.nome_motorista}`,
    ...(carona.media_motorista !== null ? [rotuloNotaMedia(carona.media_motorista)] : []),
    ...(carona.somente_mulheres ? ['somente mulheres'] : []),
  ].join(', ');
}
