import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Botao } from '@/components/Botao';
import { ErroCarregamento } from '@/components/ErroCarregamento';
import { EsqueletoLista } from '@/components/EsqueletoLista';
import { EstadoVazio } from '@/components/EstadoVazio';
import { IconeEmCirculo } from '@/components/IconeEmCirculo';
import { Placa } from '@/components/Placa';
import { normalizarErro } from '@/services/erros';
import { listarMeusVeiculos, type Veiculo } from '@/services/veiculos';
import { tema } from '@/tema';

type Carregamento =
  | { tipo: 'carregando' }
  | { tipo: 'erro'; mensagem: string }
  | { tipo: 'pronto'; veiculos: Veiculo[] };

function ItemVeiculo({ veiculo }: { veiculo: Veiculo }) {
  const detalhe = `${veiculo.cor.toLowerCase()} · ${veiculo.qtd_lugares} lugares`;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${veiculo.modelo}, ${detalhe}, placa ${veiculo.placa}`}
      accessibilityHint="Abre o veículo para editar ou excluir"
      onPress={() =>
        router.push({ pathname: '/veiculos/[id]', params: { id: veiculo.id_veiculo } })
      }
      style={({ pressed }) => [estilos.card, pressed && estilos.cardPressionado]}
    >
      <IconeEmCirculo icone="car-outline" tamanho="medio" />
      <View style={estilos.textos}>
        <Text style={estilos.modelo}>{veiculo.modelo}</Text>
        <Text style={estilos.detalhe}>{detalhe}</Text>
      </View>
      <Placa placa={veiculo.placa} />
      <Ionicons name="chevron-forward" size={20} color={tema.cores.textoSutil} />
    </Pressable>
  );
}

async function consultarVeiculos(): Promise<Carregamento> {
  try {
    return { tipo: 'pronto', veiculos: await listarMeusVeiculos() };
  } catch (falha) {
    return { tipo: 'erro', mensagem: normalizarErro(falha).message };
  }
}

export default function TelaVeiculos() {
  const [carregamento, setCarregamento] = useState<Carregamento>({ tipo: 'carregando' });

  // Recarrega sempre que a tela volta ao foco (depois de cadastrar, editar ou excluir).
  useFocusEffect(
    useCallback(() => {
      // Ignora a resposta se a tela perdeu o foco antes de ela chegar
      let ativo = true;
      const carregar = async () => {
        const estado = await consultarVeiculos();
        if (ativo) {
          setCarregamento(estado);
        }
      };
      void carregar();
      return () => {
        ativo = false;
      };
    }, []),
  );

  const tentarDeNovo = async () => {
    setCarregamento({ tipo: 'carregando' });
    setCarregamento(await consultarVeiculos());
  };

  if (carregamento.tipo === 'carregando') {
    return (
      <View style={estilos.lista}>
        <EsqueletoLista />
      </View>
    );
  }

  if (carregamento.tipo === 'erro') {
    return (
      <ScrollView contentContainerStyle={estilos.centro}>
        <ErroCarregamento
          mensagem={carregamento.mensagem}
          aoTentarDeNovo={() => void tentarDeNovo()}
        />
      </ScrollView>
    );
  }

  const cadastrar = () => router.push('/veiculos/novo');

  if (carregamento.veiculos.length === 0) {
    return (
      <ScrollView contentContainerStyle={estilos.centro}>
        <EstadoVazio
          icone="car-sport-outline"
          titulo="Você ainda não cadastrou nenhum veículo."
          mensagem="Para oferecer caronas, cadastre o carro que vai usar."
          acao={{ titulo: 'Cadastrar veículo', onPress: cadastrar }}
        />
      </ScrollView>
    );
  }

  return (
    <FlatList
      style={estilos.tela}
      contentContainerStyle={estilos.lista}
      data={carregamento.veiculos}
      keyExtractor={(veiculo) => veiculo.id_veiculo}
      renderItem={({ item }) => <ItemVeiculo veiculo={item} />}
      ListFooterComponent={
        <Botao titulo="Cadastrar veículo" icone="add" variante="secundario" onPress={cadastrar} />
      }
    />
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: tema.cores.fundo },
  lista: { padding: tema.espaco.x5, gap: tema.espaco.x3 },
  centro: { flexGrow: 1, justifyContent: 'center' },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tema.espaco.x3,
    padding: tema.espaco.x4,
    backgroundColor: tema.cores.superficie,
    borderRadius: tema.raio.grande,
    borderWidth: 1,
    borderColor: tema.cores.borda,
    ...tema.sombra.cartao,
  },
  cardPressionado: { backgroundColor: tema.cores.superficieAlternativa },
  textos: { flex: 1 },
  modelo: { ...tema.tipografia.corpoForte, color: tema.cores.texto },
  detalhe: { ...tema.tipografia.legenda, color: tema.cores.textoSecundario },
});
