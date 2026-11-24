import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { urlFotoPerfil, type FonteFoto } from '@/services/foto-perfil';
import { tema } from '@/tema';
import { iniciais } from '@/utils/nome';

interface Props {
  nome: string;
  tamanho?: 40 | 44 | 48 | 72;
  // Caminho da foto no Storage (foto_caminho / foto_motorista, T44); null ou ausente = iniciais
  fotoCaminho?: string | null;
  // Com onPress vira botão (ex.: "Meu perfil" na tela inicial)
  onPress?: () => void;
  accessibilityLabel?: string;
}

// A fonte da imagem (URL do Storage + token) é por caminho: trocar a foto troca o ?v= e recarrega
function useFonteFoto(fotoCaminho: string | null | undefined): FonteFoto | null {
  const [carregada, setCarregada] = useState<{ caminho: string; fonte: FonteFoto } | null>(null);
  useEffect(() => {
    if (!fotoCaminho) {
      return undefined;
    }
    let ativo = true;
    const carregar = async () => {
      try {
        const fonte = await urlFotoPerfil(fotoCaminho);
        if (ativo) {
          setCarregada({ caminho: fotoCaminho, fonte });
        }
      } catch {
        // Sem sessão: ficam as iniciais
      }
    };
    void carregar();
    return () => {
      ativo = false;
    };
  }, [fotoCaminho]);
  return fotoCaminho && carregada?.caminho === fotoCaminho ? carregada.fonte : null;
}

export function Avatar({ nome, tamanho = 40, fotoCaminho, onPress, accessibilityLabel }: Props) {
  const circulo = { width: tamanho, height: tamanho, borderRadius: tamanho / 2 };
  const fonte = useFonteFoto(fotoCaminho);
  // A imagem que falhou (rede, arquivo apagado): volta às iniciais até o caminho mudar
  const [falhou, setFalhou] = useState<string | null>(null);
  const letras = iniciais(nome);
  const mostrarFoto = fonte !== null && falhou !== fotoCaminho;

  // Sem nome (ex.: perfil ainda carregando), mostra o ícone de pessoa
  const conteudo = mostrarFoto ? (
    <Image
      testID="avatar-foto"
      source={fonte}
      style={circulo}
      accessibilityIgnoresInvertColors
      onError={() => setFalhou(fotoCaminho ?? null)}
    />
  ) : letras ? (
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
  // overflow: a foto fica recortada no círculo
  base: {
    backgroundColor: tema.cores.primariaClara,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  pressionado: { backgroundColor: tema.cores.superficieAlternativa },
  iniciais: { fontWeight: '700', color: tema.cores.primaria },
});
