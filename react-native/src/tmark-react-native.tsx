import React from "react";
import {
  Image, Linking, Pressable, ScrollView, StyleSheet, Text, View,
  type StyleProp, type TextStyle, type ViewStyle,
} from "react-native";
import type {
  BlockNode, Caption, Cell, ListItem, RichNode, SlideshowNode, TmarkNode,
} from "@tmark/tmark";

export type TmarkMediaRenderer = (media: {
  src: string;
  kind: "image" | "video" | "audio" | "map";
  lat?: number;
  lon?: number;
  zoom?: number;
}) => React.ReactNode;

export type TmarkNodeRenderer = (node: TmarkNode, renderDefault: () => React.ReactNode) => React.ReactNode;

export interface TmarkViewProps {
  value: TmarkNode;
  mediaRenderer?: TmarkMediaRenderer;
  renderNode?: TmarkNodeRenderer;
  onOpenLink?: (url: string) => void;
  onOpenAnchor?: (name: string) => void;
  style?: StyleProp<ViewStyle>;
}

type ContextValue = Pick<TmarkViewProps, "mediaRenderer" | "renderNode" | "onOpenLink" | "onOpenAnchor">;
const TmarkContext = React.createContext<ContextValue>({});

export function TmarkView({ value, mediaRenderer, renderNode, onOpenLink, onOpenAnchor, style }: TmarkViewProps) {
  const context = React.useMemo(() => ({ mediaRenderer, renderNode, onOpenLink, onOpenAnchor }), [mediaRenderer, renderNode, onOpenLink, onOpenAnchor]);
  return <TmarkContext.Provider value={context}><View style={style}>{value.kind === "document" || value.kind === "attachedMedia"
    ? <Blocks nodes={value.content} />
    : isRichNode(value) ? <Text><RichNodeView node={value} /></Text> : <BlockView value={value as BlockNode} />}</View></TmarkContext.Provider>;
}

export function RichTextView({ nodes }: { nodes?: RichNode[] }) {
  return <Text>{nodes?.map((node, index) => <RichNodeView key={index} node={node} />)}</Text>;
}

function RichNodeView({ node }: { node: RichNode }) {
  const { renderNode } = React.useContext(TmarkContext);
  return <>{renderNode ? renderNode(node, () => defaultRichNode(node)) : defaultRichNode(node)}</>;
}

function defaultRichNode(node: RichNode): React.ReactNode {
  switch (node.kind) {
    case "text": return node.text;
    case "link": return <Link href={node.href}><RichTextView nodes={node.children} /></Link>;
    case "anchorLink": return <AnchorLink name={node.anchorName}><RichTextView nodes={node.children} /></AnchorLink>;
    case "referenceLink": return <AnchorLink name={node.referenceName}><RichTextView nodes={node.children} /></AnchorLink>;
    case "reference": return <RichTextView nodes={node.children} />;
    case "bold": return <Text style={styles.bold}><RichTextView nodes={node.children} /></Text>;
    case "italic": return <Text style={styles.italic}><RichTextView nodes={node.children} /></Text>;
    case "marked": return <Text style={styles.marked}><RichTextView nodes={node.children} /></Text>;
    case "underline": return <Text style={styles.underline}><RichTextView nodes={node.children} /></Text>;
    case "strikethrough": return <Text style={styles.strike}><RichTextView nodes={node.children} /></Text>;
    case "spoiler": return <InlineSpoiler><RichTextView nodes={node.children} /></InlineSpoiler>;
    case "subscript": return <Text style={styles.subscript}><RichTextView nodes={node.children} /></Text>;
    case "superscript": return <Text style={styles.superscript}><RichTextView nodes={node.children} /></Text>;
    case "datetime": return formatDate(node.unix, node.timezone);
    case "code": return <Text style={styles.inlineCode}>{node.text}</Text>;
    case "math": return <Text style={styles.inlineCode}>{node.expression}</Text>;
    case "icon": return <Text accessibilityLabel={node.alternativeText}>{node.alternativeText ?? ""}</Text>;
    case "unknown": return node.raw;
  }
}

function Link({ href, children }: { href: string; children: React.ReactNode }) {
  const { onOpenLink } = React.useContext(TmarkContext);
  const url = safeUrl(href);
  return <Text style={styles.link} onPress={url ? () => onOpenLink ? onOpenLink(url) : void Linking.openURL(url) : undefined}>{children}</Text>;
}

function AnchorLink({ name, children }: { name: string; children: React.ReactNode }) {
  const { onOpenAnchor } = React.useContext(TmarkContext);
  return <Text style={styles.link} onPress={onOpenAnchor ? () => onOpenAnchor(name) : undefined}>{children}</Text>;
}

function InlineSpoiler({ children }: { children: React.ReactNode }) {
  const [revealed, setRevealed] = React.useState(false);
  return <Text accessibilityRole="button" accessibilityLabel={revealed ? undefined : "Reveal text"} onPress={() => setRevealed(true)} style={revealed ? undefined : styles.hiddenText}>{children}</Text>;
}

export function BlockView({ value }: { value: BlockNode | TmarkNode }) {
  const { renderNode } = React.useContext(TmarkContext);
  return <>{renderNode ? renderNode(value, () => defaultBlockView(value)) : defaultBlockView(value)}</>;
}

function Blocks({ nodes }: { nodes?: BlockNode[] }) {
  return <>{nodes?.map((node, index) => <BlockView key={index} value={node} />)}</>;
}

function defaultBlockView(value: BlockNode | TmarkNode): React.ReactNode {
  switch (value.kind) {
    case "paragraph": return <Text style={styles.paragraph}><RichTextView nodes={value.children} /></Text>;
    case "header": return <Text accessibilityRole="header" style={[styles.heading, headingStyle(value.size)]}><RichTextView nodes={value.children} /></Text>;
    case "preformatted": return <ScrollView horizontal style={styles.codeBlock}><Text selectable style={styles.monospace}>{value.text}</Text></ScrollView>;
    case "mathBlock": return <Text style={[styles.paragraph, styles.monospace]}>{value.expression}</Text>;
    case "anchor": return null;
    case "divider": return <View style={styles.divider} />;
    case "blockquote": return <View style={styles.quote}><Blocks nodes={value.blocks} /><Credit nodes={value.credit} /></View>;
    case "pullQuote": return <View style={styles.quote}><Text style={styles.pullQuote}><RichTextView nodes={value.text} /></Text><Credit nodes={value.credit} /></View>;
    case "list": return <ListView items={value.items} />;
    case "listItem": return <ListItemView item={value} ordered={value.order != null || value.type != null} index={0} />;
    case "image": case "video": case "audio": return <MediaBlock node={value} />;
    case "map": return <MapBlock lat={value.lat} lon={value.lon} zoom={value.zoom} caption={value.caption} />;
    case "collage": return <View style={styles.block}><View style={styles.collage}>{value.children?.map((node, index) => <View key={index} style={styles.collageItem}><MediaContent node={node} /></View>)}</View><CaptionView caption={value.caption} /></View>;
    case "slideshow": return <SlideshowView nodes={value.children} caption={value.caption} />;
    case "table": return <View style={styles.block}><ScrollView horizontal><View>{value.rows?.map((row, index) => <View key={index} style={[styles.tableRow, value.striped && index % 2 === 1 && styles.stripedRow]}>{row.cells?.map((cell, cellIndex) => <CellView key={cellIndex} cell={cell} bordered={value.bordered} />)}</View>)}</View></ScrollView>{!!value.caption?.length && <Text style={styles.caption}><RichTextView nodes={value.caption} /></Text>}</View>;
    case "tableRow": return <View style={styles.tableRow}>{value.cells?.map((cell, index) => <CellView key={index} cell={cell} />)}</View>;
    case "cell": return <CellView cell={value} />;
    case "details": return <DetailsView summary={value.summary} isOpen={value.isOpen} children={value.children} />;
    case "unknown": return <Text style={styles.monospace}>{value.raw}</Text>;
    default: return null;
  }
}

function ListView({ items = [] }: { items?: ListItem[] }) {
  const ordered = items.some((item) => item.order != null || item.type != null);
  return <View style={styles.block}>{items.map((item, index) => <ListItemView key={index} item={item} ordered={ordered} index={index} />)}</View>;
}

function ListItemView({ item, ordered, index }: { item: ListItem; ordered: boolean; index: number }) {
  const marker = item.checked == null ? listItemMarker(item, ordered, index) : item.checked ? "☑" : "☐";
  return <View style={styles.listItem}><Text style={styles.marker}>{marker}</Text><View style={styles.listBody}><Blocks nodes={item.children} /></View></View>;
}

function MediaBlock({ node }: { node: Extract<BlockNode, { kind: "image" | "video" | "audio" }> }) {
  return <View style={styles.block}><MediaContent node={node} /><CaptionView caption={node.caption} /></View>;
}

function MediaContent({ node }: { node: Extract<BlockNode, { kind: "image" | "video" | "audio" }> }) {
  const { mediaRenderer } = React.useContext(TmarkContext);
  const src = safeMediaUrl(node.src, node.kind);
  const [revealed, setRevealed] = React.useState(!("hasSpoiler" in node && node.hasSpoiler));
  if (!src) return null;
  const content = mediaRenderer?.({ src, kind: node.kind }) ?? (node.kind === "image"
    ? <Image source={{ uri: src }} resizeMode="contain" style={styles.image} />
    : <Text style={styles.mediaFallback}>{node.kind === "video" ? "Video" : "Audio"}: {src}</Text>);
  return revealed ? <>{content}</> : <Pressable accessibilityRole="button" accessibilityLabel="Reveal media" onPress={() => setRevealed(true)} style={styles.mediaSpoiler}><Text>Tap to reveal {node.kind}</Text></Pressable>;
}

function MapBlock({ lat, lon, zoom, caption }: { lat: number; lon: number; zoom?: number; caption?: Caption }) {
  const { mediaRenderer } = React.useContext(TmarkContext);
  const content = mediaRenderer?.({ src: `${lat},${lon}`, kind: "map", lat, lon, zoom });
  return <View style={styles.block}>{content ?? <Text style={styles.mediaFallback}>Map: {lat}, {lon}</Text>}<CaptionView caption={caption} /></View>;
}

function SlideshowView({ nodes = [], caption }: { nodes?: SlideshowNode[]; caption?: Caption }) {
  const [index, setIndex] = React.useState(0);
  React.useEffect(() => setIndex((current) => nodes.length ? Math.min(current, nodes.length - 1) : 0), [nodes.length]);
  if (!nodes.length) return null;
  return <View style={styles.block}><MediaContent node={nodes[index]} />{nodes.length > 1 && <View style={styles.pager}><Pressable accessibilityRole="button" accessibilityLabel="Previous slide" onPress={() => setIndex((index + nodes.length - 1) % nodes.length)}><Text style={styles.pagerButton}>‹</Text></Pressable><Text>{index + 1} / {nodes.length}</Text><Pressable accessibilityRole="button" accessibilityLabel="Next slide" onPress={() => setIndex((index + 1) % nodes.length)}><Text style={styles.pagerButton}>›</Text></Pressable></View>}<CaptionView caption={caption} /></View>;
}

function CellView({ cell, bordered = false }: { cell: Cell; bordered?: boolean }) {
  const align: TextStyle["textAlign"] = cell.align ?? "left";
  return <View style={[styles.cell, bordered && styles.cellBorder, cell.isHeader && styles.cellHeader]}><Text style={[cell.isHeader && styles.bold, { textAlign: align }]}><RichTextView nodes={cell.children} /></Text></View>;
}

function DetailsView({ summary, isOpen, children }: { summary?: RichNode[]; isOpen?: boolean; children?: BlockNode[] }) {
  const [open, setOpen] = React.useState(Boolean(isOpen));
  React.useEffect(() => setOpen(Boolean(isOpen)), [isOpen]);
  return <View style={styles.block}><Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={() => setOpen(!open)}><Text style={styles.bold}>{open ? "▾" : "▸"} <RichTextView nodes={summary} /></Text></Pressable>{open && <View style={styles.detailsBody}><Blocks nodes={children} /></View>}</View>;
}

function CaptionView({ caption }: { caption?: Caption }) {
  if (!caption) return null;
  return <View><Text style={styles.caption}><RichTextView nodes={caption.text} /></Text><Credit nodes={caption.credit} /></View>;
}

function Credit({ nodes }: { nodes?: RichNode[] }) {
  return nodes?.length ? <Text style={styles.credit}><RichTextView nodes={nodes} /></Text> : null;
}

function headingStyle(size: number): TextStyle {
  return { fontSize: [30, 26, 23, 20, 18, 16][Math.min(6, Math.max(1, size || 4)) - 1] };
}

function formatDate(unix: number, timezone: string): string {
  const date = new Date(unix * 1000);
  if (!Number.isFinite(date.getTime())) return String(unix);
  try { return date.toLocaleString(undefined, { timeZone: timezone }); }
  catch { return date.toLocaleString(); }
}

function listItemMarker(item: ListItem, ordered: boolean, index: number): string {
  const order = item.order ?? (ordered ? index + 1 : undefined);
  if (order == null) return "•";
  if (item.type === "a" || item.type === "A") {
    let n = order, out = "";
    while (n > 0) { n--; out = String.fromCharCode(65 + n % 26) + out; n = Math.floor(n / 26); }
    return `${item.type === "a" ? out.toLowerCase() : out || order}.`;
  }
  if (item.type === "i" || item.type === "I") {
    if (order <= 0 || order > 3999) return `${order}.`;
    let n = order, out = "";
    for (const [value, numeral] of [[1000,"M"],[900,"CM"],[500,"D"],[400,"CD"],[100,"C"],[90,"XC"],[50,"L"],[40,"XL"],[10,"X"],[9,"IX"],[5,"V"],[4,"IV"],[1,"I"]] as const) while (n >= value) { out += numeral; n -= value; }
    return `${item.type === "i" ? out.toLowerCase() : out}.`;
  }
  return `${order}.`;
}

function safeUrl(value: string): string | undefined {
  const url = value.trim();
  return /^(https?:\/\/|mailto:|tel:)/i.test(url) && !/[\u0000-\u001f\u007f]/.test(url) ? url : undefined;
}

function safeMediaUrl(value: string, kind: "image" | "video" | "audio"): string | undefined {
  const url = value.trim();
  if (/[\u0000-\u001f\u007f]/.test(url)) return undefined;
  return /^(https?:\/\/|file:\/\/)/i.test(url) || (kind === "image" && /^data:image\//i.test(url)) ? url : undefined;
}

function isRichNode(value: TmarkNode): value is RichNode {
  return ["text", "link", "anchorLink", "reference", "referenceLink", "bold", "italic", "marked", "underline", "strikethrough", "spoiler", "subscript", "superscript", "datetime", "code", "math", "icon", "unknown"].includes(value.kind);
}

const styles = StyleSheet.create({
  paragraph: { color: "#202124", fontSize: 16, lineHeight: 24, marginBottom: 12 },
  heading: { color: "#202124", fontWeight: "700", lineHeight: 36, marginTop: 14, marginBottom: 10 },
  bold: { fontWeight: "700" }, italic: { fontStyle: "italic" },
  marked: { backgroundColor: "#fff3a3" }, underline: { textDecorationLine: "underline" },
  strike: { textDecorationLine: "line-through" }, hiddenText: { color: "#333", backgroundColor: "#333" },
  subscript: { fontSize: 12, lineHeight: 18 }, superscript: { fontSize: 12, lineHeight: 18 },
  inlineCode: { fontFamily: "monospace", backgroundColor: "#f2f2f2" }, link: { color: "#2563eb", textDecorationLine: "underline" },
  block: { marginBottom: 12 }, divider: { height: 1, backgroundColor: "#bbb", marginVertical: 14 },
  quote: { borderLeftWidth: 3, borderLeftColor: "#999", paddingLeft: 12, marginBottom: 12 },
  pullQuote: { fontSize: 20, fontStyle: "italic" }, codeBlock: { backgroundColor: "#f2f2f2", padding: 12, marginBottom: 12 },
  monospace: { fontFamily: "monospace", fontSize: 14 }, listItem: { flexDirection: "row", marginBottom: 3 },
  marker: { width: 28, textAlign: "right", marginRight: 8, fontSize: 16 }, listBody: { flex: 1 },
  image: { width: "100%", height: 220 }, mediaFallback: { padding: 16, backgroundColor: "#eee" },
  mediaSpoiler: { minHeight: 120, alignItems: "center", justifyContent: "center", backgroundColor: "#ddd" },
  caption: { textAlign: "center", color: "#555", marginTop: 5 }, credit: { textAlign: "center", color: "#777", fontSize: 12 },
  collage: { flexDirection: "row", flexWrap: "wrap", gap: 4 }, collageItem: { width: "48%" },
  pager: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, pagerButton: { fontSize: 32, paddingHorizontal: 12 },
  tableRow: { flexDirection: "row" }, stripedRow: { backgroundColor: "#f5f5f5" },
  cell: { minWidth: 100, flex: 1, padding: 8 }, cellBorder: { borderWidth: 1, borderColor: "#ccc" }, cellHeader: { backgroundColor: "#eee" },
  detailsBody: { marginTop: 8, paddingLeft: 16 },
});
