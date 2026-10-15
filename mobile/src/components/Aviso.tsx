import { StyleSheet, Text, View } from 'react-native';

interface Props {
  mensagem: string;
  tipo?: 'erro' | 'sucesso' | 'info';
}

export function Aviso({ mensagem, tipo = 'erro' }: Props) {
  return (
    <View
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
      style={[estilos.caixa, estilos[tipo]]}
    >
      <Text style={[estilos.texto, estilos[`texto_${tipo}`]]}>{mensagem}</Text>
    </View>
  );
}

const estilos = StyleSheet.create({
  caixa: { borderRadius: 8, padding: 12, borderWidth: 1 },
  erro: { backgroundColor: '#fef3f2', borderColor: '#fda29b' },
  sucesso: { backgroundColor: '#ecfdf3', borderColor: '#6ce9a6' },
  info: { backgroundColor: '#eff8ff', borderColor: '#84caff' },
  texto: { fontSize: 14, lineHeight: 20 },
  texto_erro: { color: '#912018' },
  texto_sucesso: { color: '#05603a' },
  texto_info: { color: '#175cd3' },
});
