import { Stack } from 'expo-router';

import { tema } from '@/tema';

export default function LayoutPublico() {
  return (
    <Stack
      screenOptions={{ headerShown: false, contentStyle: { backgroundColor: tema.cores.fundo } }}
    />
  );
}
