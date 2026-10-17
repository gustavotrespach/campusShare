import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Aviso } from '@/components/Aviso';
import { Botao } from '@/components/Botao';
import { normalizarErro } from '@/services/erros';
import { listarMinhasReservas, type MinhaReserva } from '@/services/reservas';
import { formatarDataHoraCurta } from '@/utils/data-hora';
import { formatarReais } from '@/utils/dinheiro';
import { rotuloStatusReserva } from '@/utils/reserva';

type Lista =
  | { tipo: 'carregando' }
  | { tipo: 'erro'; mensagem: string }
  | { tipo: 'pronto'; reservas: MinhaReserva[] };

async function consultar(): Promise<Lista> {
  try {
    return { tipo: 'pronto', reservas: await listarMinhasReservas() };
  } catch (falha) {
    return { tipo: 'erro', mensagem: normalizarErro(falha).message };
  }
}

function ItemReserva({ reserva }: { reserva: MinhaReserva }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityHint="Abre o pagamento e o status da reserva"
      onPress={() =>
        router.push({ pathname: '/reservas/[id]', params: { id: reserva.id_reserva } })
      }
      style={({ pressed }) => [estilos.item, pressed && estilos.pressionado]}
    >
      <View style={estilos.topo}>
        <Text style={estilos.horario}>{formatarDataHoraCurta(reserva.data_hora_partida)}</Text>
        <Text style={estilos.valor}>{formatarReais(reserva.valorCentavos)}</Text>
      </View>
      <Text style={estilos.rota}>
        {reserva.origem} → {reserva.destino}
      </Text>
      <Text style={estilos.detalhe}>
        {rotuloStatusReserva(reserva.status_reserva)} · motorista {reserva.nome_motorista}
      </Text>
    </Pressable>
  );
}

export default function TelaMinhasReservas() {
  const [lista, setLista] = useState<Lista>({ tipo: 'carregando' });
  const [atualizando, setAtualizando] = useState(false);

  // Recarrega ao voltar da tela de pagamento, que pode ter confirmado a reserva
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
      data={lista.tipo === 'pronto' ? lista.reservas : []}
      keyExtractor={(reserva) => reserva.id_reserva}
      renderItem={({ item }) => <ItemReserva reserva={item} />}
      ListHeaderComponent={
        <>
          {lista.tipo === 'carregando' ? <ActivityIndicator size="large" /> : null}
          {lista.tipo === 'erro' ? (
            <View style={estilos.cabecalho}>
              <Aviso mensagem={lista.mensagem} />
              <Botao
                titulo="Tentar de novo"
                variante="secundario"
                onPress={() => void atualizar()}
              />
            </View>
          ) : null}
        </>
      }
      ListEmptyComponent={
        lista.tipo === 'pronto' ? (
          <Text style={estilos.vazio}>
            Você ainda não tem reservas. Encontre uma carona na tela inicial.
          </Text>
        ) : null
      }
      refreshControl={
        <RefreshControl refreshing={atualizando} onRefresh={() => void atualizar()} />
      }
    />
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: '#fff' },
  lista: { padding: 24, gap: 12 },
  cabecalho: { gap: 16 },
  vazio: { fontSize: 15, color: '#52606d', textAlign: 'center', paddingVertical: 24 },
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
