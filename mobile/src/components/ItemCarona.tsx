import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { CaronaResumo } from '@/services/caronas';
import { formatarDataHoraCurta } from '@/utils/data-hora';
import { formatarReais } from '@/utils/dinheiro';

interface Props {
  carona: CaronaResumo;
  aoAbrir: () => void;
}

function formatarDistancia(km: number): string {
  return `${km.toFixed(1).replace('.', ',')} km`;
}

export function ItemCarona({ carona, aoAbrir }: Props) {
  const vagas = carona.vagas_disponiveis === 1 ? '1 vaga' : `${carona.vagas_disponiveis} vagas`;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityHint="Abre os detalhes da carona"
      onPress={aoAbrir}
      style={({ pressed }) => [estilos.item, pressed && estilos.pressionado]}
    >
      <View style={estilos.topo}>
        <Text style={estilos.horario}>{formatarDataHoraCurta(carona.data_hora_partida)}</Text>
        <Text style={estilos.valor}>{formatarReais(carona.valorPorPassageiroCentavos)}/pessoa</Text>
      </View>
      <Text style={estilos.rota}>
        {carona.origem} → {carona.destino}
      </Text>
      <Text style={estilos.detalhe}>
        {vagas} · tolerância de {carona.tolerancia_min} min · a{' '}
        {formatarDistancia(carona.distancia_km)}
      </Text>
      <Text style={estilos.detalhe}>
        {carona.nome_motorista} · {carona.modelo} {carona.cor}
        {carona.somente_mulheres ? ' · Somente mulheres' : ''}
      </Text>
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  item: {
    borderWidth: 1,
    borderColor: '#cbd2d9',
    borderRadius: 8,
    padding: 16,
    gap: 4,
    backgroundColor: '#fff',
  },
  pressionado: { backgroundColor: '#f5f7fa' },
  topo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  horario: { fontSize: 16, fontWeight: '600', color: '#1f2933' },
  valor: { fontSize: 16, fontWeight: '600', color: '#1a56db' },
  rota: { fontSize: 15, color: '#1f2933' },
  detalhe: { fontSize: 14, color: '#52606d' },
});
