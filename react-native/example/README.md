# TMark React Native example

This is the native Android/iOS host app for `@tmark/react-native`.
At startup it loads `.tmark` documents from
`https://tmark.waus.app/examples/`. Choose a document to view it, or tap
**Source** to inspect its text. An internet connection is required.

## First setup

Install Node.js 22.11 or newer, npm, Android Studio with the Android SDK,
and Xcode with CocoaPods. From the repository root:

```sh
npm install
npm run build
cd react-native/example/ios && pod install && cd ..
```

## Run in Android Studio

1. In a terminal in this directory, run `npm start`. Leave Metro running.
2. Open `android/` in Android Studio and wait for Gradle sync.
3. Select an emulator or connected device, then click **Run** for `app`.

## Run in Xcode

1. In a terminal in this directory, run `npm start`. Leave Metro running.
2. Open `ios/TMarkExample.xcworkspace` in Xcode (created by `pod install`).
3. Select the `TMarkExample` scheme and an iPhone simulator, then click **Run**.

The app uses the workspace packages by their public names.
