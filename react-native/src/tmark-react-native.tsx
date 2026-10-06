import React from "react";
import {
  Clipboard, Image, Linking, Pressable, ScrollView, StyleSheet, Text, View,
  type ScrollViewInstance, type StyleProp, type TextStyle, type ViewStyle,
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
    case "code": return <InlineCode text={node.text} />;
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

function useCopy(text: string) {
  const [copied, setCopied] = React.useState(false);
  React.useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1200);
    return () => clearTimeout(timer);
  }, [copied]);
  return { copied, copy: () => { Clipboard.setString(text); setCopied(true); } };
}

function InlineCode({ text }: { text: string }) {
  const { copied, copy } = useCopy(text);
  return <Text accessibilityRole="button" accessibilityLabel={copied ? "Copied" : `Copy code: ${text}`} onPress={event => { event.stopPropagation(); copy(); }} style={[styles.inlineCode, copied && styles.copiedCode]}>{text}</Text>;
}

function CodeBlock({ text }: { text: string }) {
  return <View style={styles.codeBlock}>
    <ScrollView horizontal contentContainerStyle={styles.codeBlockContent}><Text selectable style={styles.monospace}>{text}</Text></ScrollView>
    <CopyButton text={text} />
  </View>;
}

function CopyButton({ text }: { text: string }) {
  const { copied, copy } = useCopy(text);
  return <Pressable accessibilityRole="button" accessibilityLabel={copied ? "Copied" : "Copy code"} onPress={copy} style={styles.copyButton}>
    {copied ? <Text style={styles.copyCheck}>✓</Text> : <View style={styles.copyIcon}><View style={styles.copyIconBack} /><View style={styles.copyIconFront} /></View>}
  </Pressable>;
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
    case "preformatted": return <CodeBlock text={value.text} />;
    case "mathBlock": return <Text style={[styles.paragraph, styles.monospace]}>{value.expression}</Text>;
    case "anchor": return null;
    case "divider": return <View style={styles.divider} />;
    case "blockquote": return <View style={styles.quote}><Blocks nodes={value.blocks} /><Credit nodes={value.credit} /></View>;
    case "pullQuote": return <View style={styles.pullQuoteBlock}><Text style={styles.pullQuote}><RichTextView nodes={value.text} /></Text><Credit nodes={value.credit} /></View>;
    case "list": return <ListView items={value.items} />;
    case "listItem": return <ListItemView item={value} ordered={value.order != null || value.type != null} index={0} />;
    case "image": case "video": case "audio": return <MediaBlock node={value} />;
    case "map": return <MapBlock lat={value.lat} lon={value.lon} zoom={value.zoom} caption={value.caption} />;
    case "collage": return <CollageView nodes={value.children} caption={value.caption} />;
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

function MediaContent({ node, mode }: { node: Extract<BlockNode, { kind: "image" | "video" | "audio" }>; mode?: "collage" | "slideshow" }) {
  const { mediaRenderer } = React.useContext(TmarkContext);
  const src = safeMediaUrl(node.src, node.kind);
  const [revealed, setRevealed] = React.useState(!("hasSpoiler" in node && node.hasSpoiler));
  if (!src) return null;
  const preview = node.kind === "video" ? safeMediaUrl(node.preview ?? "", "image") : undefined;
  const image = node.kind === "image" ? src : preview;
  const imageStyle = mode ? styles.galleryImage : styles.image;
  const resizeMode = mode === "collage" ? "cover" : "contain";
  if (!revealed) return <Pressable accessibilityRole="button" accessibilityLabel="Reveal media" onPress={() => setRevealed(true)} style={[imageStyle, styles.spoilerFrame]}>
    {image ? <Image source={{ uri: image }} resizeMode={resizeMode} blurRadius={60} style={styles.galleryImage} /> : null}
    <View pointerEvents="none" style={styles.spoilerOverlay}><Text style={styles.spoilerIcon}>👁</Text></View>
  </Pressable>;
  return mediaRenderer?.({ src, kind: node.kind }) ?? (image
    ? <Image source={{ uri: image }} resizeMode={resizeMode} style={imageStyle} />
    : mode ? <View style={styles.galleryFallback}><Text style={styles.galleryFallbackText}>{node.kind === "video" ? "Video" : "Audio"}</Text></View>
      : <Text style={styles.mediaFallback}>{node.kind === "video" ? "Video" : "Audio"}: {src}</Text>);
}

function MapBlock({ lat, lon, zoom, caption }: { lat: number; lon: number; zoom?: number; caption?: Caption }) {
  const { mediaRenderer } = React.useContext(TmarkContext);
  const content = mediaRenderer?.({ src: `${lat},${lon}`, kind: "map", lat, lon, zoom });
  return <View style={styles.block}>{content ?? <Text style={styles.mediaFallback}>Map: {lat}, {lon}</Text>}<CaptionView caption={caption} /></View>;
}

function SlideshowView({ nodes = [], caption }: { nodes?: SlideshowNode[]; caption?: Caption }) {
  const pager = React.useRef<ScrollViewInstance>(null);
  const [width, setWidth] = React.useState(0);
  const [index, setIndex] = React.useState(0);
  React.useEffect(() => {
    const next = Math.min(index, Math.max(0, nodes.length - 1));
    if (next !== index) setIndex(next);
    if (width) pager.current?.scrollTo({ x: next * width, animated: false });
  }, [nodes.length, width]);
  if (!nodes.length) return null;
  const move = (delta: number) => {
    const next = (index + delta + nodes.length) % nodes.length;
    setIndex(next);
    pager.current?.scrollTo({ x: next * width, animated: true });
  };
  return <View style={styles.block}>
    <View style={styles.slideshow} onLayout={event => setWidth(event.nativeEvent.layout.width)}>
      <ScrollView ref={pager} horizontal pagingEnabled showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={event => width && setIndex(Math.max(0, Math.min(nodes.length - 1, Math.round(event.nativeEvent.contentOffset.x / width))))}>
        {nodes.map((node, slide) => <View key={`${node.src}-${slide}`} style={{ width, height: "100%" }}><MediaContent node={node} mode="slideshow" /></View>)}
      </ScrollView>
      {nodes.length > 1 && <>
        <Pressable accessibilityRole="button" accessibilityLabel="Previous slide" onPress={() => move(-1)} style={[styles.slideshowButton, styles.slideshowPrevious]}><View style={[styles.slideshowChevron, styles.slideshowChevronLeft]} /></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Next slide" onPress={() => move(1)} style={[styles.slideshowButton, styles.slideshowNext]}><View style={[styles.slideshowChevron, styles.slideshowChevronRight]} /></Pressable>
        <Text style={styles.slideshowCounter}>{index + 1} / {nodes.length}</Text>
      </>}
    </View>
    <CaptionView caption={caption} />
  </View>;
}

type CollageTile = { x: number; y: number; width: number; height: number };

function CollageView({ nodes, caption }: { nodes?: SlideshowNode[]; caption?: Caption }) {
  const children = nodes ?? [];
  const [width, setWidth] = React.useState(0);
  const [resolvedRatios, setResolvedRatios] = React.useState<Record<string, number>>({});

  React.useEffect(() => {
    let active = true;
    setResolvedRatios({});
    for (const node of nodes ?? []) {
      const src = node.kind === "image" ? node.src : node.preview;
      const url = src && safeMediaUrl(src, "image");
      if (!url) continue;
      Image.getSize(url, (imageWidth, imageHeight) => {
        if (active && imageWidth > 0 && imageHeight > 0) {
          setResolvedRatios(current => ({ ...current, [src]: Math.min(5, Math.max(0.2, imageWidth / imageHeight)) }));
        }
      }, () => {});
    }
    return () => { active = false; };
  }, [nodes]);

  const ratios = children.map((node, index) => {
    const src = node.kind === "image" ? node.src : node.preview;
    return src && resolvedRatios[src] || (children.length === 3 && index === 0 ? 1.6 : children.length === 4 && index === 0 ? 1.4 : children.length > 4 && node.kind === "video" ? 16 / 9 : 1);
  });
  const tiles = width > 0 ? groupedMediaTiles(ratios, width, Math.min(96, width / 3), 2) : [];
  const height = tiles.reduce((max, tile) => Math.max(max, tile.y + tile.height), 0);

  return <View style={styles.block}><View onLayout={event => setWidth(event.nativeEvent.layout.width)} style={{ height }}>
    {width > 0 && children.map((node, index) => <View key={`${node.src}-${index}`} style={[styles.collageItem, { left: tiles[index].x, top: tiles[index].y, width: tiles[index].width, height: tiles[index].height }]}><MediaContent node={node} mode="collage" /></View>)}
  </View><CaptionView caption={caption} /></View>;
}

function groupedMediaTiles(ratios: number[], maxWidth: number, minWidth: number, spacing: number): CollageTile[] {
  const count = ratios.length;
  if (!count) return [];
  const maxHeight = maxWidth;
  const averageRatio = ratios.reduce((sum, ratio) => sum + ratio, 1) / count;
  const proportions = ratios.map(ratio => ratio > 1.2 ? "w" : ratio < 0.8 ? "n" : "q").join("");
  const tile = (x: number, y: number, width: number, height: number): CollageTile => ({ x, y, width, height });

  if (count === 1) return [tile(0, 0, maxWidth, maxWidth / ratios[0])];
  if (count === 2) {
    if (proportions === "ww" && averageRatio > 1.4 && Math.abs(ratios[1] - ratios[0]) < 0.2) {
      const height = Math.min(maxWidth / ratios[0], maxWidth / ratios[1], (maxHeight - spacing) / 2);
      return [tile(0, 0, maxWidth, height), tile(0, height + spacing, maxWidth, height)];
    }
    if (proportions === "ww" || proportions === "qq") {
      const width = (maxWidth - spacing) / 2;
      const height = Math.min(width / ratios[0], width / ratios[1], maxHeight);
      return [tile(0, 0, width, height), tile(width + spacing, 0, width, height)];
    }
    const secondWidth = Math.min(Math.max(0.4 * (maxWidth - spacing), (maxWidth - spacing) / ratios[0] / (1 / ratios[0] + 1 / ratios[1])), maxWidth - spacing - minWidth * 1.5);
    const firstWidth = maxWidth - secondWidth - spacing;
    const height = Math.min(maxHeight, firstWidth / ratios[0], secondWidth / ratios[1]);
    return [tile(0, 0, firstWidth, height), tile(firstWidth + spacing, 0, secondWidth, height)];
  }
  if (count === 3) {
    if (proportions[0] === "n") {
      const firstHeight = maxHeight;
      const thirdHeight = Math.min((maxHeight - spacing) / 2, ratios[1] * (maxWidth - spacing) / (ratios[2] + ratios[1]));
      const secondHeight = firstHeight - thirdHeight - spacing;
      const rightWidth = Math.max(minWidth, Math.min((maxWidth - spacing) / 2, thirdHeight * ratios[2], secondHeight * ratios[1]));
      const leftWidth = Math.min(firstHeight * ratios[0], maxWidth - spacing - rightWidth);
      return [tile(0, 0, leftWidth, firstHeight), tile(leftWidth + spacing, 0, rightWidth, secondHeight), tile(leftWidth + spacing, secondHeight + spacing, rightWidth, thirdHeight)];
    }
    const firstHeight = Math.min(maxWidth / ratios[0], (maxHeight - spacing) * 0.66);
    const secondWidth = (maxWidth - spacing) / 2;
    const secondHeight = Math.min(maxHeight - firstHeight - spacing, secondWidth / ratios[1], secondWidth / ratios[2]);
    return [tile(0, 0, maxWidth, firstHeight), tile(0, firstHeight + spacing, secondWidth, secondHeight), tile(secondWidth + spacing, firstHeight + spacing, maxWidth - secondWidth - spacing, secondHeight)];
  }
  if (count === 4) {
    if (proportions[0] === "w") {
      const firstHeight = Math.min(maxWidth / ratios[0], (maxHeight - spacing) * 0.66);
      const height = (maxWidth - 2 * spacing) / (ratios[1] + ratios[2] + ratios[3]);
      const firstWidth = Math.max(minWidth, Math.min((maxWidth - 2 * spacing) * 0.4, height * ratios[1]));
      const thirdWidth = Math.max(minWidth, (maxWidth - 2 * spacing) * 0.33, height * ratios[3]);
      const secondWidth = maxWidth - firstWidth - thirdWidth - 2 * spacing;
      const rowHeight = Math.min(maxHeight - firstHeight - spacing, height);
      return [tile(0, 0, maxWidth, firstHeight), tile(0, firstHeight + spacing, firstWidth, rowHeight), tile(firstWidth + spacing, firstHeight + spacing, secondWidth, rowHeight), tile(firstWidth + secondWidth + 2 * spacing, firstHeight + spacing, thirdWidth, rowHeight)];
    }
    const leftWidth = Math.min(maxHeight * ratios[0], (maxWidth - spacing) * 0.6);
    const width = (maxHeight - 2 * spacing) / (1 / ratios[1] + 1 / ratios[2] + 1 / ratios[3]);
    const firstHeight = width / ratios[1];
    const secondHeight = width / ratios[2];
    const thirdHeight = maxHeight - firstHeight - secondHeight - 2 * spacing;
    const rightWidth = Math.max(minWidth, Math.min(maxWidth - leftWidth - spacing, width));
    return [tile(0, 0, leftWidth, maxHeight), tile(leftWidth + spacing, 0, rightWidth, firstHeight), tile(leftWidth + spacing, firstHeight + spacing, rightWidth, secondHeight), tile(leftWidth + spacing, firstHeight + secondHeight + 2 * spacing, rightWidth, thirdHeight)];
  }

  const cropped = ratios.map(ratio => averageRatio > 1.1 ? Math.min(2.75, Math.max(1, ratio)) : Math.min(1, Math.max(0.6667, ratio)));
  const attempts: { counts: number[]; heights: number[] }[] = [];
  const push = (counts: number[]) => {
    let offset = 0;
    const heights = counts.map(columns => {
      const sum = cropped.slice(offset, offset + columns).reduce((total, ratio) => total + ratio, 0);
      offset += columns;
      return (maxWidth - (columns - 1) * spacing) / sum;
    });
    attempts.push({ counts, heights });
  };
  for (let first = 1; first < count; first++) {
    const second = count - first;
    if (first <= 3 && second <= 3) push([first, second]);
  }
  for (let first = 1; first < count - 1; first++) for (let second = 1; second < count - first; second++) {
    const third = count - first - second;
    if (first <= 3 && second <= (averageRatio < 0.85 ? 4 : 3) && third <= 3) push([first, second, third]);
  }
  for (let first = 1; first < count - 2; first++) for (let second = 1; second < count - first - 1; second++) for (let third = 1; third < count - first - second; third++) {
    const fourth = count - first - second - third;
    if (first <= 3 && second <= 3 && third <= 3 && fourth <= 3) push([first, second, third, fourth]);
  }
  if (!attempts.length) {
    const counts: number[] = [];
    for (let remaining = count; remaining > 0; remaining -= 3) counts.push(Math.min(3, remaining));
    push(counts);
  }
  const score = (attempt: typeof attempts[number]) => {
    const totalHeight = attempt.heights.reduce((sum, height) => sum + height, spacing * (attempt.counts.length - 1));
    const badHeight = Math.min(...attempt.heights) < minWidth ? 1.5 : 1;
    const badOrder = attempt.counts.some((columns, index) => index > 0 && attempt.counts[index - 1] > columns) ? 1.5 : 1;
    return Math.abs(totalHeight - maxWidth * 4 / 3) * badHeight * badOrder;
  };
  const best = attempts.reduce((best, attempt) => score(attempt) < score(best) ? attempt : best);
  const result: CollageTile[] = [];
  let index = 0, y = 0;
  for (let row = 0; row < best.counts.length; row++) {
    const columns = best.counts[row], rowHeight = best.heights[row];
    let x = 0;
    for (let column = 0; column < columns; column++) {
      const width = column === columns - 1 ? maxWidth - x : cropped[index] * rowHeight;
      result.push(tile(x, y, width, rowHeight));
      x += width + spacing;
      index++;
    }
    y += rowHeight + spacing;
  }
  return result;
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
  inlineCode: { fontFamily: "monospace", backgroundColor: "#f2f2f2" }, copiedCode: { backgroundColor: "#d8f1dd" }, link: { color: "#2563eb", textDecorationLine: "underline" },
  block: { marginBottom: 12 }, divider: { height: 1, backgroundColor: "#bbb", marginVertical: 14 },
  quote: { borderLeftWidth: 3, borderLeftColor: "#999", paddingLeft: 12, marginBottom: 12 },
  pullQuoteBlock: { backgroundColor: "#eef4ff", borderRadius: 8, padding: 16, marginBottom: 12 },
  pullQuote: { color: "#183b5d", fontSize: 20, textAlign: "center" }, codeBlock: { backgroundColor: "#f2f2f2", marginBottom: 12 },
  codeBlockContent: { padding: 12, paddingRight: 52 },
  copyButton: { position: "absolute", top: 6, right: 6, width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  copyIcon: { width: 22, height: 22 },
  copyIconBack: { position: "absolute", top: 2, left: 2, width: 14, height: 14, borderWidth: 2, borderColor: "#5c6773", borderRadius: 2 },
  copyIconFront: { position: "absolute", top: 6, left: 6, width: 14, height: 14, borderWidth: 2, borderColor: "#5c6773", borderRadius: 2, backgroundColor: "#f2f2f2" },
  copyCheck: { color: "#2f7d46", fontSize: 24 },
  monospace: { fontFamily: "monospace", fontSize: 14 }, listItem: { flexDirection: "row", marginBottom: 3 },
  marker: { width: 28, textAlign: "right", marginRight: 8, fontSize: 16 }, listBody: { flex: 1 },
  image: { width: "100%", height: 220 }, mediaFallback: { padding: 16, backgroundColor: "#eee" },
  spoilerFrame: { overflow: "hidden" },
  spoilerOverlay: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, alignItems: "center", justifyContent: "center" },
  spoilerIcon: { width: 44, height: 44, lineHeight: 44, textAlign: "center", color: "#fff", fontSize: 24, backgroundColor: "#0009", borderRadius: 22, overflow: "hidden" },
  caption: { textAlign: "center", color: "#555", marginTop: 5 }, credit: { textAlign: "center", color: "#777", fontSize: 12 },
  collageItem: { position: "absolute", overflow: "hidden", backgroundColor: "#eee" }, galleryImage: { width: "100%", height: "100%" },
  galleryFallback: { width: "100%", height: "100%", alignItems: "center", justifyContent: "center", backgroundColor: "#263445" },
  galleryFallbackText: { color: "#fff", fontSize: 16 },
  slideshow: { width: "100%", aspectRatio: 16 / 9, overflow: "hidden", borderRadius: 10, backgroundColor: "#111827" },
  slideshowButton: { position: "absolute", top: "50%", marginTop: -20, width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: "#0009" },
  slideshowPrevious: { left: 12 }, slideshowNext: { right: 12 },
  slideshowChevron: { width: 10, height: 10, borderRightWidth: 2, borderBottomWidth: 2, borderColor: "#fff" },
  slideshowChevronLeft: { transform: [{ rotate: "135deg" }], marginLeft: 4 }, slideshowChevronRight: { transform: [{ rotate: "-45deg" }], marginRight: 4 },
  slideshowCounter: { position: "absolute", bottom: 12, alignSelf: "center", overflow: "hidden", borderRadius: 12, backgroundColor: "#0009", color: "#fff", fontSize: 12, paddingHorizontal: 10, paddingVertical: 5 },
  tableRow: { flexDirection: "row" }, stripedRow: { backgroundColor: "#f5f5f5" },
  cell: { minWidth: 100, flex: 1, padding: 8 }, cellBorder: { borderWidth: 1, borderColor: "#ccc" }, cellHeader: { backgroundColor: "#eee" },
  detailsBody: { marginTop: 8, paddingLeft: 16 },
});
