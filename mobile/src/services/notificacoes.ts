import type { Database } from '@/types/database';

import { normalizarErro } from './erros';
import { obterSupabase } from './supabase';

type LinhaNotificacao = Database['public']['Tables']['notificacao']['Row'];

// Notificações dentro do app (T29). Os avisos são gravados pelo backend (gatilhos); o app só lê os
// próprios (RLS) e marca como lidos pela RPC. Push fica para depois.
export type Notificacao = Pick<
  LinhaNotificacao,
  'id_notificacao' | 'tipo' | 'mensagem' | 'lida' | 'criado_em' | 'id_carona' | 'id_reserva'
>;

export const LIMITE_NOTIFICACOES = 50;

// As mais recentes primeiro
export async function listarNotificacoes(): Promise<Notificacao[]> {
  try {
    const { data, error } = await obterSupabase()
      .from('notificacao')
      .select('id_notificacao, tipo, mensagem, lida, criado_em, id_carona, id_reserva')
      .order('criado_em', { ascending: false })
      .limit(LIMITE_NOTIFICACOES);
    if (error) {
      throw error;
    }
    return data;
  } catch (falha) {
    throw normalizarErro(falha);
  }
}

export async function contarNaoLidas(): Promise<number> {
  try {
    const { data, error } = await obterSupabase().rpc('contar_notificacoes_nao_lidas');
    if (error) {
      throw error;
    }
    return data;
  } catch (falha) {
    throw normalizarErro(falha);
  }
}

// Sem ids: todas as do usuário. Devolve quantas deixaram de ser não lidas.
export async function marcarComoLidas(ids?: string[]): Promise<number> {
  try {
    const { data, error } = await obterSupabase().rpc(
      'marcar_notificacoes_lidas',
      ids ? { p_ids: ids } : {},
    );
    if (error) {
      throw error;
    }
    return data;
  } catch (falha) {
    throw normalizarErro(falha);
  }
}
