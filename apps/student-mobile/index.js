// registerGlobals() must run before any other module can touch WebRTC.
// React Native has no RTCPeerConnection, MediaStream or mediaDevices of its
// own; this import installs them. Importing it below './App' would be too
// late — App's import graph reaches livekit-client first.
import './src/live/registerGlobals';

import '@expo/metro-runtime';
import { registerRootComponent } from 'expo';
import App from './App';

registerRootComponent(App);
