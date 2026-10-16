import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

interface Props extends TextInputProps {
  rotulo: string;
  erro?: string;
}

export function CampoTexto({ rotulo, erro, style, ...props }: Props) {
  return (
    <View style={estilos.container}>
      <Text style={estilos.rotulo}>{rotulo}</Text>
      <TextInput
        accessibilityLabel={rotulo}
        placeholderTextColor="#8a94a6"
        style={[estilos.entrada, erro ? estilos.entradaComErro : null, style]}
        {...props}
      />
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
  entrada: {
    borderWidth: 1,
    borderColor: '#cbd2d9',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1f2933',
    backgroundColor: '#fff',
  },
  entradaComErro: { borderColor: '#b42318' },
  erro: { fontSize: 13, color: '#b42318' },
});
