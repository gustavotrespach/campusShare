import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Text, View } from 'react-native';

import { tema } from '@/tema';
import { rotuloReputacao, textoReputacao } from '@/utils/avaliacoes';

const TAMANHO_ESTRELA = 14;

// "★ 4,3 · 12 avaliações" ou "Sem avaliações ainda" (T30). A estrela coral é só gráfica: o texto
// diz a nota. media null = ninguém avaliou ainda.
export function Reputacao({ media, total }: { media: number | null; total: number }) {
  const semAvaliacoes = media === null || total === 0;
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
