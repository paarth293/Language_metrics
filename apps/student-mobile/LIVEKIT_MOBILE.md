# Live classes on mobile

The Expo app uses LiveKit's React Native SDK, which contains native code.

## This does not run in Expo Go

Expo Go only loads modules compiled into its own binary, and
`@livekit/react-native-webrtc` is not one of them. Running `npx expo start`
and opening the app in Expo Go will crash the moment a student joins a class.

You need a **development build**:

```bash
cd apps/student-mobile

# 1. install the SDK and the two config plugins
npx expo install @livekit/react-native @livekit/react-native-webrtc livekit-client
npm i -D @livekit/react-native-expo-plugin @config-plugins/react-native-webrtc

# 2. regenerate the native projects with the plugins applied
npx expo prebuild --clean

# 3. build a dev client (once per native-dependency change)
eas build --profile development --platform android
# or, to build locally:
npx expo run:android

# 4. day to day
npm run start        # expo start --dev-client
```

`npm run start:go` still exists for working on screens that do not touch video.

## What the config plugins do

* `@livekit/react-native-expo-plugin` — wires the SDK's Android/iOS setup.
* `@config-plugins/react-native-webrtc` — adds the camera and microphone
  usage strings, the Android permissions, and the iOS background audio mode.

Both run at `prebuild` time. Editing `android/` or `ios/` by hand will be
overwritten; change `app.json` instead.

## Why mobile defaults to 360p

`LiveClassScreen` publishes at 640x360 / ~260 kbps regardless of what the
phone's camera can do. Lessons are taken on mobile data far more often than on
wifi, and the extra pixels cost the student's data allowance and our LiveKit
bandwidth bill without making a language lesson any better.

## Testing without a teacher

```bash
# join the same room from a browser as the teacher
open "https://<teacher-web-host>/live/<classSessionId>"
```

Two devices on the same class session is the only real test; a single client
cannot exercise subscription, simulcast or the billing intersection.
