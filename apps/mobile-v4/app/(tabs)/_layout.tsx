import { Tabs } from 'expo-router';

/**
 * Tabs layout for main navigation
 * Minimal navigation: Chat (Home) and Library
 */
export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }}>
      <Tabs.Screen
        name="(home)"
        options={{
          title: 'Chat',
        }}
      />
      <Tabs.Screen
        name="library"
        options={{
          title: 'Library',
        }}
      />
    </Tabs>
  );
}
