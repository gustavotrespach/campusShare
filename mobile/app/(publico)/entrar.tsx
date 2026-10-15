import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Aviso } from '@/components/Aviso';
import { Botao } from '@/components/Botao';
import { CampoTexto } from '@/components/CampoTexto';
import { entrar } from '@/services/auth';
import { normalizarErro } from '@/services/erros';
import { temErros, validarLogin, type ErrosDeCampo } from '@/utils/validacao';

export default function TelaEntrar() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [errosCampo, setErrosCampo] = useState<ErrosDeCampo<'email' | 'senha'>>({});
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  // Sucesso não navega daqui: a sessão muda e o layout raiz troca para a Home.
  const aoEntrar = async () => {
    const erros = validarLogin({ email, senha });
    setErrosCampo(erros);
    setErroGeral(null);
    if (temErros(erros)) {
      return;
    }
    setEnviando(true);
    try {
      await entrar(email, senha);
    } catch (falha) {
      setErroGeral(normalizarErro(falha).message);
      setEnviando(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={estilos.tela}
    >
      <ScrollView contentContainerStyle={estilos.conteudo} keyboardShouldPersistTaps="handled">
        <View style={estilos.cabecalho}>
          <Text style={estilos.titulo}>CampusShare</Text>
          <Text style={estilos.subtitulo}>Caronas entre estudantes da sua instituição</Text>
        </View>

        {erroGeral ? <Aviso mensagem={erroGeral} /> : null}

        <CampoTexto
          rotulo="E-mail institucional"
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
          value={senha}
          onChangeText={setSenha}
          erro={errosCampo.senha}
          autoCapitalize="none"
          autoComplete="current-password"
          secureTextEntry
          textContentType="password"
          returnKeyType="go"
          onSubmitEditing={aoEntrar}
        />

        <Botao titulo="Entrar" carregando={enviando} onPress={aoEntrar} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: '#fff' },
  conteudo: { flexGrow: 1, justifyContent: 'center', padding: 24, gap: 16 },
  cabecalho: { alignItems: 'center', gap: 4, marginBottom: 8 },
  titulo: { fontSize: 28, fontWeight: 'bold', color: '#1f2933' },
  subtitulo: { fontSize: 15, color: '#52606d', textAlign: 'center' },
});
