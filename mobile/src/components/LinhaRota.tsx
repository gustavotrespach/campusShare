import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Text, View } from 'react-native';

import { tema } from '@/tema';

interface Props {
  origem: string;
  destino: string;
  // compacta: card da lista; completa: detalhe, com "Origem"/"Destino"; emLinha: Minhas reservas
  variante?: 'compacta' | 'completa' | 'emLinha';
  // Expirada/cancelada em Minhas reservas: texto apagado
  apagada?: boolean;
}

const { cores } = tema;

// O desenho da marca no app: anel de origem, linha e ponto coral de destino
export function LinhaRota({ origem, destino, variante = 'compacta', apagada = false }: Props) {
  const rotulo = `De ${origem} para ${destino}`;
  const corTexto = apagada ? cores.textoSecundario : cores.texto;

  if (variante === 'emLinha') {
    return (
      <View accessible accessibilityLabel={rotulo} style={estilos.emLinha}>
        <Text numberOfLines={1} style={[estilos.corpo, estilos.encolhe, { color: corTexto }]}>
          {origem}
        </Text>
        <Ionicons name="arrow-forward" size={16} color={cores.textoSutil} />
        <Text numberOfLines={1} style={[estilos.corpo, estilos.encolhe, { color: corTexto }]}>
          {destino}
        </Text>
      </View>
    );
  }

  const completa = variante === 'completa';
  return (
    <View accessible accessibilityLabel={rotulo} style={estilos.linha}>
      <View style={[estilos.trilho, completa ? estilos.trilhoCompleto : null]}>
        <View style={estilos.anel} />
        <View style={estilos.traco} />
        <View style={estilos.ponto} />
      </View>
      <View style={[estilos.textos, { gap: completa ? tema.espaco.x3 : tema.espaco.x2 }]}>
        {completa ? (
          <>
            <View>
              <Text style={estilos.legenda}>Origem</Text>
              <Text style={estilos.subtitulo}>{origem}</Text>
            </View>
            <View>
              <Text style={estilos.legenda}>Destino</Text>
              <Text style={estilos.subtitulo}>{destino}</Text>
            </View>
          </>
        ) : (
          <>
            <Text style={[estilos.corpo, { color: corTexto }]}>{origem}</Text>
            <Text style={[estilos.corpo, { color: corTexto }]}>{destino}</Text>
          </>
        )}
      </View>
    </View>
  );
}

const TAMANHO_PONTO = 12;

const estilos = StyleSheet.create({
  linha: { flexDirection: 'row', gap: tema.espaco.x3 },
  // O anel e o ponto ficam na altura do meio da primeira e da última linha de texto
  trilho: { width: TAMANHO_PONTO, alignItems: 'center', gap: 3, paddingVertical: 5 },
  trilhoCompleto: { paddingTop: 24, paddingBottom: 6 },
  anel: {
    width: TAMANHO_PONTO,
    height: TAMANHO_PONTO,
    borderRadius: TAMANHO_PONTO / 2,
    borderWidth: 2.5,
    borderColor: cores.primaria,
    backgroundColor: cores.superficie,
  },
  traco: { width: 2, flex: 1, minHeight: 14, backgroundColor: cores.borda },
  ponto: {
    width: TAMANHO_PONTO,
    height: TAMANHO_PONTO,
    borderRadius: TAMANHO_PONTO / 2,
    backgroundColor: cores.secundaria,
  },
  textos: { flex: 1 },
  corpo: { ...tema.tipografia.corpo },
  legenda: { ...tema.tipografia.legenda, color: cores.textoSecundario },
  subtitulo: { ...tema.tipografia.subtitulo, color: cores.texto },
  emLinha: { flexDirection: 'row', alignItems: 'center', gap: tema.espaco.x1 },
  encolhe: { flexShrink: 1 },
});
