import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { tema } from '@/tema';

import type { NomeIcone } from './icones';

export interface Opcao<Valor> {
  valor: Valor;
  rotulo: string;
  // Ícone fixo do chip (ex.: "Minha localização"); os outros mostram o pin só quando selecionados
  icone?: NomeIcone;
}

interface Props<Valor> {
  rotulo: string;
  opcoes: readonly Opcao<Valor>[];
  valor: Valor;
  aoMudar: (valor: Valor) => void;
  ajuda?: string;
  erro?: string;
  // Uma linha só, rolando para o lado (pontos da tela inicial)
  horizontal?: boolean;
  // Ícone do chip selecionado sem ícone próprio (ex.: 'location' na tela inicial)
  iconeSelecionado?: NomeIcone;
}

const { cores } = tema;

// Escolha única entre poucas opções, em "chips".
export function SeletorOpcoes<Valor extends string | number | null>({
  rotulo,
  opcoes,
  valor,
  aoMudar,
  ajuda,
  erro,
  horizontal = false,
  iconeSelecionado,
}: Props<Valor>) {
  const chips = opcoes.map((opcao) => {
    const selecionado = valor === opcao.valor;
    const icone = opcao.icone ?? (selecionado ? iconeSelecionado : undefined);
    return (
      <Pressable
        key={String(opcao.valor)}
        accessibilityRole="radio"
        accessibilityState={{ selected: selecionado }}
        hitSlop={{ top: 4, bottom: 4 }}
        onPress={() => aoMudar(opcao.valor)}
        style={({ pressed }) => [
          estilos.opcao,
          selecionado ? estilos.opcaoSelecionada : pressed ? estilos.opcaoPressionada : null,
        ]}
      >
        {icone ? (
          <Ionicons
            name={icone}
            size={16}
            color={selecionado ? cores.textoSobrePrimaria : cores.primaria}
          />
        ) : null}
        <Text style={[estilos.textoOpcao, selecionado && estilos.textoSelecionado]}>
          {opcao.rotulo}
        </Text>
      </Pressable>
    );
  });

  return (
    <View style={estilos.container}>
      <Text style={estilos.rotulo}>{rotulo}</Text>
      {ajuda ? <Text style={estilos.ajuda}>{ajuda}</Text> : null}
      {horizontal ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          accessibilityRole="radiogroup"
          accessibilityLabel={rotulo}
          contentContainerStyle={estilos.opcoesHorizontais}
          // O último chip sai pela borda da tela: indica que dá para rolar
          style={estilos.rolagem}
        >
          {chips}
        </ScrollView>
      ) : (
        <View accessibilityRole="radiogroup" accessibilityLabel={rotulo} style={estilos.opcoes}>
          {chips}
        </View>
      )}
      {erro ? (
        <Text accessibilityLiveRegion="polite" style={estilos.erro}>
          {erro}
        </Text>
      ) : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  container: { gap: tema.espaco.x2 },
  rotulo: { ...tema.tipografia.rotulo, color: cores.texto },
  ajuda: { ...tema.tipografia.legenda, color: cores.textoSecundario },
  opcoes: { flexDirection: 'row', flexWrap: 'wrap', gap: tema.espaco.x2 },
  rolagem: { marginHorizontal: -tema.espaco.x5 },
  opcoesHorizontais: { gap: tema.espaco.x2, paddingHorizontal: tema.espaco.x5 },
  opcao: {
    minHeight: tema.toque.chip,
    minWidth: tema.toque.minimo,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: cores.borda,
    borderRadius: tema.raio.pilula,
    paddingHorizontal: 14,
    backgroundColor: cores.superficie,
  },
  opcaoPressionada: { backgroundColor: cores.superficieAlternativa },
  opcaoSelecionada: { borderColor: cores.primaria, backgroundColor: cores.primaria },
  textoOpcao: { ...tema.tipografia.rotulo, color: cores.texto },
  textoSelecionado: { color: cores.textoSobrePrimaria },
  erro: { ...tema.tipografia.legenda, color: cores.erro },
});
