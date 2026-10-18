import { StyleSheet, View, type DimensionValue } from 'react-native';

import { tema } from '@/tema';

const BARRAS: { altura: number; largura: DimensionValue }[] = [
  { altura: 22, largura: '45%' },
  { altura: 16, largura: '80%' },
  { altura: 16, largura: '60%' },
];

// Carregamento das listas: 3 cards cinza no lugar dos cards reais (estático)
export function EsqueletoLista() {
  return (
    <View accessibilityLabel="Carregando" accessibilityRole="progressbar" style={estilos.lista}>
      {[0, 1, 2].map((card) => (
        <View key={card} style={estilos.card}>
          {BARRAS.map((barra, indice) => (
            <View
              key={indice}
              style={[estilos.barra, { height: barra.altura, width: barra.largura }]}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

const estilos = StyleSheet.create({
  lista: { gap: tema.espaco.x3 },
  card: {
    backgroundColor: tema.cores.superficie,
    borderRadius: tema.raio.grande,
    borderWidth: 1,
    borderColor: tema.cores.borda,
    padding: tema.espaco.x4,
    gap: tema.espaco.x3,
  },
  barra: { borderRadius: tema.raio.pequeno, backgroundColor: tema.cores.neutroClaro },
});
