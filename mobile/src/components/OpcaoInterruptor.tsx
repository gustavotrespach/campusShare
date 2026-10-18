import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Switch, Text, View } from 'react-native';

import { tema } from '@/tema';

import type { NomeIcone } from './icones';

interface Props {
  icone: NomeIcone;
  corIcone?: string;
  titulo: string;
  ajuda?: string;
  valor: boolean;
  aoMudar: (valor: boolean) => void;
  accessibilityLabel: string;
}

const { cores } = tema;

// Linha de opção com Switch (ex.: filtro "Somente mulheres")
export function OpcaoInterruptor({
  icone,
  corIcone = cores.primaria,
  titulo,
  ajuda,
  valor,
  aoMudar,
  accessibilityLabel,
}: Props) {
  return (
    <View style={estilos.linha}>
      <Ionicons name={icone} size={22} color={corIcone} />
      <View style={estilos.textos}>
        <Text style={estilos.titulo}>{titulo}</Text>
        {ajuda ? <Text style={estilos.ajuda}>{ajuda}</Text> : null}
      </View>
      <Switch
        accessibilityLabel={accessibilityLabel}
        value={valor}
        onValueChange={aoMudar}
        trackColor={{ false: cores.bordaForte, true: cores.primaria }}
        thumbColor={cores.superficie}
        ios_backgroundColor={cores.bordaForte}
      />
    </View>
  );
}

const estilos = StyleSheet.create({
  linha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tema.espaco.x3,
    backgroundColor: cores.superficie,
    borderWidth: 1,
    borderColor: cores.borda,
    borderRadius: tema.raio.medio,
    paddingTop: 10,
    paddingRight: 12,
    paddingBottom: 10,
    paddingLeft: 14,
  },
  textos: { flex: 1 },
  titulo: { ...tema.tipografia.corpoForte, color: cores.texto },
  ajuda: { ...tema.tipografia.legenda, color: cores.textoSecundario },
});
