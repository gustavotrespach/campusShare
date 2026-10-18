import Ionicons from '@expo/vector-icons/Ionicons';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { tema } from '@/tema';

import type { NomeIcone } from './icones';

type Variante = 'primario' | 'secundario' | 'perigo' | 'texto';

interface Props {
  titulo: string;
  onPress: () => void;
  carregando?: boolean;
  variante?: Variante;
  desabilitado?: boolean;
  icone?: NomeIcone;
  // Ajustes de posição e forma (ex.: botão flutuante); as cores vêm sempre da variante
  estilo?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

const { cores } = tema;

const COR_TEXTO: Record<Variante, string> = {
  primario: cores.textoSobrePrimaria,
  secundario: cores.primaria,
  perigo: cores.textoSobrePrimaria,
  texto: cores.primaria,
};

const FUNDO: Record<Variante, ViewStyle> = {
  primario: { backgroundColor: cores.primaria },
  secundario: { backgroundColor: cores.superficie, borderWidth: 1.5, borderColor: cores.primaria },
  perigo: { backgroundColor: cores.erro },
  texto: { backgroundColor: 'transparent', minHeight: tema.toque.minimo },
};

const FUNDO_PRESSIONADO: Record<Variante, ViewStyle> = {
  primario: { backgroundColor: cores.primariaPressionada },
  secundario: { backgroundColor: cores.primariaClara },
  // O tema não tem um tom escuro de erro: o pressionado escurece pela opacidade
  perigo: { opacity: 0.85 },
  texto: { backgroundColor: cores.primariaClara },
};

export function Botao({
  titulo,
  onPress,
  carregando = false,
  variante = 'primario',
  desabilitado = false,
  icone,
  estilo,
  accessibilityLabel,
}: Props) {
  const inativo = carregando || desabilitado;
  // Desabilitado tem cores próprias, sem opacidade: com opacidade o texto perde contraste
  const desligado = desabilitado && !carregando;
  const corTexto = desligado ? cores.desabilitadoTexto : COR_TEXTO[variante];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: inativo, busy: carregando }}
      disabled={inativo}
      onPress={onPress}
      style={({ pressed }) => [
        estilos.botao,
        FUNDO[variante],
        pressed && !inativo ? FUNDO_PRESSIONADO[variante] : null,
        desligado ? estilos.desabilitado : null,
        estilo,
      ]}
    >
      {carregando ? (
        <ActivityIndicator color={COR_TEXTO[variante]} />
      ) : (
        <>
          {icone ? <Ionicons name={icone} size={20} color={corTexto} /> : null}
          <Text
            numberOfLines={1}
            maxFontSizeMultiplier={1.4}
            style={[estilos.texto, { color: corTexto }]}
          >
            {titulo}
          </Text>
        </>
      )}
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  botao: {
    minHeight: tema.toque.botao,
    borderRadius: tema.raio.medio,
    paddingHorizontal: tema.espaco.x5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: tema.espaco.x2,
    alignSelf: 'stretch',
  },
  desabilitado: { backgroundColor: cores.desabilitadoFundo, borderWidth: 0 },
  texto: { ...tema.tipografia.botao, flexShrink: 1 },
});
