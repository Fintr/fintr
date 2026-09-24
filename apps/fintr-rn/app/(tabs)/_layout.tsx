import { SymbolView } from 'expo-symbols';
import { Tabs, useRouter } from 'expo-router';
import { useEffect } from 'react';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useClientOnlyValue } from '@/components/useClientOnlyValue';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const router = useRouter();

  // Optional automated run (useful for capturing console timings).
  useEffect(() => {
    const runBenchmark = process.env.EXPO_PUBLIC_FINTR_TAB_BENCHMARK === "1";

    if (!runBenchmark) return;

    const cycle = async () => {
      const steps = [
        { path: "/", label: "Home" },
        { path: "/transactions", label: "Transactions" },
        { path: "/insights", label: "Dashboard" },
        { path: "/menu", label: "Menu" },
        { path: "/", label: "Home" },
      ] as const;

      // Give the app a moment to mount before the first navigation.
      await new Promise((r) => setTimeout(r, 1200));

      for (const step of steps) {
        globalThis.__fintrTabPressAtMs = Date.now();
        router.push(step.path as never);
        await new Promise((r) => setTimeout(r, 1600));
      }

      // eslint-disable-next-line no-console
      console.log("[rn-tab-switch][bench] completed");
    };

    void cycle();
  }, [router]);

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme].tint,
        // Disable the static render of the header on web
        // to prevent a hydration error in React Navigation v6.
        headerShown: useClientOnlyValue(false, true),
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => (
            <SymbolView
              name={{
                ios: 'house.fill',
                android: 'home',
                web: 'house.fill',
              }}
              tintColor={color}
              size={28}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="transactions"
        options={{
          title: 'Transactions',
          tabBarIcon: ({ color }) => (
            <SymbolView
              name={{
                ios: 'list.bullet',
                android: 'format-list-bulleted',
                web: 'list.bullet',
              }}
              tintColor={color}
              size={28}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="insights"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color }) => (
            <SymbolView
              name={{
                ios: 'chart.bar.fill',
                android: 'bar-chart',
                web: 'chart.bar.fill',
              }}
              tintColor={color}
              size={28}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="menu"
        options={{
          title: 'Menu',
          tabBarIcon: ({ color }) => (
            <SymbolView
              name={{
                ios: 'gearshape.fill',
                android: 'settings',
                web: 'gearshape.fill',
              }}
              tintColor={color}
              size={28}
            />
          ),
        }}
      />
    </Tabs>
  );
}
