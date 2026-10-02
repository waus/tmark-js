import {
  maxDepth,
  type AttachedMedia,
  type BlockNode,
  type Caption,
  type CaptionNode,
  type Cell,
  type Document,
  type ListItem,
  type RichBlocks,
  type RichNode,
  type RichText,
  type SlideshowNode,
  type TableRow,
  type TableCellAlign,
  type TableCellValign,
  type TmarkNode,
} from "./types.js";

export function marshal(value: TmarkNode): string {
  return new Writer().value(value);
}

export function unmarshal(data: string, options: { soft?: boolean } = {}): TmarkNode {
  return new Decoder(new Parser(data).parse(), Boolean(options.soft)).singleValue();
}

export function unmarshalDocument(data: string, options: { soft?: boolean } = {}): Document {
  const value = unmarshal(data, options);
  if (value.kind !== "document") throw new Error("tmark: expected document node");
  return value;
}

function esc(s: string): string {
  return s.replace(/[#{\\}]/g, (m) => `\\${m}`);
}

class Writer {
  private depth = 0;

  value(v: unknown, omitTag = false): string {
    if (v == null) return "";
    if (++this.depth > maxDepth) throw new Error(`tmark: max depth ${maxDepth} exceeded`);
    try {
      if (typeof v === "string") return esc(v);
      if (typeof v === "number") return decimal(v);
      if (typeof v === "boolean") return v ? "t" : "f";
      if (Array.isArray(v)) return v.map((x) => this.value(x, omitTag)).join("");
      if (isNode(v)) {
        if (v.kind === "text") return esc(v.text);
        if (v.kind === "unknown") {
          new Parser(v.raw).singleNode();
          return v.raw;
        }
        validateNode(v);
        return `{${omitTag ? "" : `${tag(v)};`}${this.body(v, expand(v))}}`;
      }
      throw new Error("tmark: unsupported value");
    } finally {
      this.depth--;
    }
  }

  private body(v: TmarkNode, mode: Expand): string {
    const fields: FieldOut[] = [];
    const named = (name: string, value: unknown, omitFalse = false, concrete = false) => {
      if (!empty(value, omitFalse)) fields.push({ name, value, named: true, concrete });
    };
    const unnamed = (value: unknown, concrete = false) => {
      if (!empty(value, false)) fields.push({ name: "", value, named: false, concrete });
    };

    switch (v.kind) {
      case "document":
        named("url", v.url);
        named("title", v.title);
        named("description", v.description);
        named("author_name", v.authorName);
        named("author_url", v.authorUrl);
        named("image_url", v.imageUrl);
        named("attached_media", v.attachedMedia, false, true);
        unnamed(v.content);
        break;
      case "attachedMedia": named("hash", v.hash); unnamed(v.content); break;
      case "caption": named("credit", v.credit); unnamed(v.text); break;
      case "link": named("href", v.href); unnamed(v.children); break;
      case "anchorLink": named("name", v.anchorName); unnamed(v.children); break;
      case "reference": named("name", v.name); unnamed(v.children); break;
      case "referenceLink": named("name", v.referenceName); unnamed(v.children); break;
      case "bold": case "italic": case "marked": case "underline": case "strikethrough": case "spoiler": case "subscript": case "superscript": unnamed(v.children); break;
      case "datetime": named("timezone", v.timezone); unnamed(v.unix); break;
      case "code": unnamed(v.text); break;
      case "math": unnamed(v.expression); break;
      case "icon": named("alt", v.alternativeText); unnamed(v.src); break;
      case "paragraph": unnamed(v.children); break;
      case "header": named("s", v.size); unnamed(v.children); break;
      case "preformatted": named("language", v.language); unnamed(v.text); break;
      case "mathBlock": unnamed(v.expression); break;
      case "anchor": unnamed(v.name); break;
      case "divider": break;
      case "blockquote": named("credit", v.credit); unnamed(v.blocks); break;
      case "pullQuote": named("credit", v.credit); unnamed(v.text); break;
      case "collage": named("caption", v.caption); unnamed(v.children); break;
      case "list": unnamed(v.items, true); break;
      case "listItem": named("type", v.type); named("order", v.order); named("checked", v.checked); unnamed(v.children); break;
      case "map": named("lat", v.lat); named("lon", v.lon); named("zoom", v.zoom); named("caption", v.caption); break;
      case "image": named("caption", v.caption); named("has_spoiler", v.hasSpoiler, true); unnamed(v.src); break;
      case "video": named("caption", v.caption); named("has_spoiler", v.hasSpoiler, true); unnamed(v.src); break;
      case "audio": named("caption", v.caption); unnamed(v.src); break;
      case "slideshow": named("caption", v.caption); unnamed(v.children); break;
      case "table": named("caption", v.caption); named("bordered", v.bordered, true); named("striped", v.striped, true); unnamed(v.rows, true); break;
      case "tableRow": unnamed(v.cells, true); break;
      case "cell": named("header", v.isHeader, true); named("colspan", v.colspan); named("rowspan", v.rowspan); named("align", v.align); named("valign", v.valign); unnamed(v.children); break;
      case "details": named("summary", v.summary); named("open", v.isOpen, true); unnamed(v.children); break;
    }

    const expanded = mode === "always" || (mode === "multiple" && primaryLen(fields) > 1);
    let out = "";
    for (const f of fields) {
      if (f.named) {
        if (expanded) out += "\n";
        out += `#${f.name}{${this.attribute(f.value, f.concrete)}}`;
      } else if (expanded) {
        out += this.expanded(f.value, f.concrete);
      } else {
        out += this.value(f.value, f.concrete);
      }
    }
    return expanded ? `${out}\n` : out;
  }

  private attribute(v: unknown, concrete: boolean): string {
    if (isCaption(v)) return this.caption(v);
    return this.value(v, concrete);
  }

  private caption(c: Caption): string {
    return `${empty(c.credit, false) ? "" : `#credit{${this.value(c.credit)}}`}${this.value(c.text)}`;
  }

  private expanded(v: unknown, concrete: boolean): string {
    if (Array.isArray(v)) {
      return v.map((item) => `\n${this.value(item, concrete)}`).join("");
    }
    return `\n${this.value(v)}`;
  }
}

type FieldOut = { name: string; value: unknown; named: boolean; concrete: boolean };
type Expand = "none" | "always" | "multiple";

function empty(v: unknown, omitFalse: boolean): boolean {
  return v == null || (omitFalse && v === false) || v === "" || (Array.isArray(v) && v.length === 0);
}

function primaryLen(fields: FieldOut[]): number {
  const value = fields.find((f) => !f.named)?.value;
  return Array.isArray(value) ? value.length : empty(value, false) ? 0 : 1;
}

function validateNode(value: TmarkNode): void {
  if (value.kind === "header" && (!Number.isInteger(value.size) || value.size < 1 || value.size > 6)) throw new Error("tmark: header size must be 1..6");
  if (value.kind === "listItem" && value.type !== undefined && !["a", "A", "i", "I", "1", "checkbox"].includes(value.type)) throw new Error("tmark: invalid list item type");
  if (value.kind === "cell") {
    if (value.align !== undefined && !["left", "center", "right"].includes(value.align)) throw new Error("tmark: invalid cell align");
    if (value.valign !== undefined && !["top", "middle", "bottom"].includes(value.valign)) throw new Error("tmark: invalid cell valign");
  }
}

function decimal(n: number): string {
  if (!Number.isFinite(n)) throw new Error("tmark: non-finite number");
  if (n === 0) return "0";
  const text = String(n);
  if (!text.includes("e")) return text;
  const [mantissa, exponent] = text.split("e");
  const negative = mantissa.startsWith("-");
  const unsigned = negative ? mantissa.slice(1) : mantissa;
  const point = (unsigned.indexOf(".") < 0 ? unsigned.length : unsigned.indexOf(".")) + Number(exponent);
  const digits = unsigned.replace(".", "");
  const expanded = point <= 0 ? `0.${"0".repeat(-point)}${digits}`
    : point >= digits.length ? digits + "0".repeat(point - digits.length)
      : `${digits.slice(0, point)}.${digits.slice(point)}`;
  return negative ? `-${expanded}` : expanded;
}

function isNode(v: unknown): v is TmarkNode {
  return typeof v === "object" && v !== null && "kind" in v;
}

function isCaption(v: unknown): v is Caption {
  return typeof v === "object" && v !== null && !Array.isArray(v) && (!("kind" in v) || (v as CaptionNode).kind === "caption");
}

function tag(v: TmarkNode): string {
  switch (v.kind) {
    case "document": return "document";
    case "attachedMedia": return "attached";
    case "caption": return "caption";
    case "link": return "a";
    case "anchorLink": return "anchor-link";
    case "reference": return "ref";
    case "referenceLink": return "ref-link";
    case "bold": return "b";
    case "italic": return "i";
    case "marked": return "m";
    case "underline": return "u";
    case "strikethrough": return "s";
    case "spoiler": return "spoiler";
    case "subscript": return "sub";
    case "superscript": return "sup";
    case "datetime": return "datetime";
    case "code": return "code";
    case "math": return "math";
    case "icon": return "icon";
    case "paragraph": return "p";
    case "header": return "h";
    case "preformatted": return "pre";
    case "mathBlock": return "math-block";
    case "anchor": return "anchor";
    case "divider": return "hr";
    case "blockquote": return "q";
    case "pullQuote": return "as";
    case "collage": return "collage";
    case "list": return "list";
    case "listItem": return "li";
    case "map": return "map";
    case "image": return "img";
    case "video": return "video";
    case "audio": return "audio";
    case "slideshow": return "slideshow";
    case "table": return "table";
    case "tableRow": return "tr";
    case "cell": return "td";
    case "details": return "details";
    default: throw new Error("tmark: missing tag name");
  }
}

function expand(v: TmarkNode): Expand {
  return ["document", "attachedMedia", "preformatted", "mathBlock", "collage", "list", "slideshow", "table"].includes(v.kind)
    ? "always"
    : ["blockquote", "listItem", "details"].includes(v.kind)
      ? "multiple"
      : "none";
}

type Part = TextPart | NodePart | FieldPart;
type TextPart = { type: "text"; text: string };
type NodePart = { type: "node"; node: ParsedNode };
type FieldPart = { type: "field"; field: ParsedField };
type ParsedNode = { tag: string; body: Part[]; raw: string };
type ParsedField = { name: string; value: Part[] };

class Parser {
  private pos = 0;
  private depth = 0;

  private readonly data: string;
  constructor(data: string) {
    if (data.startsWith("\uFEFF") || /\r(?!\n)/.test(data)) throw new Error("tmark: invalid line ending or BOM");
    this.data = data.replace(/\r\n/g, "\n");
  }

  parse(): Part[] {
    const parts = this.parts(false);
    if (this.pos !== this.data.length) throw new Error(`tmark: unexpected input at byte ${this.pos}`);
    return parts;
  }

  singleNode(): ParsedNode {
    const node = singleNode(this.parse());
    if (!node) throw new Error("tmark: expected single node");
    return node;
  }

  private parts(stopOnBrace: boolean): Part[] {
    const parts: Part[] = [];
    const fields = new Set<string>();
    let contentSeen = false;
    while (this.pos < this.data.length) {
      const c = this.data[this.pos];
      if (c === "}") {
        if (!stopOnBrace) throw new Error(`tmark: unexpected } at byte ${this.pos}`);
        this.pos++;
        return parts;
      }
      if (c === "{") { parts.push({ type: "node", node: this.node() }); contentSeen = true; }
      else if (c === "#") {
        const field = this.field();
        if (contentSeen) throw new Error("tmark: named field after content");
        if (fields.has(field.name)) throw new Error(`tmark: duplicate field "${field.name}"`);
        fields.add(field.name);
        parts.push({ type: "field", field });
      }
      else {
        const t = this.text();
        if (t) { parts.push({ type: "text", text: t }); if (!isNl({ type: "text", text: t })) contentSeen = true; }
      }
    }
    if (stopOnBrace) throw new Error("tmark: missing }");
    return parts;
  }

  private node(): ParsedNode {
    const start = this.pos;
    if (++this.depth > maxDepth) throw new Error(`tmark: max depth ${maxDepth} exceeded`);
    try {
      this.pos++;
      const tagStart = this.pos;
      while (this.pos < this.data.length && !";}#{\\".includes(this.data[this.pos])) this.pos++;
      if (this.data[this.pos] === ";") {
        const tagName = this.data.slice(tagStart, this.pos++);
        if (!validName(tagName)) throw new Error(`tmark: invalid tag "${tagName}"`);
        const body = this.parts(true);
        return { tag: tagName, body, raw: this.data.slice(start, this.pos) };
      }
      this.pos = tagStart;
      const body = this.parts(true);
      return { tag: "", body, raw: this.data.slice(start, this.pos) };
    } finally {
      this.depth--;
    }
  }

  private field(): ParsedField {
    this.pos++;
    const start = this.pos;
    while (/[a-z0-9_-]/.test(this.data[this.pos] ?? "")) this.pos++;
    if (start === this.pos || this.data[this.pos] !== "{") throw new Error(`tmark: malformed field at byte ${start - 1}`);
    const name = this.data.slice(start, this.pos++);
    if (!validName(name)) throw new Error(`tmark: invalid field name "${name}"`);
    return { name, value: this.parts(true) };
  }

  private text(): string {
    let out = "";
    while (this.pos < this.data.length) {
      let c = this.data[this.pos];
      if (c === "{" || c === "}" || c === "#") break;
      if (c === "\\") {
        this.pos++;
        if (this.pos >= this.data.length) throw new Error("tmark: trailing escape");
        c = this.data[this.pos];
        if (!"#{}\\".includes(c)) throw new Error(`tmark: invalid escape at byte ${this.pos - 1}`);
      }
      out += c;
      this.pos++;
    }
    return out;
  }
}

function validName(name: string): boolean { return /^[a-z0-9_-]{1,32}$/.test(name); }

class Decoder {
  private depth = 0;
  constructor(private readonly parts: Part[], private readonly soft: boolean) {}

  singleValue(): TmarkNode {
    const clean = dropNl(this.parts);
    if (clean.length === 1 && clean[0].type === "text") return { kind: "text", text: clean[0].text };
    const node = singleNode(this.parts);
    if (!node) throw new Error("tmark: expected single value");
    return this.node(node);
  }

  private node(node: ParsedNode): TmarkNode {
    if (++this.depth > maxDepth) throw new Error(`tmark: max depth ${maxDepth} exceeded`);
    try {
      const b = new Body(node.body, expandedTag(node.tag));
      let value: TmarkNode;
      switch (node.tag) {
        case "document": value = this.document(b); break;
        case "attached": value = this.attachedMedia(b); break;
        case "caption": value = { kind: "caption", credit: this.rich(b.field("credit") ?? []), text: this.rich(b.unnamed) } satisfies CaptionNode; break;
        case "a": value = { kind: "link", href: partText(b.req("href")), children: this.rich(b.unnamed) }; break;
        case "anchor-link": value = { kind: "anchorLink", anchorName: partText(b.req("name")), children: this.rich(b.unnamed) }; break;
        case "ref": value = { kind: "reference", name: partText(b.req("name")), children: this.rich(b.unnamed) }; break;
        case "ref-link": value = { kind: "referenceLink", referenceName: partText(b.req("name")), children: this.rich(b.unnamed) }; break;
        case "b": value = { kind: "bold", children: this.rich(b.unnamed) }; break;
        case "i": value = { kind: "italic", children: this.rich(b.unnamed) }; break;
        case "m": value = { kind: "marked", children: this.rich(b.unnamed) }; break;
        case "u": value = { kind: "underline", children: this.rich(b.unnamed) }; break;
        case "s": value = { kind: "strikethrough", children: this.rich(b.unnamed) }; break;
        case "spoiler": value = { kind: "spoiler", children: this.rich(b.unnamed) }; break;
        case "sub": value = { kind: "subscript", children: this.rich(b.unnamed) }; break;
        case "sup": value = { kind: "superscript", children: this.rich(b.unnamed) }; break;
        case "datetime": value = { kind: "datetime", unix: parseNumber(partText(b.unnamed), true), timezone: partText(b.req("timezone")) }; break;
        case "code": value = { kind: "code", text: partText(b.unnamed, b.expanded) }; break;
        case "math": value = { kind: "math", expression: partText(b.unnamed, b.expanded) }; break;
        case "icon": value = { kind: "icon", src: partText(b.unnamed), alternativeText: optText(b.field("alt")) }; break;
        case "p": value = { kind: "paragraph", children: this.rich(b.unnamed) }; break;
        case "h": value = { kind: "header", size: parseNumber(partText(b.req("s")), true), children: this.rich(b.unnamed) }; break;
        case "pre": value = { kind: "preformatted", text: partText(b.unnamed, b.expanded), language: optText(b.field("language")) }; break;
        case "math-block": value = { kind: "mathBlock", expression: partText(b.unnamed, b.expanded) }; break;
        case "anchor": value = { kind: "anchor", name: partText(b.unnamed) }; break;
        case "hr": value = { kind: "divider" }; break;
        case "q": value = { kind: "blockquote", credit: this.rich(b.field("credit") ?? []), blocks: this.blocks(b.unnamed) }; break;
        case "as": value = { kind: "pullQuote", credit: this.rich(b.field("credit") ?? []), text: this.rich(b.unnamed) }; break;
        case "collage": value = { kind: "collage", caption: this.optionalCaption(b.field("caption")), children: this.slides(b.unnamed) }; break;
        case "list": value = { kind: "list", items: this.items(b.unnamed) }; break;
        case "li": value = this.listItem(b); break;
        case "map": value = { kind: "map", lat: parseNumber(partText(b.req("lat"))), lon: parseNumber(partText(b.req("lon"))), zoom: optNum(b.field("zoom"), true), caption: this.optionalCaption(b.field("caption")) }; break;
        case "img": value = { kind: "image", src: partText(b.unnamed), caption: this.optionalCaption(b.field("caption")), hasSpoiler: optBool(b.field("has_spoiler")) ?? false }; break;
        case "video": value = { kind: "video", src: partText(b.unnamed), caption: this.optionalCaption(b.field("caption")), hasSpoiler: optBool(b.field("has_spoiler")) ?? false }; break;
        case "audio": value = { kind: "audio", src: partText(b.unnamed), caption: this.optionalCaption(b.field("caption")) }; break;
        case "slideshow": value = { kind: "slideshow", caption: this.optionalCaption(b.field("caption")), children: this.slides(b.unnamed) }; break;
        case "table": value = { kind: "table", caption: this.rich(b.field("caption") ?? []), bordered: optBool(b.field("bordered")) ?? false, striped: optBool(b.field("striped")) ?? false, rows: this.rows(b.unnamed) }; break;
        case "tr": value = this.tableRow(b); break;
        case "td": value = this.cell(b); break;
        case "details": value = { kind: "details", summary: this.rich(b.field("summary") ?? []), isOpen: optBool(b.field("open")) ?? false, children: this.blocks(b.unnamed) }; break;
        default:
          if (this.soft && node.tag) return { kind: "unknown", raw: node.raw };
          throw new Error(`tmark: unknown tag "${node.tag}"`);
      }
      b.done();
      validateNode(value);
      return value;
    } finally {
      this.depth--;
    }
  }

  private rich(parts: Part[]): RichText {
    return parts.map((part) => {
      if (part.type === "text") return { kind: "text", text: part.text };
      if (part.type === "node") {
        const node = this.node(part.node);
        if (isRich(node)) return node;
      }
      throw new Error("tmark: expected rich text");
    });
  }

  private blocks(parts: Part[]): RichBlocks {
    return dropNl(parts).map((part) => {
      if (part.type === "node") {
        const node = this.node(part.node);
        if (isBlock(node)) return node;
      }
      throw new Error("tmark: expected block node");
    });
  }

  private items(parts: Part[]): ListItem[] {
    return this.concreteArray(parts, "li", (b) => this.listItem(b));
  }

  private slides(parts: Part[]): SlideshowNode[] {
    return dropNl(parts).map((part) => {
      if (part.type === "node") {
        const node = this.node(part.node);
        if (node.kind === "image" || node.kind === "video") return node;
      }
      throw new Error("tmark: expected slideshow node");
    });
  }

  private rows(parts: Part[]): TableRow[] {
    return this.concreteArray(parts, "tr", (b) => this.tableRow(b));
  }

  private cells(parts: Part[]): Cell[] {
    return this.concreteArray(parts, "td", (b) => this.cell(b));
  }

  private listItem(b: Body): ListItem {
    return { kind: "listItem", type: optText(b.field("type")), order: optNum(b.field("order"), true), checked: optBool(b.field("checked")), children: this.blocks(b.unnamed) };
  }

  private tableRow(b: Body): TableRow {
    return { kind: "tableRow", cells: this.cells(b.unnamed) };
  }

  private cell(b: Body): Cell {
    return { kind: "cell", isHeader: optBool(b.field("header")) ?? false, colspan: optNum(b.field("colspan"), true), rowspan: optNum(b.field("rowspan"), true), align: optText(b.field("align")) as TableCellAlign | undefined, valign: optText(b.field("valign")) as TableCellValign | undefined, children: this.rich(b.unnamed) };
  }

  private concreteArray<T>(parts: Part[], tagName: string, decode: (body: Body) => T): T[] {
    return dropNl(parts).map((part) => {
      if (part.type !== "node") throw new Error(`tmark: expected ${tagName} element`);
      // Tagged input may be ambiguous here: its tag becomes content in a concrete element.
      const content = part.node.tag ? new Parser(part.node.raw.slice(1, -1)).parse() : part.node.body;
      const body = new Body(content, expandedTag(tagName));
      const value = decode(body);
      body.done();
      validateNode(value as TmarkNode);
      return value;
    });
  }

  private document(b: Body): Document {
    return {
      kind: "document",
      url: partText(b.req("url")),
      title: partText(b.req("title")),
      description: optText(b.field("description")),
      authorName: optText(b.field("author_name")),
      authorUrl: optText(b.field("author_url")),
      imageUrl: optText(b.field("image_url")),
      attachedMedia: this.attachedMediaList(b.field("attached_media") ?? []),
      content: this.blocks(b.unnamed),
    };
  }

  private attachedMedia(b: Body): AttachedMedia {
    return {
      kind: "attachedMedia",
      hash: partText(b.req("hash")),
      content: this.blocks(b.unnamed),
    };
  }

  private attachedMediaList(parts: Part[]): AttachedMedia[] {
    return this.concreteArray(parts, "attached", (b) => this.attachedMedia(b));
  }

  private optionalCaption(parts?: Part[]): Caption | undefined {
    if (!parts) return undefined;
    const body = new Body(parts, false);
    const caption = { credit: this.rich(body.field("credit") ?? []), text: this.rich(body.unnamed) };
    body.done();
    return caption;
  }
}

class Body {
  readonly unnamed: Part[] = [];
  private readonly fields = new Map<string, Part[]>();

  constructor(raw: Part[], readonly expanded: boolean) {
    const parts = expanded ? trimNl(raw) : raw;
    for (const part of parts) {
      if (expanded && isNl(part)) continue;
      if (part.type === "field") {
        if (this.fields.has(part.field.name)) throw new Error(`tmark: duplicate field "${part.field.name}"`);
        this.fields.set(part.field.name, part.field.value);
      } else {
        this.unnamed.push(part);
      }
    }
  }

  field(name: string): Part[] | undefined {
    const value = this.fields.get(name);
    this.fields.delete(name);
    return value;
  }

  req(name: string): Part[] {
    const value = this.field(name);
    if (!value) throw new Error(`tmark: missing field "${name}"`);
    return value;
  }

  done(): void {
    const first = this.fields.keys().next();
    if (!first.done) throw new Error(`tmark: unknown field "${first.value}"`);
  }
}

function partText(parts: Part[], expanded = false): string {
  let text = "";
  for (const part of parts) {
    if (part.type !== "text") throw new Error("tmark: expected text");
    text += part.text;
  }
  if (expanded) text = text.replace(/^\n/, "").replace(/\n$/, "");
  return text;
}

function optText(parts?: Part[]): string | undefined {
  return parts ? partText(parts) : undefined;
}

function parseNumber(value: string, integer = false): number {
  if (!/^-?(?:0|[1-9][0-9]*)(?:\.[0-9]*[1-9])?$/.test(value) || value === "-0" || (integer && value.includes("."))) throw new Error(`tmark: invalid number "${value}"`);
  const n = Number(value);
  if (!Number.isFinite(n)) throw new Error(`tmark: invalid number "${value}"`);
  return n;
}

function optNum(parts?: Part[], integer = false): number | undefined {
  return parts ? parseNumber(partText(parts), integer) : undefined;
}

function optBool(parts?: Part[]): boolean | undefined {
  if (!parts) return undefined;
  const value = partText(parts);
  if (value === "t") return true;
  if (value === "f") return false;
  throw new Error(`tmark: parse bool: expected t or f, got "${value}"`);
}

function singleNode(parts: Part[]): ParsedNode | undefined {
  const clean = dropNl(parts);
  return clean.length === 1 && clean[0].type === "node" ? clean[0].node : undefined;
}

function isNl(part: Part): boolean {
  return part.type === "text" && part.text.includes("\n") && part.text.trim() === "";
}

function dropNl(parts: Part[]): Part[] {
  return parts.filter((p) => !isNl(p));
}

function trimNl(parts: Part[]): Part[] {
  let start = 0;
  let end = parts.length;
  while (start < end && isNl(parts[start])) start++;
  while (end > start && isNl(parts[end - 1])) end--;
  return parts.slice(start, end);
}

function expandedTag(tagName: string): boolean {
  return new Set(["document", "attached", "pre", "math-block", "collage", "list", "slideshow", "table", "q", "li", "details"]).has(tagName);
}

function isRich(node: TmarkNode): node is RichNode {
  return [
    "text", "link", "anchorLink", "reference", "referenceLink", "bold", "italic",
    "marked", "underline", "strikethrough", "spoiler", "subscript", "superscript",
    "datetime", "code", "math", "icon", "unknown",
  ].includes(node.kind);
}

function isBlock(node: TmarkNode): node is BlockNode {
  return [
    "paragraph", "header", "preformatted", "mathBlock", "anchor", "divider",
    "blockquote", "pullQuote", "collage", "list", "listItem", "map", "image",
    "video", "audio", "slideshow", "table", "tableRow", "cell", "details", "unknown",
  ].includes(node.kind);
}
