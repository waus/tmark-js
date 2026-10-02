# @tmark/tmark

Parse and serialize TMark documents. Works in Node.js and browsers.

```sh
npm install @tmark/tmark
```

```ts
import { marshal, unmarshalDocument } from "@tmark/tmark";

const document = unmarshalDocument(source);
const text = marshal(document);
```

Use `unmarshal(source)` for any TMark node. Pass `{ soft: true }` to either parser to preserve unknown constructs when possible. Types such as `Document` and `TmarkNode` are exported from the package root.
