import type { Database } from '@/types/database';
import { centavosParaReais, reaisParaCentavos } from '@/utils/dinheiro';
import { paraIsoUtc } from '@/utils/data-hora';
import { arredondarCoordenada, type Local } from '@/utils/pontos';

import { AppError, normalizarErro } from './erros';
import { obterSupabase } from './supabase';

type Funcoes = Database['public']['Functions'];
type LinhaBusca = Funcoes['buscar_caronas']['Returns'][number];
type LinhaDetalhe = Funcoes['detalhar_carona']['Returns'][number];

// Dinheiro no app em centavos: a conversão de/para reais (decimal do banco) fica só aqui.
export type CaronaResumo = Omit<LinhaBusca, 'valor_por_passageiro'> & {
  valorPorPassageiroCentavos: number;
};

export type CaronaDetalhe = Omit<LinhaDetalhe, 'valor_por_passageiro' | 'custo_total'> & {
  valorPorPassageiroCentavos: number;
  custoTotalCentavos: number;
};

// O que a tela de publicar entrega. Não existe id_motorista: o motorista é o auth.uid() da
// sessão, decidido pela publicar_carona (docs/API.md → "caronas").
export interface NovaCarona {
  idVeiculo: string;
  origem: Local;
  destino: Local;
  partida: Date;
  vagas: number;
  custoTotalCentavos: number;
  toleranciaMin: number;
  somenteMulheres: boolean;
}

export interface FiltrosBusca {
  latitude: number;
  longitude: number;
  somenteMulheres: boolean;
  pagina?: number;
}

const CARONA_NAO_ENCONTRADA = new AppError(
  404,
  'CARONA_NAO_ENCONTRADA',
  'Carona não encontrada ou não está mais disponível.',
);

// Parâmetros montados campo a campo: nada além do contrato da RPC chega ao banco.
export async function publicarCarona(carona: NovaCarona): Promise<string> {
  try {
    const { data, error } = await obterSupabase().rpc('publicar_carona', {
      p_id_veiculo: carona.idVeiculo,
      p_origem: carona.origem.descricao.trim(),
      p_origem_lat: arredondarCoordenada(carona.origem.latitude),
      p_origem_lng: arredondarCoordenada(carona.origem.longitude),
      p_destino: carona.destino.descricao.trim(),
      p_destino_lat: arredondarCoordenada(carona.destino.latitude),
      p_destino_lng: arredondarCoordenada(carona.destino.longitude),
      p_data_hora_partida: paraIsoUtc(carona.partida),
      p_vagas_ofertadas: carona.vagas,
      p_custo_total: centavosParaReais(carona.custoTotalCentavos),
      p_tolerancia_min: carona.toleranciaMin,
      p_somente_mulheres: carona.somenteMulheres,
    });
    if (error) {
      throw error;
    }
    return data;
  } catch (erro) {
    throw normalizarErro(erro);
  }
}

// RN08, RN14 e RN18 são aplicadas pela buscar_caronas; o app só mostra o que vier.
export async function buscarCaronas(filtros: FiltrosBusca): Promise<CaronaResumo[]> {
  try {
    const { data, error } = await obterSupabase().rpc('buscar_caronas', {
      p_lat: arredondarCoordenada(filtros.latitude),
      p_lng: arredondarCoordenada(filtros.longitude),
      p_somente_mulheres: filtros.somenteMulheres,
      p_pagina: filtros.pagina ?? 1,
    });
    if (error) {
      throw error;
    }
    return data.map(({ valor_por_passageiro, ...linha }) => ({
      ...linha,
      valorPorPassageiroCentavos: reaisParaCentavos(valor_por_passageiro),
    }));
  } catch (erro) {
    throw normalizarErro(erro);
  }
}

export async function detalharCarona(idCarona: string): Promise<CaronaDetalhe> {
  try {
    const { data, error } = await obterSupabase().rpc('detalhar_carona', {
      p_id_carona: idCarona,
    });
    if (error) {
      throw error;
    }
    const linha = data[0];
    if (!linha) {
      throw CARONA_NAO_ENCONTRADA;
    }
    const { valor_por_passageiro, custo_total, ...resto } = linha;
    return {
      ...resto,
      valorPorPassageiroCentavos: reaisParaCentavos(valor_por_passageiro),
      custoTotalCentavos: reaisParaCentavos(custo_total),
    };
  } catch (erro) {
    throw normalizarErro(erro);
  }
}
