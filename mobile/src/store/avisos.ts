// Aviso de uma tela para a seguinte, só em memória (ex.: "Avaliação enviada." mostrado na lista de
// pendentes depois de voltar da tela de avaliar). Quem lê consome: o aviso aparece uma vez.
const avisos = new Map<string, string>();

// Lista de avaliações pendentes (T30)
export const AVISO_AVALIACOES = 'avaliacoes';

export function deixarAviso(tela: string, mensagem: string): void {
  avisos.set(tela, mensagem);
}

export function consumirAviso(tela: string): string | null {
  const mensagem = avisos.get(tela) ?? null;
  avisos.delete(tela);
  return mensagem;
}
