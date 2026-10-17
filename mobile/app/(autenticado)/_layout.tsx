import { Stack } from 'expo-router';

export default function LayoutAutenticado() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'CampusShare' }} />
      <Stack.Screen name="perfil" options={{ title: 'Meu perfil' }} />
      <Stack.Screen name="veiculos/index" options={{ title: 'Meus veículos' }} />
      <Stack.Screen name="veiculos/novo" options={{ title: 'Novo veículo' }} />
      <Stack.Screen name="veiculos/[id]" options={{ title: 'Editar veículo' }} />
    </Stack>
  );
}
