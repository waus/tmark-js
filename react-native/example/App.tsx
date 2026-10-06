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
  const [menuOpen, setMenuOpen] = React.useState(false);
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
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Choose document"
          accessibilityState={{expanded: menuOpen}}
          onPress={() => setMenuOpen(value => !value)}
          style={styles.documentPicker}>
          <Text numberOfLines={1} style={styles.documentTitle}>{example.document.title}</Text>
          <View style={styles.chevron} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => setShowSource(value => !value)}
          style={styles.modeButton}>
          <Text style={styles.modeButtonText}>
            {showSource ? 'Render' : 'Source'}
          </Text>
        </Pressable>
      </View>

      <ScrollView key={`${example.file}-${showSource}`} contentContainerStyle={styles.document}>
        {showSource ? (
          <Text selectable style={styles.source}>{example.source}</Text>
        ) : (
          <TmarkView value={example.document} />
        )}
      </ScrollView>
      {menuOpen && (
        <View style={styles.menuOverlay}>
          <Pressable accessibilityLabel="Close document list" onPress={() => setMenuOpen(false)} style={StyleSheet.absoluteFill} />
          <ScrollView style={[styles.menu, {marginTop: insets.top + 56}]}>
            {examples.map(({file, document}, index) => (
              <Pressable
                key={file}
                accessibilityRole="button"
                accessibilityState={{selected: index === selected}}
                onPress={() => { setSelected(index); setMenuOpen(false); }}
                style={[styles.menuItem, index === selected && styles.selectedMenuItem]}>
                <Text style={styles.menuItemText}>{document.title}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}
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
  documentPicker: {flex: 1, flexDirection: 'row', alignItems: 'center', marginRight: 12},
  documentTitle: {flexShrink: 1, fontSize: 19, fontWeight: '700', color: '#1b2838'},
  chevron: {width: 9, height: 9, borderRightWidth: 2, borderBottomWidth: 2, borderColor: '#1b2838', transform: [{rotate: '45deg'}], marginLeft: 12, marginTop: -4},
  modeButton: {paddingVertical: 8, paddingHorizontal: 12},
  modeButtonText: {fontSize: 15, fontWeight: '600', color: '#1769aa'},
  menuOverlay: {position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, zIndex: 1},
  menu: {maxHeight: 360, marginHorizontal: 16, backgroundColor: '#ffffff', borderRadius: 8, elevation: 4, shadowColor: '#000000', shadowOpacity: 0.16, shadowRadius: 8, shadowOffset: {width: 0, height: 3}},
  menuItem: {paddingVertical: 12, paddingHorizontal: 16},
  selectedMenuItem: {backgroundColor: '#dceaff'},
  menuItemText: {fontSize: 15, color: '#1b2838'},
  document: {padding: 20, paddingBottom: 40},
  source: {fontFamily: 'monospace', fontSize: 13, lineHeight: 20, color: '#263445'},
  message: {padding: 20, color: '#263445'},
});
