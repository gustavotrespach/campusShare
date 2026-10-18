import { Stack } from 'expo-router';

import { tema } from '@/tema';

export default function LayoutAutenticado() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: tema.cores.fundo },
        headerShadowVisible: false,
        headerTintColor: tema.cores.primaria,
        headerTitleStyle: { fontSize: 17, fontWeight: '600', color: tema.cores.texto },
        headerTitleAlign: 'center',
        headerBackTitle: 'Voltar',
        contentStyle: { backgroundColor: tema.cores.fundo },
      }}
    >
      {/* O Início tem cabeçalho próprio (saudação, Minhas reservas e Meu perfil) */}
      <Stack.Screen name="index" options={{ title: 'Caronas próximas', headerShown: false }} />
      <Stack.Screen name="perfil" options={{ title: 'Meu perfil' }} />
      <Stack.Screen name="veiculos/index" options={{ title: 'Meus veículos' }} />
      <Stack.Screen name="veiculos/novo" options={{ title: 'Novo veículo' }} />
      <Stack.Screen name="veiculos/[id]" options={{ title: 'Editar veículo' }} />
      <Stack.Screen name="caronas/publicar" options={{ title: 'Oferecer carona' }} />
      <Stack.Screen name="caronas/[id]" options={{ title: 'Detalhes da carona' }} />
      <Stack.Screen name="reservas/index" options={{ title: 'Minhas reservas' }} />
      <Stack.Screen name="reservas/[id]" options={{ title: 'Pagamento da reserva' }} />
    </Stack>
  );
}
