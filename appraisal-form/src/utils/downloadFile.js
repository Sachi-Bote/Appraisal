import { buildApiUrl } from "./apiUrl";

export const getAccessToken = () =>
  localStorage.getItem("access") ||
  sessionStorage.getItem("access") ||
  localStorage.getItem("access_token") ||
  sessionStorage.getItem("access_token");

export async function downloadWithAuth(url, filename) {
  const requestUrl = buildApiUrl(url);
  const token = getAccessToken();
  const res = await fetch(requestUrl, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (!res.ok) {
    throw new Error(`Download failed (${res.status})`);
  }

  const contentType = (res.headers.get("content-type") || "").toLowerCase();
  if (!contentType.includes("application/pdf")) {
    let detail = "Server returned a non-PDF response.";
    try {
      detail = await res.text();
    } catch {
      // keep fallback detail
    }
    throw new Error(detail || "Download failed: invalid PDF response");
  }

  const blob = await res.blob();
  const objectUrl = window.URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = filename;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();

  setTimeout(() => {
    a.remove();
    window.URL.revokeObjectURL(objectUrl);
  }, 60000);
}
