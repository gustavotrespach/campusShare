import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  AccessibilityInfo,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Aviso } from '@/components/Aviso';
import { Botao } from '@/components/Botao';
import { CampoTexto } from '@/components/CampoTexto';
import { CarregandoTela } from '@/components/CarregandoTela';
import { ErroCarregamento } from '@/components/ErroCarregamento';
import { EstadoVazio } from '@/components/EstadoVazio';
import { SeletorNota } from '@/components/SeletorNota';
import {
  avaliarParticipante,
  listarAvaliacoesPendentes,
  type AvaliacaoPendente,
} from '@/services/avaliacoes';
import { normalizarErro } from '@/services/erros';
import { AVISO_AVALIACOES, deixarAviso } from '@/store/avisos';
import { tema } from '@/tema';
import { descreverAvaliado, TAMANHO_MAXIMO_COMENTARIO } from '@/utils/avaliacoes';
import { formatarDataHoraCurta } from '@/utils/data-hora';
import { nomeCurtoLocal } from '@/utils/listas';

type Carregamento =
  | { tipo: 'carregando' }
  | { tipo: 'erro'; mensagem: string }
  | { tipo: 'pronto'; pendente: AvaliacaoPendente | null };

const MENSAGEM_ENVIADA = 'Avaliação enviada.';

export default function TelaAvaliar() {
  const { idReserva } = useLocalSearchParams<{ idReserva: string }>();
  const [carregamento, setCarregamento] = useState<Carregamento>({ tipo: 'carregando' });
  const [tentativa, setTentativa] = useState(0);
  const [nota, setNota] = useState<number | null>(null);
  const [comentario, setComentario] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Nome, papel e carona vêm das pendências: se a reserva não está lá, não dá mais para avaliar
  useEffect(() => {
    let ativo = true;
    const carregar = async () => {
      try {
        const pendentes = await listarAvaliacoesPendentes();
        if (ativo) {
          setCarregamento({
            tipo: 'pronto',
            pendente: pendentes.find((item) => item.id_reserva === idReserva) ?? null,
          });
        }
      } catch (falha) {
        if (ativo) {
          setCarregamento({ tipo: 'erro', mensagem: normalizarErro(falha).message });
        }
      }
    };
    void carregar();
    return () => {
      ativo = false;
    };
  }, [idReserva, tentativa]);

  if (carregamento.tipo === 'carregando') {
    return <CarregandoTela />;
  }

  if (carregamento.tipo === 'erro') {
    return (
      <ScrollView contentContainerStyle={estilos.centro}>
        <ErroCarregamento
          mensagem={carregamento.mensagem}
          aoTentarDeNovo={() => {
            setCarregamento({ tipo: 'carregando' });
            setTentativa((anterior) => anterior + 1);
          }}
          aoVoltar={() => router.back()}
        />
      </ScrollView>
    );
  }

  const { pendente } = carregamento;
  if (!pendente) {
    return (
      <ScrollView contentContainerStyle={estilos.centro}>
        <EstadoVazio
          icone="star-outline"
          titulo="Avaliação indisponível"
          mensagem="Esta avaliação já foi feita ou o prazo para avaliar terminou."
          acao={{ titulo: 'Voltar', onPress: () => router.back() }}
        />
      </ScrollView>
    );
  }

  const enviar = async () => {
    if (nota === null) {
      return;
    }
    setEnviando(true);
    setErro(null);
    try {
      await avaliarParticipante(pendente.id_reserva, nota, comentario);
      AccessibilityInfo.announceForAccessibility(MENSAGEM_ENVIADA);
      deixarAviso(AVISO_AVALIACOES, MENSAGEM_ENVIADA);
      router.back();
    } catch (falha) {
      // A frase vem do backend (prazo de 7 dias, duplicada, carona não concluída...)
      const mensagem = normalizarErro(falha).message;
      setErro(mensagem);
      AccessibilityInfo.announceForAccessibility(mensagem);
      setEnviando(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={estilos.tela}
    >
      <ScrollView contentContainerStyle={estilos.conteudo} keyboardShouldPersistTaps="handled">
        <View style={estilos.topo}>
          <Text accessibilityRole="header" style={estilos.titulo}>
            Avaliar {pendente.nome_avaliado}
          </Text>
          <Text style={estilos.apoio}>
            {descreverAvaliado(pendente.papel)} na carona para {nomeCurtoLocal(pendente.destino)},{' '}
            {formatarDataHoraCurta(pendente.data_hora_partida)}
          </Text>
        </View>

        <SeletorNota valor={nota} aoMudar={setNota} />

        <CampoTexto
          rotulo="Comentário (opcional)"
          ajuda={`${comentario.length}/${TAMANHO_MAXIMO_COMENTARIO}`}
          value={comentario}
          onChangeText={setComentario}
          maxLength={TAMANHO_MAXIMO_COMENTARIO}
          multiline
          placeholder="Como foi a viagem?"
          style={estilos.comentario}
        />

        {erro ? <Aviso mensagem={erro} /> : null}
        <Botao
          titulo="Enviar avaliação"
          desabilitado={nota === null}
          carregando={enviando}
          onPress={() => void enviar()}
        />
        <Text style={estilos.legenda}>
          Avalie até {formatarDataHoraCurta(pendente.avaliar_ate)}. Cada carona é avaliada uma vez.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: tema.cores.fundo },
  centro: { flexGrow: 1, justifyContent: 'center' },
  conteudo: { padding: tema.espaco.x5, gap: tema.espaco.x5 },
  topo: { gap: tema.espaco.x1 },
  titulo: { ...tema.tipografia.titulo, color: tema.cores.texto },
  apoio: { ...tema.tipografia.apoio, color: tema.cores.textoSecundario },
  // Várias linhas: o texto começa no topo da caixa
  comentario: { minHeight: tema.espaco.x12 * 2, textAlignVertical: 'top' },
  legenda: { ...tema.tipografia.legenda, color: tema.cores.textoSecundario, textAlign: 'center' },
});
