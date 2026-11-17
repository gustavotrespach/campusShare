import { AuthApiError, type Session } from '@supabase/supabase-js';

import type { Genero } from '@/utils/genero';
import { lerLinkDeConfirmacao } from '@/utils/link-confirmacao';
import { apenasDigitos } from '@/utils/validacao';

import { AppError, normalizarErro } from './erros';
import { urlDeConfirmacao } from './links';
import { obterSupabase } from './supabase';

// Tipo da sessão exposto pelo service, para telas e store não importarem o supabase-js.
export type Sessao = Session;

// O Auth compara e-mails em minúsculas; normalizar evita "conta não encontrada" por caixa alta.
function normalizarEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function entrar(email: string, senha: string): Promise<Sessao> {
  try {
    const { data, error } = await obterSupabase().auth.signInWithPassword({
      email: normalizarEmail(email),
      password: senha,
    });
    if (error) {
      throw error;
    }
    return data.session;
  } catch (erro) {
    throw normalizarErro(erro);
  }
}

// Logout sempre limpa a sessão do aparelho (SecureStore). O signOut() padrão (scope global) revoga
// as sessões no servidor e só então apaga a local; desde o auth-js 2.119, se a revogação falha (sem
// internet, 5xx), ele devolve o erro e mantém a sessão no aparelho. Nesse caso, o scope local apaga
// a sessão do aparelho antes de qualquer pedido à rede, e o refresh token expira sozinho no
// servidor. O erro da revogação remota não vai para a tela; o de limpeza local, sim.
export async function sair(): Promise<void> {
  const auth = obterSupabase().auth;
  try {
    const { error } = await auth.signOut();
    if (!error) {
      return;
    }
  } catch {
    // Mesma saída do erro devolvido: cai na limpeza local abaixo
  }
  try {
    // O error devolvido aqui é o da nova tentativa de revogação, já sem sessão no aparelho
    await auth.signOut({ scope: 'local' });
  } catch (erro) {
    throw normalizarErro(erro);
  }
}

export async function obterSessao(): Promise<Sessao | null> {
  try {
    const { data, error } = await obterSupabase().auth.getSession();
    if (error) {
      throw error;
    }
    return data.session;
  } catch (erro) {
    throw normalizarErro(erro);
  }
}

// Avisa a cada login, logout e renovação de token; devolve a função para cancelar a assinatura.
export function observarSessao(aoMudar: (sessao: Sessao | null) => void): () => void {
  const { data } = obterSupabase().auth.onAuthStateChange((_evento, sessao) => {
    aoMudar(sessao);
  });
  return () => data.subscription.unsubscribe();
}

export interface DadosCadastro {
  nomeCompleto: string;
  email: string;
  senha: string;
  genero: Genero;
  telefone: string;
}

// Os metadados viram a linha de public.usuario pelo trigger criar_perfil_usuario (docs/API.md).
// E-mail já cadastrado e não confirmado também responde sucesso (o Auth não revela a conta):
// a tela trata igual e oferece o reenvio.
export async function cadastrar(dados: DadosCadastro): Promise<void> {
  const telefone = apenasDigitos(dados.telefone);
  try {
    const { error } = await obterSupabase().auth.signUp({
      email: normalizarEmail(dados.email),
      password: dados.senha,
      options: {
        data: {
          nome_completo: dados.nomeCompleto.trim(),
          genero: dados.genero,
          ...(telefone ? { telefone } : {}),
        },
        emailRedirectTo: urlDeConfirmacao(),
      },
    });
    if (error) {
      throw error;
    }
  } catch (erro) {
    throw normalizarErro(erro);
  }
}

export async function reenviarConfirmacao(email: string): Promise<void> {
  try {
    const { error } = await obterSupabase().auth.resend({
      type: 'signup',
      email: normalizarEmail(email),
      options: { emailRedirectTo: urlDeConfirmacao() },
    });
    if (error) {
      throw error;
    }
  } catch (erro) {
    throw normalizarErro(erro);
  }
}

export const MENSAGEM_LINK_INVALIDO = 'Este link de confirmação não é válido.';

// Abre a sessão a partir do link de confirmação (o app não usa detectSessionInUrl).
export async function confirmarPorLink(url: string): Promise<Sessao> {
  const link = lerLinkDeConfirmacao(url);
  if (link === null) {
    throw new AppError(400, 'LINK_INVALIDO', MENSAGEM_LINK_INVALIDO);
  }
  try {
    if (link.tipo === 'erro') {
      // Mesmo formato dos erros do Auth, para reaproveitar as mensagens (ex.: otp_expired)
      throw new AuthApiError(link.descricao, 403, link.codigo);
    }
    const { data, error } = await obterSupabase().auth.setSession({
      access_token: link.accessToken,
      refresh_token: link.refreshToken,
    });
    if (error) {
      throw error;
    }
    if (!data.session) {
      throw new AppError(401, 'session_not_found', 'Sua sessão expirou. Entre novamente.');
    }
    return data.session;
  } catch (erro) {
    throw normalizarErro(erro);
  }
}
