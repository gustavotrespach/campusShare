import type { Database } from '@/types/database';
import { lerConsumo } from '@/utils/consumo';
import { normalizarPlaca } from '@/utils/placa';

import { AppError, normalizarErro } from './erros';
import { obterSupabase } from './supabase';

type LinhaVeiculo = Database['public']['Tables']['veiculo']['Row'];

export type Veiculo = Omit<LinhaVeiculo, 'id_motorista'>;

// O que o formulário entrega. id_motorista nunca é enviado: o default auth.uid() preenche no
// INSERT e a RLS impede trocar o dono no UPDATE (docs/API.md → "veiculos").
export interface DadosVeiculo {
  modelo: string;
  placa: string;
  cor: string;
  qtd_lugares: number;
  motorizacao: string | null;
  consumo_kml: string;
}

type ValoresVeiculo = Omit<Veiculo, 'id_veiculo'>;

const COLUNAS_VEICULO = 'id_veiculo, modelo, placa, cor, qtd_lugares, motorizacao, consumo_kml';

export const CODIGO_PLACA_DUPLICADA = 'PLACA_DUPLICADA';

const VEICULO_NAO_ENCONTRADO = new AppError(
  404,
  'VEICULO_NAO_ENCONTRADO',
  'Veículo não encontrado.',
);

// Objeto montado campo a campo: nada além das colunas do veículo chega ao banco.
function paraValores(dados: DadosVeiculo): ValoresVeiculo {
  const motorizacao = dados.motorizacao?.trim() ?? '';
  const consumo = lerConsumo(dados.consumo_kml);
  return {
    modelo: dados.modelo.trim(),
    placa: normalizarPlaca(dados.placa),
    cor: dados.cor.trim(),
    qtd_lugares: dados.qtd_lugares,
    motorizacao: motorizacao || null,
    consumo_kml: consumo === null || Number.isNaN(consumo) ? null : consumo,
  };
}

function ehPlacaDuplicada(erro: unknown): boolean {
  if (typeof erro !== 'object' || erro === null) {
    return false;
  }
  const { code, message } = erro as { code?: unknown; message?: unknown };
  return code === '23505' && typeof message === 'string' && message.includes('veiculo_placa_key');
}

// A placa é única no sistema todo (constraint veiculo_placa_key); o normalizarErro trataria o
// 23505 como erro genérico, então este service traduz antes.
function converterErro(erro: unknown): AppError {
  if (ehPlacaDuplicada(erro)) {
    return new AppError(409, CODIGO_PLACA_DUPLICADA, 'Esta placa já está cadastrada.');
  }
  return normalizarErro(erro);
}

// A RLS devolve só os veículos do próprio usuário.
export async function listarMeusVeiculos(): Promise<Veiculo[]> {
  try {
    const { data, error } = await obterSupabase()
      .from('veiculo')
      .select(COLUNAS_VEICULO)
      .order('modelo');
    if (error) {
      throw error;
    }
    return data;
  } catch (erro) {
    throw converterErro(erro);
  }
}

export async function obterVeiculo(idVeiculo: string): Promise<Veiculo> {
  try {
    const { data, error } = await obterSupabase()
      .from('veiculo')
      .select(COLUNAS_VEICULO)
      .eq('id_veiculo', idVeiculo)
      .maybeSingle();
    if (error) {
      throw error;
    }
    if (!data) {
      throw VEICULO_NAO_ENCONTRADO;
    }
    return data;
  } catch (erro) {
    throw converterErro(erro);
  }
}

export async function cadastrarVeiculo(dados: DadosVeiculo): Promise<Veiculo> {
  try {
    const { data, error } = await obterSupabase()
      .from('veiculo')
      .insert(paraValores(dados))
      .select(COLUNAS_VEICULO)
      .single();
    if (error) {
      throw error;
    }
    return data;
  } catch (erro) {
    throw converterErro(erro);
  }
}

// Veículo de outro motorista (ou já excluído) não gera erro no PostgREST: a RLS filtra a linha e
// a resposta vem vazia. Por isso a ausência de linha vira "Veículo não encontrado.".
export async function atualizarVeiculo(idVeiculo: string, dados: DadosVeiculo): Promise<Veiculo> {
  try {
    const { data, error } = await obterSupabase()
      .from('veiculo')
      .update(paraValores(dados))
      .eq('id_veiculo', idVeiculo)
      .select(COLUNAS_VEICULO)
      .maybeSingle();
    if (error) {
      throw error;
    }
    if (!data) {
      throw VEICULO_NAO_ENCONTRADO;
    }
    return data;
  } catch (erro) {
    throw converterErro(erro);
  }
}

// Veículo com carona é recusado pelo banco (VEICULO_EM_USO / VEICULO_COM_HISTORICO, 409); o
// normalizarErro já entrega a frase do hint como mensagem.
export async function excluirVeiculo(idVeiculo: string): Promise<void> {
  try {
    const { data, error } = await obterSupabase()
      .from('veiculo')
      .delete()
      .eq('id_veiculo', idVeiculo)
      .select('id_veiculo');
    if (error) {
      throw error;
    }
    if (data.length === 0) {
      throw VEICULO_NAO_ENCONTRADO;
    }
  } catch (erro) {
    throw converterErro(erro);
  }
}
