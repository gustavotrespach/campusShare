import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Aviso } from '@/components/Aviso';
import { Botao } from '@/components/Botao';
import { CampoTexto } from '@/components/CampoTexto';
import { SeletorGenero } from '@/components/SeletorGenero';
import { cadastrar } from '@/services/auth';
import { normalizarErro } from '@/services/erros';
import { tema } from '@/tema';
import { campoDoErroDeCadastro } from '@/utils/erros-cadastro';
import type { Genero } from '@/utils/genero';
import {
  TAMANHO_MINIMO_SENHA,
  temErros,
  validarCadastro,
  type CamposCadastro,
  type ErrosDeCampo,
} from '@/utils/validacao';

export default function TelaCadastro() {
  const insets = useSafeAreaInsets();
  const [nomeCompleto, setNomeCompleto] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [genero, setGenero] = useState<Genero | null>(null);
  const [telefone, setTelefone] = useState('');
  const [errosCampo, setErrosCampo] = useState<ErrosDeCampo<CamposCadastro>>({});
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const aoCadastrar = async () => {
    const erros = validarCadastro({ nomeCompleto, email, senha, genero, telefone });
    setErrosCampo(erros);
    setErroGeral(null);
    if (temErros(erros) || genero === null) {
      return;
    }
    setEnviando(true);
    try {
      await cadastrar({ nomeCompleto, email, senha, genero, telefone });
      router.replace({ pathname: '/confira-email', params: { email: email.trim().toLowerCase() } });
    } catch (falha) {
      const erro = normalizarErro(falha);
      const campo = campoDoErroDeCadastro(erro.code);
      if (campo) {
        setErrosCampo({ [campo]: erro.message });
      } else {
        setErroGeral(erro.message);
      }
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
        <View style={estilos.cabecalho}>
          <Text accessibilityRole="header" maxFontSizeMultiplier={1.4} style={estilos.titulo}>
            Criar conta
          </Text>
          <Text style={estilos.subtitulo}>Use o e-mail da sua instituição de ensino.</Text>
        </View>

        {erroGeral ? <Aviso mensagem={erroGeral} /> : null}

        <CampoTexto
          rotulo="Nome completo"
          icone="person-outline"
          value={nomeCompleto}
          onChangeText={setNomeCompleto}
          erro={errosCampo.nomeCompleto}
          autoCapitalize="words"
          autoComplete="name"
          textContentType="name"
        />
        <CampoTexto
          rotulo="E-mail institucional"
          icone="mail-outline"
          ajuda="Só e-mails @rede.ulbra.br podem criar conta."
          placeholder="nome@rede.ulbra.br"
          value={email}
          onChangeText={setEmail}
          erro={errosCampo.email}
          autoCapitalize="none"
          autoComplete="email"
          autoCorrect={false}
          keyboardType="email-address"
          textContentType="username"
        />
        <CampoTexto
          rotulo={`Senha (mínimo ${TAMANHO_MINIMO_SENHA} caracteres)`}
          icone="lock-closed-outline"
          senha
          value={senha}
          onChangeText={setSenha}
          erro={errosCampo.senha}
          autoCapitalize="none"
          autoComplete="new-password"
          textContentType="newPassword"
        />
        <CampoTexto
          rotulo="Telefone (opcional)"
          icone="call-outline"
          value={telefone}
          onChangeText={setTelefone}
          erro={errosCampo.telefone}
          autoComplete="tel"
          keyboardType="phone-pad"
          textContentType="telephoneNumber"
          placeholder="(51) 99999-9999"
        />
        <SeletorGenero valor={genero} aoMudar={setGenero} erro={errosCampo.genero} />

        <Botao titulo="Criar conta" carregando={enviando} onPress={aoCadastrar} />
        <Botao titulo="Já tenho conta" variante="texto" onPress={() => router.back()} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: tema.cores.fundo },
  conteudo: { flexGrow: 1, paddingHorizontal: tema.espaco.x5, gap: tema.espaco.x4 },
  cabecalho: { gap: tema.espaco.x1 },
  titulo: { ...tema.tipografia.titulo, color: tema.cores.texto },
  subtitulo: { ...tema.tipografia.corpo, color: tema.cores.textoSecundario },
});
