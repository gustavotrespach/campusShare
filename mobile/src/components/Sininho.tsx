import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { tema } from '@/tema';
import { rotuloSininho, textoSeloNaoLidas } from '@/utils/notificacoes';

interface Props {
  naoLidas: number;
  onPress: () => void;
}

const { cores } = tema;
const TAMANHO_ICONE = 22;
// Selo: 20 de altura (escala de 4); o número cabe em 1 ou 2 caracteres ("9+")
const TAMANHO_SELO = tema.espaco.x5;

// Botão-ícone 44 do cabeçalho do Início (T29), igual ao "Minhas reservas", com o selo de não lidas.
// O selo é só visual: o rótulo já diz quantas são.
export function Sininho({ naoLidas, onPress }: Props) {
  const selo = textoSeloNaoLidas(naoLidas);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={rotuloSininho(naoLidas)}
      onPress={onPress}
      style={({ pressed }) => [estilos.botao, pressed && estilos.pressionado]}
    >
      <Ionicons
        name={naoLidas > 0 ? 'notifications' : 'notifications-outline'}
        size={TAMANHO_ICONE}
        color={cores.primaria}
      />
      {selo ? (
        <View
          style={estilos.selo}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <Text style={estilos.textoSelo} maxFontSizeMultiplier={1.2}>
            {selo}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  botao: {
    width: tema.toque.minimo,
    height: tema.toque.minimo,
    borderRadius: tema.raio.pilula,
    backgroundColor: cores.superficie,
    borderWidth: 1,
    borderColor: cores.borda,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressionado: { backgroundColor: cores.superficieAlternativa },
  // Canto de cima à direita, por cima da borda do círculo; vermelho com branco (contraste alto)
  selo: {
    position: 'absolute',
    top: -tema.espaco.x1,
    right: -tema.espaco.x1,
    minWidth: TAMANHO_SELO,
    height: TAMANHO_SELO,
    paddingHorizontal: tema.espaco.x1,
    borderRadius: tema.raio.pilula,
    backgroundColor: cores.erro,
    borderWidth: 2,
    borderColor: cores.fundo,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textoSelo: { ...tema.tipografia.selo, ...tema.numerico, color: cores.textoSobrePrimaria },
});
