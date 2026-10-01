// Separado do index.ts para ser testável sem subir um servidor (Deno.serve).
export function handler(_req: Request): Response {
  return Response.json({ status: 'ok' }, { status: 200 });
}
