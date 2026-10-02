export const maxDepth = 16;

export type RichNode =
  | TextNode | Link | AnchorLink | Reference | ReferenceLink
  | Bold | Italic | Marked | Underline | Strikethrough | Spoiler
  | Subscript | Superscript | DateTimeNode | Code | MathInline | Icon | Unknown;

export type BlockNode =
  | Paragraph | Header | Preformatted | MathBlock | Anchor | Divider
  | Blockquote | PullQuote | Collage | ListBlock | ListItem | MapBlock
  | ImageNode | VideoNode | AudioNode | Slideshow | TableNode | TableRow | Cell | Details | Unknown;

export type SlideshowNode = ImageNode | VideoNode;
export type TmarkNode = RichNode | BlockNode | Document | AttachedMedia | CaptionNode;
export type Text = string;
export type RichText = RichNode[];
export type RichBlocks = BlockNode[];

export interface TextNode { kind: "text"; text: string }
export interface Unknown { kind: "unknown"; raw: string }
export interface Caption { credit?: RichText; text?: RichText }
export interface CaptionNode extends Caption { kind: "caption" }
export interface Link { kind: "link"; href: string; children?: RichText }
export interface AnchorLink { kind: "anchorLink"; anchorName: string; children?: RichText }
export interface Reference { kind: "reference"; name: string; children?: RichText }
export interface ReferenceLink { kind: "referenceLink"; referenceName: string; children?: RichText }
export interface Bold { kind: "bold"; children?: RichText }
export interface Italic { kind: "italic"; children?: RichText }
export interface Marked { kind: "marked"; children?: RichText }
export interface Underline { kind: "underline"; children?: RichText }
export interface Strikethrough { kind: "strikethrough"; children?: RichText }
export interface Spoiler { kind: "spoiler"; children?: RichText }
export interface Subscript { kind: "subscript"; children?: RichText }
export interface Superscript { kind: "superscript"; children?: RichText }
export interface DateTimeNode { kind: "datetime"; unix: number; timezone: string }
export interface Code { kind: "code"; text: string }
export interface MathInline { kind: "math"; expression: string }
export interface Icon { kind: "icon"; src: string; alternativeText?: string }
export interface Paragraph { kind: "paragraph"; children?: RichText }
export interface Header { kind: "header"; size: number; children?: RichText }
export interface Preformatted { kind: "preformatted"; text: string; language?: string }
export interface MathBlock { kind: "mathBlock"; expression: string }
export interface Anchor { kind: "anchor"; name: string }
export interface Divider { kind: "divider" }
export interface Blockquote { kind: "blockquote"; credit?: RichText; blocks?: RichBlocks }
export interface PullQuote { kind: "pullQuote"; credit?: RichText; text?: RichText }
export interface Collage { kind: "collage"; caption?: Caption; children?: SlideshowNode[] }
export interface ListBlock { kind: "list"; items?: ListItem[] }
export interface ListItem { kind: "listItem"; type?: string; order?: number; checked?: boolean; children?: RichBlocks }
export interface MapBlock { kind: "map"; lat: number; lon: number; zoom?: number; caption?: Caption }
export interface ImageNode { kind: "image"; src: string; caption?: Caption; hasSpoiler?: boolean }
export interface VideoNode { kind: "video"; src: string; caption?: Caption; hasSpoiler?: boolean }
export interface AudioNode { kind: "audio"; src: string; caption?: Caption }
export interface Slideshow { kind: "slideshow"; caption?: Caption; children?: SlideshowNode[] }
export type TableCellAlign = "left" | "center" | "right";
export type TableCellValign = "top" | "middle" | "bottom";
export interface TableNode { kind: "table"; caption?: RichText; bordered?: boolean; striped?: boolean; rows?: TableRow[] }
export interface TableRow { kind: "tableRow"; cells?: Cell[] }
export interface Cell { kind: "cell"; isHeader?: boolean; colspan?: number; rowspan?: number; align?: TableCellAlign; valign?: TableCellValign; children?: RichText }
export interface Details { kind: "details"; summary?: RichText; isOpen?: boolean; children?: RichBlocks }
export interface AttachedMedia { kind: "attachedMedia"; hash: Text; content?: RichBlocks }
export interface Document { kind: "document"; url: Text; title: Text; description?: Text; authorName?: Text; authorUrl?: Text; imageUrl?: Text; attachedMedia?: AttachedMedia[]; content?: RichBlocks }
