import { Pressable, StyleSheet, Text, View } from 'react-native';

export interface Opcao<Valor> {
  valor: Valor;
  rotulo: string;
}

interface Props<Valor> {
  rotulo: string;
  opcoes: readonly Opcao<Valor>[];
  valor: Valor;
  aoMudar: (valor: Valor) => void;
  ajuda?: string;
  erro?: string;
}

// Escolha única entre poucas opções, em "chips" (mesmo visual do SeletorGenero).
export function SeletorOpcoes<Valor extends string | number | null>({
  rotulo,
  opcoes,
  valor,
  aoMudar,
  ajuda,
  erro,
}: Props<Valor>) {
  return (
    <View style={estilos.container}>
      <Text style={estilos.rotulo}>{rotulo}</Text>
      {ajuda ? <Text style={estilos.ajuda}>{ajuda}</Text> : null}
      <View accessibilityRole="radiogroup" accessibilityLabel={rotulo} style={estilos.opcoes}>
        {opcoes.map((opcao) => {
          const selecionado = valor === opcao.valor;
          return (
            <Pressable
              key={String(opcao.valor)}
              accessibilityRole="radio"
              accessibilityState={{ selected: selecionado }}
              onPress={() => aoMudar(opcao.valor)}
              style={[estilos.opcao, selecionado && estilos.opcaoSelecionada]}
            >
              <Text style={[estilos.textoOpcao, selecionado && estilos.textoSelecionado]}>
                {opcao.rotulo}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {erro ? (
        <Text accessibilityLiveRegion="polite" style={estilos.erro}>
          {erro}
        </Text>
      ) : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  container: { gap: 6 },
  rotulo: { fontSize: 14, fontWeight: '600', color: '#1f2933' },
  ajuda: { fontSize: 13, color: '#52606d' },
  opcoes: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  opcao: {
    minWidth: 44,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#cbd2d9',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#fff',
  },
  opcaoSelecionada: { borderColor: '#1a56db', backgroundColor: '#eff4ff' },
  textoOpcao: { fontSize: 15, color: '#1f2933' },
  textoSelecionado: { color: '#1a56db', fontWeight: '600' },
  erro: { fontSize: 13, color: '#b42318' },
});
