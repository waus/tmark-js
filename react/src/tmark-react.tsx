import React from "react";
import type {
  BlockNode,
  Caption,
  Cell,
  ListItem,
  RichNode,
  SlideshowNode,
  TmarkNode,
} from "@tmark/tmark";

type MathRenderer = {
  render: (expression: string, inline: boolean) => string;
};

let mathRendererPromise: Promise<MathRenderer> | undefined;

function loadMathRenderer() {
  mathRendererPromise ??= Promise.all([
    import("mathjax-full/js/adaptors/liteAdaptor.js"),
    import("mathjax-full/js/handlers/html.js"),
    import("mathjax-full/js/input/tex.js"),
    import("mathjax-full/js/input/tex/ams/AmsConfiguration.js"),
    import("mathjax-full/js/input/tex/newcommand/NewcommandConfiguration.js"),
    import("mathjax-full/js/input/tex/noundefined/NoUndefinedConfiguration.js"),
    import("mathjax-full/js/mathjax.js"),
    import("mathjax-full/js/output/svg.js"),
  ]).then(([adaptorModule, htmlModule, texModule, , , , mathjaxModule, svgModule]) => {
    const adaptorApi = moduleApi(adaptorModule);
    const htmlApi = moduleApi(htmlModule);
    const texApi = moduleApi(texModule);
    const mathjaxApi = moduleApi(mathjaxModule);
    const svgApi = moduleApi(svgModule);
    const adaptor = adaptorApi.liteAdaptor();
    htmlApi.RegisterHTMLHandler(adaptor);
    const document = mathjaxApi.mathjax.document("", {
      InputJax: new texApi.TeX({ packages: ["base", "ams", "newcommand", "noundefined"] }),
      OutputJax: new svgApi.SVG({ fontCache: "local" }),
    });

    return {
      render: (expression, inline) => adaptor.outerHTML(document.convert(expression, { display: !inline })),
    };
  });

  return mathRendererPromise;
}

export type TmarkMediaRenderer = (props: {
  src: string;
  kind: "image" | "video" | "audio" | "map";
  lat?: number;
  lon?: number;
  zoom?: number;
}) => React.ReactNode;

export type TmarkNodeRenderer = (node: TmarkNode, renderDefault: () => React.ReactNode) => React.ReactNode;

const NodeRendererContext = React.createContext<TmarkNodeRenderer | undefined>(undefined);

export interface TmarkViewProps {
  value: TmarkNode;
  mediaRenderer?: TmarkMediaRenderer;
  renderNode?: TmarkNodeRenderer;
  className?: string;
}

export function TmarkView({ value, mediaRenderer, renderNode, className }: TmarkViewProps) {
  return <NodeRendererContext.Provider value={renderNode}>
    <TmarkContent value={value} mediaRenderer={mediaRenderer} className={className} />
  </NodeRendererContext.Provider>;
}

function TmarkContent({ value, mediaRenderer, className }: Omit<TmarkViewProps, "renderNode">) {
  if (value.kind === "document" || value.kind === "attachedMedia") {
    return <div className={className}><Blocks nodes={value.content} mediaRenderer={mediaRenderer} /></div>;
  }
  if (isRichNode(value)) {
    return <span className={className}><RichNodeView node={value} /></span>;
  }
  return <BlockView value={value as BlockNode} mediaRenderer={mediaRenderer} />;
}

export function RichTextView({ nodes }: { nodes?: RichNode[] }) {
  return <>{nodes?.map((node, index) => <RichNodeView key={index} node={node} />)}</>;
}

function RichNodeView({ node }: { node: RichNode }) {
  const renderNode = React.useContext(NodeRendererContext);
  return renderNode ? <>{renderNode(node, () => defaultRichNode(node))}</> : defaultRichNode(node);
}

function defaultRichNode(node: RichNode) {
  switch (node.kind) {
    case "text": return <>{textWithLineBreaks(node.text)}</>;
    case "link": return <a href={safeUrl(node.href)}><RichTextView nodes={node.children} /></a>;
    case "anchorLink": return <a href={fragmentHref(node.anchorName)}><RichTextView nodes={node.children} /></a>;
    case "reference": return <span data-tmark-reference={node.name}><RichTextView nodes={node.children} /></span>;
    case "referenceLink": return <a href={fragmentHref(node.referenceName)}><RichTextView nodes={node.children} /></a>;
    case "bold": return <strong><RichTextView nodes={node.children} /></strong>;
    case "italic": return <em><RichTextView nodes={node.children} /></em>;
    case "marked": return <mark><RichTextView nodes={node.children} /></mark>;
    case "underline": return <u><RichTextView nodes={node.children} /></u>;
    case "strikethrough": return <s><RichTextView nodes={node.children} /></s>;
    case "spoiler": return <InlineSpoiler><RichTextView nodes={node.children} /></InlineSpoiler>;
    case "subscript": return <sub><RichTextView nodes={node.children} /></sub>;
    case "superscript": return <sup><RichTextView nodes={node.children} /></sup>;
    case "datetime": return <DateTimeView unix={node.unix} timezone={node.timezone} />;
    case "code": return <code>{node.text}</code>;
    case "math": return <MathView expression={node.expression} inline />;
    case "icon": return <InlineIcon src={node.src} alternativeText={node.alternativeText} />;
    case "unknown": return <span data-tmark-unknown>{node.raw}</span>;
  }
}

function InlineSpoiler({ children }: { children: React.ReactNode }) {
  const [revealed, setRevealed] = React.useState(false);

  if (revealed) return <>{children}</>;

  return <span
    className="tmark-spoiler"
    role="button"
    tabIndex={0}
    aria-label="Reveal spoiler"
    onClick={() => setRevealed(true)}
    onFocusCapture={(event) => {
      if (event.target !== event.currentTarget) setRevealed(true);
    }}
    onKeyDown={(event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        setRevealed(true);
      }
    }}
  ><span className="tmark-spoiler-content" aria-hidden="true">{children}</span></span>;
}

export function BlockView({ value, mediaRenderer }: { value: BlockNode | TmarkNode; mediaRenderer?: TmarkMediaRenderer }) {
  const renderNode = React.useContext(NodeRendererContext);
  return renderNode ? <>{renderNode(value, () => defaultBlockView(value, mediaRenderer))}</> : defaultBlockView(value, mediaRenderer);
}

function defaultBlockView(value: BlockNode | TmarkNode, mediaRenderer?: TmarkMediaRenderer) {
  switch (value.kind) {
    case "paragraph": return <p><RichTextView nodes={value.children} /></p>;
    case "header": return header(value.size, <RichTextView nodes={value.children} />);
    case "preformatted": return <CodeBlock text={value.text} language={value.language} />;
    case "mathBlock": return <MathView expression={value.expression} />;
    case "anchor": return <span id={value.name} />;
    case "divider": return <hr />;
    case "blockquote":
      return <blockquote className="tmark-blockquote"><Blocks nodes={value.blocks} mediaRenderer={mediaRenderer} />{captionRich(value.credit)}</blockquote>;
    case "pullQuote":
      return <aside className="tmark-pull-quote"><p><RichTextView nodes={value.text} /></p>{captionRich(value.credit)}</aside>;
    case "collage":
      return <CollageView nodes={value.children} caption={value.caption} mediaRenderer={mediaRenderer} />;
    case "list":
      return <ListView items={value.items} mediaRenderer={mediaRenderer} />;
    case "listItem":
      return <ListItemView item={value} ordered={value.order != null || value.type != null} index={0} mediaRenderer={mediaRenderer} />;
    case "map":
      return (
        <figure>
          {mediaRenderer?.({ src: `${value.lat},${value.lon}`, kind: "map", lat: value.lat, lon: value.lon, zoom: value.zoom }) ?? <LeafletMapView lat={value.lat} lon={value.lon} zoom={value.zoom ?? 12} />}
          {value.caption && <CaptionView caption={value.caption} />}
        </figure>
      );
    case "image": return <MediaBlock node={value} kind="image" mediaRenderer={mediaRenderer} />;
    case "video": return <MediaBlock node={value} kind="video" mediaRenderer={mediaRenderer} />;
    case "audio": return <MediaBlock node={value} kind="audio" mediaRenderer={mediaRenderer} />;
    case "slideshow":
      return <SlideshowView nodes={value.children} caption={value.caption} mediaRenderer={mediaRenderer} />;
    case "table":
      return (
        <figure>
          <table className={[value.bordered && "tmark-bordered", value.striped && "tmark-striped"].filter(Boolean).join(" ") || undefined}>
            <tbody>{value.rows?.map((row, r) => <tr key={r}>{row.cells?.map((cell, c) => <CellView key={c} cell={cell} />)}</tr>)}</tbody>
          </table>
          {!!value.caption?.length && <figcaption><RichTextView nodes={value.caption} /></figcaption>}
        </figure>
      );
    case "cell": return <CellView cell={value} />;
    case "details":
      return <details className="tmark-details" open={value.isOpen}>
        <summary><span><RichTextView nodes={value.summary} /></span></summary>
        <div className="tmark-details-content"><Blocks nodes={value.children} mediaRenderer={mediaRenderer} /></div>
      </details>;
    case "unknown": return <pre data-tmark-unknown>{value.raw}</pre>;
    default: return null;
  }
}

function Blocks({ nodes, mediaRenderer }: { nodes?: BlockNode[]; mediaRenderer?: TmarkMediaRenderer }) {
  return <>{nodes?.map((node, index) => <BlockView key={index} value={node} mediaRenderer={mediaRenderer} />)}</>;
}

function CodeBlock({ text, language }: { text: string; language?: string }) {
  return (
    <div className="tmark-code-block">
      <pre>
        <code data-language={language}>{text}</code>
        <CopyButton text={text} className="tmark-code-block-copy" />
      </pre>
    </div>
  );
}

function CopyButton({ text, className }: { text: string; className?: string }) {
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    if (!copied) return undefined;
    const timer = window.setTimeout(() => setCopied(false), 1200);
    return () => window.clearTimeout(timer);
  }, [copied]);

  return (
    <button
      className={["tmark-copy-button", className].filter(Boolean).join(" ")}
      type="button"
      aria-label={copied ? "Copied" : "Copy"}
      title={copied ? "Copied" : "Copy"}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        void copyText(text).then(() => setCopied(true));
      }}
    >
      {copied ? <CheckIcon /> : <CopyIcon />}
    </button>
  );
}

function CopyIcon() {
  return (
    <svg className="tmark-copy-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <rect x="9" y="9" width="10" height="10" rx="2" />
      <path d="M5 15V7a2 2 0 0 1 2-2h8" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg className="tmark-copy-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="m5 12 4 4L19 6" />
    </svg>
  );
}

function ListView({ items = [], mediaRenderer }: { items?: ListItem[]; mediaRenderer?: TmarkMediaRenderer }) {
  const ordered = items.some((item) => item.order != null || item.type != null);
  return (
    <div className="tmark-list" role="list">
      {items.map((item, index) => <ListItemView key={index} item={item} ordered={ordered} index={index} mediaRenderer={mediaRenderer} />)}
    </div>
  );
}

function ListItemView({ item, ordered, index, mediaRenderer }: { item: ListItem; ordered: boolean; index: number; mediaRenderer?: TmarkMediaRenderer }) {
  const marker = item.checked == null
    ? listItemMarker(item, ordered, index)
    : <input type="checkbox" checked={item.checked} readOnly aria-label={item.checked ? "checked" : "unchecked"} />;

  return (
    <div className="tmark-list-item" role="listitem">
      <span className="tmark-list-marker" aria-hidden={item.checked == null ? true : undefined}>{marker}</span>
      <div className="tmark-list-content"><Blocks nodes={item.children} mediaRenderer={mediaRenderer} /></div>
    </div>
  );
}

function MediaBlock({ node, kind, mediaRenderer }: { node: { src: string; caption?: Caption; hasSpoiler?: boolean }; kind: "image" | "video" | "audio"; mediaRenderer?: TmarkMediaRenderer }) {
  const src = safeMediaUrl(node.src, kind);

  return (
    <figure>
      {src && <MediaContent src={src} kind={kind} hasSpoiler={node.hasSpoiler} mediaRenderer={mediaRenderer} />}
      {node.caption && <CaptionView caption={node.caption} />}
    </figure>
  );
}

function CollageView({ nodes, caption, mediaRenderer }: { nodes?: SlideshowNode[]; caption?: Caption; mediaRenderer?: TmarkMediaRenderer }) {
  return (
    <figure>
      <div className="tmark-collage">
        {nodes?.map((node, index) => (
          <div className="tmark-collage-item" key={index}>
            <GalleryNodeView node={node} mediaRenderer={mediaRenderer} />
          </div>
        ))}
      </div>
      {caption && <CaptionView caption={caption} />}
    </figure>
  );
}

function SlideshowView({ nodes = [], caption, mediaRenderer }: { nodes?: SlideshowNode[]; caption?: Caption; mediaRenderer?: TmarkMediaRenderer }) {
  const [index, setIndex] = React.useState(0);
  const count = nodes.length;

  React.useEffect(() => {
    setIndex((current) => count ? Math.min(current, count - 1) : 0);
  }, [count]);

  if (!count) return null;

  const canPage = count > 1;
  const move = (delta: number) => setIndex((current) => (current + delta + count) % count);

  return (
    <figure>
      <div className="tmark-slideshow">
        <div className="tmark-slideshow-slide">
          <GalleryNodeView node={nodes[index]} mediaRenderer={mediaRenderer} />
        </div>
        {canPage && (
          <>
            <button className="tmark-slideshow-button tmark-slideshow-button-prev" type="button" aria-label="Previous slide" onClick={() => move(-1)}><ChevronIcon direction="prev" /></button>
            <button className="tmark-slideshow-button tmark-slideshow-button-next" type="button" aria-label="Next slide" onClick={() => move(1)}><ChevronIcon direction="next" /></button>
            <div className="tmark-slideshow-counter">{index + 1} / {count}</div>
          </>
        )}
      </div>
      {caption && <CaptionView caption={caption} />}
    </figure>
  );
}

function GalleryNodeView({ node, mediaRenderer }: { node: SlideshowNode; mediaRenderer?: TmarkMediaRenderer }) {
  return <MediaContent src={safeMediaUrl(node.src, node.kind)} kind={node.kind} hasSpoiler={node.hasSpoiler} mediaRenderer={mediaRenderer} />;
}

function ChevronIcon({ direction }: { direction: "prev" | "next" }) {
  return (
    <svg className="tmark-slideshow-chevron" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d={direction === "prev" ? "M15 5 8 12l7 7" : "m9 5 7 7-7 7"} />
    </svg>
  );
}

function MediaContent({ src, kind, hasSpoiler, mediaRenderer }: { src?: string; kind: "image" | "video" | "audio"; hasSpoiler?: boolean; mediaRenderer?: TmarkMediaRenderer }) {
  if (!src) return null;
  const content = mediaRenderer?.({ src, kind }) ?? defaultMedia({ src }, kind);
  return hasSpoiler ? <SpoilerMedia>{content}</SpoilerMedia> : content;
}

function defaultMedia(node: { src: string }, kind: "image" | "video" | "audio") {
  if (kind === "image") return <img src={node.src} alt="" />;
  if (kind === "video") return <video src={node.src} controls />;
  return <audio src={node.src} controls />;
}

function SpoilerMedia({ children }: { children: React.ReactNode }) {
  const [revealed, setRevealed] = React.useState(false);

  if (revealed) return <>{children}</>;

  return (
    <div
      className="tmark-media-spoiler"
      role="button"
      tabIndex={0}
      aria-label="Reveal media"
      onClick={() => setRevealed(true)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          setRevealed(true);
        }
      }}
    >
      <div className="tmark-media-spoiler-content">{children}</div>
    </div>
  );
}

function CellView({ cell }: { cell: Cell }) {
  const Tag = cell.isHeader ? "th" : "td";
  return (
    <Tag colSpan={cell.colspan} rowSpan={cell.rowspan} style={{ textAlign: cell.align, verticalAlign: cell.valign }}>
      <RichTextView nodes={cell.children} />
    </Tag>
  );
}

function CaptionView({ caption }: { caption: Caption }) {
  return (
    <figcaption>
      <RichTextView nodes={caption.text} />
      {!!caption.credit?.length && <small><RichTextView nodes={caption.credit} /></small>}
    </figcaption>
  );
}

function InlineIcon({ src, alternativeText }: { src: string; alternativeText?: string }) {
  const safeSrc = safeMediaUrl(src, "image");
  if (!safeSrc) return <span role="img" aria-label={alternativeText}>{alternativeText ?? ""}</span>;
  return <img className="tmark-inline-icon" src={safeSrc} alt={alternativeText ?? ""} />;
}

function MathView({ expression, inline = false }: { expression: string; inline?: boolean }) {
  const [html, setHtml] = React.useState<string>();

  React.useEffect(() => {
    let disposed = false;

    setHtml(undefined);
    void loadMathRenderer().then((renderer) => {
      if (disposed) return;
      try {
        setHtml(renderer.render(expression, inline));
      } catch {
        setHtml("");
      }
    });

    return () => {
      disposed = true;
    };
  }, [expression, inline]);

  const Tag = inline ? "span" : "div";
  if (!html) {
    return inline
      ? <code className="tmark-math">{expression}</code>
      : <pre className="tmark-math-block">{expression}</pre>;
  }

  return <Tag className={inline ? "tmark-math" : "tmark-math-block"} dangerouslySetInnerHTML={{ __html: html }} />;
}

function LeafletMapView({ lat, lon, zoom }: { lat: number; lon: number; zoom: number }) {
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    let disposed = false;
    let map: { remove: () => void } | undefined;

    void import("leaflet").then((leaflet) => {
      if (disposed || !containerRef.current) return;
      const leafletApi = moduleApi(leaflet);

      map = leafletApi.map(container, {
        attributionControl: true,
        scrollWheelZoom: false,
      }).setView([lat, lon], zoom);

      leafletApi.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap contributors",
        maxZoom: 19,
      }).addTo(map);

      leafletApi.circleMarker([lat, lon], {
        radius: 7,
        weight: 2,
        color: "#2563eb",
        fillColor: "#2563eb",
        fillOpacity: 0.8,
      }).addTo(map);
    });

    return () => {
      disposed = true;
      map?.remove();
    };
  }, [lat, lon, zoom]);

  return <div className="tmark-map" ref={containerRef} role="img" aria-label={`Map at ${lat}, ${lon}`} />;
}

function DateTimeView({ unix, timezone }: { unix: number; timezone: string }) {
  const date = new Date(unix * 1000);
  const local = Number.isFinite(date.getTime()) ? date.toLocaleString() : String(unix);
  let source = "";
  try {
    source = Number.isFinite(date.getTime())
      ? date.toLocaleString(undefined, { timeZone: timezone })
      : "";
  } catch {
    source = "";
  }

  return <time dateTime={Number.isFinite(date.getTime()) ? date.toISOString() : String(unix)} title={[source, timezone].filter(Boolean).join(" ")}>{local}</time>;
}

function listItemMarker(item: ListItem, ordered: boolean, index: number) {
  const order = item.order ?? (ordered ? index + 1 : undefined);
  if (order == null) return "\u2022";

  switch (item.type) {
    case "a": return `${alphabeticOrder(order).toLowerCase()}.`;
    case "A": return `${alphabeticOrder(order)}.`;
    case "i": return `${romanOrder(order).toLowerCase()}.`;
    case "I": return `${romanOrder(order)}.`;
    case "1":
    default: return `${order}.`;
  }
}

function alphabeticOrder(value: number) {
  if (value <= 0) return String(value);

  let out = "";
  let n = value;
  while (n > 0) {
    n--;
    out = String.fromCharCode(65 + (n % 26)) + out;
    n = Math.floor(n / 26);
  }
  return out;
}

function romanOrder(value: number) {
  if (value <= 0 || value > 3999) return String(value);

  const numerals: Array<[number, string]> = [
    [1000, "M"], [900, "CM"], [500, "D"], [400, "CD"],
    [100, "C"], [90, "XC"], [50, "L"], [40, "XL"],
    [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"],
  ];

  let out = "";
  let n = value;
  for (const [number, numeral] of numerals) {
    while (n >= number) {
      out += numeral;
      n -= number;
    }
  }
  return out;
}

function captionRich(nodes?: RichNode[]) {
  return nodes?.length ? <cite><RichTextView nodes={nodes} /></cite> : null;
}

function header(size: number, children: React.ReactNode) {
  const level = Math.min(6, Math.max(1, size || 4));
  const Tag = `h${level}` as keyof JSX.IntrinsicElements;
  return <Tag>{children}</Tag>;
}

function textWithLineBreaks(text: string) {
  if (!text.includes("\n")) return text;

  return text.split("\n").map((part, index) => (
    <React.Fragment key={index}>
      {index > 0 && <br />}
      {part}
    </React.Fragment>
  ));
}

function fragmentHref(value: string) {
  return `#${encodeURIComponent(value)}`;
}

function safeUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed || /[\u0000-\u001f\u007f]/.test(trimmed)) return undefined;

  try {
    const base = "https://tmark.invalid";
    const parsed = new URL(trimmed, base);
    const hasProtocol = /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(trimmed);

    if (!hasProtocol && parsed.origin === base) return trimmed;
    return ["http:", "https:", "mailto:", "tel:"].includes(parsed.protocol) ? trimmed : undefined;
  } catch {
    return undefined;
  }
}

function safeMediaUrl(value: string, kind: "image" | "video" | "audio") {
  const trimmed = value.trim();
  if (!trimmed || /[\u0000-\u001f\u007f]/.test(trimmed)) return undefined;

  try {
    const base = "https://tmark.invalid";
    const parsed = new URL(trimmed, base);
    const hasProtocol = /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(trimmed);

    if (!hasProtocol && parsed.origin === base) return trimmed;
    if (["http:", "https:", "blob:"].includes(parsed.protocol)) return trimmed;
    if (parsed.protocol === "data:" && trimmed.toLowerCase().startsWith(`data:${kind}/`)) return trimmed;
    return undefined;
  } catch {
    return undefined;
  }
}

async function copyText(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.append(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
}

function isRichNode(value: TmarkNode): value is RichNode {
  return [
    "text", "link", "anchorLink", "reference", "referenceLink", "bold", "italic",
    "marked", "underline", "strikethrough", "spoiler", "subscript", "superscript",
    "datetime", "code", "math", "icon", "unknown",
  ].includes(value.kind);
}

function moduleApi(module: unknown): any {
  return (module as any).default ?? module;
}
