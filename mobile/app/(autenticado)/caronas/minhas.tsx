import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ErroCarregamento } from '@/components/ErroCarregamento';
import { EsqueletoLista } from '@/components/EsqueletoLista';
import { EstadoVazio } from '@/components/EstadoVazio';
import { ListaPorPartida } from '@/components/ListaPorPartida';
import { SeloStatus } from '@/components/SeloStatus';
import { listarMinhasCaronas, type MinhaCarona } from '@/services/caronas';
import { normalizarErro } from '@/services/erros';
import { tema } from '@/tema';
import { formatarDataHoraCurta } from '@/utils/data-hora';
import {
  caronaEhProxima,
  nomeCurtoLocal,
  separarPorPartida,
  situacaoExibidaCarona,
} from '@/utils/listas';
import { aparenciaSelo } from '@/utils/selo-status';

type Lista =
  | { tipo: 'carregando' }
  | { tipo: 'erro'; mensagem: string }
  | { tipo: 'pronto'; caronas: MinhaCarona[] };

const { cores } = tema;

async function consultar(): Promise<Lista> {
  try {
    return { tipo: 'pronto', caronas: await listarMinhasCaronas() };
  } catch (falha) {
    return { tipo: 'erro', mensagem: normalizarErro(falha).message };
  }
}

function textoVagasLivres(carona: MinhaCarona): string {
  return `${carona.vagas_disponiveis} de ${carona.vagas_ofertadas} vagas livres`;
}

function ItemMinhaCarona({ carona }: { carona: MinhaCarona }) {
  // Passada, cancelada ou concluída fica apagada; o selo continua colorido
  const anterior = !caronaEhProxima(carona);
  const corTexto = anterior ? cores.textoSecundario : cores.texto;
  const destino = nomeCurtoLocal(carona.destino);
  const origem = nomeCurtoLocal(carona.origem);
  const quando = formatarDataHoraCurta(carona.data_hora_partida);
  const situacao = situacaoExibidaCarona(carona);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Para ${destino}, saindo de ${origem}, ${quando}, ${aparenciaSelo(situacao).rotulo}, ${textoVagasLivres(carona)}`}
      accessibilityHint="Abre os detalhes da carona"
      onPress={() => router.push({ pathname: '/caronas/[id]', params: { id: carona.id_carona } })}
      style={({ pressed }) => [estilos.card, pressed && estilos.pressionado]}
    >
      <View style={estilos.topo}>
        <Text style={[estilos.titulo, { color: corTexto }]} numberOfLines={2}>
          Para {destino}
        </Text>
        <SeloStatus tipo={situacao} />
      </View>
      <Text style={estilos.saindo} numberOfLines={1}>
        Saindo de {origem}
      </Text>
      <Text style={[estilos.quando, { color: corTexto }]}>{quando}</Text>
      <View style={estilos.linha}>
        <Text style={estilos.legenda}>{textoVagasLivres(carona)}</Text>
        <Ionicons name="chevron-forward" size={18} color={cores.textoSutil} />
      </View>
    </Pressable>
  );
}

export default function TelaMinhasCaronas() {
  const [lista, setLista] = useState<Lista>({ tipo: 'carregando' });
  const [atualizando, setAtualizando] = useState(false);

  // Recarrega ao voltar do detalhe, onde a carona pode ter sido cancelada
  useFocusEffect(
    useCallback(() => {
      let ativo = true;
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

  const { proximas, anteriores } = separarPorPartida(lista.caronas, (carona) =>
    caronaEhProxima(carona),
  );

  return (
    <ListaPorPartida
      proximas={proximas}
      anteriores={anteriores}
      chave={(carona) => carona.id_carona}
      renderizar={(carona) => <ItemMinhaCarona carona={carona} />}
      nomeDoItem={{ singular: 'carona', plural: 'caronas' }}
      atualizando={atualizando}
      aoAtualizar={() => void atualizar()}
      vazio={
        <EstadoVazio
          icone="car-outline"
          titulo={
            anteriores.length > 0 ? 'Nenhuma carona próxima' : 'Você ainda não ofereceu caronas'
          }
          mensagem="As caronas que você oferecer aparecem aqui, com as vagas e o status de cada uma."
          acao={{
            titulo: 'Oferecer carona',
            icone: 'add',
            onPress: () => router.push('/caronas/publicar'),
          }}
        />
      }
    />
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.fundo },
  espaco: { padding: tema.espaco.x5 },
  centro: { justifyContent: 'center' },
  // Mesmo card de "Minhas reservas" (tela 9)
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
  topo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: tema.espaco.x3,
  },
  titulo: { ...tema.tipografia.subtitulo, flex: 1 },
  saindo: { ...tema.tipografia.apoio, color: cores.textoSecundario },
  quando: { ...tema.tipografia.corpoForte, ...tema.numerico, marginTop: tema.espaco.x1 },
  linha: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  legenda: { ...tema.tipografia.legenda, color: cores.textoSecundario, flex: 1 },
});
