/*
 * Expo Go derives its runtime version from the SDK version it ships with
 * (exposdk:57.0.0). A project that declares its own `runtimeVersion` — which
 * `eas init` adds so OTA updates work — no longer matches, and Expo Go reports
 * it as "incompatible ... requires a newer version of Expo Go".
 *
 * `npm run start:go` sets EXPO_GO_COMPAT, which strips the keys that only
 * apply to real builds. Every other command, including every EAS build, sees
 * app.json unchanged.
 */
module.exports = ({ config }) => {
  if (process.env.EXPO_GO_COMPAT !== '1') return config;

  const goConfig = { ...config };
  delete goConfig.runtimeVersion;
  delete goConfig.updates;

  // The dev-client launcher is not part of Expo Go.
  goConfig.plugins = (goConfig.plugins ?? []).filter(
    (plugin) => (Array.isArray(plugin) ? plugin[0] : plugin) !== 'expo-dev-client',
  );

  return goConfig;
};
