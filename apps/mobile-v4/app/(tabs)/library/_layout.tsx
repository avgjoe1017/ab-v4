import { Stack } from 'expo-router';

/**
 * Library layout
 */
export default function LibraryLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
    </Stack>
  );
}
