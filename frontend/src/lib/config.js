export const apiBaseUrl =
  (import.meta.env.VITE_API_BASE_URL || "http://localhost/api").replace(/\/+$/, "");

export const assetBaseUrl =
  (import.meta.env.VITE_ASSET_BASE_URL || "http://localhost").replace(/\/+$/, "");
