import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Aviso } from '@/components/Aviso';
import { Botao } from '@/components/Botao';
import { CampoTexto } from '@/components/CampoTexto';
import { confirmarPorLink, MENSAGEM_LINK_INVALIDO, reenviarConfirmacao } from '@/services/auth';
import { normalizarErro } from '@/services/erros';
import { useSessao } from '@/store/sessao';
import { validarEmail } from '@/utils/validacao';

// Rota aberta pelo link do e-mail (fora dos grupos protegidos: vale logado ou não).
export default function TelaConfirmacao() {
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
    return (
      <View style={estilos.centro}>
        <ActivityIndicator size="large" />
        <Text style={estilos.texto}>Confirmando seu e-mail…</Text>
      </View>
    );
  }

  return (
    <View style={estilos.container}>
      <Text style={estilos.titulo}>Não foi possível confirmar</Text>
      <Aviso mensagem={erro} />
      <CampoTexto
        rotulo="Seu e-mail institucional"
        value={email}
        onChangeText={setEmail}
        erro={erroEmail}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
      />
      {reenvio ? <Aviso mensagem={reenvio} tipo="info" /> : null}
      <Botao titulo="Reenviar link" carregando={enviando} onPress={aoReenviar} />
      <Botao
        titulo={sessao ? 'Ir para o início' : 'Voltar ao login'}
        variante="secundario"
        onPress={() => router.replace(sessao ? '/' : '/entrar')}
      />
    </View>
  );
}

const estilos = StyleSheet.create({
  centro: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: '#fff',
  },
  container: { flex: 1, backgroundColor: '#fff', padding: 24, gap: 16, justifyContent: 'center' },
  titulo: { fontSize: 24, fontWeight: 'bold', color: '#1f2933' },
  texto: { fontSize: 16, color: '#3e4c59' },
});
