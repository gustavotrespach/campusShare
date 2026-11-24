import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { ViagemDoInicio } from '@/services/proxima-viagem';
import { tema } from '@/tema';
import { rotuloNotaMedia } from '@/utils/avaliacoes';
import { descreverQuandoRelativo, formatarQuandoRelativo } from '@/utils/data-hora';
import { textoVoceDirige } from '@/utils/inicio';
import { nomeCurtoLocal, situacaoExibidaCarona } from '@/utils/listas';
import { aparenciaSelo, type TipoSelo } from '@/utils/selo-status';

import { Reputacao } from './Reputacao';
import { SeloStatus } from './SeloStatus';

interface Props {
  viagem: ViagemDoInicio;
  aoAbrir: () => void;
  // Injetável para os testes ("hoje"/"amanhã")
  agora?: Date;
}

const { cores } = tema;
const TAMANHO_ICONE_ROTULO = 16;
const TAMANHO_CHEVRON = 20;

// Topo da tela inicial (T43): a reserva ou a carona própria de partida mais próxima. A reserva abre
// a tela da reserva; a carona própria, o detalhe da carona.
export function ProximaViagem({ viagem, aoAbrir, agora = new Date() }: Props) {
  const dados = viagem.tipo === 'RESERVA' ? viagem.reserva : viagem.carona;
  const destino = nomeCurtoLocal(dados.destino);
  const selo: TipoSelo =
    viagem.tipo === 'RESERVA'
      ? viagem.reserva.status_reserva
      : situacaoExibidaCarona(viagem.carona, agora);

  const detalhe =
    viagem.tipo === 'RESERVA' ? (
      <View style={estilos.linha}>
        <Text style={estilos.apoio}>com {viagem.reserva.nome_motorista}</Text>
        <Reputacao
          media={viagem.reserva.media_motorista}
          total={viagem.reserva.total_avaliacoes_motorista}
          compacta
        />
      </View>
    ) : (
      <Text style={estilos.apoio}>{textoVoceDirige(viagem.carona)}</Text>
    );

  const rotulo = [
    'Sua próxima viagem',
    `Para ${destino}`,
    descreverQuandoRelativo(dados.data_hora_partida, agora),
    ...(viagem.tipo === 'RESERVA'
      ? [
          `com ${viagem.reserva.nome_motorista}`,
          ...(viagem.reserva.media_motorista !== null
            ? [rotuloNotaMedia(viagem.reserva.media_motorista)]
            : []),
        ]
      : [textoVoceDirige(viagem.carona)]),
    aparenciaSelo(selo).rotulo,
  ].join(', ');

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={rotulo}
      accessibilityHint={
        viagem.tipo === 'RESERVA' ? 'Abre a sua reserva' : 'Abre os detalhes da sua carona'
      }
      onPress={aoAbrir}
      style={({ pressed }) => [estilos.card, pressed && estilos.pressionado]}
    >
      <View style={estilos.cabecalho}>
        <View style={estilos.linha}>
          <Ionicons
            name="navigate-circle-outline"
            size={TAMANHO_ICONE_ROTULO}
            color={cores.primaria}
          />
          <Text style={estilos.rotulo}>Sua próxima viagem</Text>
        </View>
        <SeloStatus tipo={selo} />
      </View>
      <View style={estilos.corpo}>
        <View style={estilos.textos}>
          <Text style={estilos.titulo} numberOfLines={2}>
            Para {destino} · {formatarQuandoRelativo(dados.data_hora_partida, agora)}
          </Text>
          {detalhe}
        </View>
        <Ionicons name="chevron-forward" size={TAMANHO_CHEVRON} color={cores.primaria} />
      </View>
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  card: {
    backgroundColor: cores.primariaClara,
    borderRadius: tema.raio.grande,
    borderWidth: 1,
    borderColor: cores.primaria,
    padding: tema.espaco.x4,
    gap: tema.espaco.x2,
  },
  pressionado: { backgroundColor: cores.superficieAlternativa },
  cabecalho: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: tema.espaco.x2,
  },
  linha: { flexDirection: 'row', alignItems: 'center', gap: tema.espaco.x1 },
  rotulo: { ...tema.tipografia.rotulo, color: cores.primaria },
  corpo: { flexDirection: 'row', alignItems: 'center', gap: tema.espaco.x3 },
  textos: { flex: 1, gap: tema.espaco.x1 },
  titulo: { ...tema.tipografia.subtitulo, ...tema.numerico, color: cores.texto },
  apoio: { ...tema.tipografia.apoio, color: cores.textoSecundario },
});
