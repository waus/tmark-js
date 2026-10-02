# TMark React Native

Native renderer for the shared `@tmark/tmark` model. `TmarkView` renders text,
formatting, lists, quotes, images, galleries, details and simple tables with
React Native components. It does not use a WebView.

## Use

Install `@tmark/tmark` and `@tmark/react-native` in your React Native app.
The host app owns its `ScrollView`; `TmarkView` only renders
document content.

```sh
npm install @tmark/tmark @tmark/react-native
```

```tsx
import { unmarshalDocument } from "@tmark/tmark";
import { TmarkView } from "@tmark/react-native";

const document = unmarshalDocument(source);
<TmarkView value={document} />;
```

Supply native video, audio and map components through `mediaRenderer`:

```tsx
<TmarkView
  value={document}
  mediaRenderer={({ kind, src, lat, lon, zoom }) => {
    if (kind === "video") return <MyVideoPlayer uri={src} />;
    if (kind === "audio") return <MyAudioPlayer uri={src} />;
    if (kind === "map") return <MyMap lat={lat!} lon={lon!} zoom={zoom} />;
    return null; // Built-in Image handles images.
  }}
  onOpenAnchor={(name) => scrollToAnchor(name)}
  renderNode={(node, renderDefault) => renderDefault()}
/>
```

`renderNode` can replace any node. Inline replacements must return text or
`Text` components because React Native only permits text inside `Text`.

See the [Android/iOS example app](https://github.com/waus/tmark-js/tree/master/react-native/example).

