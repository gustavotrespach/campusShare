// Só exibição: partes do nome para o Avatar e a saudação da tela inicial.

function palavras(nome: string): string[] {
  return nome.trim().split(/\s+/).filter(Boolean);
}

// "Ana Souza" → "AS"; "Marina" → "M"; primeira e última palavra, em maiúsculas
export function iniciais(nome: string): string {
  const partes = palavras(nome);
  if (partes.length === 0) {
    return '';
  }
  const primeira = partes[0].charAt(0);
  const ultima = partes.length > 1 ? partes[partes.length - 1].charAt(0) : '';
  return `${primeira}${ultima}`.toLocaleUpperCase('pt-BR');
}

// "Júlia Rocha" → "Júlia"; vazio quando não há nome
export function primeiroNome(nome: string | null | undefined): string {
  return palavras(nome ?? '')[0] ?? '';
}
