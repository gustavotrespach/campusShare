import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text } from 'react-native';

import { tema } from '@/tema';

import type { NomeIcone } from './icones';

interface Props {
  icone: NomeIcone;
  titulo: string;
  onPress: () => void;
}

const TAMANHO_ICONE = 22;

// Recuo da divisória entre duas linhas: começa onde começa o texto, como nas listas do iOS
export const RECUO_DIVISORIA_ATALHO = tema.espaco.x4 + TAMANHO_ICONE + tema.espaco.x3;

// Linha de atalho de um card de navegação (ex.: "Meus veículos" no Perfil)
export function LinhaAtalho({ icone, titulo, onPress }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [estilos.linha, pressed && estilos.pressionada]}
    >
      <Ionicons name={icone} size={TAMANHO_ICONE} color={tema.cores.primaria} />
      <Text style={estilos.titulo}>{titulo}</Text>
      <Ionicons name="chevron-forward" size={20} color={tema.cores.textoSutil} />
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  linha: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tema.espaco.x3,
    paddingHorizontal: tema.espaco.x4,
  },
  pressionada: { backgroundColor: tema.cores.superficieAlternativa },
  titulo: { ...tema.tipografia.corpo, color: tema.cores.texto, flex: 1 },
});
