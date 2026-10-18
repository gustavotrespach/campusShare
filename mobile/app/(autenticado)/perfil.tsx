import { router } from 'expo-router';
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
import { LinhaAtalho } from '@/components/LinhaAtalho';
import { SeletorGenero } from '@/components/SeletorGenero';
import { StatusServidor } from '@/components/StatusServidor';
import { sair } from '@/services/auth';
import { normalizarErro } from '@/services/erros';
import { atualizarPerfil, obterMeuPerfil, type MeuPerfil } from '@/services/perfil';
import { limparPix } from '@/store/pix';
import { tema } from '@/tema';
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
  const [saindo, setSaindo] = useState(false);
  const [erroSair, setErroSair] = useState<string | null>(null);

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

  // Sucesso não navega daqui: a sessão muda e o layout raiz leva para o login
  const aoSair = async () => {
    setSaindo(true);
    setErroSair(null);
    try {
      await sair();
      // O Pix em memória é da conta que saiu
      limparPix();
    } catch (falha) {
      setErroSair(normalizarErro(falha).message);
      setSaindo(false);
    }
  };

  // Atalhos que vieram da tela inicial (T32): nenhum caminho some, mesmo com o perfil fora do ar
  const atalhos = (
    <>
      <View style={estilos.cartaoAtalhos}>
        <LinhaAtalho
          icone="car-outline"
          titulo="Meus veículos"
          onPress={() => router.push('/veiculos')}
        />
        <View style={estilos.divisoria} />
        <LinhaAtalho
          icone="receipt-outline"
          titulo="Minhas reservas"
          onPress={() => router.push('/reservas')}
        />
      </View>
      {erroSair ? <Aviso mensagem={erroSair} /> : null}
      <Botao
        titulo="Sair"
        icone="log-out-outline"
        variante="texto"
        carregando={saindo}
        onPress={() => void aoSair()}
      />
      <StatusServidor />
    </>
  );

  if (carregamento.tipo === 'carregando') {
    return (
      <View style={estilos.centro}>
        <ActivityIndicator size="large" color={tema.cores.primaria} />
      </View>
    );
  }

  if (carregamento.tipo === 'erro' || !perfil) {
    const mensagem = carregamento.tipo === 'erro' ? carregamento.mensagem : '';
    return (
      <ScrollView contentContainerStyle={estilos.conteudo}>
        <Aviso mensagem={mensagem} />
        <Botao
          titulo="Tentar de novo"
          onPress={() => {
            setCarregamento({ tipo: 'carregando' });
            setTentativa((anterior) => anterior + 1);
          }}
        />
        {atalhos}
      </ScrollView>
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

        {atalhos}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: tema.cores.fundo },
  conteudo: { padding: tema.espaco.x5, gap: tema.espaco.x4 },
  centro: {
    flex: 1,
    justifyContent: 'center',
    padding: tema.espaco.x5,
    gap: tema.espaco.x4,
    backgroundColor: tema.cores.fundo,
  },
  leitura: { gap: tema.espaco.x1 },
  rotulo: { ...tema.tipografia.rotulo, color: tema.cores.texto },
  valorLeitura: {
    ...tema.tipografia.corpo,
    color: tema.cores.textoSecundario,
    backgroundColor: tema.cores.neutroClaro,
    borderWidth: 1,
    borderColor: tema.cores.borda,
    borderRadius: tema.raio.medio,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  ajuda: { ...tema.tipografia.legenda, color: tema.cores.textoSecundario, marginTop: -8 },
  cartaoAtalhos: {
    marginTop: tema.espaco.x2,
    backgroundColor: tema.cores.superficie,
    borderRadius: tema.raio.grande,
    borderWidth: 1,
    borderColor: tema.cores.borda,
    overflow: 'hidden',
  },
  divisoria: { height: 1, backgroundColor: tema.cores.borda, marginLeft: 50 },
});
