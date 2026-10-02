import React from 'react';
import {
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

import {unmarshalDocument} from '@tmark/tmark';
import type {Document} from '@tmark/tmark';
import {TmarkView} from '@tmark/react-native';

const examplesBase = 'https://tmark.waus.app/examples/';
const exampleFiles = [
  'all_widgets.tmark',
  'edge_cases.tmark',
  'edge_empties.tmark',
  'inline_formatting.tmark',
  'lists_and_tasks.tmark',
  'maps_and_events.tmark',
  'math_and_code.tmark',
  'media_formats.tmark',
  'media_gallery.tmark',
  'quotes_and_details.tmark',
  'references_and_anchors.tmark',
  'tables.tmark',
];

type Example = {file: string; source: string; document: Document};

async function loadExample(file: string): Promise<Example> {
  const response = await fetch(`${examplesBase}${file}`);
  if (!response.ok) throw new Error(`Cannot load ${file}: HTTP ${response.status}`);
  const source = await response.text();
  return {file, source, document: unmarshalDocument(source, {soft: true})};
}

function ExampleScreen() {
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = React.useState(0);
  const [showSource, setShowSource] = React.useState(false);
  const [examples, setExamples] = React.useState<Example[]>([]);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let mounted = true;
    Promise.all(exampleFiles.map(loadExample))
      .then(loaded => { if (mounted) setExamples(loaded); })
      .catch(reason => { if (mounted) setError(String(reason)); });
    return () => { mounted = false; };
  }, []);

  if (error || !examples.length) {
    return <View style={styles.screen}><Text style={styles.message}>{error ?? 'Loading...'}</Text></View>;
  }

  const example = examples[selected];

  return (
    <View style={[styles.screen, {paddingTop: insets.top, paddingBottom: insets.bottom}]}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <Text style={styles.appTitle}>tmark examples</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => setShowSource(value => !value)}
          style={styles.modeButton}>
          <Text style={styles.modeButtonText}>
            {showSource ? 'Render' : 'Source'}
          </Text>
        </Pressable>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabs}
        contentContainerStyle={styles.tabsContent}>
        {examples.map(({file, document}, index) => (
          <Pressable
            key={file}
            accessibilityRole="button"
            accessibilityState={{selected: index === selected}}
            onPress={() => setSelected(index)}
            style={[styles.tab, index === selected && styles.selectedTab]}>
            <Text style={[styles.tabText, index === selected && styles.selectedTabText]}>
              {document.title}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <ScrollView key={`${example.file}-${showSource}`} contentContainerStyle={styles.document}>
        {showSource ? (
          <Text selectable style={styles.source}>{example.source}</Text>
        ) : (
          <TmarkView value={example.document} />
        )}
      </ScrollView>
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ExampleScreen />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  screen: {flex: 1, backgroundColor: '#ffffff'},
  header: {
    minHeight: 56,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#d5dce5',
  },
  appTitle: {fontSize: 19, fontWeight: '700', color: '#1b2838'},
  modeButton: {paddingVertical: 8, paddingHorizontal: 12},
  modeButtonText: {fontSize: 15, fontWeight: '600', color: '#1769aa'},
  tabs: {flexGrow: 0, maxHeight: 60},
  tabsContent: {alignItems: 'center', paddingHorizontal: 12, gap: 8},
  tab: {paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, backgroundColor: '#f0f2f5'},
  selectedTab: {backgroundColor: '#dceaff'},
  tabText: {fontSize: 14, color: '#39475a'},
  selectedTabText: {fontWeight: '700', color: '#114f83'},
  document: {padding: 20, paddingBottom: 40},
  source: {fontFamily: 'monospace', fontSize: 13, lineHeight: 20, color: '#263445'},
  message: {padding: 20, color: '#263445'},
});
