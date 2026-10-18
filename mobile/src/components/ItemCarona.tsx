import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { CaronaResumo } from '@/services/caronas';
import { tema } from '@/tema';
import { formatarDiaCurto, formatarHora } from '@/utils/data-hora';
import { formatarReais } from '@/utils/dinheiro';
import {
  descreverCarona,
  descreverVeiculo,
  textoDistancia,
  textoVagas,
} from '@/utils/exibicao-carona';

import { Avatar } from './Avatar';
import type { NomeIcone } from './icones';
import { LinhaRota } from './LinhaRota';
import { SeloStatus } from './SeloStatus';

interface Props {
  carona: CaronaResumo;
  aoAbrir: () => void;
}

const { cores } = tema;

function Metadado({ icone, texto }: { icone: NomeIcone; texto: string }) {
  return (
    <View style={estilos.metadado}>
      <Ionicons name={icone} size={16} color={cores.textoSecundario} />
      <Text style={estilos.legenda}>{texto}</Text>
    </View>
  );
}

// O nome do motorista é o que a buscar_caronas devolve: só o primeiro nome (decisão de 17/10)
export function ItemCarona({ carona, aoAbrir }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityHint="Abre os detalhes da carona"
      accessibilityLabel={descreverCarona(carona)}
      onPress={aoAbrir}
      style={({ pressed }) => [estilos.card, pressed && estilos.pressionado]}
    >
      <View style={estilos.topo}>
        <View style={estilos.quando}>
          <Text style={estilos.hora}>{formatarHora(carona.data_hora_partida)}</Text>
          <Text style={estilos.legenda}>{formatarDiaCurto(carona.data_hora_partida)}</Text>
        </View>
        <View style={estilos.preco}>
          <Text style={estilos.valor}>{formatarReais(carona.valorPorPassageiroCentavos)}</Text>
          <Text style={estilos.legenda}>por pessoa</Text>
        </View>
      </View>

      <LinhaRota origem={carona.origem} destino={carona.destino} />

      <View style={estilos.metadados}>
        <Metadado icone="people-outline" texto={textoVagas(carona.vagas_disponiveis)} />
        <Metadado icone="navigate-outline" texto={textoDistancia(carona.distancia_km)} />
        <Metadado icone="hourglass-outline" texto={`${carona.tolerancia_min} min`} />
      </View>
      {carona.somente_mulheres ? <SeloStatus tipo="SOMENTE_MULHERES" /> : null}

      <View style={estilos.divisoria} />

      <View style={estilos.motorista}>
        <Avatar nome={carona.nome_motorista} />
        <View style={estilos.textosMotorista}>
          <Text style={estilos.nome}>{carona.nome_motorista}</Text>
          <Text style={estilos.legenda}>{descreverVeiculo(carona.modelo, carona.cor)}</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={cores.textoSutil} />
      </View>
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  card: {
    backgroundColor: cores.superficie,
    borderRadius: tema.raio.grande,
    borderWidth: 1,
    borderColor: cores.borda,
    padding: tema.espaco.x4,
    gap: tema.espaco.x3,
    ...tema.sombra.cartao,
  },
  pressionado: { backgroundColor: cores.superficieAlternativa },
  topo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  quando: { flexDirection: 'row', alignItems: 'baseline', gap: tema.espaco.x2 },
  hora: { ...tema.tipografia.destaque, ...tema.numerico, color: cores.texto },
  preco: { alignItems: 'flex-end' },
  valor: {
    ...tema.tipografia.subtitulo,
    ...tema.numerico,
    fontWeight: '700',
    color: cores.primaria,
  },
  legenda: { ...tema.tipografia.legenda, color: cores.textoSecundario },
  metadados: { flexDirection: 'row', flexWrap: 'wrap', gap: tema.espaco.x4 },
  metadado: { flexDirection: 'row', alignItems: 'center', gap: tema.espaco.x1 },
  divisoria: { height: 1, backgroundColor: cores.borda },
  motorista: { flexDirection: 'row', alignItems: 'center', gap: tema.espaco.x3 },
  textosMotorista: { flex: 1 },
  nome: { ...tema.tipografia.corpoForte, color: cores.texto },
});
