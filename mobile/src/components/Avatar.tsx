import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { tema } from '@/tema';
import { iniciais } from '@/utils/nome';

interface Props {
  nome: string;
  tamanho?: 40 | 44 | 48 | 72;
  // Com onPress vira botão (ex.: "Meu perfil" na tela inicial)
  onPress?: () => void;
  accessibilityLabel?: string;
}

export function Avatar({ nome, tamanho = 40, onPress, accessibilityLabel }: Props) {
  const circulo = { width: tamanho, height: tamanho, borderRadius: tamanho / 2 };
  const letras = iniciais(nome);
  // Sem nome (ex.: perfil ainda carregando), mostra o ícone de pessoa
  const conteudo = letras ? (
    <Text style={[estilos.iniciais, { fontSize: tamanho >= 48 ? 17 : 15 }]}>{letras}</Text>
  ) : (
    <Ionicons name="person-outline" size={tamanho / 2} color={tema.cores.primaria} />
  );
  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        onPress={onPress}
        style={({ pressed }) => [estilos.base, circulo, pressed && estilos.pressionado]}
      >
        {conteudo}
      </Pressable>
    );
  }
  // Sem ação, o nome já aparece ao lado: o avatar é decorativo para o leitor de tela
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[estilos.base, circulo]}
    >
      {conteudo}
    </View>
  );
}

const estilos = StyleSheet.create({
  base: {
    backgroundColor: tema.cores.primariaClara,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressionado: { backgroundColor: tema.cores.superficieAlternativa },
  iniciais: { fontWeight: '700', color: tema.cores.primaria },
});
