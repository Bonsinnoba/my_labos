// Polyfill URL for Hermes (Android) – must be the very first import in App.tsx.
// Hermes does not fully implement the WHATWG URL API; accessing .protocol throws:
//   "Error: URL.protocol is not implemented, js engine: hermes"
// This crashes module initialisation before AppRegistry.registerComponent runs,
// which then produces the secondary error:
//   "Invariant Violation: 'main' has not been registered"
import 'react-native-url-polyfill/auto';
