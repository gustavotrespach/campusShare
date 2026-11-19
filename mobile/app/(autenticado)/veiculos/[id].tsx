import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';

import { Aviso } from '@/components/Aviso';
import { Botao } from '@/components/Botao';
import { CarregandoTela } from '@/components/CarregandoTela';
import { Divisoria } from '@/components/Divisoria';
import { ErroCarregamento } from '@/components/ErroCarregamento';
import { FormularioVeiculo } from '@/components/FormularioVeiculo';
import { normalizarErro } from '@/services/erros';
import {
  atualizarVeiculo,
  excluirVeiculo,
  obterVeiculo,
  type DadosVeiculo,
  type Veiculo,
} from '@/services/veiculos';
import { tema } from '@/tema';

type Carregamento =
  | { tipo: 'carregando' }
  | { tipo: 'erro'; mensagem: string }
  | { tipo: 'pronto'; veiculo: Veiculo };

export default function TelaEditarVeiculo() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [carregamento, setCarregamento] = useState<Carregamento>({ tipo: 'carregando' });
  const [tentativa, setTentativa] = useState(0);
  const [excluindo, setExcluindo] = useState(false);
  const [erroExclusao, setErroExclusao] = useState<string | null>(null);

  useEffect(() => {
    // Ignora a resposta se a tela foi desmontada ou uma nova tentativa começou
    let ativo = true;
    const carregar = async () => {
      try {
        const veiculo = await obterVeiculo(id);
        if (ativo) {
          setCarregamento({ tipo: 'pronto', veiculo });
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
  }, [id, tentativa]);

  const aoSalvar = async (dados: DadosVeiculo) => {
    await atualizarVeiculo(id, dados);
    router.back();
  };

  // Veículo em uso ou com histórico: o banco recusa (409) e a frase fica na tela, sem sair dela
  const excluir = async () => {
    setExcluindo(true);
    setErroExclusao(null);
    try {
      await excluirVeiculo(id);
      router.back();
    } catch (falha) {
      setErroExclusao(normalizarErro(falha).message);
      setExcluindo(false);
    }
  };

  const confirmarExclusao = (veiculo: Veiculo) => {
    Alert.alert('Excluir veículo', `Excluir ${veiculo.modelo} (${veiculo.placa})?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Excluir', style: 'destructive', onPress: () => void excluir() },
    ]);
  };

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

  const { veiculo } = carregamento;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={estilos.tela}
    >
      <ScrollView contentContainerStyle={estilos.conteudo} keyboardShouldPersistTaps="handled">
        <FormularioVeiculo inicial={veiculo} tituloBotao="Salvar" aoSalvar={aoSalvar} />
        <Divisoria />
        <View style={estilos.exclusao}>
          {erroExclusao ? <Aviso mensagem={erroExclusao} /> : null}
          <Botao
            titulo="Excluir veículo"
            icone="trash-outline"
            variante="perigo"
            carregando={excluindo}
            onPress={() => confirmarExclusao(veiculo)}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: tema.cores.fundo },
  // 24 acima e abaixo da divisória que separa a exclusão do formulário
  conteudo: { padding: tema.espaco.x5, gap: tema.espaco.x6 },
  centro: { flexGrow: 1, justifyContent: 'center' },
  exclusao: { gap: tema.espaco.x3 },
});
