import { StyleSheet, View } from 'react-native';

import { tema } from '@/tema';

// Linha de 1 pt entre blocos; o recuo alinha a linha ao texto quando há ícone à esquerda
export function Divisoria({ recuo = 0 }: { recuo?: number }) {
  return <View style={[estilos.linha, { marginLeft: recuo }]} />;
}

const estilos = StyleSheet.create({
  linha: { height: 1, backgroundColor: tema.cores.borda },
});
