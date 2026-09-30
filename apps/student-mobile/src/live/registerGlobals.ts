/**
 * LiveKit React Native bootstrap.
 *
 * MUST be imported before anything else touches WebRTC — the SDK installs
 * globals (RTCPeerConnection, mediaDevices, MediaStream) that React Native
 * does not ship with. Import this at the very top of index.js, above App.
 *
 * IMPORTANT — this does not run in Expo Go.
 * @livekit/react-native-webrtc contains native code, and Expo Go only loads
 * the modules baked into its own binary. You need a development build:
 *
 *     npx expo prebuild --clean
 *     npx expo run:android   # or eas build --profile development
 *
 * Then run `npx expo start --dev-client`.
 *
 * On web and in Expo Go the native module is missing, so the SDK is loaded
 * with require() inside a try/catch instead of a static import. The app still
 * starts, `liveVideoAvailable` is false, and the Classes screen falls back to
 * the web classroom.
 */
import { Platform } from "react-native";

export let liveVideoAvailable = false;

if (Platform.OS !== "web") {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { registerGlobals } = require("@livekit/react-native") as typeof import("@livekit/react-native");
    registerGlobals();
    liveVideoAvailable = true;
  } catch (err) {
    console.warn("[live] LiveKit native module unavailable; in-app classes disabled.", err);
  }
}
