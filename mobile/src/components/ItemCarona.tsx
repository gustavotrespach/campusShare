import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { CaronaResumo } from '@/services/caronas';
import { tema } from '@/tema';
import { formatarHora } from '@/utils/data-hora';
import { formatarReais } from '@/utils/dinheiro';
import {
  descreverCarona,
  descreverVeiculo,
  textoDistancia,
  textoVagas,
} from '@/utils/exibicao-carona';
import { nomeCurtoLocal } from '@/utils/listas';

import { Avatar } from './Avatar';
import { Divisoria } from './Divisoria';
import type { NomeIcone } from './icones';
import { Reputacao } from './Reputacao';
import { SeloStatus } from './SeloStatus';

interface Props {
  carona: CaronaResumo;
  aoAbrir: () => void;
}

const { cores } = tema;
const TAMANHO_ICONE_METADADO = 16;
const TAMANHO_CHEVRON = 20;

function Metadado({
  icone,
  texto,
  forte = false,
}: {
  icone: NomeIcone;
  texto: string;
  forte?: boolean;
}) {
  return (
    <View style={estilos.metadado}>
      <Ionicons name={icone} size={TAMANHO_ICONE_METADADO} color={cores.textoSecundario} />
      <Text style={forte ? estilos.metadadoForte : estilos.legenda}>{texto}</Text>
    </View>
  );
}

// Card da tela inicial (T43): começa pelo destino, como as listas da T41. O dia está no cabeçalho
// do grupo, então o card só mostra a hora. O nome do motorista é o primeiro nome que a
// buscar_caronas devolve (decisão de 17/10), com a nota dele ao lado (nada sem avaliações).
export function ItemCarona({ carona, aoAbrir }: Props) {
  const destino = nomeCurtoLocal(carona.destino);
  const origem = nomeCurtoLocal(carona.origem);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityHint="Abre os detalhes da carona"
      accessibilityLabel={descreverCarona(carona)}
      onPress={aoAbrir}
      style={({ pressed }) => [estilos.card, pressed && estilos.pressionado]}
    >
      <View style={estilos.topo}>
        <View style={estilos.trajeto}>
          <Text style={estilos.titulo} numberOfLines={2}>
            Para {destino}
          </Text>
          <Text style={estilos.saindo} numberOfLines={1}>
            Saindo de {origem} · {textoDistancia(carona.distancia_km)}
          </Text>
        </View>
        <View style={estilos.preco}>
          <Text style={estilos.valor}>{formatarReais(carona.valorPorPassageiroCentavos)}</Text>
          <Text style={estilos.legenda}>por pessoa</Text>
        </View>
      </View>

      <View style={estilos.metadados}>
        <Metadado icone="time-outline" texto={formatarHora(carona.data_hora_partida)} forte />
        <Metadado icone="people-outline" texto={textoVagas(carona.vagas_disponiveis)} />
        {carona.somente_mulheres ? <SeloStatus tipo="SOMENTE_MULHERES" /> : null}
      </View>

      <Divisoria />

      <View style={estilos.motorista}>
        <Avatar nome={carona.nome_motorista} />
        <View style={estilos.textosMotorista}>
          <View style={estilos.linhaNome}>
            <Text style={estilos.nome}>{carona.nome_motorista}</Text>
            <Reputacao
              media={carona.media_motorista}
              total={carona.total_avaliacoes_motorista}
              compacta
            />
          </View>
          <Text style={estilos.legenda}>{descreverVeiculo(carona.modelo, carona.cor)}</Text>
        </View>
        <Ionicons name="chevron-forward" size={TAMANHO_CHEVRON} color={cores.textoSutil} />
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
  topo: { flexDirection: 'row', alignItems: 'flex-start', gap: tema.espaco.x3 },
  trajeto: { flex: 1, gap: tema.espaco.x1 },
  titulo: { ...tema.tipografia.subtitulo, color: cores.texto },
  saindo: { ...tema.tipografia.apoio, color: cores.textoSecundario },
  preco: { alignItems: 'flex-end' },
  valor: {
    ...tema.tipografia.subtitulo,
    ...tema.numerico,
    fontWeight: '700',
    color: cores.primaria,
  },
  legenda: { ...tema.tipografia.legenda, color: cores.textoSecundario },
  metadados: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: tema.espaco.x4,
  },
  metadado: { flexDirection: 'row', alignItems: 'center', gap: tema.espaco.x1 },
  metadadoForte: { ...tema.tipografia.corpoForte, ...tema.numerico, color: cores.texto },
  motorista: { flexDirection: 'row', alignItems: 'center', gap: tema.espaco.x3 },
  textosMotorista: { flex: 1 },
  linhaNome: { flexDirection: 'row', alignItems: 'center', gap: tema.espaco.x2 },
  nome: { ...tema.tipografia.corpoForte, color: cores.texto },
});
