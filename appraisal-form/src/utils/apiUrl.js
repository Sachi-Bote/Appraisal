const normalizeBaseUrl = (url) => (url.endsWith("/") ? url : `${url}/`);

const API_BASE_URL = normalizeBaseUrl(
  import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000/api/"
);

const BACKEND_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, "");

export { API_BASE_URL, BACKEND_ORIGIN };

export function buildApiUrl(pathOrUrl = "") {
  const raw = String(pathOrUrl || "").trim();
  if (!raw) return `${BACKEND_ORIGIN}/api/`;

  if (/^https?:\/\//i.test(raw)) {
    return raw
      .replace("http://127.0.0.1:8000", BACKEND_ORIGIN)
      .replace("http://localhost:8000", BACKEND_ORIGIN);
  }

  if (raw.startsWith("/api/")) return `${BACKEND_ORIGIN}${raw}`;
  if (raw.startsWith("/")) return `${BACKEND_ORIGIN}${raw}`;
  return `${BACKEND_ORIGIN}/api/${raw.replace(/^\/+/, "")}`;
}
