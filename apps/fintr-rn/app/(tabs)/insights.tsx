import { StyleSheet } from 'react-native';

import { Text, View } from '@/components/Themed';
import { useTabSwitchTiming } from '@/src/perf/use-tab-switch-timing';

export default function InsightsScreen() {
  useTabSwitchTiming({ tabLabel: 'Dashboard', matchPath: '/insights' });

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Dashboard</Text>
      <View
        style={styles.separator}
        lightColor="#eee"
        darkColor="rgba(255,255,255,0.1)"
      />
      <Text style={styles.subtitle}>Placeholder (insights wiring next)</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  subtitle: {
    marginTop: 8,
    fontSize: 14,
    opacity: 0.7,
  },
  separator: {
    marginVertical: 30,
    height: 1,
    width: '80%',
  },
});

