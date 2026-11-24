import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Text, View } from 'react-native';

import { tema } from '@/tema';
import { formatarNota, rotuloNotaMedia, rotuloReputacao, textoReputacao } from '@/utils/avaliacoes';

const TAMANHO_ESTRELA = 14;

interface Props {
  media: number | null;
  total: number;
  // Curta (T42, card de "Minhas reservas"): só "★ 4,0", e nada sem avaliações
  compacta?: boolean;
}

// "★ 4,3 · 12 avaliações" ou "Sem avaliações ainda" (T30). A estrela coral é só gráfica: o texto
// diz a nota. media null = ninguém avaliou ainda.
export function Reputacao({ media, total, compacta = false }: Props) {
  const semAvaliacoes = media === null || total === 0;
  if (compacta) {
    if (semAvaliacoes) {
      return null;
    }
    return (
      <View accessible accessibilityLabel={rotuloNotaMedia(media)} style={estilos.linha}>
        <Ionicons name="star" size={TAMANHO_ESTRELA} color={tema.cores.secundaria} />
        <Text style={estilos.texto}>{formatarNota(media)}</Text>
      </View>
    );
  }
  return (
    <View accessible accessibilityLabel={rotuloReputacao(media, total)} style={estilos.linha}>
      {semAvaliacoes ? null : (
        <Ionicons name="star" size={TAMANHO_ESTRELA} color={tema.cores.secundaria} />
      )}
      <Text style={semAvaliacoes ? estilos.vazio : estilos.texto}>
        {textoReputacao(media, total)}
      </Text>
    </View>
  );
}

const estilos = StyleSheet.create({
  linha: { flexDirection: 'row', alignItems: 'center', gap: tema.espaco.x1 },
  texto: {
    ...tema.tipografia.legenda,
    fontWeight: '600',
    color: tema.cores.texto,
    ...tema.numerico,
  },
  vazio: { ...tema.tipografia.legenda, color: tema.cores.textoSecundario },
});
