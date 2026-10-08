import { invocarFuncao } from './funcoes';

interface RespostaSaude {
  status: string;
}

// Edge Function pública (verify_jwt = false): confirma que o app alcança o backend.
export async function verificarSaude(): Promise<string> {
  const resposta = await invocarFuncao<RespostaSaude>('health', { method: 'GET' });
  return resposta.status;
}
