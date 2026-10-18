import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { normalizarErro } from '@/services/erros';
import { verificarSaude } from '@/services/sistema';
import { tema } from '@/tema';

type EstadoSaude =
  { tipo: 'carregando' } | { tipo: 'ok'; status: string } | { tipo: 'erro'; mensagem: string };

async function consultarSaude(): Promise<EstadoSaude> {
  try {
    return { tipo: 'ok', status: await verificarSaude() };
  } catch (erro) {
    return { tipo: 'erro', mensagem: normalizarErro(erro).message };
  }
}

// Diagnóstico da conexão com o backend (Edge Function health), útil no teste pelo Expo Go.
export function StatusServidor() {
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
      {saude.tipo === 'carregando' && <ActivityIndicator />}
      {saude.tipo === 'ok' && <Text style={estilos.ok}>Servidor: {saude.status}</Text>}
      {saude.tipo === 'erro' && (
        <>
          <Text style={estilos.erro}>{saude.mensagem}</Text>
          <Pressable accessibilityRole="button" onPress={tentarDeNovo}>
            <Text style={estilos.link}>Tentar de novo</Text>
          </Pressable>
        </>
      )}
    </View>
  );
}

const estilos = StyleSheet.create({
  container: { alignItems: 'center', gap: 6 },
  ok: { fontSize: 13, color: tema.cores.sucesso },
  erro: { fontSize: 13, color: tema.cores.erro, textAlign: 'center' },
  link: { fontSize: 13, color: tema.cores.primaria, fontWeight: '600' },
});
