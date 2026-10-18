import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Aviso } from '@/components/Aviso';
import { Botao } from '@/components/Botao';
import { CampoTexto } from '@/components/CampoTexto';
import { entrar } from '@/services/auth';
import { normalizarErro } from '@/services/erros';
import { tema } from '@/tema';
import { temErros, validarLogin, type ErrosDeCampo } from '@/utils/validacao';

const { cores } = tema;

// O ícone do app só aparece no build (T31); no Expo Go, a marca da demo é esta assinatura
const ICONE = require('../../assets/icon.png') as number;

export default function TelaEntrar() {
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [errosCampo, setErrosCampo] = useState<ErrosDeCampo<'email' | 'senha'>>({});
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  // Conta ainda não confirmada: oferece o reenvio do link
  const [naoConfirmado, setNaoConfirmado] = useState(false);

  // Sucesso não navega daqui: a sessão muda e o layout raiz troca para a Home.
  const aoEntrar = async () => {
    const erros = validarLogin({ email, senha });
    setErrosCampo(erros);
    setErroGeral(null);
    setNaoConfirmado(false);
    if (temErros(erros)) {
      return;
    }
    setEnviando(true);
    try {
      await entrar(email, senha);
    } catch (falha) {
      const erro = normalizarErro(falha);
      setErroGeral(erro.message);
      setNaoConfirmado(erro.code === 'email_not_confirmed');
      setEnviando(false);
    }
  };

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
        <View style={estilos.assinatura}>
          <Image source={ICONE} style={estilos.icone} accessibilityIgnoresInvertColors />
          <Text style={estilos.marca} accessibilityRole="header" maxFontSizeMultiplier={1.4}>
            Campus<Text style={estilos.marcaDestaque}>Share</Text>
          </Text>
          <Text style={estilos.subtitulo}>Caronas entre estudantes da sua instituição</Text>
        </View>

        {erroGeral ? <Aviso mensagem={erroGeral} /> : null}

        <CampoTexto
          rotulo="E-mail institucional"
          icone="mail-outline"
          placeholder="nome@rede.ulbra.br"
          value={email}
          onChangeText={setEmail}
          erro={errosCampo.email}
          autoCapitalize="none"
          autoComplete="email"
          autoCorrect={false}
          keyboardType="email-address"
          textContentType="username"
          returnKeyType="next"
        />
        <CampoTexto
          rotulo="Senha"
          icone="lock-closed-outline"
          senha
          value={senha}
          onChangeText={setSenha}
          erro={errosCampo.senha}
          autoCapitalize="none"
          autoComplete="current-password"
          textContentType="password"
          returnKeyType="go"
          onSubmitEditing={aoEntrar}
        />

        <Botao titulo="Entrar" carregando={enviando} onPress={aoEntrar} />
        {naoConfirmado ? (
          <Botao
            titulo="Reenviar link de confirmação"
            variante="texto"
            onPress={() =>
              router.push({
                pathname: '/confira-email',
                params: { email: email.trim().toLowerCase() },
              })
            }
          />
        ) : null}

        <View style={estilos.separador}>
          <View style={estilos.linha} />
          <Text style={estilos.legenda}>Ainda não tem conta?</Text>
          <View style={estilos.linha} />
        </View>
        <Botao
          titulo="Criar conta"
          variante="secundario"
          onPress={() => router.push('/cadastro')}
        />

        <View style={estilos.confianca}>
          <Ionicons name="shield-checkmark-outline" size={16} color={cores.textoSecundario} />
          <Text style={estilos.legenda}>Só entra quem confirma o e-mail @rede.ulbra.br.</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.fundo },
  conteudo: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: tema.espaco.x5,
    gap: tema.espaco.x4,
  },
  assinatura: { alignItems: 'center', marginBottom: tema.espaco.x4 },
  icone: { width: 72, height: 72, borderRadius: tema.raio.grande },
  marca: {
    ...tema.tipografia.titulo,
    color: cores.texto,
    marginTop: tema.espaco.x4,
  },
  marcaDestaque: { color: cores.primaria },
  subtitulo: {
    ...tema.tipografia.corpo,
    color: cores.textoSecundario,
    textAlign: 'center',
    marginTop: tema.espaco.x1,
  },
  separador: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tema.espaco.x3,
    marginTop: tema.espaco.x2,
  },
  linha: { flex: 1, height: 1, backgroundColor: cores.borda },
  legenda: { ...tema.tipografia.legenda, color: cores.textoSecundario },
  confianca: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: tema.espaco.x1,
    marginTop: tema.espaco.x2,
  },
});
