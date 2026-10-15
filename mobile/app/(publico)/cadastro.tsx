import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text } from 'react-native';

import { Aviso } from '@/components/Aviso';
import { Botao } from '@/components/Botao';
import { CampoTexto } from '@/components/CampoTexto';
import { SeletorGenero } from '@/components/SeletorGenero';
import { cadastrar } from '@/services/auth';
import { normalizarErro } from '@/services/erros';
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
      <ScrollView contentContainerStyle={estilos.conteudo} keyboardShouldPersistTaps="handled">
        <Text style={estilos.titulo}>Criar conta</Text>
        <Text style={estilos.subtitulo}>Use o e-mail da sua instituição de ensino.</Text>

        {erroGeral ? <Aviso mensagem={erroGeral} /> : null}

        <CampoTexto
          rotulo="Nome completo"
          value={nomeCompleto}
          onChangeText={setNomeCompleto}
          erro={errosCampo.nomeCompleto}
          autoCapitalize="words"
          autoComplete="name"
          textContentType="name"
        />
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
        />
        <CampoTexto
          rotulo={`Senha (mínimo ${TAMANHO_MINIMO_SENHA} caracteres)`}
          value={senha}
          onChangeText={setSenha}
          erro={errosCampo.senha}
          autoCapitalize="none"
          autoComplete="new-password"
          secureTextEntry
          textContentType="newPassword"
        />
        <SeletorGenero valor={genero} aoMudar={setGenero} erro={errosCampo.genero} />
        <CampoTexto
          rotulo="Telefone (opcional)"
          value={telefone}
          onChangeText={setTelefone}
          erro={errosCampo.telefone}
          autoComplete="tel"
          keyboardType="phone-pad"
          textContentType="telephoneNumber"
          placeholder="(51) 99999-9999"
        />

        <Botao titulo="Criar conta" carregando={enviando} onPress={aoCadastrar} />
        <Botao titulo="Já tenho conta" variante="secundario" onPress={() => router.back()} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: '#fff' },
  conteudo: { flexGrow: 1, padding: 24, paddingTop: 64, gap: 16 },
  titulo: { fontSize: 26, fontWeight: 'bold', color: '#1f2933' },
  subtitulo: { fontSize: 15, color: '#52606d', marginTop: -8 },
});
