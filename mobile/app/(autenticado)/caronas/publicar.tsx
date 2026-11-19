import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';

import { Aviso } from '@/components/Aviso';
import { Botao } from '@/components/Botao';
import { CampoTexto } from '@/components/CampoTexto';
import { CarregandoTela } from '@/components/CarregandoTela';
import { Cartao } from '@/components/Cartao';
import { ErroCarregamento } from '@/components/ErroCarregamento';
import { EstadoVazio } from '@/components/EstadoVazio';
import { MarcadorRota } from '@/components/LinhaRota';
import { OpcaoInterruptor } from '@/components/OpcaoInterruptor';
import { SeletorDataHora } from '@/components/SeletorDataHora';
import { SeletorLocal } from '@/components/SeletorLocal';
import { SeletorOpcoes, type Opcao } from '@/components/SeletorOpcoes';
import { publicarCarona } from '@/services/caronas';
import { normalizarErro } from '@/services/erros';
import { listarMeusVeiculos, type Veiculo } from '@/services/veiculos';
import { tema } from '@/tema';
import { partidaSugerida } from '@/utils/data-hora';
import { lerReais } from '@/utils/dinheiro';
import { campoDoErroDePublicacao } from '@/utils/erros-carona';
import { pontoPorId, type Local } from '@/utils/pontos';
import {
  temErros,
  validarPublicacao,
  type CamposPublicacao,
  type ErrosDeCampo,
} from '@/utils/validacao';

type Veiculos =
  | { tipo: 'carregando' }
  | { tipo: 'erro'; mensagem: string }
  | { tipo: 'pronto'; veiculos: Veiculo[] };

const ID_ORIGEM_PADRAO = 'centro-torres';
const ID_DESTINO_PADRAO = 'ulbra-torres';
const VAGAS_PADRAO = 3;
// O valor por passageiro não aparece aqui: quem calcula é o backend (ADR-005)
const AJUDA_CUSTO =
  'O valor é dividido entre você e os passageiros. O valor por passageiro aparece no detalhe da carona depois de publicar.';
const TOLERANCIAS = [0, 5, 10, 15, 20, 30];
const OPCOES_TOLERANCIA: Opcao<number>[] = TOLERANCIAS.map((minutos) => ({
  valor: minutos,
  rotulo: `${minutos} min`,
}));

function localDoPonto(id: string): Local | null {
  const ponto = pontoPorId(id);
  return ponto
    ? { descricao: ponto.descricao, latitude: ponto.latitude, longitude: ponto.longitude }
    : null;
}

// Vagas para passageiros: o motorista ocupa um dos lugares (RN05). É limite de interface; quem
// garante a regra é a publicar_carona.
function opcoesDeVagas(veiculo: Veiculo | undefined): Opcao<number>[] {
  const maximo = veiculo ? veiculo.qtd_lugares - 1 : 1;
  return Array.from({ length: Math.max(maximo, 1) }, (_, indice) => ({
    valor: indice + 1,
    rotulo: String(indice + 1),
  }));
}

async function consultarVeiculos(): Promise<Veiculos> {
  try {
    return { tipo: 'pronto', veiculos: await listarMeusVeiculos() };
  } catch (falha) {
    return { tipo: 'erro', mensagem: normalizarErro(falha).message };
  }
}

export default function TelaPublicarCarona() {
  const [estadoVeiculos, setEstadoVeiculos] = useState<Veiculos>({ tipo: 'carregando' });
  const [idVeiculo, setIdVeiculo] = useState<string | null>(null);
  const [origem, setOrigem] = useState<Local | null>(localDoPonto(ID_ORIGEM_PADRAO));
  const [destino, setDestino] = useState<Local | null>(localDoPonto(ID_DESTINO_PADRAO));
  const [partida, setPartida] = useState<Date>(partidaSugerida());
  const [vagas, setVagas] = useState(VAGAS_PADRAO);
  const [custoTotal, setCustoTotal] = useState('');
  const [tolerancia, setTolerancia] = useState(10);
  const [somenteMulheres, setSomenteMulheres] = useState(false);
  const [errosCampo, setErrosCampo] = useState<ErrosDeCampo<CamposPublicacao>>({});
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [publicando, setPublicando] = useState(false);

  // Recarrega os veículos ao voltar do cadastro de veículo
  useFocusEffect(
    useCallback(() => {
      let ativo = true;
      const carregar = async () => {
        const estado = await consultarVeiculos();
        if (!ativo) {
          return;
        }
        setEstadoVeiculos(estado);
        if (estado.tipo === 'pronto') {
          // Mantém a escolha se o veículo ainda existe; senão, o primeiro da lista
          setIdVeiculo((atual) =>
            estado.veiculos.some((veiculo) => veiculo.id_veiculo === atual)
              ? atual
              : (estado.veiculos[0]?.id_veiculo ?? null),
          );
        }
      };
      void carregar();
      return () => {
        ativo = false;
      };
    }, []),
  );

  const veiculos = estadoVeiculos.tipo === 'pronto' ? estadoVeiculos.veiculos : [];
  const veiculo = veiculos.find((item) => item.id_veiculo === idVeiculo);
  const opcoesVagas = opcoesDeVagas(veiculo);
  // Ao trocar para um carro menor, as vagas escolhidas descem para o máximo dele
  const vagasEfetivas = Math.min(vagas, opcoesVagas.length);

  const aoPublicar = async () => {
    const erros = validarPublicacao({ idVeiculo, origem, destino, partida, custoTotal });
    setErrosCampo(erros);
    setErroGeral(null);
    const custoCentavos = lerReais(custoTotal);
    if (temErros(erros) || !idVeiculo || !origem || !destino || custoCentavos === null) {
      return;
    }
    setPublicando(true);
    try {
      const idCarona = await publicarCarona({
        idVeiculo,
        origem,
        destino,
        partida,
        vagas: vagasEfetivas,
        custoTotalCentavos: custoCentavos,
        toleranciaMin: tolerancia,
        somenteMulheres,
      });
      router.replace({ pathname: '/caronas/[id]', params: { id: idCarona } });
    } catch (falha) {
      const erro = normalizarErro(falha);
      const campo = campoDoErroDePublicacao(erro.code);
      if (campo) {
        setErrosCampo({ [campo]: erro.message });
      } else {
        setErroGeral(erro.message);
      }
      setPublicando(false);
    }
  };

  if (estadoVeiculos.tipo === 'carregando') {
    return <CarregandoTela />;
  }

  if (estadoVeiculos.tipo === 'erro') {
    return (
      <ScrollView contentContainerStyle={estilos.centro}>
        <ErroCarregamento
          mensagem={estadoVeiculos.mensagem}
          aoTentarDeNovo={async () => {
            setEstadoVeiculos({ tipo: 'carregando' });
            setEstadoVeiculos(await consultarVeiculos());
          }}
        />
      </ScrollView>
    );
  }

  // RN04: sem veículo não há carona; a publicar_carona também recusa (SEM_VEICULO)
  if (veiculos.length === 0) {
    return (
      <ScrollView contentContainerStyle={estilos.centro}>
        <EstadoVazio
          icone="car-sport-outline"
          titulo="Cadastre um veículo primeiro"
          mensagem="Para oferecer uma carona, informe o carro que você vai usar."
          acao={{ titulo: 'Cadastrar veículo', onPress: () => router.push('/veiculos/novo') }}
        />
      </ScrollView>
    );
  }

  const opcoesVeiculo: Opcao<string>[] = veiculos.map((item) => ({
    valor: item.id_veiculo,
    rotulo: `${item.modelo} · ${item.placa}`,
  }));

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={estilos.tela}
    >
      <ScrollView contentContainerStyle={estilos.conteudo} keyboardShouldPersistTaps="handled">
        <Cartao titulo="Carro">
          <SeletorOpcoes
            rotulo="Veículo"
            opcoes={opcoesVeiculo}
            valor={idVeiculo ?? ''}
            aoMudar={setIdVeiculo}
            erro={errosCampo.veiculo}
          />
        </Cartao>

        <Cartao titulo="Trajeto">
          <View style={estilos.trajeto}>
            <View style={estilos.ponto}>
              <MarcadorRota tipo="origem" distanciaAteDestino={ESPACO_ENTRE_PONTOS} />
              <View style={estilos.campoPonto}>
                <SeletorLocal
                  rotulo="Origem"
                  rotuloDescricao="Descrição da origem"
                  idInicial={ID_ORIGEM_PADRAO}
                  valor={origem}
                  aoMudar={setOrigem}
                  erro={errosCampo.origem}
                />
              </View>
            </View>
            <View style={estilos.ponto}>
              <MarcadorRota tipo="destino" />
              <View style={estilos.campoPonto}>
                <SeletorLocal
                  rotulo="Destino"
                  rotuloDescricao="Descrição do destino"
                  idInicial={ID_DESTINO_PADRAO}
                  valor={destino}
                  aoMudar={setDestino}
                  erro={errosCampo.destino}
                />
              </View>
            </View>
          </View>
        </Cartao>

        <Cartao titulo="Quando">
          <SeletorDataHora
            rotulo="Partida"
            valor={partida}
            aoMudar={setPartida}
            erro={errosCampo.partida}
          />
        </Cartao>

        <Cartao titulo="Vagas e valor">
          <SeletorOpcoes
            rotulo="Vagas para passageiros"
            ajuda="Sem contar você, que dirige."
            opcoes={opcoesVagas}
            valor={vagasEfetivas}
            aoMudar={setVagas}
            erro={errosCampo.vagas}
          />
          <CampoTexto
            rotulo="Custo total da viagem (R$)"
            icone="cash-outline"
            ajuda={AJUDA_CUSTO}
            value={custoTotal}
            onChangeText={setCustoTotal}
            erro={errosCampo.custo_total}
            keyboardType="decimal-pad"
            placeholder="Ex.: 24,00"
          />
          <SeletorOpcoes
            rotulo="Tolerância de espera"
            opcoes={OPCOES_TOLERANCIA}
            valor={tolerancia}
            aoMudar={setTolerancia}
          />
        </Cartao>

        <OpcaoInterruptor
          icone="female-outline"
          corIcone={tema.cores.secundariaTexto}
          titulo="Somente mulheres"
          ajuda="Só passageiras poderão ver e reservar."
          valor={somenteMulheres}
          aoMudar={setSomenteMulheres}
          accessibilityLabel="Carona somente para mulheres"
        />

        {erroGeral ? <Aviso mensagem={erroGeral} /> : null}
        <Botao titulo="Publicar carona" carregando={publicando} onPress={aoPublicar} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// Espaço entre os blocos de origem e destino; o traço da rota atravessa esse espaço
const ESPACO_ENTRE_PONTOS = tema.espaco.x6;

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: tema.cores.fundo },
  conteudo: { padding: tema.espaco.x5, gap: tema.espaco.x5 },
  centro: { flexGrow: 1, justifyContent: 'center' },
  trajeto: { gap: ESPACO_ENTRE_PONTOS },
  ponto: { flexDirection: 'row', gap: tema.espaco.x3 },
  campoPonto: { flex: 1 },
});
