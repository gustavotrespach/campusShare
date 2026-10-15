import { FunctionsHttpError, type FunctionInvokeOptions } from '@supabase/supabase-js';

import { normalizarErro, type AppError } from './erros';
import { obterSupabase } from './supabase';

interface RespostaHttp {
  status: number;
  json: () => Promise<unknown>;
}

// Duck typing em vez de instanceof Response: o polyfill de fetch do React Native e o dos testes
// criam Response de outro realm.
function ehRespostaHttp(valor: unknown): valor is RespostaHttp {
  if (typeof valor !== 'object' || valor === null) {
    return false;
  }
  const resposta = valor as Partial<RespostaHttp>;
  return typeof resposta.status === 'number' && typeof resposta.json === 'function';
}

// O corpo do erro da Edge Function ({ error: { code, message, details } }) só pode ser lido de
// forma assíncrona; junta o status HTTP ao corpo para o normalizarErro.
async function erroDaFuncao(erro: unknown): Promise<AppError> {
  if (erro instanceof FunctionsHttpError && ehRespostaHttp(erro.context)) {
    try {
      const corpo = await erro.context.json();
      if (typeof corpo === 'object' && corpo !== null) {
        return normalizarErro({ ...corpo, status: erro.context.status });
      }
    } catch {
      // Corpo que não é JSON: cai no erro genérico abaixo.
    }
  }
  return normalizarErro(erro);
}

export async function invocarFuncao<T>(nome: string, opcoes?: FunctionInvokeOptions): Promise<T> {
  try {
    const { data, error } = await obterSupabase().functions.invoke<T>(nome, opcoes);
    if (error) {
      throw await erroDaFuncao(error);
    }
    return data as T;
  } catch (erro) {
    throw normalizarErro(erro);
  }
}
