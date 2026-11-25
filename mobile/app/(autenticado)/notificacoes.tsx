import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { Aviso } from '@/components/Aviso';
import { Botao } from '@/components/Botao';
import { ErroCarregamento } from '@/components/ErroCarregamento';
import { EsqueletoLista } from '@/components/EsqueletoLista';
import { EstadoVazio } from '@/components/EstadoVazio';
import { normalizarErro } from '@/services/erros';
import { listarNotificacoes, marcarComoLidas, type Notificacao } from '@/services/notificacoes';
import { tema } from '@/tema';
import { destinoNotificacao, iconeNotificacao, quandoNotificacao } from '@/utils/notificacoes';

type Lista =
  | { tipo: 'carregando' }
  | { tipo: 'erro'; mensagem: string }
  | { tipo: 'pronto'; notificacoes: Notificacao[] };

const { cores } = tema;
const TAMANHO_ICONE = 22;
const TAMANHO_MARCA_NAO_LIDA = tema.espaco.x2;

async function consultar(): Promise<Lista> {
  try {
    return { tipo: 'pronto', notificacoes: await listarNotificacoes() };
  } catch (falha) {
    return { tipo: 'erro', mensagem: normalizarErro(falha).message };
  }
}

function ItemNotificacao({
  notificacao,
  aoTocar,
}: {
  notificacao: Notificacao;
  aoTocar: () => void;
}) {
  const quando = quandoNotificacao(notificacao.criado_em);
  const naoLida = !notificacao.lida;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${naoLida ? 'Não lida. ' : ''}${notificacao.mensagem} ${quando}`}
      onPress={aoTocar}
      style={({ pressed }) => [
        estilos.card,
        naoLida && estilos.cardNaoLida,
        pressed && estilos.pressionado,
      ]}
    >
      <View style={[estilos.icone, naoLida && estilos.iconeNaoLida]}>
        <Ionicons
          name={iconeNotificacao(notificacao.tipo)}
          size={TAMANHO_ICONE}
          color={naoLida ? cores.primaria : cores.textoSecundario}
        />
      </View>
      <View style={estilos.textos}>
        <Text style={naoLida ? estilos.mensagemNaoLida : estilos.mensagem}>
          {notificacao.mensagem}
        </Text>
        <Text style={estilos.quando}>{quando}</Text>
      </View>
      {naoLida ? <View style={estilos.marcaNaoLida} /> : null}
    </Pressable>
  );
}

// Notificações dentro do app (T29): tocar marca como lida e abre a reserva ou a carona
export default function TelaNotificacoes() {
  const [lista, setLista] = useState<Lista>({ tipo: 'carregando' });
  const [atualizando, setAtualizando] = useState(false);
  const [marcandoTodas, setMarcandoTodas] = useState(false);
  const [erroAcao, setErroAcao] = useState<string | null>(null);

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

  // A lista muda na hora; se a marcação falhar, ela volta como estava no próximo carregamento
  const marcarNaLista = (ids: string[] | null) => {
    setLista((atual) =>
      atual.tipo === 'pronto'
        ? {
            tipo: 'pronto',
            notificacoes: atual.notificacoes.map((item) =>
              ids === null || ids.includes(item.id_notificacao) ? { ...item, lida: true } : item,
            ),
          }
        : atual,
    );
  };

  const aoTocar = (notificacao: Notificacao) => {
    setErroAcao(null);
    if (!notificacao.lida) {
      marcarNaLista([notificacao.id_notificacao]);
      // Não espera: abrir a tela não depende de marcar como lida
      void (async () => {
        try {
          await marcarComoLidas([notificacao.id_notificacao]);
        } catch {
          // Fica não lida no servidor; aparece de novo ao recarregar
        }
      })();
    }
    const destino = destinoNotificacao(notificacao);
    if (destino) {
      router.push(destino);
    }
  };

  const aoMarcarTodas = async () => {
    setErroAcao(null);
    setMarcandoTodas(true);
    try {
      await marcarComoLidas();
      marcarNaLista(null);
    } catch (falha) {
      setErroAcao(normalizarErro(falha).message);
    } finally {
      setMarcandoTodas(false);
    }
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

  const temNaoLidas = lista.notificacoes.some((item) => !item.lida);

  return (
    <FlatList
      style={estilos.tela}
      contentContainerStyle={estilos.lista}
      data={lista.notificacoes}
      keyExtractor={(item) => item.id_notificacao}
      renderItem={({ item }) => (
        <ItemNotificacao notificacao={item} aoTocar={() => aoTocar(item)} />
      )}
      ListHeaderComponent={
        temNaoLidas || erroAcao ? (
          <View style={estilos.cabecalho}>
            {temNaoLidas ? (
              <Botao
                titulo="Marcar todas como lidas"
                icone="checkmark-done-outline"
                variante="texto"
                carregando={marcandoTodas}
                onPress={() => void aoMarcarTodas()}
                estilo={estilos.marcarTodas}
              />
            ) : null}
            {erroAcao ? <Aviso mensagem={erroAcao} /> : null}
          </View>
        ) : undefined
      }
      ListEmptyComponent={
        <EstadoVazio
          icone="notifications-outline"
          titulo="Nenhuma notificação"
          mensagem="Avisos de reservas, pagamentos, cancelamentos e avaliações aparecem aqui."
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
  cabecalho: { gap: tema.espaco.x2 },
  marcarTodas: { alignSelf: 'flex-end' },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: tema.espaco.x3,
    backgroundColor: cores.superficie,
    borderRadius: tema.raio.grande,
    borderWidth: 1,
    borderColor: cores.borda,
    paddingVertical: tema.espaco.x3,
    paddingHorizontal: tema.espaco.x4,
    minHeight: tema.toque.minimo,
    ...tema.sombra.cartao,
  },
  // Não lida em destaque: borda e ícone na cor primária, texto forte e o ponto à direita
  cardNaoLida: { borderColor: cores.primaria },
  pressionado: { backgroundColor: cores.superficieAlternativa },
  icone: {
    width: tema.toque.minimo,
    height: tema.toque.minimo,
    borderRadius: tema.raio.pilula,
    backgroundColor: cores.superficieAlternativa,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconeNaoLida: { backgroundColor: cores.primariaClara },
  textos: { flex: 1, gap: tema.espaco.x1 },
  mensagem: { ...tema.tipografia.corpo, color: cores.textoSecundario },
  mensagemNaoLida: { ...tema.tipografia.corpoForte, color: cores.texto },
  quando: { ...tema.tipografia.legenda, color: cores.textoSecundario },
  marcaNaoLida: {
    width: TAMANHO_MARCA_NAO_LIDA,
    height: TAMANHO_MARCA_NAO_LIDA,
    borderRadius: tema.raio.pilula,
    backgroundColor: cores.primaria,
    marginTop: tema.espaco.x2,
  },
});
