import { Stack } from 'expo-router';

export default function LayoutAutenticado() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Caronas próximas' }} />
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
