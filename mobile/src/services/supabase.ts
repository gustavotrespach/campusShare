import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';

import type { Database } from '@/types/database';

import { armazenamentoSeguro } from './armazenamento-seguro';
import { AppError } from './erros';

// Único lugar do app que cria o cliente Supabase; telas usam as funções dos outros services.
let cliente: SupabaseClient<Database> | null = null;

function criarCliente(): SupabaseClient<Database> {
  // Acesso direto a process.env.EXPO_PUBLIC_*: o Expo só embute as variáveis escritas assim.
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const chavePublicavel = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !chavePublicavel) {
    throw new AppError(
      500,
      'CONFIGURACAO_AUSENTE',
      'App sem configuração do Supabase: defina EXPO_PUBLIC_SUPABASE_URL e ' +
        'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY no mobile/.env e reinicie o Expo.',
    );
  }

  const novo = createClient<Database>(url, chavePublicavel, {
    auth: {
      storage: armazenamentoSeguro,
      storageKey: 'campusshare-sessao',
      persistSession: true,
      autoRefreshToken: true,
      // No app nativo não há URL de navegador; o deep link de confirmação é tratado à parte (T11).
      detectSessionInUrl: false,
    },
  });

  // Renovação automática do token só com o app em primeiro plano (recomendação do supabase-js
  // para React Native: timers em segundo plano não são confiáveis).
  if (AppState.currentState === 'active') {
    novo.auth.startAutoRefresh();
  }
  AppState.addEventListener('change', (estado) => {
    if (estado === 'active') {
      novo.auth.startAutoRefresh();
    } else {
      novo.auth.stopAutoRefresh();
    }
  });

  return novo;
}

// Criado sob demanda: sem as variáveis de ambiente, a tela mostra o AppError em vez de travar o app.
export function obterSupabase(): SupabaseClient<Database> {
  cliente ??= criarCliente();
  return cliente;
}
