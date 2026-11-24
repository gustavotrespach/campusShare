import Ionicons from '@expo/vector-icons/Ionicons';
import * as Clipboard from 'expo-clipboard';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Aviso } from '@/components/Aviso';
import { Botao } from '@/components/Botao';
import { Divisoria } from '@/components/Divisoria';
import { SeloStatus } from '@/components/SeloStatus';
import { normalizarErro } from '@/services/erros';
import {
  cancelarReserva,
  consultarStatusReserva,
  listarMinhasReservas,
  type MinhaReserva,
  type SituacaoReserva,
} from '@/services/reservas';
import { descartarPix, obterPix } from '@/store/pix';
import { tema } from '@/tema';
import { acompanharReserva } from '@/utils/acompanhamento-reserva';
import {
  confirmacaoCancelarReserva,
  mensagemReservaCancelada,
  podeCancelarReserva,
} from '@/utils/cancelamento';
import { formatarReais } from '@/utils/dinheiro';
import { situacaoExibidaCarona } from '@/utils/listas';
import { confirmouAgora, reservaEmAberto, type StatusReserva } from '@/utils/reserva';

const { cores } = tema;

// Quanto tempo o botão mostra "Código copiado" antes de voltar ao normal
const DURACAO_COPIADO_MS = 2_000;
const MENSAGEM_CONFIRMADO = 'Pagamento confirmado! Sua vaga está garantida.';

export default function TelaPagamentoReserva() {
  const { id } = useLocalSearchParams<{ id: string }>();
  // O Pix só existe na memória do app, logo depois da reserva (store/pix.ts)
  const [reservaCriada] = useState(() => obterPix(id));
  const [situacao, setSituacao] = useState<SituacaoReserva | null>(null);
  const [falhaConsulta, setFalhaConsulta] = useState<string | null>(null);
  const [esgotado, setEsgotado] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const pararAcompanhamento = useRef<(() => void) | null>(null);
  const statusAnterior = useRef<StatusReserva | null>(null);
  const temporizadorCopiado = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Partida e status da carona (minhas_reservas): o passageiro não lê a tabela carona
  const [reservaDaLista, setReservaDaLista] = useState<MinhaReserva | null>(null);
  const [cancelando, setCancelando] = useState(false);
  const [erroCancelamento, setErroCancelamento] = useState<string | null>(null);
  // Cancelada nesta tela: a frase do resultado (o status passa a CANCELADA sem esperar o polling)
  const [cancelamentoFeito, setCancelamentoFeito] = useState<string | null>(null);

  const acompanhar = useCallback(() => {
    pararAcompanhamento.current?.();
    setEsgotado(false);
    pararAcompanhamento.current = acompanharReserva({
      consultar: () => consultarStatusReserva(id),
      aoAtualizar: (nova) => {
        // O leitor de tela anuncia a confirmação vista acontecer nesta tela
        if (confirmouAgora(statusAnterior.current, nova.statusReserva)) {
          AccessibilityInfo.announceForAccessibility(MENSAGEM_CONFIRMADO);
        }
        statusAnterior.current = nova.statusReserva;
        setSituacao(nova);
        setFalhaConsulta(null);
        if (!reservaEmAberto(nova.statusReserva)) {
          descartarPix(id);
        }
      },
      aoFalhar: (erro) => setFalhaConsulta(normalizarErro(erro).message),
      aoEsgotar: () => setEsgotado(true),
    });
  }, [id]);

  // Polling só com a tela em foco: sair da tela para (cleanup do useFocusEffect)
  useFocusEffect(
    useCallback(() => {
      acompanhar();
      return () => {
        pararAcompanhamento.current?.();
        pararAcompanhamento.current = null;
      };
    }, [acompanhar]),
  );

  useEffect(() => {
    let ativo = true;
    const carregar = async () => {
      try {
        const reservas = await listarMinhasReservas();
        if (ativo) {
          setReservaDaLista(reservas.find((reserva) => reserva.id_reserva === id) ?? null);
        }
      } catch {
        // Sem a partida, o botão de cancelar não aparece; o resto da tela segue igual
      }
    };
    void carregar();
    return () => {
      ativo = false;
    };
  }, [id]);

  useEffect(
    () => () => {
      if (temporizadorCopiado.current !== null) {
        clearTimeout(temporizadorCopiado.current);
      }
    },
    [],
  );

  const copiarCodigo = async () => {
    if (!reservaCriada) {
      return;
    }
    await Clipboard.setStringAsync(reservaCriada.pix.qrCode);
    setCopiado(true);
    if (temporizadorCopiado.current !== null) {
      clearTimeout(temporizadorCopiado.current);
    }
    temporizadorCopiado.current = setTimeout(() => setCopiado(false), DURACAO_COPIADO_MS);
  };

  if (!situacao && !falhaConsulta) {
    return (
      <View style={estilos.centro}>
        <ActivityIndicator size="large" color={cores.primaria} />
      </View>
    );
  }

  const status: StatusReserva = cancelamentoFeito
    ? 'CANCELADA'
    : (situacao?.statusReserva ?? 'PENDENTE');
  const valorCentavos = situacao?.valorCentavos ?? reservaCriada?.valorCentavos ?? null;
  const valor = valorCentavos !== null ? formatarReais(valorCentavos) : null;

  // A carona continua ABERTA no banco depois da partida: aqui ela aparece como "Já partiu" (T41)
  const caronaJaPartiu =
    reservaDaLista !== null &&
    situacaoExibidaCarona({
      status: reservaDaLista.status_carona,
      data_hora_partida: reservaDaLista.data_hora_partida,
    }) === 'JA_PARTIU';

  const exibirCancelar =
    !cancelamentoFeito &&
    reservaDaLista !== null &&
    podeCancelarReserva({
      statusReserva: status,
      statusCarona: reservaDaLista.status_carona,
      partida: reservaDaLista.data_hora_partida,
    });

  const cancelar = async () => {
    const anterior = status;
    setCancelando(true);
    setErroCancelamento(null);
    try {
      await cancelarReserva(id);
      // Reserva encerrada: o polling para e o Pix em memória não serve mais
      pararAcompanhamento.current?.();
      pararAcompanhamento.current = null;
      descartarPix(id);
      const mensagem = mensagemReservaCancelada(anterior);
      setCancelamentoFeito(mensagem);
      AccessibilityInfo.announceForAccessibility(mensagem);
    } catch (falha) {
      // A frase vem do backend (ex.: prazo de 2 h da reserva paga, RN20)
      const mensagem = normalizarErro(falha).message;
      setErroCancelamento(mensagem);
      AccessibilityInfo.announceForAccessibility(mensagem);
    } finally {
      setCancelando(false);
    }
  };

  const confirmarCancelamento = () => {
    Alert.alert('Cancelar reserva', confirmacaoCancelarReserva(status), [
      { text: 'Voltar', style: 'cancel' },
      { text: 'Cancelar reserva', style: 'destructive', onPress: () => void cancelar() },
    ]);
  };

  // Separado do resto por uma divisória; o erro fica logo acima do botão
  const acaoCancelar = exibirCancelar ? (
    <View style={estilos.cancelamento}>
      <Divisoria />
      {erroCancelamento ? <Aviso mensagem={erroCancelamento} /> : null}
      <Botao
        titulo="Cancelar reserva"
        icone="close-circle-outline"
        variante="perigo"
        carregando={cancelando}
        onPress={confirmarCancelamento}
      />
    </View>
  ) : null;

  if (status === 'CONFIRMADA') {
    return (
      <ScrollView style={estilos.tela} contentContainerStyle={estilos.confirmada}>
        <View style={estilos.halo}>
          <View style={estilos.circuloSucesso}>
            <Ionicons name="checkmark" size={44} color={cores.textoSobrePrimaria} />
          </View>
        </View>
        <Text style={estilos.titulo} accessibilityRole="header" maxFontSizeMultiplier={1.4}>
          Pagamento confirmado!
        </Text>
        <Text style={estilos.textoSecundario}>Sua vaga está garantida.</Text>
        <View style={estilos.linhaSelo}>
          <SeloStatus tipo="CONFIRMADA" />
          {caronaJaPartiu ? <SeloStatus tipo="JA_PARTIU" /> : null}
          {valor ? <Text style={estilos.corpoForte}>{valor}</Text> : null}
        </View>
        <View style={estilos.acoesConfirmada}>
          <Botao
            titulo="Minhas reservas"
            icone="receipt-outline"
            onPress={() => router.navigate('/reservas')}
          />
          <Botao titulo="Voltar ao início" variante="texto" onPress={() => router.navigate('/')} />
        </View>
        {acaoCancelar}
      </ScrollView>
    );
  }

  const pendente = status === 'PENDENTE';

  return (
    <ScrollView style={estilos.tela} contentContainerStyle={estilos.conteudo}>
      <View style={estilos.topo}>
        <View style={estilos.selos}>
          <SeloStatus tipo={status} />
          {caronaJaPartiu ? <SeloStatus tipo="JA_PARTIU" /> : null}
        </View>
        {valor ? (
          <Text style={estilos.valor} maxFontSizeMultiplier={1.4}>
            {valor}
          </Text>
        ) : null}
        <Text style={estilos.legenda}>Valor da sua vaga</Text>
      </View>

      {status === 'CANCELADA' || status === 'EXPIRADA' ? (
        <>
          {cancelamentoFeito ? (
            <Aviso tipo="sucesso" mensagem={cancelamentoFeito} />
          ) : (
            <Aviso
              mensagem={
                status === 'EXPIRADA'
                  ? 'Esta reserva expirou porque o pagamento não foi feito a tempo.'
                  : 'Esta reserva foi cancelada.'
              }
            />
          )}
          <Botao
            titulo="Buscar outra carona"
            variante="secundario"
            onPress={() => router.navigate('/')}
          />
        </>
      ) : null}

      {pendente && reservaCriada ? (
        <View style={estilos.cartao}>
          <Text style={estilos.corpo}>
            Pague com o Pix pelo QR code ou pelo código copia e cola. A confirmação aparece aqui
            sozinha.
          </Text>
          <View style={estilos.moldura}>
            <Image
              accessibilityLabel="QR code do Pix"
              source={{ uri: `data:image/png;base64,${reservaCriada.pix.qrCodeBase64}` }}
              style={estilos.qr}
            />
          </View>
          <Botao
            titulo={copiado ? 'Código copiado' : 'Copiar código Pix'}
            icone={copiado ? 'checkmark' : 'copy-outline'}
            variante="secundario"
            onPress={() => void copiarCodigo()}
          />
        </View>
      ) : null}
      {pendente && !reservaCriada ? (
        <Aviso tipo="info" mensagem="O código Pix desta reserva não está mais disponível." />
      ) : null}
      {pendente && !esgotado ? (
        <View style={estilos.aguardando} accessibilityLiveRegion="polite">
          <ActivityIndicator color={cores.primaria} />
          <Text style={estilos.apoio}>Aguardando a confirmação do pagamento…</Text>
        </View>
      ) : null}
      {pendente && esgotado ? (
        <Aviso
          tipo="info"
          mensagem="Ainda não recebemos a confirmação do pagamento."
          acao={{ titulo: 'Verificar de novo', onPress: acompanhar }}
        />
      ) : null}
      {falhaConsulta ? <Aviso mensagem={falhaConsulta} /> : null}
      {pendente ? (
        <View style={estilos.rodape}>
          <Ionicons name="shield-checkmark-outline" size={16} color={cores.textoSecundario} />
          <Text style={estilos.legenda}>Pagamento processado pelo Mercado Pago.</Text>
        </View>
      ) : null}
      {acaoCancelar}
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.fundo },
  conteudo: { padding: tema.espaco.x5, gap: tema.espaco.x4 },
  centro: {
    flex: 1,
    justifyContent: 'center',
    padding: tema.espaco.x5,
    backgroundColor: cores.fundo,
  },
  topo: { alignItems: 'center', gap: 6 },
  selos: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: tema.espaco.x2 },
  valor: { ...tema.tipografia.display, ...tema.numerico, color: cores.texto },
  legenda: { ...tema.tipografia.legenda, color: cores.textoSecundario },
  corpo: { ...tema.tipografia.corpo, color: cores.texto },
  corpoForte: { ...tema.tipografia.corpoForte, ...tema.numerico, color: cores.texto },
  apoio: { ...tema.tipografia.apoio, color: cores.textoSecundario, flexShrink: 1 },
  cartao: {
    backgroundColor: cores.superficie,
    borderRadius: tema.raio.grande,
    borderWidth: 1,
    borderColor: cores.borda,
    padding: tema.espaco.x5,
    gap: tema.espaco.x4,
    ...tema.sombra.cartao,
  },
  moldura: {
    alignSelf: 'center',
    padding: tema.espaco.x3,
    borderWidth: 1,
    borderColor: cores.borda,
    borderRadius: tema.raio.medio,
    backgroundColor: cores.superficie,
  },
  qr: { width: 208, height: 208 },
  aguardando: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: tema.espaco.x2,
  },
  rodape: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: tema.espaco.x1,
  },
  confirmada: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: tema.espaco.x5,
  },
  halo: {
    width: 96,
    height: 96,
    borderRadius: tema.raio.pilula,
    backgroundColor: cores.sucessoClaro,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circuloSucesso: {
    width: 72,
    height: 72,
    borderRadius: tema.raio.pilula,
    backgroundColor: cores.sucesso,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titulo: {
    ...tema.tipografia.titulo,
    color: cores.texto,
    textAlign: 'center',
    marginTop: tema.espaco.x6,
  },
  textoSecundario: {
    ...tema.tipografia.corpo,
    color: cores.textoSecundario,
    textAlign: 'center',
    marginTop: tema.espaco.x2,
  },
  linhaSelo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tema.espaco.x3,
    marginTop: tema.espaco.x4,
  },
  acoesConfirmada: { alignSelf: 'stretch', gap: tema.espaco.x3, marginTop: tema.espaco.x8 },
  // Esticado também na tela de confirmada, que centraliza o conteúdo
  cancelamento: { alignSelf: 'stretch', gap: tema.espaco.x4, marginTop: tema.espaco.x4 },
});
