import { Pressable, StyleSheet, Text, View } from 'react-native';

import { GENEROS, ROTULO_GENERO, type Genero } from '@/utils/genero';

interface Props {
  valor: Genero | null;
  aoMudar: (genero: Genero) => void;
  erro?: string;
}

export function SeletorGenero({ valor, aoMudar, erro }: Props) {
  return (
    <View style={estilos.container}>
      <Text style={estilos.rotulo}>Gênero</Text>
      <Text style={estilos.ajuda}>Usado só no filtro de caronas “somente mulheres”.</Text>
      <View accessibilityRole="radiogroup" style={estilos.opcoes}>
        {GENEROS.map((genero) => {
          const selecionado = valor === genero;
          return (
            <Pressable
              key={genero}
              accessibilityRole="radio"
              accessibilityState={{ selected: selecionado }}
              onPress={() => aoMudar(genero)}
              style={[estilos.opcao, selecionado && estilos.opcaoSelecionada]}
            >
              <Text style={[estilos.textoOpcao, selecionado && estilos.textoSelecionado]}>
                {ROTULO_GENERO[genero]}
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
