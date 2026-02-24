import API from "../api";

const CACHE_KEY = "faculty.appraisalStatus.cache.v1";
const CACHE_TTL_MS = 30_000;

export function normalizeStatusPayload(data) {
  return {
    underReview: data?.under_review || data?.underReview || [],
    approved: data?.approved || [],
    changesRequested: data?.changes_requested || data?.changesRequested || [],
  };
}

export function getLatestAppraisal(statusData) {
  const all = [
    ...(statusData?.underReview || []),
    ...(statusData?.approved || []),
    ...(statusData?.changesRequested || []),
  ];

  if (!all.length) return null;

  return [...all].sort((a, b) => Number(b?.id || 0) - Number(a?.id || 0))[0];
}

export function writeStatusCache(statusData) {
  try {
    sessionStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ ts: Date.now(), data: statusData })
    );
  } catch {
    // ignore storage failures
  }
}

export function readStatusCache(maxAgeMs = CACHE_TTL_MS) {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (!parsed?.ts || !parsed?.data) return null;

    if (Date.now() - parsed.ts > maxAgeMs) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

export async function fetchAndCacheFacultyStatus() {
  const response = await API.get("faculty/appraisal/status/");
  const normalized = normalizeStatusPayload(response.data || {});
  writeStatusCache(normalized);
  return normalized;
}
