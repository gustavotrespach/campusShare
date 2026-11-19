import Ionicons from '@expo/vector-icons/Ionicons';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Aviso } from '@/components/Aviso';
import { Botao } from '@/components/Botao';
import { CampoTexto } from '@/components/CampoTexto';
import { CarregandoTela } from '@/components/CarregandoTela';
import { confirmarPorLink, MENSAGEM_LINK_INVALIDO, reenviarConfirmacao } from '@/services/auth';
import { normalizarErro } from '@/services/erros';
import { useSessao } from '@/store/sessao';
import { tema } from '@/tema';
import { validarEmail } from '@/utils/validacao';

// Rota aberta pelo link do e-mail (fora dos grupos protegidos: vale logado ou não).
export default function TelaConfirmacao() {
  const insets = useSafeAreaInsets();
  // A URL completa traz o fragmento (#access_token=...), que os parâmetros de rota não incluem.
  const url = Linking.useLinkingURL();
  const { sessao } = useSessao();
  const processada = useRef<string | null>(null);
  const [erroDoLink, setErroDoLink] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [erroEmail, setErroEmail] = useState<string | undefined>();
  const [reenvio, setReenvio] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (!url || processada.current === url) {
      return;
    }
    processada.current = url;
    const confirmar = async () => {
      try {
        await confirmarPorLink(url);
        router.replace('/');
      } catch (falha) {
        setErroDoLink(normalizarErro(falha).message);
      }
    };
    void confirmar();
  }, [url]);

  const aoReenviar = async () => {
    const mensagem = validarEmail(email);
    setErroEmail(mensagem);
    if (mensagem) {
      return;
    }
    setEnviando(true);
    try {
      await reenviarConfirmacao(email);
      setReenvio('Enviamos um novo link. Confira sua caixa de entrada.');
    } catch (falha) {
      setReenvio(normalizarErro(falha).message);
    } finally {
      setEnviando(false);
    }
  };

  // Sem URL (rota aberta sem link) não há o que confirmar: mostra o erro em vez de esperar para sempre.
  // O valor inicial do useLinkingURL é síncrono, então null aqui não é "ainda carregando".
  const erro = url === null ? MENSAGEM_LINK_INVALIDO : erroDoLink;

  if (!erro) {
    return <CarregandoTela mensagem="Confirmando seu e-mail…" />;
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={estilos.tela}
    >
      <ScrollView
        contentContainerStyle={[
          estilos.conteudo,
          {
            paddingTop: insets.top + tema.espaco.x6,
            paddingBottom: insets.bottom + tema.espaco.x6,
          },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={estilos.topo}>
          <Ionicons name="alert-circle" size={48} color={tema.cores.erro} />
          <Text accessibilityRole="header" maxFontSizeMultiplier={1.4} style={estilos.titulo}>
            Não foi possível confirmar
          </Text>
        </View>
        <Aviso mensagem={erro} />
        <CampoTexto
          rotulo="Seu e-mail institucional"
          icone="mail-outline"
          placeholder="nome@rede.ulbra.br"
          value={email}
          onChangeText={setEmail}
          erro={erroEmail}
          autoCapitalize="none"
          autoComplete="email"
          autoCorrect={false}
          keyboardType="email-address"
        />
        {reenvio ? <Aviso mensagem={reenvio} tipo="info" /> : null}
        <Botao titulo="Reenviar link" carregando={enviando} onPress={aoReenviar} />
        <Botao
          titulo={sessao ? 'Ir para o início' : 'Voltar ao login'}
          variante="texto"
          onPress={() => router.replace(sessao ? '/' : '/entrar')}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: tema.cores.fundo },
  conteudo: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: tema.espaco.x5,
    gap: tema.espaco.x4,
  },
  topo: { alignItems: 'center', gap: tema.espaco.x3 },
  titulo: { ...tema.tipografia.titulo, color: tema.cores.texto, textAlign: 'center' },
});
