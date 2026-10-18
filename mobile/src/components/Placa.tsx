import { StyleSheet, Text, View } from 'react-native';

import { tema } from '@/tema';

// Placa do carro, para o passageiro reconhecer o veículo no embarque
export function Placa({ placa }: { placa: string }) {
  return (
    <View accessible accessibilityLabel={`Placa ${placa}`} style={estilos.placa}>
      <Text style={estilos.texto}>{placa}</Text>
    </View>
  );
}

const estilos = StyleSheet.create({
  placa: {
    borderWidth: 1.5,
    borderColor: tema.cores.texto,
    borderRadius: tema.raio.pequeno,
    paddingVertical: 3,
    paddingHorizontal: 10,
    backgroundColor: tema.cores.superficie,
  },
  texto: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '700',
    letterSpacing: 1.5,
    color: tema.cores.texto,
    ...tema.numerico,
  },
});
