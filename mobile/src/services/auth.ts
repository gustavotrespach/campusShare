import type { Session } from '@supabase/supabase-js';

import { normalizarErro } from './erros';
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

// Logout sempre limpa a sessão do aparelho (SecureStore): o auth-js apaga a sessão local mesmo
// quando o servidor não responde (sem internet), e aí o refresh token expira sozinho no servidor.
// Por isso o erro da revogação remota não é repassado à tela.
export async function sair(): Promise<void> {
  try {
    await obterSupabase().auth.signOut();
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
