// Fakes de resposta HTTP do Supabase (Auth e PostgREST) para testar os services com o cliente
// real. Os formatos de erro copiam o que o Supabase local devolve.

export interface RespostaFalsa {
  ok: boolean;
  status: number;
  statusText: string;
  headers: { get: (nome: string) => string | null };
  json: () => Promise<unknown>;
  text: () => Promise<string>;
}

export function resposta(status: number, corpo: unknown): RespostaFalsa {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: '',
    headers: {
      get: (nome) => (nome.toLowerCase() === 'x-supabase-api-version' ? '2024-01-01' : null),
    },
    json: async () => corpo,
    text: async () => JSON.stringify(corpo),
  };
}

function base64Url(valor: object): string {
  return btoa(JSON.stringify(valor)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

const AGORA = Math.floor(Date.now() / 1000);
export const ID_USUARIO = 'e0000000-0000-0000-0000-000000000001';
export const ACCESS_TOKEN = [
  base64Url({ alg: 'HS256', typ: 'JWT' }),
  base64Url({ sub: ID_USUARIO, exp: AGORA + 3600, role: 'authenticated' }),
  'assinatura',
].join('.');

// Usuário com metadados longos: a sessão passa de 2048 bytes e precisa ser dividida em partes.
export const SESSAO = {
  access_token: ACCESS_TOKEN,
  token_type: 'bearer',
  expires_in: 3600,
  expires_at: AGORA + 3600,
  refresh_token: 'refresh-falso',
  user: {
    id: ID_USUARIO,
    aud: 'authenticated',
    role: 'authenticated',
    email: 'mariana.souza@rede.ulbra.br',
    email_confirmed_at: new Date().toISOString(),
    app_metadata: { provider: 'email', providers: ['email'] },
    user_metadata: { nome_completo: 'Mariana Conceição Gonçalves de Souza '.repeat(40) },
    created_at: new Date().toISOString(),
  },
};
