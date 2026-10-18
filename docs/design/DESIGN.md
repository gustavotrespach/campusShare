# CampusShare — Identidade visual e design das telas

> Especificação para implementar em React Native + Expo (Expo Go). Não é código de tela: é o que
> cada tela e componente deve ser. Mockups em [`mockups/`](mockups/), ícone e splash em
> [`marca/`](marca/).
>
> **Regra para quem implementa:** o design muda só a aparência. Nenhuma regra de negócio vem para o
> app (rateio, teto, vagas e status continuam vindo do backend). Os textos que já existem no app
> foram mantidos; os textos **novos** estão marcados com ✚.

| Arquivo | O que é |
|---|---|
| `mockups/00-marca.png` | Ícone em vários tamanhos, Android adaptativo, monocromático, splash e assinatura |
| `mockups/01-componentes.png` | Botão, campo, aviso, selo, chip e esqueleto de carregamento com os estados |
| `mockups/05-caronas-proximas.png` | Tela 5 |
| `mockups/06-detalhe-carona.png` | Tela 6 |
| `mockups/08-pagamento.png` | Tela 8: aguardando e confirmado |
| `mockups/09-minhas-reservas.png` | Tela 9: lista e vazia |
| `marca/*.svg` e `marca/*.png` | Ícone iOS, camadas do ícone adaptativo do Android, monocromático, splash |

---

## 1. Identidade

**Conceito.** CampusShare é "a carona da turma": o colega que já vai para o campus e divide a
gasolina, sem climão. A identidade vem do litoral norte (o verde-mar de Torres e o coral do
pôr do sol na Guarita) e de um símbolo simples, a **rota**: um anel de origem ligado a um pin de
destino. O mesmo desenho aparece no ícone e em todo trajeto dentro do app.

**Personalidade:** confiável (verde profundo, informação clara, selo de e-mail confirmado),
amigável (cantos arredondados, linguagem de colega, "Olá, Júlia"), jovem e simples (uma cor de
ação, nada de enfeite). Não usa o azul nem o logo da ULBRA.

### Paleta

| Token | Hex | Uso |
|---|---|---|
| `primaria` | `#0E6B63` | Verde-mar. Botões principais, links, preços, ícones ativos, chip selecionado, fundo do ícone e do splash |
| `primariaPressionada` | `#0A4F49` | Botão primário pressionado |
| `primariaClara` | `#E2F1EE` | Fundo do bloco de valor, avatar, círculo do estado vazio, secundário pressionado |
| `secundaria` | `#F2694E` | Coral. **Só elementos gráficos**: pin de destino, ponto do trajeto, detalhe do ícone. Nunca texto sobre branco (3,0:1) |
| `secundariaTexto` | `#A33C26` | Texto/ícone em coral: selo "Somente mulheres", ícone do filtro |
| `secundariaClara` | `#FDEBE6` | Fundo do selo "Somente mulheres" |
| `fundo` | `#F6F4EF` | Fundo de todas as telas (areia) |
| `superficie` | `#FFFFFF` | Cards, campos, barra inferior |
| `superficieAlternativa` | `#EFECE6` | Card/linha pressionada |
| `texto` | `#17252A` | Texto principal |
| `textoSecundario` | `#55626A` | Legendas, rótulos auxiliares, metadados |
| `textoSutil` | `#66727A` | Placeholder, chevrons |
| `textoSobrePrimaria` | `#FFFFFF` | Texto em botão primário, perigo e chip selecionado |
| `borda` | `#E3DFD7` | Borda de card, divisórias (decorativa) |
| `bordaForte` | `#7C878C` | Borda de campo de texto, trilho do Switch desligado (precisa de 3:1) |
| `sucesso` / `sucessoClaro` | `#146C37` / `#E4F3E9` | Pagamento confirmado, selo Confirmada, "E-mail institucional confirmado" |
| `alerta` / `alertaClaro` | `#7A4D00` / `#FFF1CC` | Selo Aguardando pagamento |
| `erro` / `erroClaro` | `#A8201A` / `#FCE9E7` | Erros, selo Cancelada, botão perigo |
| `info` / `infoClaro` | `#1A5A96` / `#E6F0FA` | Aviso informativo |
| `neutro` / `neutroClaro` | `#4A555B` / `#ECEAE4` | Selo Expirada, campo somente leitura, esqueleto |
| `desabilitadoFundo` / `desabilitadoTexto` | `#E7E4DD` / `#5E6A70` | Botão desabilitado |

### Contraste (WCAG 2.1, calculado)

AA pede 4,5:1 para texto normal e 3:1 para texto grande (≥ 18,66 pt negrito ou ≥ 24 pt) e para
componentes gráficos.

| Texto / fundo | Contraste | Resultado |
|---|---|---|
| `texto` / `fundo` | 14,32:1 | AA e AAA |
| `texto` / `superficie` | 15,74:1 | AA e AAA |
| `textoSecundario` / `fundo` | 5,72:1 | AA |
| `textoSecundario` / `superficie` | 6,28:1 | AA |
| `textoSutil` / `superficie` (placeholder) | 4,94:1 | AA |
| branco / `primaria` (botão) | 6,36:1 | AA |
| branco / `primariaPressionada` | 9,43:1 | AA e AAA |
| `primaria` / `superficie` (preço, link) | 6,36:1 | AA |
| `primaria` / `fundo` | 5,79:1 | AA |
| `primaria` / `primariaClara` (bloco de valor) | 5,47:1 | AA |
| `secundariaTexto` / `superficie` | 6,50:1 | AA |
| `secundariaTexto` / `secundariaClara` (selo) | 5,63:1 | AA |
| `secundaria` / `superficie` | 3,04:1 | **Só gráfico** (≥ 3:1), proibido em texto |
| `texto` / `secundaria` | 5,18:1 | AA (caso um dia haja texto sobre coral) |
| `sucesso` / `sucessoClaro` | 5,66:1 | AA |
| `sucesso` / `superficie` | 6,50:1 | AA |
| `alerta` / `alertaClaro` | 6,47:1 | AA |
| `erro` / `erroClaro` | 6,22:1 | AA |
| branco / `erro` (botão perigo) | 7,28:1 | AA e AAA |
| `info` / `infoClaro` | 6,18:1 | AA |
| `neutro` / `neutroClaro` | 6,37:1 | AA |
| `desabilitadoTexto` / `desabilitadoFundo` | 4,39:1 | Isento (controle desabilitado), legível mesmo assim |
| `bordaForte` / `superficie` (borda de campo) | 3,68:1 | AA para componente (≥ 3:1) |
| `bordaForte` / `fundo` | 3,35:1 | AA para componente |

---

## 2. Tokens — `mobile/src/tema.ts`

Arquivo único, importado por componentes e telas. Nenhuma cor, tamanho ou sombra escrita direto
na tela: sempre `tema.*`.

```ts
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
```

Notas de plataforma:

- **Fonte:** não definir `fontFamily`; o sistema usa San Francisco (iOS) e Roboto (Android).
  No Android, `fontWeight: '600'` é desenhado como negrito; está correto assim.
- **Elevation** só aparece se a View tiver `backgroundColor`. Cards e barras sempre com
  `backgroundColor: tema.cores.superficie`.
- **Escala de fonte do sistema:** manter `allowFontScaling` (padrão). Em `display`, `titulo` e no
  texto de botão, usar `maxFontSizeMultiplier={1.4}` para não quebrar o layout.
- **Status bar:** `<StatusBar style="dark" />` (só modo claro). `app.json` já tem
  `"userInterfaceStyle": "light"`.
- **Ícones:** a dependência `@expo/vector-icons` **não está instalada** hoje. Instalar com
  `npx expo install @expo/vector-icons` (funciona no Expo Go) e registrar no PR. Todos os ícones
  abaixo são **Ionicons** (`import Ionicons from '@expo/vector-icons/Ionicons'`); os nomes foram
  conferidos no glyphmap do Ionicons.
- **Área segura:** `react-native-safe-area-context` já está instalado. Usar `useSafeAreaInsets()`
  no cabeçalho do Início, no botão flutuante e nas barras inferiores.
- **Indicador de carregamento:** `ActivityIndicator` sempre com `color={tema.cores.primaria}`
  (branco dentro de botão primário/perigo).

---

## 3. Componentes

Medidas em pt. "Gutter" = margem lateral da tela, `espaco.x5` (20).

### 3.1 Botão (`Botao.tsx`, já existe — ampliar)

Props: `titulo`, `onPress`, `variante?: 'primario' | 'secundario' | 'perigo' | 'texto'`,
`icone?: nome Ionicons`, `carregando?`, `desabilitado?`. Mantém `accessibilityRole="button"` e
`accessibilityState={{ disabled, busy }}` como hoje.

| Medida | Valor |
|---|---|
| Altura | 52 (`toque.botao`); variante `texto` 44 |
| Raio | 12 |
| Padding horizontal | 20 |
| Largura | ocupa a largura do pai (`alignSelf: 'stretch'`), exceto o botão flutuante |
| Ícone | 20, à esquerda do texto, `gap` 8, mesma cor do texto |
| Texto | `tipografia.botao`, `numberOfLines={1}` |

| Variante | Normal | Pressionado |
|---|---|---|
| `primario` | fundo `primaria`, texto branco | fundo `primariaPressionada` |
| `secundario` | fundo `superficie`, borda 1.5 `primaria`, texto `primaria` | fundo `primariaClara` |
| `perigo` | fundo `erro`, texto branco | fundo `#861A15` |
| `texto` | sem fundo, texto `primaria` | fundo `primariaClara` |

| Estado | Visual |
|---|---|
| Desabilitado | qualquer variante: fundo `desabilitadoFundo`, sem borda, texto `desabilitadoTexto`. Sem opacidade (a opacidade de 0.6 de hoje deixa o texto sem contraste) |
| Carregando | mantém fundo e largura da variante; troca o texto por `ActivityIndicator` pequeno (branco em primário/perigo, `primaria` nos outros); não aceita toque |

Uso: no máximo **um** botão primário por tela. "Sair", "Voltar ao login" e "Já tenho conta" são
`texto` ou `secundario`.

### 3.2 Campo de texto (`CampoTexto.tsx`, já existe — ampliar)

Props atuais (`rotulo`, `erro`, `...TextInputProps`) mais `ajuda?: string`,
`icone?: nome Ionicons` e `senha?: boolean`.

Estrutura (coluna, `gap` 6): rótulo → caixa → mensagem (ajuda ou erro).

| Parte | Medida |
|---|---|
| Rótulo | `tipografia.rotulo`, cor `texto` |
| Caixa | altura 52, raio 12, fundo `superficie`, padding horizontal 14, `gap` 10 |
| Texto digitado | `tipografia.corpo`, cor `texto`; placeholder `textoSutil` |
| Ícone à esquerda (opcional) | 20, `textoSecundario` (vira `primaria` no foco) |
| Botão de senha (`senha`) | à direita, área 44 × 44, ícone `eye-outline` / `eye-off-outline` 20, `accessibilityLabel` "Mostrar senha" / "Ocultar senha" ✚ |
| Ajuda | `tipografia.legenda`, `textoSecundario` |
| Erro | linha com `alert-circle` 16 + texto `legenda`, cor `erro`, `accessibilityLiveRegion="polite"` |

| Estado | Borda |
|---|---|
| Normal | 1.5 `bordaForte` |
| Foco (`onFocus`/`onBlur` num `useState`) | 2 `primaria`; padding horizontal 13.5 para o texto não pular |
| Erro | 2 `erro` (mesmo com foco); a mensagem de erro substitui a de ajuda |
| Somente leitura | fundo `neutroClaro`, borda 1 `borda`, texto `textoSecundario`, `editable={false}` |

Ícones sugeridos: e-mail `mail-outline`, senha `lock-closed-outline`, nome `person-outline`,
telefone `call-outline`, placa `card-outline`, valor `cash-outline`.

### 3.3 Card de carona (`ItemCarona.tsx`, já existe — redesenhar)

`Pressable` com `accessibilityRole="button"` e o `accessibilityHint` atual.

| Parte | Medida |
|---|---|
| Container | fundo `superficie`, raio 16, borda 1 `borda`, `sombra.cartao`, padding 16, `gap` 12 |
| Pressionado | fundo `superficieAlternativa` |
| Linha 1 | esquerda: hora (`destaque`, numérico) + dia curto (`legenda`), alinhados pela base, `gap` 8. Direita: valor (`subtitulo` em 700, `primaria`, numérico) e embaixo "por pessoa" (`legenda`), alinhados à direita |
| Linha 2 — trajeto | componente **LinhaRota compacta** (3.8) |
| Linha 3 — metadados | linha com `gap` 16, `flexWrap`: `people-outline` + "2 vagas" / "1 vaga"; `navigate-outline` + "a 0,4 km"; `hourglass-outline` + "10 min". Ícones 16 `textoSecundario`, texto `legenda` |
| Selo opcional | se `somente_mulheres`: SeloStatus "Somente mulheres" (3.4) |
| Divisória | 1 pt `borda` |
| Linha 4 — motorista | Avatar 40 (3.9) + coluna (nome `corpoForte`; "Onix prata" = modelo + cor em minúsculas na `legenda`) + `chevron-forward` 20 `textoSutil` |

A hora e o dia vêm da formatação já existente (`formatarDataHoraCurta` produz "dom 18/10 · 12:30");
para separar hora e dia, criar em `utils/data-hora.ts` `formatarHora` ("12:30") e
`formatarDiaCurto` ("dom 18/10") — só exibição.

`accessibilityLabel` do card ✚: "Carona dom 18/10 às 12:30, de Centro de Torres para ULBRA
Torres, R$ 6,00 por pessoa, 2 vagas, motorista Ana Souza".

### 3.4 Selo de status (`SeloStatus.tsx`, novo)

Props: `tipo: 'PENDENTE' | 'CONFIRMADA' | 'CANCELADA' | 'EXPIRADA' | 'SOMENTE_MULHERES'`.
O texto vem de `rotuloStatusReserva` (já existe), para não duplicar rótulos.

| Medida | Valor |
|---|---|
| Altura | 24, padding horizontal 10, raio `pilula`, `alignSelf: 'flex-start'` |
| Conteúdo | ícone 14 + texto `tipografia.selo`, `gap` 4 |

| Tipo | Fundo | Texto e ícone | Ícone | Texto |
|---|---|---|---|---|
| PENDENTE | `alertaClaro` | `alerta` | `time-outline` | Aguardando pagamento |
| CONFIRMADA | `sucessoClaro` | `sucesso` | `checkmark-circle` | Confirmada |
| CANCELADA | `erroClaro` | `erro` | `close-circle` | Cancelada |
| EXPIRADA | `neutroClaro` | `neutro` | `hourglass-outline` | Expirada |
| SOMENTE_MULHERES | `secundariaClara` | `secundariaTexto` | `female-outline` | Somente mulheres |

A cor nunca é a única pista: todo selo tem ícone e texto.

### 3.5 Aviso (`Aviso.tsx`, já existe — redesenhar)

Props atuais (`mensagem`, `tipo`) mais `acao?: { titulo: string; onPress: () => void }`.
Mantém `accessibilityRole="alert"` e `accessibilityLiveRegion="polite"`.

| Medida | Valor |
|---|---|
| Container | linha, raio 12, padding 12 vertical / 14 horizontal, `gap` 10, `borderLeftWidth` 4 |
| Ícone | 20, alinhado ao topo |
| Texto | `tipografia.apoio`, `flex: 1` |
| Ação (opcional) | botão `texto` abaixo do texto, alinhado à esquerda, altura 44 |

| Tipo | Fundo | Borda esquerda, ícone e texto | Ícone |
|---|---|---|---|
| `info` | `infoClaro` | `info` | `information-circle` |
| `sucesso` | `sucessoClaro` | `sucesso` | `checkmark-circle` |
| `erro` | `erroClaro` | `erro` | `alert-circle` |

### 3.6 Estado vazio (`EstadoVazio.tsx`, novo)

Props: `icone`, `titulo`, `mensagem`, `acao?: { titulo; icone?; onPress }`.

Coluna centralizada, padding horizontal 40 (o texto não passa de ~300 pt):
círculo 80 `primariaClara` com ícone 36 `primaria` → 20 → título `subtitulo` centralizado →
8 → mensagem `corpo` `textoSecundario` centralizada → 24 → botão primário (largura total).
Dentro de lista, fica no `ListEmptyComponent` com `paddingVertical` 48.

### 3.7 Cabeçalho de tela

**Padrão (todas as telas, exceto Início e as públicas):** header nativo do Stack, configurado
uma vez em `app/(autenticado)/_layout.tsx` via `screenOptions`:

| Opção | Valor |
|---|---|
| `headerStyle` | `{ backgroundColor: tema.cores.fundo }` |
| `headerShadowVisible` | `false` |
| `headerTintColor` | `tema.cores.primaria` (seta e "Voltar") |
| `headerTitleStyle` | `{ fontSize: 17, fontWeight: '600', color: tema.cores.texto }` |
| `headerTitleAlign` | `'center'` (Android igual ao iOS) |
| `headerBackTitle` | `'Voltar'` |
| `contentStyle` | `{ backgroundColor: tema.cores.fundo }` |

Os títulos de cada rota continuam os de hoje.

**Início (`CabecalhoInicio`, novo):** `headerShown: false` na rota `index` e cabeçalho próprio
(ver tela 5). Padding superior = `insets.top + 8`, horizontal 20.

**Telas públicas (Entrar, Cadastro, Confira seu e-mail, Confirmação):** sem header; a própria
tela traz o título.

### 3.8 LinhaRota (`LinhaRota.tsx`, novo)

O desenho da marca no app: anel de origem, linha, ponto coral de destino.

- Trilho (coluna de 12 de largura, `gap` 3): anel 12 × 12 (borda 2.5 `primaria`, fundo
  `superficie`) → linha 2 de largura, cor `borda`, `flex: 1` (mín. 14) → ponto 12 × 12
  `secundaria`.
- Textos ao lado, `gap` 12 entre trilho e textos.
- **Compacta** (card): origem e destino em `corpo`, `gap` 8.
- **Completa** (detalhe): cada ponto com rótulo "Origem"/"Destino" (`legenda`) em cima do nome
  (`subtitulo`), `gap` 12.
- **Em linha** (Minhas reservas): "Centro de Torres" `arrow-forward` 16 `textoSutil` "ULBRA
  Torres", tudo `corpo`, `numberOfLines={1}`.
- `accessibilityLabel` ✚: "De Centro de Torres para ULBRA Torres".

### 3.9 Outros componentes

- **Avatar** (`Avatar.tsx`, novo): círculo (40, 44 ou 48), fundo `primariaClara`, iniciais
  (2 letras: primeira e última palavra do nome) em 700 `primaria`, fonte 15/17. Função
  `iniciais(nome)` em `utils/` (só exibição).
- **Chip** (`SeletorOpcoes.tsx`, já existe — restilizar): altura 40, `hitSlop` 4, padding
  horizontal 14, raio `pilula`, texto `rotulo`. Não selecionado: fundo `superficie`, borda 1
  `borda`, texto `texto`. Selecionado: fundo `primaria`, texto branco, ícone `location` 16.
  "Minha localização" tem sempre o ícone `locate-outline` (`primaria` quando não selecionado).
  Manter `accessibilityRole="radio"` e `accessibilityState={{ selected }}`.
- **Linha de opção com Switch:** container `superficie`, borda 1 `borda`, raio 12, padding
  10/12/10/14, `gap` 12: ícone 22 → coluna (título `corpoForte`, ajuda `legenda`) → `Switch` com
  `trackColor={{ false: bordaForte, true: primaria }}`, `thumbColor="#FFFFFF"`,
  `ios_backgroundColor={bordaForte}`.
- **Botão flutuante** ("Oferecer carona"): `Botao` primário com raio `pilula`, padding 18/22,
  ícone `add` 24, `sombra.flutuante`, `position: 'absolute'`, `right: 20`,
  `bottom: insets.bottom + 16`. A lista ganha `paddingBottom` 96 para o último card não ficar
  embaixo dele.
- **Barra de ação inferior** (Detalhe da carona): fundo `superficie`, borda superior 1 `borda`,
  `sombra.flutuante`, padding 14 em cima, 20 nas laterais, `insets.bottom + 12` embaixo, linha
  com `gap` 16.
- **Placa:** texto 15/700, `letterSpacing` 1.5, numérico, borda 1.5 `texto`, raio 6, padding 3/10,
  fundo branco.
- **Esqueleto de carregamento** (listas): 3 cards com o container do card e 3 barras
  `neutroClaro` (raio 6; alturas 22, 16, 16; larguras 45%, 80%, 60%). Estático; um pulso de
  opacidade com `Animated.loop` (0.5 ↔ 1, 800 ms) é opcional.

---

## 4. Telas

Fundo de todas as telas: `fundo`. Gutter 20. Entre blocos: 16 (12 entre cards de lista).

### Estados comuns (tela 14) — valem para todas

| Estado | Como fica |
|---|---|
| Carregando tela inteira | `ActivityIndicator` `large` `primaria` centralizado. Listas (Início, Minhas reservas, Meus veículos): 3 esqueletos |
| Carregando ação | o botão que disparou fica em `carregando` |
| Erro de carregamento | `EstadoVazio` com ícone `cloud-offline-outline`, título "Não foi possível carregar" ✚, mensagem = texto do erro (`normalizarErro(...).message`), ação "Tentar de novo" |
| Erro de ação | `Aviso` `erro` logo acima do botão da ação |
| Lista vazia | `EstadoVazio` com os textos de cada tela |
| Puxar para atualizar | `RefreshControl` com `tintColor` e `colors={[primaria]}` |

### Tela 1 — Entrar (`(publico)/entrar.tsx`)

Conteúdo centralizado na vertical, `KeyboardAvoidingView` como hoje.

1. Assinatura: ícone do app 72 (imagem `assets/icon.png` com raio 16) + 16 + "CampusShare"
   (`titulo`; "Campus" em `texto` e "Share" em `primaria`), centralizados.
2. "Caronas entre estudantes da sua instituição" — `corpo` `textoSecundario`, centralizado.
3. 32 de espaço.
4. Aviso de erro geral (se houver).
5. Campo "E-mail institucional" (ícone `mail-outline`, placeholder "nome@rede.ulbra.br" ✚,
   `keyboardType="email-address"`, `autoCapitalize="none"`).
6. Campo "Senha" (ícone `lock-closed-outline`, `senha`).
7. Botão primário "Entrar".
8. Se e-mail não confirmado: botão `texto` "Reenviar link de confirmação".
9. Rodapé: divisória com o texto "Ainda não tem conta?" ✚ (`legenda`) e botão secundário
   "Criar conta".
10. Selo de confiança no fim ✚: `shield-checkmark-outline` 16 `textoSecundario` + "Só entra quem
    confirma o e-mail @rede.ulbra.br." (`legenda`).

### Tela 2 — Cadastro (`(publico)/cadastro.tsx`)

Rolável, padding superior `insets.top + 24`.

1. "Criar conta" (`titulo`).
2. "Use o e-mail da sua instituição de ensino." (`corpo` `textoSecundario`).
3. Aviso de erro geral.
4. Campos, `gap` 16: "Nome completo" (`person-outline`); "E-mail institucional" (`mail-outline`,
   ajuda "Só e-mails @rede.ulbra.br podem criar conta." ✚); "Senha (mínimo 8 caracteres)"
   (`lock-closed-outline`, `senha`); "Telefone (opcional)" (`call-outline`, placeholder
   "(51) 99999-9999").
5. Gênero (`SeletorGenero`, com chips do 3.9): rótulo "Gênero", ajuda "Usado só no filtro de
   caronas “somente mulheres”.", opções Feminino, Masculino, Outro, Prefiro não informar.
6. Botão primário "Criar conta".
7. Botão `texto` "Já tenho conta".

### Tela 3 — Confira seu e-mail (`(publico)/confira-email.tsx`)

Centralizada na vertical, padding 20.

1. Círculo 80 `primariaClara` com `mail-unread-outline` 36 `primaria`.
2. "Confira seu e-mail" (`titulo`, centralizado).
3. "Enviamos um link de confirmação para **{e-mail}**. Abra o link no celular para ativar sua
   conta. Se não encontrar, olhe também a caixa de spam." (`corpo` `textoSecundario`,
   centralizado; o e-mail em `corpoForte` `texto`).
4. Aviso de retorno (sucesso: "Enviamos um novo link. Confira sua caixa de entrada.").
5. Botão primário "Reenviar link" / desabilitado "Reenviar link (42s)".
6. Botão `texto` "Voltar ao login".

### Tela 4 — Confirmação (`confirmacao.tsx`)

- **Confirmando:** `ActivityIndicator` `large` + "Confirmando seu e-mail…" (`corpo`
  `textoSecundario`), centralizados.
- **Sucesso** ✚ (se a tela mostrar um estado de sucesso antes de ir ao Início): círculo 96 com
  `checkmark` (mesmo desenho da tela 8b), "E-mail confirmado!" ✚, "Sua conta está ativa." ✚,
  botão primário "Ir para o início".
- **Falha:** ícone `alert-circle` 48 `erro` → "Não foi possível confirmar" (`titulo`) → Aviso
  erro com a mensagem → campo "Seu e-mail institucional" → Aviso info do reenvio → botão
  primário "Reenviar link" → botão `texto` "Ir para o início" (com sessão) ou "Voltar ao login".

### Tela 5 — Caronas próximas (Início) ★ — `mockups/05-caronas-proximas.png`

`FlatList` com `ListHeaderComponent`; `headerShown: false`.

1. **Cabeçalho** (linha, `space-between`):
   - Esquerda: "Olá, {primeiro nome}" ✚ (`corpo` `textoSecundario`; o nome vem do
     `obterMeuPerfil` que a tela já chama; sem nome, não mostra a linha) e "Caronas próximas"
     (`titulo`).
   - Direita (`gap` 8): botão-ícone 44 (círculo `superficie`, borda 1 `borda`, `receipt-outline`
     22 `primaria`, `accessibilityLabel` "Minhas reservas") e Avatar 44 do usuário
     (`accessibilityLabel` "Meu perfil").
2. 20 → rótulo "Perto de" (`rotulo`) → 8 → chips em `ScrollView` horizontal
   (`showsHorizontalScrollIndicator={false}`, o último chip sai pela borda para indicar rolagem):
   Centro de Torres, ULBRA Torres, Rodoviária de Torres, Passo de Torres, Arroio do Sal,
   Três Cachoeiras, Minha localização. Abaixo, se estiver localizando: "Obtendo sua localização…"
   (`legenda`).
3. 12 → **filtro** (só para quem tem gênero Feminino, como hoje): linha com Switch, ícone
   `female-outline` `secundariaTexto`, título "Somente mulheres", ajuda "Mostrar só caronas para
   passageiras" ✚. `accessibilityLabel` do Switch: o atual.
4. Aviso de erro (localização ou busca) com ação "Tentar de novo".
5. 20 → contagem ✚ (`legenda`): "3 caronas · as mais perto primeiro" ("1 carona · …" no
   singular). Some enquanto carrega.
6. Lista de **cards de carona** (3.3), `gap` 12.
7. **Vazio:** `EstadoVazio` ícone `car-outline`, título "Nenhuma carona por aqui" ✚, mensagem
   "Nenhuma carona disponível perto deste ponto. Tente outro ponto ou volte mais tarde.", sem
   botão (o botão flutuante já está na tela).
8. **Botão flutuante** "Oferecer carona" (`add`), sempre visível.

Saem do rodapé desta tela: "Meus veículos", "Meu perfil", "Sair" e o `StatusServidor` (vão para
o Perfil). "Minhas reservas" vira o botão-ícone do cabeçalho.

Hierarquia: título → chips → cards; em cada card, hora e preço são o que o olho pega primeiro.

### Tela 6 — Detalhes da carona ★ — `mockups/06-detalhe-carona.png`

`ScrollView` (`paddingBottom` = altura da barra + 16) + barra de ação inferior fixa.

1. Avisos no topo, se for o caso (Aviso `info`): "Esta é a sua carona." /
   "Situação: Lotada." (ou Cancelada, Concluída).
2. **Card da viagem:** data completa sem a hora, "domingo, 18/10/2026" (`legenda`) → linha com
   "12:30" (`display`, numérico) + "Horário de Brasília" (`legenda`, alinhado pela base) →
   divisória → LinhaRota completa: "Origem" / Centro de Torres, "Destino" / ULBRA Torres.
3. **Bloco de valor** (o diferencial "sem constrangimento"): fundo `primariaClara`, raio 16,
   padding 16, `gap` 10, sem borda e sem sombra.
   - "Valor por passageiro" (`rotulo` `primaria`);
   - "R$ 6,00" (`display` `primaria`, numérico);
   - `calculator-outline` 18 + "Custo total de R$ 24,00, dividido entre motorista e passageiros."
     (`apoio`) — reescrita do texto atual;
   - `qr-code-outline` 18 + "Pagamento por Pix, dentro do app." ✚ (`apoio`).
4. **Dois cards lado a lado** (`flexDirection: 'row'`, `gap` 12, cada um `flex: 1`, padding 14):
   `people-outline` 22 `primaria` → "Vagas" (`legenda`) → "2 de 3 disponíveis" (`corpoForte`);
   `hourglass-outline` → "Tolerância de espera" → "10 min".
   Se `somente_mulheres`: abaixo, SeloStatus "Somente mulheres" com a legenda "Só passageiras
   podem reservar." ✚
5. **Card do motorista:** Avatar 48 → coluna: "Motorista" (`legenda`), "Ana Souza"
   (`corpoForte`), `shield-checkmark` 14 + "E-mail institucional confirmado" ✚ (`legenda` em
   600, cor `sucesso`). Todo usuário com acesso confirmou o e-mail, então o selo é sempre
   verdadeiro. → divisória → `car-outline` 22 `textoSecundario` + "Onix · prata" (`corpo`) +
   placa à direita (3.9).
6. Erro da reserva: Aviso `erro` com a mensagem; se o erro for `RESERVA_DUPLICADA`, ação
   "Ver minhas reservas".
7. **Barra inferior** (só quando `podeReservar`): esquerda "R$ 6,00" (20/26, 700, numérico) +
   "por pessoa · Pix" ✚ (`legenda`); direita botão primário "Reservar vaga" (`flex: 1`,
   `carregando` durante a reserva).
8. Confirmação: `Alert` nativo como hoje — título "Reservar vaga", mensagem "Reservar por
   R$ 6,00? O pagamento é por Pix.", botões "Cancelar" e "Reservar".

Erro de carregamento: estado comum, com ação "Voltar".

### Tela 7 — Oferecer carona (`caronas/publicar.tsx`)

Título do header: "Oferecer carona". Formulário rolável, `gap` 20, agrupado em cards com título
de seção (`subtitulo`) ✚:

1. **"Carro"** ✚: chips "Veículo" (`Onix · IYK4B21`).
2. **"Trajeto"** ✚: `SeletorLocal` "Origem" e "Destino" (chips + campo "Descrição da origem" /
   "Descrição do destino", placeholder "Ex.: Rua da Praia, 100 — em frente à padaria"). Entre os
   dois, a LinhaRota serve de guia visual (anel ao lado de Origem, ponto coral ao lado de Destino).
3. **"Quando"** ✚: "Partida" — valor "domingo, 18/10/2026 às 12:30 (horário de Brasília)"
   (`corpoForte`), botões secundários "Mudar data" (`calendar-outline`) e "Mudar hora"
   (`time-outline`) lado a lado no Android; seletor nativo no iOS.
4. **"Vagas e valor"** ✚: chips "Vagas para passageiros" (1 a N); campo "Custo total da viagem
   (R$)" (`cash-outline`, placeholder "Ex.: 24,00", `keyboardType="decimal-pad"`, com a ajuda que a
   tela já mostra); chips "Tolerância de espera" (`5 min`, `10 min`…).
5. **Linha com Switch** "Somente mulheres", ajuda "Só passageiras poderão ver e reservar.",
   ícone `female-outline`.
6. Aviso de erro geral.
7. Botão primário "Publicar carona".

Sem veículo: `EstadoVazio` com `car-sport-outline`, "Cadastre um veículo primeiro", o texto atual
e o botão "Cadastrar veículo".

O valor por passageiro **não** é calculado nem mostrado nesta tela antes de publicar; quem calcula
é o backend (ADR-005).

### Tela 8 — Pagamento da reserva ★ — `mockups/08-pagamento.png`

Header "Pagamento da reserva". `ScrollView`, `gap` 16.

**8a · Aguardando pagamento (PENDENTE com Pix):**

1. Bloco centralizado: SeloStatus PENDENTE → 6 → "R$ 6,00" (`display`, numérico) → "Valor da
   sua vaga" ✚ (`legenda`).
2. **Card do Pix** (padding 20, `gap` 16):
   - "Pague com o Pix pelo QR code ou pelo código copia e cola. A confirmação aparece aqui
     sozinha." (`corpo`);
   - QR 208 × 208 dentro de moldura branca (padding 12, borda 1 `borda`, raio 12), centralizado,
     `accessibilityLabel` "QR code do Pix";
   - Botão secundário `copy-outline` "Copiar código Pix" → depois de copiar, `checkmark`
     "Código copiado" (o botão fica 2 s nesse estado e volta) ✚.
3. Linha centralizada: `ActivityIndicator` pequeno `primaria` + "Aguardando a confirmação do
   pagamento…" (`apoio` `textoSecundario`), `accessibilityLiveRegion="polite"`.
4. Rodapé ✚: `shield-checkmark-outline` 16 + "Pagamento processado pelo Mercado Pago." (`legenda`).

**Polling esgotado:** no lugar do item 3, Aviso `info` "Ainda não recebemos a confirmação do
pagamento." com ação "Verificar de novo".

**Pix indisponível** (reabriu a tela depois): no lugar do card, Aviso `info` "O código Pix desta
reserva não está mais disponível."

**8b · Pagamento confirmado (CONFIRMADA, vindo do webhook):** conteúdo centralizado na vertical.

1. Círculo 96 `sucessoClaro` com círculo 72 `sucesso` dentro e `checkmark` 44 branco.
2. 24 → "Pagamento confirmado!" (`titulo`).
3. "Sua vaga está garantida." (`corpo` `textoSecundario`). O Aviso atual "Pagamento confirmado!
   Sua vaga está garantida." vira este título + texto.
4. Linha: SeloStatus CONFIRMADA + "R$ 6,00" (`corpoForte`).
5. 32 → botão primário `receipt-outline` "Minhas reservas" → botão `texto` "Voltar ao início" ✚.

Leitor de tela: ao mudar para CONFIRMADA, anunciar "Pagamento confirmado! Sua vaga está
garantida." (`AccessibilityInfo.announceForAccessibility`). Vibração curta opcional
(`Vibration.vibrate(50)`, nativo, sem biblioteca).

**Expirada / Cancelada:** bloco do topo com o SeloStatus correspondente e o valor; abaixo Aviso
`erro`: "Esta reserva expirou porque o pagamento não foi feito a tempo." / "Esta reserva foi
cancelada."; botão secundário "Buscar outra carona" ✚ (vai para o Início).

### Tela 9 — Minhas reservas ★ — `mockups/09-minhas-reservas.png`

Header "Minhas reservas". `FlatList`, `gap` 12, puxar para atualizar.

**Card de reserva** (`ItemReserva`): container do card (3.3) com padding 14/16, `gap` 10.

1. Linha: SeloStatus (esquerda) + valor "R$ 6,00" (`corpoForte`, numérico, direita).
2. "dom 18/10 · 12:30" (`corpoForte`, numérico).
3. LinhaRota em linha: "Centro de Torres → ULBRA Torres".
4. Linha: "Motorista: Ana Souza" (`legenda`) + `chevron-forward` 18 `textoSutil` à direita.
5. Só PENDENTE ✚: divisória + linha "Pagar com Pix" (`corpoForte` `primaria`) + `chevron-forward`
   20 `primaria`. Substitui o chevron do item 4.

Expirada e Cancelada: data, trajeto e valor em `textoSecundario` (o selo continua colorido).
O card inteiro abre o pagamento, como hoje (`accessibilityHint` atual).

**Vazio** (9b): `EstadoVazio` ícone `ticket-outline`, título "Nenhuma reserva ainda" ✚, mensagem
"Você ainda não tem reservas. Encontre uma carona na tela inicial.", botão primário
`search-outline` "Buscar caronas" ✚ (`router.navigate('/')`).

### Tela 10 — Meu perfil (`perfil.tsx`)

Header "Meu perfil". Rolável, `gap` 16.

1. **Topo** ✚: Avatar 72 centralizado, nome (`subtitulo`), e embaixo SeloStatus-like verde:
   `shield-checkmark` + "E-mail institucional confirmado" (`legenda` 600 `sucesso`).
2. **Card "Seus dados"** ✚: campos somente leitura "E-mail institucional" e "Instituição" + nota
   "E-mail e instituição vêm do cadastro e não podem ser alterados." (`legenda`); campos
   editáveis "Nome completo", "Telefone (opcional)"; `SeletorGenero`; Aviso de retorno
   ("Perfil atualizado."); botão primário "Salvar".
3. **Atalhos** ✚ — card com linhas de 56 de altura separadas por divisória, cada uma: ícone 22
   `primaria` + texto `corpo` + `chevron-forward`:
   - `car-outline` "Meus veículos"
   - `receipt-outline` "Minhas reservas"
4. Botão `texto` com `log-out-outline` "Sair" em cor `erro` (`carregando` enquanto sai).
5. `StatusServidor` no rodapé, em `legenda`, centralizado (ferramenta de desenvolvimento).

### Tela 11 — Meus veículos (`veiculos/index.tsx`)

Header "Meus veículos". Lista `gap` 12.

- **Card de veículo:** container do card, linha: círculo 44 `primariaClara` com `car-outline`
  22 `primaria` → coluna (modelo `corpoForte`; "prata · 5 lugares" `legenda`) → placa (3.9) →
  `chevron-forward`.
- Rodapé da lista: botão secundário `add` "Cadastrar veículo".
- **Vazio:** `EstadoVazio` `car-sport-outline`, "Você ainda não cadastrou nenhum veículo.",
  "Para oferecer caronas, cadastre o carro que vai usar.", botão primário "Cadastrar veículo".

### Tela 12 — Novo veículo (`veiculos/novo.tsx`) e 13 — Editar veículo (`veiculos/[id].tsx`)

Mesmo `FormularioVeiculo`, rolável, `gap` 16:

1. "Modelo" (placeholder "Ex.: Chevrolet Onix").
2. "Placa" (placeholder "ABC1D23", `autoCapitalize="characters"`, texto com `letterSpacing` 1.5).
3. "Cor" (placeholder "Ex.: Prata").
4. Chips "Lugares" (2 a 8).
5. Chips "Motorização" (opções atuais + "Outra/não sei").
6. "Consumo na cidade, km/l (opcional)" (placeholder "Ex.: 12,5", `decimal-pad`).
7. Aviso de erro geral.
8. Botão primário: "Cadastrar veículo" (novo) / "Salvar" (editar).

Só em Editar: divisória 1 `borda` com 24 acima e abaixo → Aviso de erro da exclusão → botão
**perigo** `trash-outline` "Excluir veículo" (hoje é secundário) → `Alert` atual: "Excluir
veículo", "Excluir Onix (IYK4B21)?", botões "Cancelar" e "Excluir" (`destructive`).

### Tela 15 — Ícone e splash

Ver seção 5.

---

## 5. Ícone e splash

**Símbolo:** rota em S, do anel de origem (branco, vazado) ao pin de destino (coral com centro
branco), sobre verde-mar. Lê bem a 40 px (conferido em `mockups/00-marca.png`).

| Arquivo em `docs/design/marca/` | Copiar para `mobile/assets/` | Formato |
|---|---|---|
| `icone.png` (+ `icone.svg`) | `icon.png` | 1024 × 1024, sem transparência, sem cantos (o iOS aplica a máscara) |
| `icone-android-foreground.png` (+ `.svg`) | `android-icon-foreground.png` | 1024 × 1024, transparente; símbolo em ~50% da camada, dentro do círculo seguro de 66 dp (61% da camada de 108 dp) |
| `icone-android-fundo.png` (+ `.svg`) | `android-icon-background.png` | 1024 × 1024, cor sólida `#0E6B63` |
| `icone-android-monocromatico.png` (+ `.svg`) | `android-icon-monochrome.png` | 1024 × 1024, branco sobre transparente (ícones temáticos do Android 13+) |
| `splash-icone.png` (+ `.svg`) | `splash-icon.png` | 1024 × 1024, transparente, só o símbolo |

**`app.json`** (trechos que mudam):

```json
"android": {
  "adaptiveIcon": {
    "backgroundColor": "#0E6B63",
    "foregroundImage": "./assets/android-icon-foreground.png",
    "backgroundImage": "./assets/android-icon-background.png",
    "monochromeImage": "./assets/android-icon-monochrome.png"
  }
},
"plugins": [
  [
    "expo-splash-screen",
    {
      "image": "./assets/splash-icon.png",
      "imageWidth": 200,
      "resizeMode": "contain",
      "backgroundColor": "#0E6B63"
    }
  ]
]
```

- Splash: fundo `#0E6B63`, símbolo centralizado com 200 pt de largura, sem texto (texto em splash
  fica pequeno e desfocado em telas diferentes).
- `expo-splash-screen` não está no `package.json`: instalar com
  `npx expo install expo-splash-screen` e registrar no PR.
- **No Expo Go o ícone e o splash não aparecem** (o app roda dentro do Expo Go). Eles só valem no
  build da T31. Para a demo no Expo Go, a marca aparece na tela Entrar (assinatura).
- Os SVGs usam só `rect`, `circle` e `path`, sem fonte nem filtro: dá para reconverter em qualquer
  ferramenta (Figma, Inkscape, navegador).

---

## 6. Ordem sugerida de implementação

1. `tema.ts` + instalar `@expo/vector-icons`.
2. Componentes base: Botao, CampoTexto, Aviso, SeloStatus, EstadoVazio, LinhaRota, Avatar.
3. Header padrão no `_layout.tsx` (uma mudança, todas as telas ganham o fundo areia).
4. Telas da demo: 5 → 6 → 8 → 9.
5. Ícone e splash (copiar os PNGs; config no `app.json`).
6. Demais telas: 1, 2, 3, 4, 10, 11, 12/13, 7.

Critério de aceite visual: cada tela comparada com o mockup em 375 pt (iPhone SE/mini) e 430 pt
(Pro Max), sem texto cortado, com a fonte do sistema em tamanho grande (Ajustes → Tela → Tamanho
do texto) e com toques de no mínimo 44 pt.
