import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState, type ComponentRef } from 'react';
import {
  Pressable,
  RefreshControl,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/Avatar';
import { Aviso } from '@/components/Aviso';
import { Botao } from '@/components/Botao';
import { BuscaLocal } from '@/components/BuscaLocal';
import { EsqueletoLista } from '@/components/EsqueletoLista';
import { EstadoVazio } from '@/components/EstadoVazio';
import { ItemCarona } from '@/components/ItemCarona';
import { OpcaoInterruptor } from '@/components/OpcaoInterruptor';
import { ProximaViagem } from '@/components/ProximaViagem';
import { listarAvaliacoesPendentes } from '@/services/avaliacoes';
import { buscarCaronas, type CaronaResumo } from '@/services/caronas';
import { normalizarErro } from '@/services/erros';
import { localizarEndereco, obterLocalizacaoAtual } from '@/services/localizacao';
import { obterMinhaFoto } from '@/services/foto-perfil';
import { obterMeuPerfil } from '@/services/perfil';
import { obterProximaViagem, type ViagemDoInicio } from '@/services/proxima-viagem';
import { tema } from '@/tema';
import { textoAvaliacoesPendentes } from '@/utils/avaliacoes';
import { pontoPorTexto } from '@/utils/busca-local';
import { mostrarFiltroSomenteMulheres } from '@/utils/genero';
import { agruparPorDia, tituloSemCaronas } from '@/utils/inicio';
import { primeiroNome } from '@/utils/nome';
import { ID_PONTO_PADRAO, pontoPorId, type PontoFixo } from '@/utils/pontos';

type Lista =
  | { tipo: 'carregando' }
  | { tipo: 'erro'; mensagem: string }
  | { tipo: 'pronto'; caronas: CaronaResumo[] };

const { cores } = tema;

// O centro da busca e o nome dele na legenda "Caronas perto de: …"
interface CentroBusca {
  rotulo: string;
  latitude: number;
  longitude: number;
}

type AvisoBusca = { mensagem: string; tentarDeNovo?: () => void } | null;

// O que fica acima da lista e não é a busca: o card "Sua próxima viagem" e o banner de avaliações
interface Topo {
  viagem: ViagemDoInicio | null;
  avaliacoesPendentes: number;
}

const TOPO_VAZIO: Topo = { viagem: null, avaliacoesPendentes: 0 };

function centroDoPonto(ponto: PontoFixo): CentroBusca {
  return { rotulo: ponto.rotulo, latitude: ponto.latitude, longitude: ponto.longitude };
}

const PONTO_PADRAO = pontoPorId(ID_PONTO_PADRAO);
const CENTRO_INICIAL: CentroBusca | null = PONTO_PADRAO ? centroDoPonto(PONTO_PADRAO) : null;

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

// Se a consulta falhar, o banner só não aparece (T30)
async function contarAvaliacoesPendentes(): Promise<number> {
  try {
    return (await listarAvaliacoesPendentes()).length;
  } catch {
    return 0;
  }
}

// Nenhuma das duas rejeita: falha vira "sem card" e "sem banner", sem erro na tela
async function consultarTopo(): Promise<Topo> {
  const [viagem, avaliacoesPendentes] = await Promise.all([
    obterProximaViagem(),
    contarAvaliacoesPendentes(),
  ]);
  return { viagem, avaliacoesPendentes };
}

export default function TelaCaronasProximas() {
  const insets = useSafeAreaInsets();
  const [centro, setCentro] = useState<CentroBusca | null>(CENTRO_INICIAL);
  const [texto, setTexto] = useState('');
  const [buscandoTexto, setBuscandoTexto] = useState<string | null>(null);
  const [somenteMulheres, setSomenteMulheres] = useState(false);
  const [exibirFiltro, setExibirFiltro] = useState(false);
  const [nomeUsuario, setNomeUsuario] = useState('');
  const [minhaFoto, setMinhaFoto] = useState<string | null>(null);
  const [lista, setLista] = useState<Lista>({ tipo: 'carregando' });
  const [atualizando, setAtualizando] = useState(false);
  const [localizando, setLocalizando] = useState(false);
  const [aviso, setAviso] = useState<AvisoBusca>(null);
  const [topo, setTopo] = useState<Topo>(TOPO_VAZIO);
  // Medida no onLayout (cresce com a fonte do sistema): o fim da lista reserva esse espaço
  const [alturaBotaoFlutuante, setAlturaBotaoFlutuante] = useState<number>(tema.toque.botao);
  const entradaBusca = useRef<ComponentRef<typeof TextInput>>(null);
  const listaRef = useRef<SectionList<CaronaResumo, { titulo: string }>>(null);

  // "Sua próxima viagem" e o banner de avaliações (T30/T43): recarregam ao voltar para a tela
  useFocusEffect(
    useCallback(() => {
      let ativo = true;
      const carregar = async () => {
        const resultado = await consultarTopo();
        if (ativo) {
          setTopo(resultado);
        }
      };
      void carregar();
      return () => {
        ativo = false;
      };
    }, []),
  );

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
      // A própria foto (T44) volta a ser lida ao voltar do Perfil, onde ela muda; se falhar, iniciais
      const carregarFoto = async () => {
        try {
          const foto = await obterMinhaFoto();
          if (ativo) {
            setMinhaFoto(foto);
          }
        } catch {
          // Fica com as iniciais
        }
      };
      void carregarPerfil();
      void carregarFoto();
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

  // Puxar para atualizar recarrega a lista, o card e o banner
  const atualizar = async () => {
    setAtualizando(true);
    const [resultado, novoTopo] = await Promise.all([
      latitude === null || longitude === null ? null : consultar(latitude, longitude, filtroAtivo),
      consultarTopo(),
    ]);
    if (resultado) {
      setLista(resultado);
    }
    setTopo(novoTopo);
    setAtualizando(false);
  };

  // Estado vazio → "Buscar em outro lugar": volta ao topo e abre o teclado na barra de busca
  const buscarEmOutroLugar = () => {
    listaRef.current?.getScrollResponder()?.scrollTo({ y: 0, animated: true });
    entradaBusca.current?.focus();
  };

  const abrirProximaViagem = (viagem: ViagemDoInicio) => {
    if (viagem.tipo === 'RESERVA') {
      router.push({ pathname: '/reservas/[id]', params: { id: viagem.reserva.id_reserva } });
    } else {
      router.push({ pathname: '/caronas/[id]', params: { id: viagem.carona.id_carona } });
    }
  };

  // Novo centro: a lista anterior dá lugar ao esqueleto até a busca responder (mesmo centro: nada
  // muda e a lista fica)
  const usarCentro = (novo: CentroBusca) => {
    setAviso(null);
    setTexto('');
    if (novo.latitude !== latitude || novo.longitude !== longitude) {
      setLista({ tipo: 'carregando' });
    }
    setCentro(novo);
  };

  const aoUsarMinhaLocalizacao = async () => {
    setAviso(null);
    setLocalizando(true);
    try {
      // Só pede a permissão aqui, no toque (nunca ao abrir o app)
      const coordenadas = await obterLocalizacaoAtual();
      usarCentro({ rotulo: 'sua localização', ...coordenadas });
    } catch (falha) {
      // Mantém o centro e a lista anteriores
      setAviso({
        mensagem: normalizarErro(falha).message,
        tentarDeNovo: () => void aoUsarMinhaLocalizacao(),
      });
    } finally {
      setLocalizando(false);
    }
  };

  // Texto livre: um ponto fixo pelo nome ou o geocodificador do aparelho (sem chamada ao backend)
  const aoBuscarTexto = async () => {
    const digitado = texto.replace(/\s+/g, ' ').trim();
    if (!digitado) {
      return;
    }
    const ponto = pontoPorTexto(digitado);
    if (ponto) {
      usarCentro(centroDoPonto(ponto));
      return;
    }
    setAviso(null);
    setBuscandoTexto(digitado);
    try {
      const coordenadas = await localizarEndereco(digitado);
      usarCentro({ rotulo: digitado, ...coordenadas });
    } catch (falha) {
      // O texto e a lista anterior ficam: o usuário corrige e busca de novo
      setAviso({ mensagem: normalizarErro(falha).message });
    } finally {
      setBuscandoTexto(null);
    }
  };

  const saudacao = primeiroNome(nomeUsuario);
  const { viagem } = topo;
  const grupos =
    lista.tipo === 'pronto'
      ? agruparPorDia(lista.caronas).map((grupo) => ({
          key: grupo.chave,
          titulo: grupo.titulo,
          data: grupo.itens,
        }))
      : [];

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
            fotoCaminho={minhaFoto}
            tamanho={44}
            accessibilityLabel="Meu perfil"
            onPress={() => router.push('/perfil')}
          />
        </View>
      </View>

      <BuscaLocal
        texto={texto}
        aoMudarTexto={setTexto}
        aoBuscarTexto={() => void aoBuscarTexto()}
        aoEscolherPonto={(ponto) => usarCentro(centroDoPonto(ponto))}
        aoUsarMinhaLocalizacao={() => void aoUsarMinhaLocalizacao()}
        localizando={localizando}
        refEntrada={entradaBusca}
      />
      <Text style={estilos.legenda} accessibilityLiveRegion="polite">
        {localizando
          ? 'Obtendo sua localização…'
          : buscandoTexto
            ? `Buscando “${buscandoTexto}”…`
            : centro
              ? `Caronas perto de: ${centro.rotulo}`
              : null}
      </Text>
      {viagem ? <ProximaViagem viagem={viagem} aoAbrir={() => abrirProximaViagem(viagem)} /> : null}
      {topo.avaliacoesPendentes > 0 ? (
        <Aviso
          tipo="info"
          mensagem={textoAvaliacoesPendentes(topo.avaliacoesPendentes)}
          acao={{ titulo: 'Avaliar', onPress: () => router.push('/avaliacoes') }}
        />
      ) : null}
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
          mensagem={aviso.mensagem}
          acao={
            aviso.tentarDeNovo
              ? { titulo: 'Tentar de novo', onPress: aviso.tentarDeNovo }
              : undefined
          }
        />
      ) : null}
      {lista.tipo === 'erro' ? (
        <Aviso
          mensagem={lista.mensagem}
          acao={{ titulo: 'Tentar de novo', onPress: () => void atualizar() }}
        />
      ) : null}
      {lista.tipo === 'carregando' ? <EsqueletoLista /> : null}
    </View>
  );

  return (
    <View style={estilos.tela}>
      <SectionList
        ref={listaRef}
        contentContainerStyle={[
          estilos.lista,
          {
            paddingTop: insets.top + tema.espaco.x2,
            // O fim do conteúdo (último card ou estado vazio) fica acima do botão flutuante
            paddingBottom: insets.bottom + tema.espaco.x4 + alturaBotaoFlutuante + tema.espaco.x4,
          },
        ]}
        sections={grupos}
        stickySectionHeadersEnabled={false}
        // Tocar numa sugestão com o teclado aberto já escolhe (sem um toque só para fechar o teclado)
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        keyExtractor={(carona) => carona.id_carona}
        renderItem={({ item }) => (
          <ItemCarona
            carona={item}
            aoAbrir={() =>
              router.push({ pathname: '/caronas/[id]', params: { id: item.id_carona } })
            }
          />
        )}
        renderSectionHeader={({ section }) => (
          <Text style={estilos.tituloGrupo} accessibilityRole="header">
            {section.titulo}
          </Text>
        )}
        ListHeaderComponent={cabecalho}
        ListEmptyComponent={
          lista.tipo === 'pronto' ? (
            <EstadoVazio
              icone="car-outline"
              titulo={tituloSemCaronas(centro?.rotulo ?? null)}
              // "Oferecer carona" é o botão flutuante, sempre visível: uma ação só aqui
              mensagem="Tente outro lugar ou ofereça uma carona pelo botão abaixo."
              acao={{
                titulo: 'Buscar em outro lugar',
                icone: 'search-outline',
                onPress: buscarEmOutroLugar,
              }}
            />
          ) : undefined
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
      <View
        pointerEvents="box-none"
        onLayout={(evento) => setAlturaBotaoFlutuante(evento.nativeEvent.layout.height)}
        style={[estilos.posicaoFlutuante, { bottom: insets.bottom + tema.espaco.x4 }]}
      >
        <Botao
          titulo="Oferecer carona"
          icone="add"
          onPress={() => router.push('/caronas/publicar')}
          estilo={estilos.flutuante}
        />
      </View>
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
  // 12 do gap da lista + 12: separa um dia do anterior
  tituloGrupo: {
    ...tema.tipografia.subtitulo,
    color: cores.texto,
    marginTop: tema.espaco.x3,
  },
  posicaoFlutuante: { position: 'absolute', right: tema.espaco.x5 },
  flutuante: {
    alignSelf: 'auto',
    borderRadius: tema.raio.pilula,
    paddingVertical: 18,
    paddingHorizontal: 22,
    ...tema.sombra.flutuante,
  },
});
