import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Text, View } from 'react-native';

import { tema } from '@/tema';

// Todo usuário com acesso confirmou o e-mail institucional (RN01): o selo é sempre verdadeiro
export function SeloEmailConfirmado() {
  return (
    <View style={estilos.linha}>
      <Ionicons name="shield-checkmark" size={14} color={tema.cores.sucesso} />
      <Text style={estilos.texto}>E-mail institucional confirmado</Text>
    </View>
  );
}

const estilos = StyleSheet.create({
  linha: { flexDirection: 'row', alignItems: 'center', gap: tema.espaco.x1 },
  texto: { ...tema.tipografia.legenda, fontWeight: '600', color: tema.cores.sucesso },
});
