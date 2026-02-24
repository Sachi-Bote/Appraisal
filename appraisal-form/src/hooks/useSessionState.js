import { useEffect, useState } from "react";

export default function useSessionState(key, initialValue) {
  const [value, setValue] = useState(() => {
    try {
      const raw = sessionStorage.getItem(key);
      if (raw !== null) return JSON.parse(raw);
    } catch (error) {
      console.error("Failed to restore session state", error);
    }
    return typeof initialValue === "function" ? initialValue() : initialValue;
  });

  useEffect(() => {
    try {
      sessionStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error("Failed to save session state", error);
    }
  }, [key, value]);

  return [value, setValue];
}
