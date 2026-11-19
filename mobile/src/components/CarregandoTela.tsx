import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { tema } from '@/tema';

// Carregamento da tela inteira (estados comuns, tela 14 do DESIGN.md)
export function CarregandoTela({ mensagem }: { mensagem?: string }) {
  return (
    <View style={estilos.centro}>
      <ActivityIndicator size="large" color={tema.cores.primaria} />
      {mensagem ? <Text style={estilos.mensagem}>{mensagem}</Text> : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  centro: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: tema.espaco.x3,
    padding: tema.espaco.x5,
    backgroundColor: tema.cores.fundo,
  },
  mensagem: { ...tema.tipografia.corpo, color: tema.cores.textoSecundario, textAlign: 'center' },
});
