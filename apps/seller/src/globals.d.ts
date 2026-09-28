// Minimal Node-style globals available in the Expo/React Native runtime (Hermes
// provides both), declared here so we don't need full @types/node.
declare var process: {
  env: Record<string, string | undefined>;
};
declare var global: typeof globalThis;
