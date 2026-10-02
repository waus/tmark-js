## Run

```sh
npm install
npm run build
npm run build:example -w @tmark/react
python3 -m http.server 8080
```

Open <http://localhost:8080/react/example/>.

To replace any block or inline node, pass `renderNode`:

```jsx
<TmarkView value={document} renderNode={(node, renderDefault) =>
  node.kind === "preformatted" ? <pre>{node.text}</pre> : renderDefault()
} />
```
