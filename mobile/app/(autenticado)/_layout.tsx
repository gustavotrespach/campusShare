import { Stack } from 'expo-router';

export default function LayoutAutenticado() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'CampusShare' }} />
    </Stack>
  );
}
