import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { ErroCarregamento } from '@/components/ErroCarregamento';
import { EsqueletoLista } from '@/components/EsqueletoLista';
import { EstadoVazio } from '@/components/EstadoVazio';
import { LinhaRota } from '@/components/LinhaRota';
import { SeloStatus } from '@/components/SeloStatus';
import { listarMinhasCaronas, type MinhaCarona } from '@/services/caronas';
import { normalizarErro } from '@/services/erros';
import { tema } from '@/tema';
import { caronaEmAndamento } from '@/utils/cancelamento';
import { formatarDataHoraCurta } from '@/utils/data-hora';
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
  const encerrada = !caronaEmAndamento(carona);
  const corTexto = encerrada ? cores.textoSecundario : cores.texto;
  const quando = formatarDataHoraCurta(carona.data_hora_partida);
  const status = aparenciaSelo(carona.status).rotulo;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${status}, ${quando}, de ${carona.origem} para ${carona.destino}, ${textoVagasLivres(carona)}`}
      accessibilityHint="Abre os detalhes da carona"
      onPress={() => router.push({ pathname: '/caronas/[id]', params: { id: carona.id_carona } })}
      style={({ pressed }) => [estilos.card, pressed && estilos.pressionado]}
    >
      <SeloStatus tipo={carona.status} />
      <Text style={[estilos.quando, { color: corTexto }]}>{quando}</Text>
      <LinhaRota
        origem={carona.origem}
        destino={carona.destino}
        variante="emLinha"
        apagada={encerrada}
      />
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

  return (
    <FlatList
      style={estilos.tela}
      contentContainerStyle={estilos.lista}
      data={lista.tipo === 'pronto' ? lista.caronas : []}
      keyExtractor={(carona) => carona.id_carona}
      renderItem={({ item }) => <ItemMinhaCarona carona={item} />}
      ListHeaderComponent={lista.tipo === 'carregando' ? <EsqueletoLista /> : undefined}
      ListEmptyComponent={
        lista.tipo === 'carregando' ? undefined : (
          <View style={estilos.vazio}>
            {lista.tipo === 'erro' ? (
              <ErroCarregamento mensagem={lista.mensagem} aoTentarDeNovo={() => void atualizar()} />
            ) : (
              <EstadoVazio
                icone="car-outline"
                titulo="Você ainda não ofereceu caronas"
                mensagem="As caronas que você oferecer aparecem aqui, com as vagas e o status de cada uma."
                acao={{
                  titulo: 'Oferecer carona',
                  icone: 'add',
                  onPress: () => router.push('/caronas/publicar'),
                }}
              />
            )}
          </View>
        )
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
  lista: { padding: tema.espaco.x5, gap: tema.espaco.x3, flexGrow: 1 },
  // Mesmo card de "Minhas reservas" (tela 9)
  card: {
    backgroundColor: cores.superficie,
    borderRadius: tema.raio.grande,
    borderWidth: 1,
    borderColor: cores.borda,
    paddingVertical: tema.espaco.x3,
    paddingHorizontal: tema.espaco.x4,
    gap: tema.espaco.x2,
    ...tema.sombra.cartao,
  },
  pressionado: { backgroundColor: cores.superficieAlternativa },
  vazio: { flex: 1, justifyContent: 'center' },
  linha: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  quando: { ...tema.tipografia.corpoForte, ...tema.numerico },
  legenda: { ...tema.tipografia.legenda, color: cores.textoSecundario, flex: 1 },
});
