import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { tema } from '@/tema';

interface Props {
  // Título de seção do formulário (ex.: "Trajeto" em Oferecer carona)
  titulo?: string;
  // false: sem padding, para linhas que vão de borda a borda (ex.: atalhos do Perfil)
  espacado?: boolean;
  children: ReactNode;
}

// Card branco do DESIGN.md (3.3): agrupa um bloco da tela
export function Cartao({ titulo, espacado = true, children }: Props) {
  return (
    <View style={[estilos.cartao, espacado ? estilos.espacado : estilos.colado]}>
      {titulo ? (
        <Text accessibilityRole="header" style={estilos.titulo}>
          {titulo}
        </Text>
      ) : null}
      {children}
    </View>
  );
}

const estilos = StyleSheet.create({
  cartao: {
    backgroundColor: tema.cores.superficie,
    borderRadius: tema.raio.grande,
    borderWidth: 1,
    borderColor: tema.cores.borda,
    ...tema.sombra.cartao,
  },
  espacado: { padding: tema.espaco.x4, gap: tema.espaco.x4 },
  colado: { overflow: 'hidden' },
  titulo: { ...tema.tipografia.subtitulo, color: tema.cores.texto },
});
