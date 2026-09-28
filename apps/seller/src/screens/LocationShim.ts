// Expo Location wrapper. If the native module isn't linked in this checkout,
// the functions fail gracefully (the settings screen shows a manual-entry fallback).
type Coords = { latitude: number; longitude: number };

export async function getCurrentPositionAsync(_options?: unknown): Promise<{ coords: Coords }> {
  try {
    // Lazy require so the app still bundles when expo-location isn't installed.
    const Location = require('expo-location') as {
      requestForegroundPermissionsAsync: () => Promise<{ granted: boolean }>;
      getCurrentPositionAsync: (options?: unknown) => Promise<{ coords: Coords }>;
    };
    const { granted } = await Location.requestForegroundPermissionsAsync();
    if (!granted) throw new Error('Location permission not granted');
    return await Location.getCurrentPositionAsync(_options);
  } catch (err) {
    if ((err as Error).message === 'Location permission not granted') throw err;
    throw new Error('expo-location is not available — add it with: npx expo install expo-location');
  }
}
