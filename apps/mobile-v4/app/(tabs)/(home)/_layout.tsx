import { Stack } from 'expo-router';

/**
 * Home is a chat-first surface, so we render our own in-screen header
 * (to match the ChatGPT-like reference layout).
 */
export default function HomeLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
    </Stack>
  );
}
