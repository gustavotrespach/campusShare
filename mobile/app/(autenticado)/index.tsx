import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';

import { Aviso } from '@/components/Aviso';
import { Botao } from '@/components/Botao';
import { ItemCarona } from '@/components/ItemCarona';
import { SeletorOpcoes, type Opcao } from '@/components/SeletorOpcoes';
import { StatusServidor } from '@/components/StatusServidor';
import { sair } from '@/services/auth';
import { buscarCaronas, type CaronaResumo } from '@/services/caronas';
import { normalizarErro } from '@/services/erros';
import { obterLocalizacaoAtual, type Coordenadas } from '@/services/localizacao';
import { obterMeuPerfil } from '@/services/perfil';
import { limparPix } from '@/store/pix';
import { mostrarFiltroSomenteMulheres } from '@/utils/genero';
import { ID_MINHA_LOCALIZACAO, ID_PONTO_PADRAO, PONTOS_FIXOS, pontoPorId } from '@/utils/pontos';

type Lista =
  | { tipo: 'carregando' }
  | { tipo: 'erro'; mensagem: string }
  | { tipo: 'pronto'; caronas: CaronaResumo[] };

const OPCOES_PONTO: Opcao<string>[] = [
  ...PONTOS_FIXOS.map((ponto) => ({ valor: ponto.id, rotulo: ponto.rotulo })),
  { valor: ID_MINHA_LOCALIZACAO, rotulo: 'Minha localização' },
];

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
  const [idPonto, setIdPonto] = useState(ID_PONTO_PADRAO);
  const [minhaLocalizacao, setMinhaLocalizacao] = useState<Coordenadas | null>(null);
  const [somenteMulheres, setSomenteMulheres] = useState(false);
  const [exibirFiltro, setExibirFiltro] = useState(false);
  const [lista, setLista] = useState<Lista>({ tipo: 'carregando' });
  const [atualizando, setAtualizando] = useState(false);
  const [localizando, setLocalizando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [saindo, setSaindo] = useState(false);

  const centro =
    idPonto === ID_MINHA_LOCALIZACAO ? minhaLocalizacao : (pontoPorId(idPonto) ?? null);
  const latitude = centro?.latitude ?? null;
  const longitude = centro?.longitude ?? null;

  // O filtro "Somente mulheres" só aparece para quem verá resultado (a regra é do backend, RN18)
  useEffect(() => {
    let ativo = true;
    const carregarPerfil = async () => {
      try {
        const perfil = await obterMeuPerfil();
        if (ativo) {
          setExibirFiltro(mostrarFiltroSomenteMulheres(perfil.genero));
        }
      } catch {
        // Sem perfil, segue sem o filtro; a busca continua funcionando
      }
    };
    void carregarPerfil();
    return () => {
      ativo = false;
    };
  }, []);

  // Recarrega ao voltar para a tela (depois de publicar) e ao mudar ponto ou filtro
  useFocusEffect(
    useCallback(() => {
      if (latitude === null || longitude === null) {
        return undefined;
      }
      let ativo = true;
      const carregar = async () => {
        const resultado = await consultar(latitude, longitude, somenteMulheres);
        if (ativo) {
          setLista(resultado);
          setAtualizando(false);
        }
      };
      void carregar();
      return () => {
        ativo = false;
      };
    }, [latitude, longitude, somenteMulheres]),
  );

  const atualizar = async () => {
    if (latitude === null || longitude === null) {
      return;
    }
    setAtualizando(true);
    setLista(await consultar(latitude, longitude, somenteMulheres));
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

  const aoSair = async () => {
    setSaindo(true);
    try {
      await sair();
      // O Pix em memória é da conta que saiu
      limparPix();
    } catch (falha) {
      setAviso(normalizarErro(falha).message);
      setSaindo(false);
    }
  };

  const cabecalho = (
    <View style={estilos.cabecalho}>
      <Botao titulo="Oferecer carona" onPress={() => router.push('/caronas/publicar')} />
      <SeletorOpcoes
        rotulo="Perto de"
        opcoes={OPCOES_PONTO}
        valor={idPonto}
        aoMudar={(id) => void aoEscolherPonto(id)}
      />
      {localizando ? <Text style={estilos.ajuda}>Obtendo sua localização…</Text> : null}
      {exibirFiltro ? (
        <View style={estilos.filtro}>
          <Text style={estilos.textoFiltro}>Somente mulheres</Text>
          <Switch
            accessibilityLabel="Mostrar só caronas somente mulheres"
            value={somenteMulheres}
            onValueChange={(valor) => {
              setLista({ tipo: 'carregando' });
              setSomenteMulheres(valor);
            }}
          />
        </View>
      ) : null}
      {aviso ? <Aviso mensagem={aviso} /> : null}
      {lista.tipo === 'carregando' ? <ActivityIndicator size="large" /> : null}
      {lista.tipo === 'erro' ? (
        <>
          <Aviso mensagem={lista.mensagem} />
          <Botao titulo="Tentar de novo" variante="secundario" onPress={() => void atualizar()} />
        </>
      ) : null}
    </View>
  );

  const rodape = (
    <View style={estilos.rodape}>
      <Botao
        titulo="Minhas reservas"
        variante="secundario"
        onPress={() => router.push('/reservas')}
      />
      <Botao
        titulo="Meus veículos"
        variante="secundario"
        onPress={() => router.push('/veiculos')}
      />
      <Botao titulo="Meu perfil" variante="secundario" onPress={() => router.push('/perfil')} />
      <StatusServidor />
      <Botao titulo="Sair" variante="secundario" carregando={saindo} onPress={aoSair} />
    </View>
  );

  return (
    <FlatList
      style={estilos.tela}
      contentContainerStyle={estilos.lista}
      data={lista.tipo === 'pronto' ? lista.caronas : []}
      keyExtractor={(carona) => carona.id_carona}
      renderItem={({ item }) => (
        <ItemCarona
          carona={item}
          aoAbrir={() => router.push({ pathname: '/caronas/[id]', params: { id: item.id_carona } })}
        />
      )}
      ListHeaderComponent={cabecalho}
      ListEmptyComponent={
        lista.tipo === 'pronto' ? (
          <Text style={estilos.vazio}>
            Nenhuma carona disponível perto deste ponto. Tente outro ponto ou volte mais tarde.
          </Text>
        ) : null
      }
      ListFooterComponent={rodape}
      refreshControl={
        <RefreshControl refreshing={atualizando} onRefresh={() => void atualizar()} />
      }
    />
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: '#fff' },
  lista: { padding: 24, gap: 12 },
  cabecalho: { gap: 16, marginBottom: 4 },
  ajuda: { fontSize: 13, color: '#52606d' },
  filtro: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  textoFiltro: { fontSize: 15, color: '#1f2933' },
  vazio: { fontSize: 15, color: '#52606d', textAlign: 'center', paddingVertical: 24 },
  rodape: { gap: 12, marginTop: 24 },
});
