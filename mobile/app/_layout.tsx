import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { ProvedorSessao, useSessao } from '@/store/sessao';
import { tema } from '@/tema';

function Navegacao() {
  const { sessao, carregando } = useSessao();

  if (carregando) {
    return (
      <View style={estilos.carregando}>
        <ActivityIndicator size="large" color={tema.cores.primaria} />
      </View>
    );
  }

  // Sem sessão, as rotas autenticadas somem e o router leva para o login; ao entrar, o inverso.
  const logado = sessao !== null;
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={logado}>
        <Stack.Screen name="(autenticado)" />
      </Stack.Protected>
      <Stack.Protected guard={!logado}>
        <Stack.Screen name="(publico)" />
      </Stack.Protected>
      {/* Aberta pelo link do e-mail de confirmação, com ou sem sessão (T11) */}
      <Stack.Screen name="confirmacao" />
    </Stack>
  );
}

export default function LayoutRaiz() {
  return (
    <ProvedorSessao>
      <Navegacao />
      {/* Só modo claro (app.json: userInterfaceStyle light) */}
      <StatusBar style="dark" />
    </ProvedorSessao>
  );
}

const estilos = StyleSheet.create({
  carregando: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tema.cores.fundo,
  },
});
