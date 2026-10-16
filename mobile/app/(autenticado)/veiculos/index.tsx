import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { Aviso } from '@/components/Aviso';
import { Botao } from '@/components/Botao';
import { normalizarErro } from '@/services/erros';
import { listarMeusVeiculos, type Veiculo } from '@/services/veiculos';

type Carregamento =
  | { tipo: 'carregando' }
  | { tipo: 'erro'; mensagem: string }
  | { tipo: 'pronto'; veiculos: Veiculo[] };

function ItemVeiculo({ veiculo }: { veiculo: Veiculo }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityHint="Abre o veículo para editar ou excluir"
      onPress={() =>
        router.push({ pathname: '/veiculos/[id]', params: { id: veiculo.id_veiculo } })
      }
      style={({ pressed }) => [estilos.item, pressed && estilos.itemPressionado]}
    >
      <Text style={estilos.modelo}>{veiculo.modelo}</Text>
      <Text style={estilos.detalhe}>
        {veiculo.placa} · {veiculo.cor} · {veiculo.qtd_lugares} lugares
      </Text>
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
      <View style={estilos.centro}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (carregamento.tipo === 'erro') {
    return (
      <View style={estilos.centro}>
        <Aviso mensagem={carregamento.mensagem} />
        <Botao titulo="Tentar de novo" onPress={() => void tentarDeNovo()} />
      </View>
    );
  }

  const cadastrar = () => router.push('/veiculos/novo');

  if (carregamento.veiculos.length === 0) {
    return (
      <View style={estilos.centro}>
        <Text style={estilos.vazio}>Você ainda não cadastrou nenhum veículo.</Text>
        <Text style={estilos.vazioAjuda}>
          Para oferecer caronas, cadastre o carro que vai usar.
        </Text>
        <Botao titulo="Cadastrar veículo" onPress={cadastrar} />
      </View>
    );
  }

  return (
    <FlatList
      style={estilos.tela}
      contentContainerStyle={estilos.lista}
      data={carregamento.veiculos}
      keyExtractor={(veiculo) => veiculo.id_veiculo}
      renderItem={({ item }) => <ItemVeiculo veiculo={item} />}
      ListFooterComponent={<Botao titulo="Cadastrar veículo" onPress={cadastrar} />}
    />
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: '#fff' },
  lista: { padding: 24, gap: 12 },
  centro: { flex: 1, justifyContent: 'center', padding: 24, gap: 16, backgroundColor: '#fff' },
  item: {
    borderWidth: 1,
    borderColor: '#cbd2d9',
    borderRadius: 8,
    padding: 16,
    gap: 4,
    backgroundColor: '#fff',
  },
  itemPressionado: { backgroundColor: '#f5f7fa' },
  modelo: { fontSize: 16, fontWeight: '600', color: '#1f2933' },
  detalhe: { fontSize: 14, color: '#52606d' },
  vazio: { fontSize: 16, fontWeight: '600', color: '#1f2933', textAlign: 'center' },
  vazioAjuda: { fontSize: 14, color: '#52606d', textAlign: 'center' },
});
