import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { Aviso } from '@/components/Aviso';
import { ErroCarregamento } from '@/components/ErroCarregamento';
import { EsqueletoLista } from '@/components/EsqueletoLista';
import { EstadoVazio } from '@/components/EstadoVazio';
import { listarAvaliacoesPendentes, type AvaliacaoPendente } from '@/services/avaliacoes';
import { normalizarErro } from '@/services/erros';
import { AVISO_AVALIACOES, consumirAviso } from '@/store/avisos';
import { tema } from '@/tema';
import { descreverAvaliado } from '@/utils/avaliacoes';
import { formatarDataHoraCurta } from '@/utils/data-hora';
import { nomeCurtoLocal } from '@/utils/listas';

type Lista =
  | { tipo: 'carregando' }
  | { tipo: 'erro'; mensagem: string }
  | { tipo: 'pronto'; pendentes: AvaliacaoPendente[] };

const { cores } = tema;

async function consultar(): Promise<Lista> {
  try {
    return { tipo: 'pronto', pendentes: await listarAvaliacoesPendentes() };
  } catch (falha) {
    return { tipo: 'erro', mensagem: normalizarErro(falha).message };
  }
}

function ItemPendente({ pendente }: { pendente: AvaliacaoPendente }) {
  const papel = descreverAvaliado(pendente.papel);
  const destino = nomeCurtoLocal(pendente.destino);
  const partida = formatarDataHoraCurta(pendente.data_hora_partida);
  const ate = formatarDataHoraCurta(pendente.avaliar_ate);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Avaliar ${pendente.nome_avaliado}, ${papel}, carona para ${destino} em ${partida}, avaliar até ${ate}`}
      onPress={() =>
        router.push({
          pathname: '/avaliacoes/[idReserva]',
          params: { idReserva: pendente.id_reserva },
        })
      }
      style={({ pressed }) => [estilos.card, pressed && estilos.pressionado]}
    >
      <View style={estilos.topo}>
        <View style={estilos.textos}>
          <Text style={estilos.titulo}>Avaliar {pendente.nome_avaliado}</Text>
          <Text style={estilos.papel}>{papel}</Text>
        </View>
        <Ionicons name="star-outline" size={22} color={cores.primaria} />
      </View>
      <Text style={estilos.corpo}>Para {destino}</Text>
      <Text style={estilos.quando}>{partida}</Text>
      <View style={estilos.linha}>
        <Text style={estilos.legenda}>Avaliar até {ate}</Text>
        <Ionicons name="chevron-forward" size={18} color={cores.textoSutil} />
      </View>
    </Pressable>
  );
}

export default function TelaAvaliacoesPendentes() {
  const [lista, setLista] = useState<Lista>({ tipo: 'carregando' });
  const [atualizando, setAtualizando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  // Recarrega ao voltar da tela de avaliar (a avaliada sai da lista) e mostra o aviso dela
  useFocusEffect(
    useCallback(() => {
      let ativo = true;
      const deixado = consumirAviso(AVISO_AVALIACOES);
      if (deixado) {
        setAviso(deixado);
      }
      const carregar = async () => {
        const resultado = await consultar();
        if (ativo) {
          setLista(resultado);
        }
      };
      void carregar();
      return () => {
        ativo = false;
      };
    }, []),
  );

  const atualizar = async () => {
    setAtualizando(true);
    setLista(await consultar());
    setAtualizando(false);
  };

  if (lista.tipo === 'carregando') {
    return (
      <View style={[estilos.tela, estilos.espaco]}>
        <EsqueletoLista />
      </View>
    );
  }

  if (lista.tipo === 'erro') {
    return (
      <View style={[estilos.tela, estilos.centro]}>
        <ErroCarregamento mensagem={lista.mensagem} aoTentarDeNovo={() => void atualizar()} />
      </View>
    );
  }

  return (
    <FlatList
      style={estilos.tela}
      contentContainerStyle={estilos.lista}
      data={lista.pendentes}
      keyExtractor={(pendente) => pendente.id_reserva}
      renderItem={({ item }) => <ItemPendente pendente={item} />}
      ListHeaderComponent={aviso ? <Aviso tipo="sucesso" mensagem={aviso} /> : undefined}
      ListEmptyComponent={
        <EstadoVazio
          icone="star-outline"
          titulo="Nenhuma avaliação pendente"
          mensagem="Depois que uma carona é concluída, você pode avaliar quem viajou com você por 7 dias."
        />
      }
      refreshControl={
        <RefreshControl
          refreshing={atualizando}
          onRefresh={() => void atualizar()}
          tintColor={cores.primaria}
          colors={[cores.primaria]}
        />
      }
    />
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.fundo },
  espaco: { padding: tema.espaco.x5 },
  centro: { justifyContent: 'center' },
  lista: { padding: tema.espaco.x5, gap: tema.espaco.x3, flexGrow: 1 },
  card: {
    backgroundColor: cores.superficie,
    borderRadius: tema.raio.grande,
    borderWidth: 1,
    borderColor: cores.borda,
    paddingVertical: tema.espaco.x3,
    paddingHorizontal: tema.espaco.x4,
    gap: tema.espaco.x1,
    ...tema.sombra.cartao,
  },
  pressionado: { backgroundColor: cores.superficieAlternativa },
  topo: { flexDirection: 'row', alignItems: 'flex-start', gap: tema.espaco.x3 },
  textos: { flex: 1 },
  titulo: { ...tema.tipografia.subtitulo, color: cores.texto },
  papel: { ...tema.tipografia.apoio, color: cores.textoSecundario },
  corpo: { ...tema.tipografia.corpo, color: cores.texto, marginTop: tema.espaco.x1 },
  quando: { ...tema.tipografia.corpoForte, ...tema.numerico, color: cores.texto },
  linha: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  legenda: { ...tema.tipografia.legenda, color: cores.textoSecundario, flex: 1 },
});
