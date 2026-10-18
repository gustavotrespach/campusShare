import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { EsqueletoLista } from '@/components/EsqueletoLista';
import { EstadoVazio } from '@/components/EstadoVazio';
import { LinhaRota } from '@/components/LinhaRota';
import { SeloStatus } from '@/components/SeloStatus';
import { normalizarErro } from '@/services/erros';
import { listarMinhasReservas, type MinhaReserva } from '@/services/reservas';
import { tema } from '@/tema';
import { formatarDataHoraCurta } from '@/utils/data-hora';
import { formatarReais } from '@/utils/dinheiro';

type Lista =
  | { tipo: 'carregando' }
  | { tipo: 'erro'; mensagem: string }
  | { tipo: 'pronto'; reservas: MinhaReserva[] };

const { cores } = tema;

async function consultar(): Promise<Lista> {
  try {
    return { tipo: 'pronto', reservas: await listarMinhasReservas() };
  } catch (falha) {
    return { tipo: 'erro', mensagem: normalizarErro(falha).message };
  }
}

function ItemReserva({ reserva }: { reserva: MinhaReserva }) {
  const pendente = reserva.status_reserva === 'PENDENTE';
  // Expirada e cancelada ficam apagadas; o selo continua colorido
  const encerrada = reserva.status_reserva === 'EXPIRADA' || reserva.status_reserva === 'CANCELADA';
  const corTexto = encerrada ? cores.textoSecundario : cores.texto;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityHint="Abre o pagamento e o status da reserva"
      onPress={() =>
        router.push({ pathname: '/reservas/[id]', params: { id: reserva.id_reserva } })
      }
      style={({ pressed }) => [estilos.card, pressed && estilos.pressionado]}
    >
      <View style={estilos.linha}>
        <SeloStatus tipo={reserva.status_reserva} />
        <Text style={[estilos.valor, { color: corTexto }]}>
          {formatarReais(reserva.valorCentavos)}
        </Text>
      </View>
      <Text style={[estilos.quando, { color: corTexto }]}>
        {formatarDataHoraCurta(reserva.data_hora_partida)}
      </Text>
      <LinhaRota
        origem={reserva.origem}
        destino={reserva.destino}
        variante="emLinha"
        apagada={encerrada}
      />
      <View style={estilos.linha}>
        <Text style={estilos.legenda}>Motorista: {reserva.nome_motorista}</Text>
        {pendente ? null : <Ionicons name="chevron-forward" size={18} color={cores.textoSutil} />}
      </View>
      {pendente ? (
        <>
          <View style={estilos.divisoria} />
          <View style={estilos.linha}>
            <Text style={estilos.pagar}>Pagar com Pix</Text>
            <Ionicons name="chevron-forward" size={20} color={cores.primaria} />
          </View>
        </>
      ) : null}
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
      ListHeaderComponent={lista.tipo === 'carregando' ? <EsqueletoLista /> : null}
      ListEmptyComponent={
        lista.tipo === 'carregando' ? null : (
          // Estado vazio no meio da tela
          <View style={estilos.vazio}>
            {lista.tipo === 'erro' ? (
              <EstadoVazio
                icone="cloud-offline-outline"
                titulo="Não foi possível carregar"
                mensagem={lista.mensagem}
                acao={{ titulo: 'Tentar de novo', onPress: () => void atualizar() }}
              />
            ) : (
              <EstadoVazio
                icone="ticket-outline"
                titulo="Nenhuma reserva ainda"
                mensagem="Você ainda não tem reservas. Encontre uma carona na tela inicial."
                acao={{
                  titulo: 'Buscar caronas',
                  icone: 'search-outline',
                  onPress: () => router.navigate('/'),
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
  card: {
    backgroundColor: cores.superficie,
    borderRadius: tema.raio.grande,
    borderWidth: 1,
    borderColor: cores.borda,
    paddingVertical: 14,
    paddingHorizontal: tema.espaco.x4,
    gap: 10,
    ...tema.sombra.cartao,
  },
  pressionado: { backgroundColor: cores.superficieAlternativa },
  vazio: { flex: 1, justifyContent: 'center' },
  linha: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  valor: { ...tema.tipografia.corpoForte, ...tema.numerico },
  quando: { ...tema.tipografia.corpoForte, ...tema.numerico },
  legenda: { ...tema.tipografia.legenda, color: cores.textoSecundario, flex: 1 },
  divisoria: { height: 1, backgroundColor: cores.borda },
  pagar: { ...tema.tipografia.corpoForte, color: cores.primaria },
});
