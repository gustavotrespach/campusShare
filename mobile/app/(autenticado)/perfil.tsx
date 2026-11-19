import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/Avatar';
import { Aviso } from '@/components/Aviso';
import { Botao } from '@/components/Botao';
import { CampoTexto } from '@/components/CampoTexto';
import { CarregandoTela } from '@/components/CarregandoTela';
import { Cartao } from '@/components/Cartao';
import { Divisoria } from '@/components/Divisoria';
import { ErroCarregamento } from '@/components/ErroCarregamento';
import { LinhaAtalho, RECUO_DIVISORIA_ATALHO } from '@/components/LinhaAtalho';
import { SeletorGenero } from '@/components/SeletorGenero';
import { SeloEmailConfirmado } from '@/components/SeloEmailConfirmado';
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
      <Cartao espacado={false}>
        <LinhaAtalho
          icone="car-outline"
          titulo="Meus veículos"
          onPress={() => router.push('/veiculos')}
        />
        <Divisoria recuo={RECUO_DIVISORIA_ATALHO} />
        <LinhaAtalho
          icone="receipt-outline"
          titulo="Minhas reservas"
          onPress={() => router.push('/reservas')}
        />
      </Cartao>
      {erroSair ? <Aviso mensagem={erroSair} /> : null}
      <Botao
        titulo="Sair"
        icone="log-out-outline"
        variante="textoPerigo"
        carregando={saindo}
        onPress={() => void aoSair()}
      />
      <StatusServidor />
    </>
  );

  if (carregamento.tipo === 'carregando') {
    return <CarregandoTela />;
  }

  if (carregamento.tipo === 'erro' || !perfil) {
    const mensagem = carregamento.tipo === 'erro' ? carregamento.mensagem : '';
    return (
      <ScrollView contentContainerStyle={estilos.conteudo}>
        <ErroCarregamento
          mensagem={mensagem}
          aoTentarDeNovo={() => {
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
        <View style={estilos.topo}>
          <Avatar nome={perfil.nome_completo} tamanho={72} />
          <Text style={estilos.nome}>{perfil.nome_completo}</Text>
          <SeloEmailConfirmado />
        </View>

        <Cartao titulo="Seus dados">
          <CampoTexto
            rotulo="E-mail institucional"
            icone="mail-outline"
            value={perfil.email_institucional}
            editable={false}
          />
          <CampoTexto
            rotulo="Instituição"
            icone="school-outline"
            value={perfil.instituicao}
            editable={false}
          />
          <Text style={estilos.ajuda}>
            E-mail e instituição vêm do cadastro e não podem ser alterados.
          </Text>

          <CampoTexto
            rotulo="Nome completo"
            icone="person-outline"
            value={nome}
            onChangeText={setNome}
            erro={errosCampo.nome_completo}
            autoCapitalize="words"
            autoComplete="name"
            textContentType="name"
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
          <SeletorGenero valor={genero} aoMudar={setGenero} />

          {retorno ? <Aviso mensagem={retorno.mensagem} tipo={retorno.tipo} /> : null}
          <Botao titulo="Salvar" carregando={salvando} onPress={aoSalvar} />
        </Cartao>

        {atalhos}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: tema.cores.fundo },
  conteudo: { padding: tema.espaco.x5, gap: tema.espaco.x4 },
  topo: { alignItems: 'center', gap: tema.espaco.x2 },
  nome: { ...tema.tipografia.subtitulo, color: tema.cores.texto, textAlign: 'center' },
  // Fica colada nos dois campos de cima, a que ela se refere
  ajuda: {
    ...tema.tipografia.legenda,
    color: tema.cores.textoSecundario,
    marginTop: -tema.espaco.x2,
  },
});
