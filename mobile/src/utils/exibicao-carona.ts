// Textos de exibição das caronas (T32). Só formatação: os números vêm do backend.
import { formatarDiaCurto, formatarHora } from './data-hora';
import { formatarReais } from './dinheiro';

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

// Acima da lista: "3 caronas · as mais perto primeiro"; nada quando a lista está vazia
export function textoContagemCaronas(quantidade: number): string | null {
  if (quantidade <= 0) {
    return null;
  }
  const caronas = quantidade === 1 ? '1 carona' : `${quantidade} caronas`;
  return `${caronas} · as mais perto primeiro`;
}

// Leitor de tela lê o card inteiro de uma vez
export function descreverCarona(carona: {
  data_hora_partida: string;
  origem: string;
  destino: string;
  valorPorPassageiroCentavos: number;
  vagas_disponiveis: number;
  nome_motorista: string;
}): string {
  return (
    `Carona ${formatarDiaCurto(carona.data_hora_partida)} às ` +
    `${formatarHora(carona.data_hora_partida)}, de ${carona.origem} para ${carona.destino}, ` +
    `${formatarReais(carona.valorPorPassageiroCentavos)} por pessoa, ` +
    `${textoVagas(carona.vagas_disponiveis)}, motorista ${carona.nome_motorista}`
  );
}
