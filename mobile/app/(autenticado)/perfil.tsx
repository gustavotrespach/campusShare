import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
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
import { SeletorGenero } from '@/components/SeletorGenero';
import { normalizarErro } from '@/services/erros';
import { atualizarPerfil, obterMeuPerfil, type MeuPerfil } from '@/services/perfil';
import type { Genero } from '@/utils/genero';
import { temErros, validarPerfil, type CamposPerfil, type ErrosDeCampo } from '@/utils/validacao';

type Carregamento =
  { tipo: 'carregando' } | { tipo: 'erro'; mensagem: string } | { tipo: 'pronto' };
type Retorno = { tipo: 'sucesso' | 'erro'; mensagem: string } | null;

function CampoSomenteLeitura({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <View style={estilos.leitura}>
      <Text style={estilos.rotulo}>{rotulo}</Text>
      <Text style={estilos.valorLeitura}>{valor}</Text>
    </View>
  );
}

export default function TelaPerfil() {
  const [carregamento, setCarregamento] = useState<Carregamento>({ tipo: 'carregando' });
  const [tentativa, setTentativa] = useState(0);
  const [perfil, setPerfil] = useState<MeuPerfil | null>(null);
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [genero, setGenero] = useState<Genero>('NAO_INFORMADO');
  const [errosCampo, setErrosCampo] = useState<ErrosDeCampo<CamposPerfil>>({});
  const [retorno, setRetorno] = useState<Retorno>(null);
  const [salvando, setSalvando] = useState(false);

  const preencher = (dados: MeuPerfil) => {
    setPerfil(dados);
    setNome(dados.nome_completo);
    setTelefone(dados.telefone ?? '');
    setGenero(dados.genero);
  };

  useEffect(() => {
    // Ignora a resposta se a tela foi desmontada ou uma nova tentativa começou
    let ativo = true;
    const carregar = async () => {
      try {
        const dados = await obterMeuPerfil();
        if (ativo) {
          preencher(dados);
          setCarregamento({ tipo: 'pronto' });
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
  }, [tentativa]);

  const aoSalvar = async () => {
    const erros = validarPerfil({ nome_completo: nome, telefone });
    setErrosCampo(erros);
    setRetorno(null);
    if (temErros(erros)) {
      return;
    }
    setSalvando(true);
    try {
      preencher(await atualizarPerfil({ nome_completo: nome, telefone, genero }));
      setRetorno({ tipo: 'sucesso', mensagem: 'Perfil atualizado.' });
    } catch (falha) {
      setRetorno({ tipo: 'erro', mensagem: normalizarErro(falha).message });
    } finally {
      setSalvando(false);
    }
  };

  if (carregamento.tipo === 'carregando') {
    return (
      <View style={estilos.centro}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (carregamento.tipo === 'erro' || !perfil) {
    const mensagem = carregamento.tipo === 'erro' ? carregamento.mensagem : '';
    return (
      <View style={estilos.centro}>
        <Aviso mensagem={mensagem} />
        <Botao
          titulo="Tentar de novo"
          onPress={() => {
            setCarregamento({ tipo: 'carregando' });
            setTentativa((anterior) => anterior + 1);
          }}
        />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={estilos.tela}
    >
      <ScrollView contentContainerStyle={estilos.conteudo} keyboardShouldPersistTaps="handled">
        <CampoSomenteLeitura rotulo="E-mail institucional" valor={perfil.email_institucional} />
        <CampoSomenteLeitura rotulo="Instituição" valor={perfil.instituicao} />
        <Text style={estilos.ajuda}>
          E-mail e instituição vêm do cadastro e não podem ser alterados.
        </Text>

        <CampoTexto
          rotulo="Nome completo"
          value={nome}
          onChangeText={setNome}
          erro={errosCampo.nome_completo}
          autoCapitalize="words"
          autoComplete="name"
          textContentType="name"
        />
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
        <SeletorGenero valor={genero} aoMudar={setGenero} />

        {retorno ? <Aviso mensagem={retorno.mensagem} tipo={retorno.tipo} /> : null}
        <Botao titulo="Salvar" carregando={salvando} onPress={aoSalvar} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: '#fff' },
  conteudo: { padding: 24, gap: 16 },
  centro: { flex: 1, justifyContent: 'center', padding: 24, gap: 16, backgroundColor: '#fff' },
  leitura: { gap: 4 },
  rotulo: { fontSize: 14, fontWeight: '600', color: '#1f2933' },
  valorLeitura: {
    fontSize: 16,
    color: '#52606d',
    backgroundColor: '#f5f7fa',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  ajuda: { fontSize: 13, color: '#52606d', marginTop: -8 },
});
