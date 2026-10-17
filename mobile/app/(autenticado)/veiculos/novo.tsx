import { router } from 'expo-router';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from 'react-native';

import { FormularioVeiculo } from '@/components/FormularioVeiculo';
import { cadastrarVeiculo, type DadosVeiculo } from '@/services/veiculos';

export default function TelaNovoVeiculo() {
  // Volta para a lista, que recarrega ao ganhar o foco
  const aoSalvar = async (dados: DadosVeiculo) => {
    await cadastrarVeiculo(dados);
    router.back();
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={estilos.tela}
    >
      <ScrollView contentContainerStyle={estilos.conteudo} keyboardShouldPersistTaps="handled">
        <FormularioVeiculo tituloBotao="Cadastrar" aoSalvar={aoSalvar} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: '#fff' },
  conteudo: { padding: 24 },
});
