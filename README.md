# TMark for JavaScript

Parser and renderers for [TMark](https://tmark.waus.app).

| Package | Purpose |
| --- | --- |
| [`@tmark/tmark`](tmark/) | Parse and serialize documents |
| [`@tmark/react`](react/) | Render in React on the web |
| [`@tmark/react-native`](react-native/) | Render in React Native |

## Development

Requires Node.js 22.11 or newer and npm. From the repository root:

```sh
npm install
npm run build
npm test
npm run pack:check
```

The React demo is in [`react/example`](react/example/). The Android/iOS app is in [`react-native/example`](react-native/example/). Both load example documents from [tmark.waus.app/examples](https://tmark.waus.app/examples/) at startup. The examples are excluded from the npm packages.

## Publishing

The npm account must own the `@tmark` scope or belong to the `tmark` organization. Enable two-factor authentication, then sign in with `npm login` and verify the account with `npm whoami`.

From the repository root, build, test, and inspect the package archives:

```sh
npm ci
npm run build
npm test
npm run pack:check
```

Publish the parser first because the renderers depend on it:

```sh
npm publish -w @tmark/tmark --access public
npm publish -w @tmark/react --access public
npm publish -w @tmark/react-native --access public
```

Each name and version can be published only once. Update the package versions and the renderers' `@tmark/tmark` dependency range for later releases. Add a license before publication if you want to grant reuse rights.
