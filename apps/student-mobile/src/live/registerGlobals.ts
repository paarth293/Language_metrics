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
 *     npx expo install @livekit/react-native @livekit/react-native-webrtc
 *     npx expo prebuild --clean
 *     eas build --profile development --platform android   # or ios
 *
 * Then run `npx expo start --dev-client`. `npx expo start` alone will load
 * Expo Go and crash the moment a class is joined.
 */
import { registerGlobals } from "@livekit/react-native";

registerGlobals();
