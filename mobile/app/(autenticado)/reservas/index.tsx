import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Divisoria } from '@/components/Divisoria';
import { ErroCarregamento } from '@/components/ErroCarregamento';
import { EsqueletoLista } from '@/components/EsqueletoLista';
import { EstadoVazio } from '@/components/EstadoVazio';
import { ListaPorPartida } from '@/components/ListaPorPartida';
import { Reputacao } from '@/components/Reputacao';
import { SeloStatus } from '@/components/SeloStatus';
import { normalizarErro } from '@/services/erros';
import { listarMinhasReservas, type MinhaReserva } from '@/services/reservas';
import { tema } from '@/tema';
import { rotuloNotaMedia } from '@/utils/avaliacoes';
import { formatarDataHoraCurta } from '@/utils/data-hora';
import { formatarReais } from '@/utils/dinheiro';
import { nomeCurtoLocal, reservaEhProxima, separarPorPartida } from '@/utils/listas';
import { rotuloStatusReserva } from '@/utils/reserva';

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
  // Anteriores (passadas, expiradas, canceladas) ficam apagadas; o selo continua colorido
  const anterior = !reservaEhProxima(reserva);
  const corTexto = anterior ? cores.textoSecundario : cores.texto;
  const destino = nomeCurtoLocal(reserva.destino);
  const origem = nomeCurtoLocal(reserva.origem);
  const quando = formatarDataHoraCurta(reserva.data_hora_partida);
  const valor = formatarReais(reserva.valorCentavos);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[
        `Para ${destino}, saindo de ${origem}, ${quando}`,
        rotuloStatusReserva(reserva.status_reserva),
        valor,
        `motorista ${reserva.nome_motorista}`,
        ...(reserva.media_motorista !== null ? [rotuloNotaMedia(reserva.media_motorista)] : []),
      ].join(', ')}
      accessibilityHint="Abre o pagamento e o status da reserva"
      onPress={() =>
        router.push({ pathname: '/reservas/[id]', params: { id: reserva.id_reserva } })
      }
      style={({ pressed }) => [estilos.card, pressed && estilos.pressionado]}
    >
      <View style={estilos.topo}>
        <Text style={[estilos.titulo, { color: corTexto }]} numberOfLines={2}>
          Para {destino}
        </Text>
        <SeloStatus tipo={reserva.status_reserva} />
      </View>
      <Text style={estilos.saindo} numberOfLines={1}>
        Saindo de {origem}
      </Text>
      <View style={estilos.linha}>
        <Text style={[estilos.quando, { color: corTexto }]}>{quando}</Text>
        <Text style={[estilos.valor, { color: corTexto }]}>{valor}</Text>
      </View>
      <View style={estilos.linha}>
        <View style={estilos.motorista}>
          <Text style={estilos.legendaMotorista}>Motorista: {reserva.nome_motorista}</Text>
          <Reputacao
            media={reserva.media_motorista}
            total={reserva.total_avaliacoes_motorista}
            compacta
          />
        </View>
        {pendente ? null : <Ionicons name="chevron-forward" size={18} color={cores.textoSutil} />}
      </View>
      {pendente ? (
        <>
          <Divisoria />
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

  // Recarrega ao voltar da tela de pagamento, que pode ter confirmado ou cancelado a reserva
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

  const { proximas, anteriores } = separarPorPartida(lista.reservas, (reserva) =>
    reservaEhProxima(reserva),
  );

  return (
    <ListaPorPartida
      proximas={proximas}
      anteriores={anteriores}
      chave={(reserva) => reserva.id_reserva}
      renderizar={(reserva) => <ItemReserva reserva={reserva} />}
      nomeDoItem={{ singular: 'reserva', plural: 'reservas' }}
      atualizando={atualizando}
      aoAtualizar={() => void atualizar()}
      vazio={
        <EstadoVazio
          icone="ticket-outline"
          titulo={anteriores.length > 0 ? 'Nenhuma reserva próxima' : 'Nenhuma reserva ainda'}
          mensagem="Você ainda não tem reservas. Encontre uma carona na tela inicial."
          acao={{
            titulo: 'Buscar caronas',
            icone: 'search-outline',
            onPress: () => router.navigate('/'),
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
  linha: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: tema.espaco.x1,
  },
  quando: { ...tema.tipografia.corpoForte, ...tema.numerico },
  valor: { ...tema.tipografia.corpoForte, ...tema.numerico },
  legenda: { ...tema.tipografia.legenda, color: cores.textoSecundario, flex: 1 },
  motorista: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: tema.espaco.x2 },
  legendaMotorista: { ...tema.tipografia.legenda, color: cores.textoSecundario, flexShrink: 1 },
  pagar: { ...tema.tipografia.corpoForte, color: cores.primaria },
});
