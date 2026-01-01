import { Stack } from 'expo-router';

/**
 * Root layout for Expo Router
 */
export default function RootLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen
        name="learn/affirmation-science"
        options={{
          presentation: 'modal',
          title: 'How Affirmations Work',
        }}
      />
    </Stack>
  );
}
