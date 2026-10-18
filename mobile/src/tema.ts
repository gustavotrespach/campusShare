import { Platform, type TextStyle, type ViewStyle } from 'react-native';

const cores = {
  primaria: '#0E6B63',
  primariaPressionada: '#0A4F49',
  primariaClara: '#E2F1EE',
  secundaria: '#F2694E',
  secundariaTexto: '#A33C26',
  secundariaClara: '#FDEBE6',
  fundo: '#F6F4EF',
  superficie: '#FFFFFF',
  superficieAlternativa: '#EFECE6',
  texto: '#17252A',
  textoSecundario: '#55626A',
  textoSutil: '#66727A',
  textoSobrePrimaria: '#FFFFFF',
  borda: '#E3DFD7',
  bordaForte: '#7C878C',
  sucesso: '#146C37',
  sucessoClaro: '#E4F3E9',
  alerta: '#7A4D00',
  alertaClaro: '#FFF1CC',
  erro: '#A8201A',
  erroClaro: '#FCE9E7',
  info: '#1A5A96',
  infoClaro: '#E6F0FA',
  neutro: '#4A555B',
  neutroClaro: '#ECEAE4',
  desabilitadoFundo: '#E7E4DD',
  desabilitadoTexto: '#5E6A70',
} as const;

// Escala de 4 pt: o número é o múltiplo de 4
const espaco = {
  x1: 4,
  x2: 8,
  x3: 12,
  x4: 16,
  x5: 20, // margem lateral das telas
  x6: 24,
  x8: 32,
  x10: 40,
  x12: 48,
} as const;

const raio = {
  pequeno: 6, // placa do carro, esqueleto
  medio: 12, // botão, campo, aviso, linha de filtro
  grande: 16, // card
  pilula: 999, // selo, chip, botão flutuante, avatar
} as const;

const tipografia = {
  display: { fontSize: 34, lineHeight: 40, fontWeight: '700', letterSpacing: -0.4 },
  titulo: { fontSize: 24, lineHeight: 30, fontWeight: '700' },
  subtitulo: { fontSize: 18, lineHeight: 24, fontWeight: '600' },
  destaque: { fontSize: 22, lineHeight: 28, fontWeight: '700' }, // hora no card
  corpo: { fontSize: 16, lineHeight: 22, fontWeight: '400' },
  corpoForte: { fontSize: 16, lineHeight: 22, fontWeight: '600' },
  rotulo: { fontSize: 14, lineHeight: 20, fontWeight: '600' },
  apoio: { fontSize: 14, lineHeight: 20, fontWeight: '400' }, // texto de aviso
  legenda: { fontSize: 13, lineHeight: 18, fontWeight: '400' },
  selo: { fontSize: 13, lineHeight: 16, fontWeight: '600' },
  botao: { fontSize: 16, lineHeight: 20, fontWeight: '600' },
} as const satisfies Record<string, TextStyle>;

// Valores em dinheiro e hora usam algarismos de largura fixa para não "dançar" na lista
const numerico: TextStyle = { fontVariant: ['tabular-nums'] };

const sombra = {
  nenhuma: {} as ViewStyle,
  cartao: Platform.select<ViewStyle>({
    ios: {
      shadowColor: '#17252A',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 8,
    },
    default: { elevation: 2 },
  }),
  flutuante: Platform.select<ViewStyle>({
    ios: {
      shadowColor: '#17252A',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.16,
      shadowRadius: 16,
    },
    default: { elevation: 8 },
  }),
} as const;

const toque = {
  minimo: 44, // área mínima de toque (iOS HIG / WCAG 2.5.5)
  botao: 52,
  campo: 52,
  chip: 40, // + hitSlop de 4 em cima e embaixo = 48
} as const;

export const tema = { cores, espaco, raio, tipografia, numerico, sombra, toque } as const;
export type Tema = typeof tema;
