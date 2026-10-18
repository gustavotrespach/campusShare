import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/Avatar';
import { Aviso } from '@/components/Aviso';
import { Botao } from '@/components/Botao';
import { EsqueletoLista } from '@/components/EsqueletoLista';
import { EstadoVazio } from '@/components/EstadoVazio';
import { ItemCarona } from '@/components/ItemCarona';
import { OpcaoInterruptor } from '@/components/OpcaoInterruptor';
import { SeletorOpcoes, type Opcao } from '@/components/SeletorOpcoes';
import { buscarCaronas, type CaronaResumo } from '@/services/caronas';
import { normalizarErro } from '@/services/erros';
import { obterLocalizacaoAtual, type Coordenadas } from '@/services/localizacao';
import { obterMeuPerfil } from '@/services/perfil';
import { tema } from '@/tema';
import { textoContagemCaronas } from '@/utils/exibicao-carona';
import { mostrarFiltroSomenteMulheres } from '@/utils/genero';
import { primeiroNome } from '@/utils/nome';
import { ID_MINHA_LOCALIZACAO, ID_PONTO_PADRAO, PONTOS_FIXOS, pontoPorId } from '@/utils/pontos';

type Lista =
  | { tipo: 'carregando' }
  | { tipo: 'erro'; mensagem: string }
  | { tipo: 'pronto'; caronas: CaronaResumo[] };

const { cores } = tema;

const OPCOES_PONTO: Opcao<string>[] = [
  ...PONTOS_FIXOS.map((ponto) => ({ valor: ponto.id, rotulo: ponto.rotulo })),
  { valor: ID_MINHA_LOCALIZACAO, rotulo: 'Minha localização', icone: 'locate-outline' },
];

// Altura do botão flutuante e folga: o último card não fica embaixo dele
const ESPACO_BOTAO_FLUTUANTE = 96;

async function consultar(
  latitude: number,
  longitude: number,
  somenteMulheres: boolean,
): Promise<Lista> {
  try {
    return {
      tipo: 'pronto',
      caronas: await buscarCaronas({ latitude, longitude, somenteMulheres }),
    };
  } catch (falha) {
    return { tipo: 'erro', mensagem: normalizarErro(falha).message };
  }
}

export default function TelaCaronasProximas() {
  const insets = useSafeAreaInsets();
  const [idPonto, setIdPonto] = useState(ID_PONTO_PADRAO);
  const [minhaLocalizacao, setMinhaLocalizacao] = useState<Coordenadas | null>(null);
  const [somenteMulheres, setSomenteMulheres] = useState(false);
  const [exibirFiltro, setExibirFiltro] = useState(false);
  const [nomeUsuario, setNomeUsuario] = useState('');
  const [lista, setLista] = useState<Lista>({ tipo: 'carregando' });
  const [atualizando, setAtualizando] = useState(false);
  const [localizando, setLocalizando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  const centro =
    idPonto === ID_MINHA_LOCALIZACAO ? minhaLocalizacao : (pontoPorId(idPonto) ?? null);
  const latitude = centro?.latitude ?? null;
  const longitude = centro?.longitude ?? null;
  // Quem não vê o filtro (ex.: mudou o gênero no Perfil) busca sempre sem ele
  const filtroAtivo = exibirFiltro && somenteMulheres;

  // Do perfil: o nome da saudação e o filtro "Somente mulheres", que só aparece para quem verá
  // resultado (a regra é do backend, RN18). Volta a ler ao voltar do Perfil, onde o nome muda.
  useFocusEffect(
    useCallback(() => {
      let ativo = true;
      const carregarPerfil = async () => {
        try {
          const perfil = await obterMeuPerfil();
          if (ativo) {
            setExibirFiltro(mostrarFiltroSomenteMulheres(perfil.genero));
            setNomeUsuario(perfil.nome_completo);
          }
        } catch {
          // Sem perfil, segue sem o filtro e sem a saudação; a busca continua funcionando
        }
      };
      void carregarPerfil();
      return () => {
        ativo = false;
      };
    }, []),
  );

  // Recarrega ao voltar para a tela (depois de publicar) e ao mudar ponto ou filtro
  useFocusEffect(
    useCallback(() => {
      if (latitude === null || longitude === null) {
        return undefined;
      }
      let ativo = true;
      const carregar = async () => {
        const resultado = await consultar(latitude, longitude, filtroAtivo);
        if (ativo) {
          setLista(resultado);
          setAtualizando(false);
        }
      };
      void carregar();
      return () => {
        ativo = false;
      };
    }, [latitude, longitude, filtroAtivo]),
  );

  const atualizar = async () => {
    if (latitude === null || longitude === null) {
      return;
    }
    setAtualizando(true);
    setLista(await consultar(latitude, longitude, filtroAtivo));
    setAtualizando(false);
  };

  const aoEscolherPonto = async (id: string) => {
    setAviso(null);
    if (id !== ID_MINHA_LOCALIZACAO) {
      setLista({ tipo: 'carregando' });
      setIdPonto(id);
      return;
    }
    setLocalizando(true);
    try {
      const coordenadas = await obterLocalizacaoAtual();
      setLista({ tipo: 'carregando' });
      setMinhaLocalizacao(coordenadas);
      setIdPonto(id);
    } catch (falha) {
      // Mantém o ponto anterior
      setAviso(normalizarErro(falha).message);
    } finally {
      setLocalizando(false);
    }
  };

  const saudacao = primeiroNome(nomeUsuario);
  const contagem = lista.tipo === 'pronto' ? textoContagemCaronas(lista.caronas.length) : null;

  const cabecalho = (
    <View style={estilos.cabecalho}>
      <View style={estilos.topo}>
        <View style={estilos.titulos}>
          {saudacao ? <Text style={estilos.saudacao}>Olá, {saudacao}</Text> : null}
          <Text style={estilos.titulo} maxFontSizeMultiplier={1.4} accessibilityRole="header">
            Caronas próximas
          </Text>
        </View>
        <View style={estilos.acoesTopo}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Minhas reservas"
            onPress={() => router.push('/reservas')}
            style={({ pressed }) => [estilos.botaoIcone, pressed && estilos.botaoIconePressionado]}
          >
            <Ionicons name="receipt-outline" size={22} color={cores.primaria} />
          </Pressable>
          <Avatar
            nome={nomeUsuario}
            tamanho={44}
            accessibilityLabel="Meu perfil"
            onPress={() => router.push('/perfil')}
          />
        </View>
      </View>

      <SeletorOpcoes
        rotulo="Perto de"
        opcoes={OPCOES_PONTO}
        valor={idPonto}
        aoMudar={(id) => void aoEscolherPonto(id)}
        horizontal
        iconeSelecionado="location"
      />
      {localizando ? <Text style={estilos.legenda}>Obtendo sua localização…</Text> : null}
      {exibirFiltro ? (
        <OpcaoInterruptor
          icone="female-outline"
          corIcone={cores.secundariaTexto}
          titulo="Somente mulheres"
          ajuda="Mostrar só caronas para passageiras"
          accessibilityLabel="Mostrar só caronas somente mulheres"
          valor={somenteMulheres}
          aoMudar={(valor) => {
            setLista({ tipo: 'carregando' });
            setSomenteMulheres(valor);
          }}
        />
      ) : null}
      {aviso ? (
        <Aviso
          mensagem={aviso}
          acao={{
            titulo: 'Tentar de novo',
            onPress: () => void aoEscolherPonto(ID_MINHA_LOCALIZACAO),
          }}
        />
      ) : null}
      {lista.tipo === 'erro' ? (
        <Aviso
          mensagem={lista.mensagem}
          acao={{ titulo: 'Tentar de novo', onPress: () => void atualizar() }}
        />
      ) : null}
      {contagem ? <Text style={[estilos.legenda, estilos.contagem]}>{contagem}</Text> : null}
      {lista.tipo === 'carregando' ? <EsqueletoLista /> : null}
    </View>
  );

  return (
    <View style={estilos.tela}>
      <FlatList
        contentContainerStyle={[
          estilos.lista,
          {
            paddingTop: insets.top + tema.espaco.x2,
            paddingBottom: insets.bottom + ESPACO_BOTAO_FLUTUANTE,
          },
        ]}
        data={lista.tipo === 'pronto' ? lista.caronas : []}
        keyExtractor={(carona) => carona.id_carona}
        renderItem={({ item }) => (
          <ItemCarona
            carona={item}
            aoAbrir={() =>
              router.push({ pathname: '/caronas/[id]', params: { id: item.id_carona } })
            }
          />
        )}
        ListHeaderComponent={cabecalho}
        ListEmptyComponent={
          lista.tipo === 'pronto' ? (
            <EstadoVazio
              icone="car-outline"
              titulo="Nenhuma carona por aqui"
              mensagem="Nenhuma carona disponível perto deste ponto. Tente outro ponto ou volte mais tarde."
            />
          ) : null
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
      <Botao
        titulo="Oferecer carona"
        icone="add"
        onPress={() => router.push('/caronas/publicar')}
        estilo={[estilos.flutuante, { bottom: insets.bottom + tema.espaco.x4 }]}
      />
    </View>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.fundo },
  lista: { paddingHorizontal: tema.espaco.x5, gap: tema.espaco.x3 },
  cabecalho: { gap: tema.espaco.x3, marginBottom: tema.espaco.x1 },
  topo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: tema.espaco.x2,
  },
  titulos: { flex: 1 },
  saudacao: { ...tema.tipografia.corpo, color: cores.textoSecundario },
  titulo: { ...tema.tipografia.titulo, color: cores.texto },
  acoesTopo: { flexDirection: 'row', alignItems: 'center', gap: tema.espaco.x2 },
  botaoIcone: {
    width: tema.toque.minimo,
    height: tema.toque.minimo,
    borderRadius: tema.raio.pilula,
    backgroundColor: cores.superficie,
    borderWidth: 1,
    borderColor: cores.borda,
    alignItems: 'center',
    justifyContent: 'center',
  },
  botaoIconePressionado: { backgroundColor: cores.superficieAlternativa },
  legenda: { ...tema.tipografia.legenda, color: cores.textoSecundario },
  contagem: { marginTop: tema.espaco.x2 },
  flutuante: {
    position: 'absolute',
    right: tema.espaco.x5,
    alignSelf: 'auto',
    borderRadius: tema.raio.pilula,
    paddingVertical: 18,
    paddingHorizontal: 22,
    ...tema.sombra.flutuante,
  },
});
