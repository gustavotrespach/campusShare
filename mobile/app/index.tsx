import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { normalizarErro } from '@/services/erros';
import { verificarSaude } from '@/services/sistema';

type EstadoSaude =
  { tipo: 'carregando' } | { tipo: 'ok'; status: string } | { tipo: 'erro'; mensagem: string };

async function consultarSaude(): Promise<EstadoSaude> {
  try {
    return { tipo: 'ok', status: await verificarSaude() };
  } catch (erro) {
    return { tipo: 'erro', mensagem: normalizarErro(erro).message };
  }
}

export default function TelaInicial() {
  const [saude, setSaude] = useState<EstadoSaude>({ tipo: 'carregando' });
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    // Ignora a resposta se a tela foi desmontada ou uma nova tentativa começou
    let ativo = true;
    const carregar = async () => {
      const estado = await consultarSaude();
      if (ativo) {
        setSaude(estado);
      }
    };
    void carregar();
    return () => {
      ativo = false;
    };
  }, [tentativa]);

  const tentarDeNovo = () => {
    setSaude({ tipo: 'carregando' });
    setTentativa((anterior) => anterior + 1);
  };

  return (
    <View style={estilos.container}>
      <Text style={estilos.titulo}>CampusShare</Text>
      {saude.tipo === 'carregando' && <ActivityIndicator />}
      {saude.tipo === 'ok' && <Text style={estilos.ok}>Servidor: {saude.status}</Text>}
      {saude.tipo === 'erro' && (
        <>
          <Text style={estilos.erro}>{saude.mensagem}</Text>
          <Pressable accessibilityRole="button" onPress={tentarDeNovo} style={estilos.botao}>
            <Text style={estilos.textoBotao}>Tentar de novo</Text>
          </Pressable>
        </>
      )}
    </View>
  );
}

const estilos = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 24,
  },
  titulo: { fontSize: 24, fontWeight: 'bold' },
  ok: { fontSize: 16, color: '#1b7f3b' },
  erro: { fontSize: 16, color: '#b42318', textAlign: 'center' },
  botao: {
    backgroundColor: '#1a56db',
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  textoBotao: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
