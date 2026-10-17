// Ajuda de preenchimento do consumo (km/l). A motorização sozinha é imprecisa (ADR-007 e
// docs/architecture.md): o valor abaixo é só uma sugestão inicial, e vale o que o motorista confirmar.

export const MOTORIZACOES = ['1.0', '1.3', '1.4', '1.5', '1.6', '1.8', '2.0'] as const;
export type Motorizacao = (typeof MOTORIZACOES)[number];

// Gasolina, ciclo urbano, valores aproximados para carros populares e médios.
const CONSUMO_SUGERIDO: Record<Motorizacao, number> = {
  '1.0': 13.0,
  '1.3': 12.0,
  '1.4': 11.5,
  '1.5': 11.5,
  '1.6': 11.0,
  '1.8': 10.0,
  '2.0': 9.5,
};

// consumo_kml é decimal(4,1) no banco; acima disso não existe carro de passeio
const CONSUMO_MAXIMO = 99.9;

export function ehMotorizacao(valor: string | null): valor is Motorizacao {
  return valor !== null && (MOTORIZACOES as readonly string[]).includes(valor);
}

export function consumoSugerido(motorizacao: string | null): number | null {
  return ehMotorizacao(motorizacao) ? CONSUMO_SUGERIDO[motorizacao] : null;
}

// Exibição em pt-BR, com 1 casa: 13 → "13,0"
export function formatarConsumo(consumo: number | null): string {
  return consumo === null ? '' : consumo.toFixed(1).replace('.', ',');
}

// Aceita vírgula ou ponto e arredonda para 1 casa, como a coluna guarda.
// Vazio → null (campo opcional); texto que não é número → NaN (a validação recusa).
export function lerConsumo(texto: string): number | null {
  const valor = texto.trim().replace(',', '.');
  if (valor.length === 0) {
    return null;
  }
  if (!/^\d+(\.\d+)?$/.test(valor)) {
    return Number.NaN;
  }
  return Math.round(Number(valor) * 10) / 10;
}

export function validarConsumo(texto: string): string | undefined {
  const consumo = lerConsumo(texto);
  if (consumo === null) {
    return undefined;
  }
  if (Number.isNaN(consumo) || consumo <= 0 || consumo > CONSUMO_MAXIMO) {
    return 'Informe o consumo em km/l, ex.: 12,5.';
  }
  return undefined;
}
