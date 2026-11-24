import Ionicons from '@expo/vector-icons/Ionicons';
import { useRef, useState, type ComponentRef, type ReactElement, type RefObject } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { tema } from '@/tema';
import { filtrarPontos } from '@/utils/busca-local';
import type { PontoFixo } from '@/utils/pontos';

import { estilosCaixaCampo } from './CampoTexto';
import { Cartao } from './Cartao';
import { Divisoria } from './Divisoria';
import type { NomeIcone } from './icones';

interface Props {
  texto: string;
  aoMudarTexto: (texto: string) => void;
  // Tecla "Buscar" do teclado (ou a sugestão "Buscar …"): texto livre, geocodificado pela tela
  aoBuscarTexto: () => void;
  aoEscolherPonto: (ponto: PontoFixo) => void;
  aoUsarMinhaLocalizacao: () => void;
  // Obtendo a localização: o botão vira um indicador
  localizando?: boolean;
  // A tela pode pôr o foco na barra (T43: "Buscar em outro lugar" do estado vazio)
  refEntrada?: RefObject<ComponentRef<typeof TextInput> | null>;
}

const { cores } = tema;
const TAMANHO_ICONE = 20;
const TAMANHO_ICONE_LOCALIZAR = 22;
// A divisória entre sugestões começa no texto, depois do ícone
const RECUO_DIVISORIA = tema.espaco.x4 + TAMANHO_ICONE + tema.espaco.x3;

function LinhaSugestao({
  icone,
  titulo,
  descricao,
  onPress,
}: {
  icone: NomeIcone;
  titulo: string;
  descricao: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${titulo}, ${descricao}`}
      onPress={onPress}
      style={({ pressed }) => [estilos.sugestao, pressed && estilos.sugestaoPressionada]}
    >
      <Ionicons name={icone} size={TAMANHO_ICONE} color={cores.primaria} />
      <View style={estilos.textosSugestao}>
        <Text style={estilos.tituloSugestao}>{titulo}</Text>
        <Text style={estilos.descricaoSugestao}>{descricao}</Text>
      </View>
    </Pressable>
  );
}

// Barra "Buscar perto de…" da tela inicial (T40). Com foco, mostra sugestões que não usam a rede:
// buscar o texto digitado, "Minha localização" e os pontos fixos filtrados pelo texto.
export function BuscaLocal({
  texto,
  aoMudarTexto,
  aoBuscarTexto,
  aoEscolherPonto,
  aoUsarMinhaLocalizacao,
  localizando = false,
  refEntrada,
}: Props) {
  const entradaInterna = useRef<ComponentRef<typeof TextInput>>(null);
  const entrada = refEntrada ?? entradaInterna;
  const [focado, setFocado] = useState(false);
  const digitado = texto.trim();
  const pontos = filtrarPontos(texto);

  // A lista usa keyboardShouldPersistTaps: o toque na sugestão não tira o foco sozinho
  const escolher = (acao: () => void) => {
    entrada.current?.blur();
    acao();
  };

  const sugestoes: { chave: string; linha: ReactElement }[] = [];
  if (digitado) {
    sugestoes.push({
      chave: 'buscar-texto',
      linha: (
        <LinhaSugestao
          icone="search-outline"
          titulo={`Buscar “${digitado}”`}
          descricao="Bairro, rua ou cidade"
          onPress={() => escolher(aoBuscarTexto)}
        />
      ),
    });
  }
  sugestoes.push({
    chave: 'minha-localizacao',
    linha: (
      <LinhaSugestao
        icone="locate-outline"
        titulo="Minha localização"
        descricao="Usa o GPS do celular"
        onPress={() => escolher(aoUsarMinhaLocalizacao)}
      />
    ),
  });
  for (const ponto of pontos) {
    sugestoes.push({
      chave: ponto.id,
      linha: (
        <LinhaSugestao
          icone="location-outline"
          titulo={ponto.rotulo}
          descricao={ponto.descricao}
          onPress={() => escolher(() => aoEscolherPonto(ponto))}
        />
      ),
    });
  }

  return (
    <View style={estilos.container}>
      <View style={[estilosCaixaCampo.caixa, focado && estilosCaixaCampo.foco, estilos.barra]}>
        <Ionicons
          name="search-outline"
          size={TAMANHO_ICONE}
          color={focado ? cores.primaria : cores.textoSecundario}
        />
        <TextInput
          ref={entrada}
          accessibilityLabel="Buscar local"
          placeholder="Buscar perto de… (bairro, rua ou cidade)"
          placeholderTextColor={cores.textoSutil}
          value={texto}
          onChangeText={aoMudarTexto}
          onFocus={() => setFocado(true)}
          onBlur={() => setFocado(false)}
          onSubmitEditing={() => {
            if (digitado) {
              aoBuscarTexto();
            }
          }}
          returnKeyType="search"
          autoCapitalize="words"
          autoCorrect={false}
          style={estilosCaixaCampo.entrada}
        />
        {texto ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Limpar busca"
            onPress={() => aoMudarTexto('')}
            style={estilos.botaoIcone}
          >
            <Ionicons name="close-circle" size={TAMANHO_ICONE} color={cores.textoSutil} />
          </Pressable>
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Minha localização"
          accessibilityState={{ busy: localizando, disabled: localizando }}
          disabled={localizando}
          onPress={() => escolher(aoUsarMinhaLocalizacao)}
          style={({ pressed }) => [estilos.botaoIcone, pressed && estilos.botaoPressionado]}
        >
          {localizando ? (
            <ActivityIndicator color={cores.primaria} />
          ) : (
            <Ionicons name="locate-outline" size={TAMANHO_ICONE_LOCALIZAR} color={cores.primaria} />
          )}
        </Pressable>
      </View>

      {focado ? (
        <Cartao espacado={false}>
          {sugestoes.map(({ chave, linha }, indice) => (
            <View key={chave}>
              {indice > 0 ? <Divisoria recuo={RECUO_DIVISORIA} /> : null}
              {linha}
            </View>
          ))}
        </Cartao>
      ) : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  container: { gap: tema.espaco.x2 },
  // Caixa do CampoTexto (3.2); à direita, os botões de 44 pt ficam perto da borda
  barra: { gap: tema.espaco.x2, paddingRight: tema.espaco.x1 },
  botaoIcone: {
    width: tema.toque.minimo,
    height: tema.toque.minimo,
    borderRadius: tema.raio.pilula,
    alignItems: 'center',
    justifyContent: 'center',
  },
  botaoPressionado: { backgroundColor: cores.primariaClara },
  sugestao: {
    minHeight: tema.toque.campo,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tema.espaco.x3,
    paddingHorizontal: tema.espaco.x4,
    paddingVertical: tema.espaco.x2,
  },
  sugestaoPressionada: { backgroundColor: cores.superficieAlternativa },
  textosSugestao: { flex: 1 },
  tituloSugestao: { ...tema.tipografia.corpo, color: cores.texto },
  descricaoSugestao: { ...tema.tipografia.legenda, color: cores.textoSecundario },
});
