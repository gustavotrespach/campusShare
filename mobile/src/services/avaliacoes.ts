import type { Database } from '@/types/database';
import type { PapelAvaliador } from '@/utils/avaliacoes';

import { AppError, CODIGO_ERRO_INESPERADO, normalizarErro } from './erros';
import { obterSupabase } from './supabase';

type Funcoes = Database['public']['Functions'];
type LinhaPendente = Funcoes['avaliacoes_pendentes']['Returns'][number];

export type AvaliacaoPendente = Omit<LinhaPendente, 'papel'> & { papel: PapelAvaliador };

// Os tipos gerados dizem number/string, mas a média vem null para quem ainda não foi avaliado e a
// foto (T44), null para quem não tem foto
export interface PerfilPublico {
  idUsuario: string;
  nome: string;
  media: number | null;
  total: number;
  fotoCaminho: string | null;
}

const USUARIO_NAO_ENCONTRADO = new AppError(
  404,
  'USUARIO_NAO_ENCONTRADO',
  'Usuário não encontrado.',
);

const RESPOSTA_INESPERADA = new AppError(
  500,
  CODIGO_ERRO_INESPERADO,
  'Algo deu errado. Tente novamente em instantes.',
);

// RN19: o avaliado, o status e o prazo de 7 dias são decididos pela avaliar_participante; o erro
// chega com a frase do hint (ex.: PRAZO_AVALIACAO_ENCERRADO, AVALIACAO_DUPLICADA)
export async function avaliarParticipante(
  idReserva: string,
  nota: number,
  comentario?: string,
): Promise<string> {
  try {
    const texto = comentario?.trim();
    const { data, error } = await obterSupabase().rpc('avaliar_participante', {
      p_id_reserva: idReserva,
      p_nota: nota,
      // Sem comentário, o parâmetro nem vai (o banco usa null)
      ...(texto ? { p_comentario: texto } : {}),
    });
    if (error) {
      throw error;
    }
    return data;
  } catch (falha) {
    throw normalizarErro(falha);
  }
}

export async function listarAvaliacoesPendentes(): Promise<AvaliacaoPendente[]> {
  try {
    const { data, error } = await obterSupabase().rpc('avaliacoes_pendentes');
    if (error) {
      throw error;
    }
    return data.map((linha) => {
      if (linha.papel !== 'PASSAGEIRO' && linha.papel !== 'MOTORISTA') {
        throw RESPOSTA_INESPERADA;
      }
      return { ...linha, papel: linha.papel };
    });
  } catch (falha) {
    throw normalizarErro(falha);
  }
}

export async function obterPerfilPublico(idUsuario: string): Promise<PerfilPublico> {
  try {
    const { data, error } = await obterSupabase().rpc('perfil_publico', {
      p_id_usuario: idUsuario,
    });
    if (error) {
      throw error;
    }
    const linha = data[0];
    if (!linha) {
      throw USUARIO_NAO_ENCONTRADO;
    }
    const media: number | null = linha.media_avaliacoes ?? null;
    const fotoCaminho: string | null = linha.foto_caminho ?? null;
    return {
      idUsuario: linha.id_usuario,
      nome: linha.nome,
      media,
      total: linha.total_avaliacoes,
      fotoCaminho,
    };
  } catch (falha) {
    throw normalizarErro(falha);
  }
}
