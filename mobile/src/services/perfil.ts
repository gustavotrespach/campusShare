import type { Database } from '@/types/database';
import { apenasDigitos } from '@/utils/validacao';

import { AppError, normalizarErro } from './erros';
import { obterSupabase } from './supabase';

type Usuario = Database['public']['Tables']['usuario']['Row'];

export type MeuPerfil = Pick<
  Usuario,
  'nome_completo' | 'email_institucional' | 'genero' | 'telefone'
> & {
  instituicao: string;
};

// Só as colunas com GRANT UPDATE para o app (migration schema_inicial); e-mail e instituição vêm
// do cadastro e não mudam por aqui.
export type AlteracoesPerfil = Pick<Usuario, 'nome_completo' | 'genero' | 'telefone'>;

const COLUNAS_PERFIL = 'nome_completo, email_institucional, genero, telefone, instituicao(nome)';

const PERFIL_NAO_ENCONTRADO = new AppError(
  404,
  'PERFIL_NAO_ENCONTRADO',
  'Não encontramos seu perfil. Saia e entre novamente.',
);

type LinhaPerfil = Omit<MeuPerfil, 'instituicao'> & { instituicao: { nome: string } | null };

function paraMeuPerfil(linha: LinhaPerfil): MeuPerfil {
  return { ...linha, instituicao: linha.instituicao?.nome ?? '' };
}

// A RLS devolve só a linha do próprio usuário.
export async function obterMeuPerfil(): Promise<MeuPerfil> {
  try {
    const { data, error } = await obterSupabase()
      .from('usuario')
      .select(COLUNAS_PERFIL)
      .maybeSingle();
    if (error) {
      throw error;
    }
    if (!data) {
      throw PERFIL_NAO_ENCONTRADO;
    }
    return paraMeuPerfil(data);
  } catch (erro) {
    throw normalizarErro(erro);
  }
}

export async function atualizarPerfil(alteracoes: AlteracoesPerfil): Promise<MeuPerfil> {
  // Objeto montado campo a campo: nada além das três colunas liberadas chega ao banco.
  const telefone = alteracoes.telefone ? apenasDigitos(alteracoes.telefone) : '';
  const valores: AlteracoesPerfil = {
    nome_completo: alteracoes.nome_completo.trim(),
    genero: alteracoes.genero,
    telefone: telefone || null,
  };
  try {
    const supabase = obterSupabase();
    const { data: sessao } = await supabase.auth.getSession();
    if (!sessao.session) {
      throw new AppError(401, 'session_not_found', 'Sua sessão expirou. Entre novamente.');
    }
    // O filtro por id é exigido pelo PostgREST para UPDATE; quem garante o dono é a RLS.
    const { data, error } = await supabase
      .from('usuario')
      .update(valores)
      .eq('id_usuario', sessao.session.user.id)
      .select(COLUNAS_PERFIL)
      .maybeSingle();
    if (error) {
      throw error;
    }
    if (!data) {
      throw PERFIL_NAO_ENCONTRADO;
    }
    return paraMeuPerfil(data);
  } catch (erro) {
    throw normalizarErro(erro);
  }
}
