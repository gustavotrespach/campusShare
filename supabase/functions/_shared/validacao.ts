import { z } from 'npm:zod@4.6.5';

import { AppError } from './erros.ts';

export { z };

export const CODIGO_PAYLOAD_INVALIDO = 'PAYLOAD_INVALIDO';

// Chave = caminho do campo ('veiculo.placa'); '_' quando o problema é o corpo inteiro.
export type CamposInvalidos = Record<string, string[]>;

export function camposInvalidos(erro: z.ZodError): CamposInvalidos {
  const campos: CamposInvalidos = {};
  for (const issue of erro.issues) {
    const caminho = issue.path.length > 0 ? issue.path.map(String).join('.') : '_';
    (campos[caminho] ??= []).push(issue.message);
  }
  return campos;
}

export function validar<T>(schema: z.ZodType<T>, dados: unknown): T {
  const resultado = schema.safeParse(dados);
  if (!resultado.success) {
    throw new AppError(400, CODIGO_PAYLOAD_INVALIDO, 'Dados inválidos.', {
      campos: camposInvalidos(resultado.error),
    });
  }
  return resultado.data;
}

export async function validarCorpo<T>(req: Request, schema: z.ZodType<T>): Promise<T> {
  let corpo: unknown;
  try {
    corpo = await req.json();
  } catch {
    throw new AppError(400, CODIGO_PAYLOAD_INVALIDO, 'O corpo da requisição não é um JSON válido.');
  }
  return validar(schema, corpo);
}
