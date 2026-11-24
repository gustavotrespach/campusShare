import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { tema } from '@/tema';

interface Props {
  valor: number | null;
  aoMudar: (nota: number) => void;
}

const NOTAS = [1, 2, 3, 4, 5] as const;
const TAMANHO_ESTRELA = 32;

// Nota de 1 a 5 em estrelas (T30): cada estrela é um alvo de 44 pt e um "radio" para o leitor de
// tela ("Nota 4 de 5", selecionada ou não). Escolher a 4 acende da 1 à 4.
export function SeletorNota({ valor, aoMudar }: Props) {
  return (
    <View style={estilos.container}>
      <Text style={estilos.rotulo}>Nota</Text>
      <View accessibilityRole="radiogroup" accessibilityLabel="Nota" style={estilos.estrelas}>
        {NOTAS.map((nota) => {
          const acesa = valor !== null && nota <= valor;
          return (
            <Pressable
              key={nota}
              accessibilityRole="radio"
              accessibilityLabel={`Nota ${nota} de 5`}
              accessibilityState={{ selected: valor === nota }}
              onPress={() => aoMudar(nota)}
              style={({ pressed }) => [estilos.estrela, pressed && estilos.pressionada]}
            >
              <Ionicons
                name={acesa ? 'star' : 'star-outline'}
                size={TAMANHO_ESTRELA}
                color={acesa ? tema.cores.secundaria : tema.cores.bordaForte}
              />
            </Pressable>
          );
        })}
      </View>
      <Text style={estilos.ajuda}>{valor === null ? 'Toque numa estrela.' : `${valor} de 5`}</Text>
    </View>
  );
}

const estilos = StyleSheet.create({
  container: { gap: tema.espaco.x2 },
  rotulo: { ...tema.tipografia.rotulo, color: tema.cores.texto },
  estrelas: { flexDirection: 'row', gap: tema.espaco.x1 },
  estrela: {
    minWidth: tema.toque.minimo,
    minHeight: tema.toque.minimo,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: tema.raio.pilula,
  },
  pressionada: { backgroundColor: tema.cores.superficieAlternativa },
  ajuda: { ...tema.tipografia.legenda, color: tema.cores.textoSecundario },
});
