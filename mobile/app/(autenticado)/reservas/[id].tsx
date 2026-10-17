import * as Clipboard from 'expo-clipboard';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Aviso } from '@/components/Aviso';
import { Botao } from '@/components/Botao';
import { normalizarErro } from '@/services/erros';
import { consultarStatusReserva, type SituacaoReserva } from '@/services/reservas';
import { descartarPix, obterPix } from '@/store/pix';
import { acompanharReserva } from '@/utils/acompanhamento-reserva';
import { formatarReais } from '@/utils/dinheiro';
import { reservaEmAberto, rotuloStatusReserva } from '@/utils/reserva';

export default function TelaPagamentoReserva() {
  const { id } = useLocalSearchParams<{ id: string }>();
  // O Pix só existe na memória do app, logo depois da reserva (store/pix.ts)
  const [reservaCriada] = useState(() => obterPix(id));
  const [situacao, setSituacao] = useState<SituacaoReserva | null>(null);
  const [falhaConsulta, setFalhaConsulta] = useState<string | null>(null);
  const [esgotado, setEsgotado] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const pararAcompanhamento = useRef<(() => void) | null>(null);

  const acompanhar = useCallback(() => {
    pararAcompanhamento.current?.();
    setEsgotado(false);
    pararAcompanhamento.current = acompanharReserva({
      consultar: () => consultarStatusReserva(id),
      aoAtualizar: (nova) => {
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

  const copiarCodigo = async () => {
    if (!reservaCriada) {
      return;
    }
    await Clipboard.setStringAsync(reservaCriada.pix.qrCode);
    setCopiado(true);
  };

  if (!situacao && !falhaConsulta) {
    return (
      <View style={estilos.centro}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  const status = situacao?.statusReserva ?? 'PENDENTE';
  const valorCentavos = situacao?.valorCentavos ?? reservaCriada?.valorCentavos ?? null;
  const pendente = status === 'PENDENTE';

  return (
    <ScrollView style={estilos.tela} contentContainerStyle={estilos.conteudo}>
      {valorCentavos !== null ? (
        <Text style={estilos.valor}>{formatarReais(valorCentavos)}</Text>
      ) : null}
      {situacao ? (
        <Text style={estilos.status} accessibilityLiveRegion="polite">
          {rotuloStatusReserva(status)}
        </Text>
      ) : null}

      {status === 'CONFIRMADA' ? (
        <>
          <Aviso tipo="info" mensagem="Pagamento confirmado! Sua vaga está garantida." />
          <Botao titulo="Minhas reservas" onPress={() => router.navigate('/reservas')} />
        </>
      ) : null}
      {status === 'CANCELADA' ? <Aviso mensagem="Esta reserva foi cancelada." /> : null}
      {status === 'EXPIRADA' ? (
        <Aviso mensagem="Esta reserva expirou porque o pagamento não foi feito a tempo." />
      ) : null}

      {pendente && reservaCriada ? (
        <View style={estilos.pix}>
          <Text style={estilos.instrucao}>
            Pague com o Pix pelo QR code ou pelo código copia e cola. A confirmação aparece aqui
            sozinha.
          </Text>
          <Image
            accessibilityLabel="QR code do Pix"
            source={{ uri: `data:image/png;base64,${reservaCriada.pix.qrCodeBase64}` }}
            style={estilos.qr}
          />
          <Botao
            titulo={copiado ? 'Código copiado' : 'Copiar código Pix'}
            variante="secundario"
            onPress={() => void copiarCodigo()}
          />
        </View>
      ) : null}
      {pendente && !reservaCriada ? (
        <Aviso tipo="info" mensagem="O código Pix desta reserva não está mais disponível." />
      ) : null}
      {pendente && !esgotado ? (
        <View style={estilos.aguardando}>
          <ActivityIndicator />
          <Text style={estilos.ajuda}>Aguardando a confirmação do pagamento…</Text>
        </View>
      ) : null}
      {pendente && esgotado ? (
        <>
          <Aviso tipo="info" mensagem="Ainda não recebemos a confirmação do pagamento." />
          <Botao titulo="Verificar de novo" variante="secundario" onPress={acompanhar} />
        </>
      ) : null}
      {falhaConsulta ? <Aviso mensagem={falhaConsulta} /> : null}
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: '#fff' },
  conteudo: { padding: 24, gap: 16 },
  centro: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#fff' },
  valor: { fontSize: 28, fontWeight: '700', color: '#1f2933', textAlign: 'center' },
  status: { fontSize: 16, fontWeight: '600', color: '#52606d', textAlign: 'center' },
  pix: { gap: 16, alignItems: 'stretch' },
  instrucao: { fontSize: 15, color: '#1f2933' },
  qr: { width: 240, height: 240, alignSelf: 'center' },
  aguardando: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  ajuda: { fontSize: 14, color: '#52606d' },
});
