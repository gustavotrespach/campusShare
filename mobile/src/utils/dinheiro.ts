// Dinheiro no app é sempre centavos (inteiro), nunca float (AGENTS.md). A conversão para reais
// acontece só na fronteira com o backend (services), que usa decimal(10,2).

// Lê o que o usuário digitou ("24", "24,5", "R$ 1.234,56", "24.50") e devolve centavos.
// Vazio → null; formato inválido ou mais de 2 casas → NaN (a validação recusa).
export function lerReais(texto: string): number | null {
  let valor = texto.replace(/R\$/i, '').replace(/\s/g, '');
  if (valor.length === 0) {
    return null;
  }
  // Com vírgula e ponto juntos, o ponto é separador de milhar ("1.234,56")
  if (valor.includes(',') && valor.includes('.')) {
    if (!/^\d{1,3}(\.\d{3})+,\d{1,2}$/.test(valor)) {
      return Number.NaN;
    }
    valor = valor.replace(/\./g, '');
  }
  const partes = /^(\d+)(?:[.,](\d{1,2}))?$/.exec(valor);
  if (!partes) {
    return Number.NaN;
  }
  // Soma de inteiros em vez de Number("24.5") * 100, que erra em casos como 4.35
  const reais = Number(partes[1]);
  const centavos = Number((partes[2] ?? '').padEnd(2, '0'));
  return reais * 100 + centavos;
}

export function centavosParaReais(centavos: number): number {
  return centavos / 100;
}

// O backend devolve reais com 2 casas (ex.: 8.33); Math.round corrige a imprecisão do float.
export function reaisParaCentavos(reais: number): number {
  return Math.round(reais * 100);
}

// "R$ 1.234,56". Formatador próprio em vez de Intl.NumberFormat: o resultado não depende do
// suporte a Intl do Hermes em cada aparelho, e é coberto por teste.
export function formatarReais(centavos: number): string {
  const sinal = centavos < 0 ? '-' : '';
  const absoluto = Math.abs(Math.round(centavos));
  const reais = Math.floor(absoluto / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const resto = (absoluto % 100).toString().padStart(2, '0');
  return `${sinal}R$ ${reais},${resto}`;
}
