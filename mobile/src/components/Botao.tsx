import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';

interface Props {
  titulo: string;
  onPress: () => void;
  carregando?: boolean;
  variante?: 'primario' | 'secundario';
  desabilitado?: boolean;
}

export function Botao({
  titulo,
  onPress,
  carregando = false,
  variante = 'primario',
  desabilitado = false,
}: Props) {
  const inativo = carregando || desabilitado;
  const secundario = variante === 'secundario';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inativo, busy: carregando }}
      disabled={inativo}
      onPress={onPress}
      style={({ pressed }) => [
        estilos.botao,
        secundario ? estilos.secundario : estilos.primario,
        (pressed || inativo) && estilos.apagado,
      ]}
    >
      {carregando ? (
        <ActivityIndicator color={secundario ? '#1a56db' : '#fff'} />
      ) : (
        <Text style={[estilos.texto, secundario && estilos.textoSecundario]}>{titulo}</Text>
      )}
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  botao: {
    minHeight: 48,
    borderRadius: 8,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primario: { backgroundColor: '#1a56db' },
  secundario: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#1a56db' },
  apagado: { opacity: 0.6 },
  texto: { color: '#fff', fontSize: 16, fontWeight: '600' },
  textoSecundario: { color: '#1a56db' },
});
