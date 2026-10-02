# @tmark/react

Render TMark documents in React on the web.

```sh
npm install @tmark/tmark @tmark/react react
```

```tsx
import { unmarshalDocument } from "@tmark/tmark";
import { TmarkView } from "@tmark/react";
import "@tmark/react/style.css";

<TmarkView value={unmarshalDocument(source)} />;
```

`TmarkView` accepts `renderNode` to replace individual nodes and `mediaRenderer` to customize media. Math and maps use MathJax and Leaflet. See the [browser example](https://github.com/waus/tmark-js/tree/master/react/example).
