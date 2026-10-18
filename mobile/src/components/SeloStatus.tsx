import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Text, View } from 'react-native';

import { tema } from '@/tema';
import { aparenciaSelo, type TipoSelo } from '@/utils/selo-status';

export function SeloStatus({ tipo }: { tipo: TipoSelo }) {
  const { rotulo, icone, fundo, cor } = aparenciaSelo(tipo);
  return (
    <View style={[estilos.selo, { backgroundColor: fundo }]}>
      <Ionicons name={icone} size={14} color={cor} />
      <Text style={[estilos.texto, { color: cor }]}>{rotulo}</Text>
    </View>
  );
}

const estilos = StyleSheet.create({
  selo: {
    minHeight: 24,
    paddingHorizontal: 10,
    borderRadius: tema.raio.pilula,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: tema.espaco.x1,
  },
  texto: { ...tema.tipografia.selo },
});
