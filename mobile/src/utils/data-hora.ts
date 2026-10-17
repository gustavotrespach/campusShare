// Horários são salvos em UTC e exibidos em America/Sao_Paulo (RNF06).
// O Brasil não tem horário de verão desde 2019 (Decreto 9.772/2019): Brasília é UTC−3 o ano
// todo. A conversão é feita aqui com esse deslocamento fixo, sem depender do suporte a fusos do
// Intl no Hermes. Se o horário de verão voltar, só este arquivo muda.
export const FUSO_APP = 'America/Sao_Paulo';
const DESLOCAMENTO_BRASILIA_MS = -3 * 60 * 60 * 1000;

const DIAS_SEMANA_CURTOS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const DIAS_SEMANA = [
  'domingo',
  'segunda-feira',
  'terça-feira',
  'quarta-feira',
  'quinta-feira',
  'sexta-feira',
  'sábado',
];

interface PartesBrasilia {
  ano: number;
  mes: number;
  dia: number;
  hora: number;
  minuto: number;
  diaSemana: number;
}

function partesEmBrasilia(instante: Date | string): PartesBrasilia {
  const deslocado = new Date(new Date(instante).getTime() + DESLOCAMENTO_BRASILIA_MS);
  return {
    ano: deslocado.getUTCFullYear(),
    mes: deslocado.getUTCMonth() + 1,
    dia: deslocado.getUTCDate(),
    hora: deslocado.getUTCHours(),
    minuto: deslocado.getUTCMinutes(),
    diaSemana: deslocado.getUTCDay(),
  };
}

function doisDigitos(valor: number): string {
  return valor.toString().padStart(2, '0');
}

// Lista: "sáb 18/10 · 12:30"
export function formatarDataHoraCurta(instante: Date | string): string {
  const p = partesEmBrasilia(instante);
  return (
    `${DIAS_SEMANA_CURTOS[p.diaSemana]} ${doisDigitos(p.dia)}/${doisDigitos(p.mes)} · ` +
    `${doisDigitos(p.hora)}:${doisDigitos(p.minuto)}`
  );
}

// Detalhe e formulário: "sábado, 18/10/2026 às 12:30"
export function formatarDataHoraCompleta(instante: Date | string): string {
  const p = partesEmBrasilia(instante);
  return (
    `${DIAS_SEMANA[p.diaSemana]}, ${doisDigitos(p.dia)}/${doisDigitos(p.mes)}/${p.ano} às ` +
    `${doisDigitos(p.hora)}:${doisDigitos(p.minuto)}`
  );
}

// Valor inicial do seletor: a próxima hora cheia depois de daqui a 1 hora
export function partidaSugerida(agora: Date = new Date()): Date {
  const sugestao = new Date(agora.getTime() + 60 * 60 * 1000);
  sugestao.setUTCMinutes(0, 0, 0);
  return new Date(sugestao.getTime() + 60 * 60 * 1000);
}

// O banco recebe ISO em UTC (timestamptz)
export function paraIsoUtc(instante: Date): string {
  return instante.toISOString();
}
