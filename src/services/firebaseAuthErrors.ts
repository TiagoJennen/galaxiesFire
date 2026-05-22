const CONFIG_ERROR_PATTERNS = [
  "requests-to-this-api-identitytoolkit-method",
  "identitytoolkit",
  "api key not valid",
  "api_key_invalid",
  "api key invalid",
  "api key blocked",
  "blocked",
  "operation-not-allowed",
  "app-not-authorized",
];

export const isFirebaseAuthConfigError = (error: unknown): boolean => {
  const code = String((error as { code?: unknown })?.code ?? "").toLowerCase();
  const message = String(
    (error as { message?: unknown })?.message ?? "",
  ).toLowerCase();
  const raw = String(error ?? "").toLowerCase();
  const haystack = `${code} ${message} ${raw}`;

  return CONFIG_ERROR_PATTERNS.some((pattern) => haystack.includes(pattern));
};