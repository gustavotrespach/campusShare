import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';

import { tema } from '@/tema';

import type { NomeIcone } from './icones';

interface Props {
  icone: NomeIcone;
  // grande: estado vazio e telas de aviso (círculo 80, ícone 36); medio: card de veículo (44, 22)
  tamanho?: 'medio' | 'grande';
}

const MEDIDAS = {
  medio: { circulo: 44, icone: 22 },
  grande: { circulo: 80, icone: 36 },
} as const;

// Ícone verde-mar num círculo claro; decorativo (o texto ao lado diz o que é)
export function IconeEmCirculo({ icone, tamanho = 'grande' }: Props) {
  const medida = MEDIDAS[tamanho];
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        estilos.circulo,
        { width: medida.circulo, height: medida.circulo, borderRadius: medida.circulo / 2 },
      ]}
    >
      <Ionicons name={icone} size={medida.icone} color={tema.cores.primaria} />
    </View>
  );
}

const estilos = StyleSheet.create({
  circulo: {
    backgroundColor: tema.cores.primariaClara,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
