import Ionicons from '@expo/vector-icons/Ionicons';
import * as Clipboard from 'expo-clipboard';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Aviso } from '@/components/Aviso';
import { Botao } from '@/components/Botao';
import { SeloStatus } from '@/components/SeloStatus';
import { normalizarErro } from '@/services/erros';
import { consultarStatusReserva, type SituacaoReserva } from '@/services/reservas';
import { descartarPix, obterPix } from '@/store/pix';
import { tema } from '@/tema';
import { acompanharReserva } from '@/utils/acompanhamento-reserva';
import { formatarReais } from '@/utils/dinheiro';
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

  const status = situacao?.statusReserva ?? 'PENDENTE';
  const valorCentavos = situacao?.valorCentavos ?? reservaCriada?.valorCentavos ?? null;
  const valor = valorCentavos !== null ? formatarReais(valorCentavos) : null;

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
      </ScrollView>
    );
  }

  const pendente = status === 'PENDENTE';

  return (
    <ScrollView style={estilos.tela} contentContainerStyle={estilos.conteudo}>
      <View style={estilos.topo}>
        <SeloStatus tipo={status} />
        {valor ? (
          <Text style={estilos.valor} maxFontSizeMultiplier={1.4}>
            {valor}
          </Text>
        ) : null}
        <Text style={estilos.legenda}>Valor da sua vaga</Text>
      </View>

      {status === 'CANCELADA' || status === 'EXPIRADA' ? (
        <>
          <Aviso
            mensagem={
              status === 'EXPIRADA'
                ? 'Esta reserva expirou porque o pagamento não foi feito a tempo.'
                : 'Esta reserva foi cancelada.'
            }
          />
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
});
