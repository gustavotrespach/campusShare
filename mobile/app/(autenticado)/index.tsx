import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Aviso } from '@/components/Aviso';
import { Botao } from '@/components/Botao';
import { StatusServidor } from '@/components/StatusServidor';
import { sair } from '@/services/auth';
import { normalizarErro } from '@/services/erros';
import { useSessao } from '@/store/sessao';

export default function TelaHome() {
  const { sessao } = useSessao();
  const [saindo, setSaindo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Ao sair, a sessão vira null e o layout raiz leva de volta ao login.
  const aoSair = async () => {
    setSaindo(true);
    setErro(null);
    try {
      await sair();
    } catch (falha) {
      setErro(normalizarErro(falha).message);
      setSaindo(false);
    }
  };

  return (
    <View style={estilos.container}>
      <Text style={estilos.titulo}>Bem-vindo(a)!</Text>
      <Text style={estilos.email}>{sessao?.user.email}</Text>
      <StatusServidor />
      {erro ? <Aviso mensagem={erro} /> : null}
      <Botao titulo="Meu perfil" onPress={() => router.push('/perfil')} />
      <Botao titulo="Meus veículos" onPress={() => router.push('/veiculos')} />
      <Botao titulo="Sair" variante="secundario" carregando={saindo} onPress={aoSair} />
    </View>
  );
}

const estilos = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 24, gap: 16, justifyContent: 'center' },
  titulo: { fontSize: 24, fontWeight: 'bold', textAlign: 'center' },
  email: { fontSize: 16, color: '#52606d', textAlign: 'center' },
});
