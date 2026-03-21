import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../api";
import "../styles/Login.css";
import useSessionState from "../hooks/useSessionState";
import collegeLogo from "../assets/college-logo.png";
import { getProfileRouteByRole } from "../utils/profileRoutes";

const AUTH_KEYS = [
  "access",
  "refresh",
  "access_token",
  "refresh_token",
  "loggedInUser",
  "userProfile",
  "role",
];

const TRANSIENT_SESSION_PREFIXES = [
  "hod.",
  "principal.",
  "faculty.",
];

const TRANSIENT_SESSION_KEYS = [
  "lastRoute",
  "selectedSubmission",
  "remarks",
  "verificationSavedAt",
];

const clearAuthStorage = () => {
  AUTH_KEYS.forEach((key) => {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  });
  TRANSIENT_SESSION_KEYS.forEach((key) => sessionStorage.removeItem(key));
  Object.keys(sessionStorage).forEach((key) => {
    if (TRANSIENT_SESSION_PREFIXES.some((prefix) => key.startsWith(prefix))) {
      sessionStorage.removeItem(key);
    }
  });
};

const normalizeRole = (role) => String(role || "").trim().toUpperCase();
const goToAdminPortal = () => {
  window.location.assign("/admin/");
};

const saveAuth = ({ access, refresh, user, remember }) => {
  const target = remember ? localStorage : sessionStorage;
  target.setItem("access", access);
  target.setItem("refresh", refresh);
  target.setItem("loggedInUser", JSON.stringify(user));
  if (user?.role) {
    target.setItem("role", user.role);
  }
};

const getStoredUser = () => {
  try {
    const raw = localStorage.getItem("loggedInUser") || sessionStorage.getItem("loggedInUser");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const routeByRole = (navigate, role, fallback = true) => {
  const normalized = normalizeRole(role);
  switch (normalized) {
    case "FACULTY":
      navigate("/faculty/dashboard", { replace: true });
      return true;
    case "HOD":
      navigate("/hod/dashboard", { replace: true });
      return true;
    case "PRINCIPAL":
      navigate("/principal/dashboard", { replace: true });
      return true;
    case "ADMIN":
      goToAdminPortal();
      return true;
    default:
      if (fallback) navigate("/login", { replace: true });
      return false;
  }
};

export default function Login() {
  const navigate = useNavigate();
  const hasBootstrappedRef = useRef(false);

  const [email, setEmail] = useSessionState("login.email", "");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useSessionState("login.remember", false);
  const [error, setError] = useSessionState("login.error", "");

  const getDefaultRouteForRole = (role) => {
    const normalized = normalizeRole(role);
    if (normalized === "FACULTY") return "/faculty/dashboard";
    if (normalized === "HOD") return "/hod/dashboard";
    if (normalized === "PRINCIPAL") return "/principal/dashboard";
    if (normalized === "ADMIN") return "/admin/";
    return null;
  };

  const isRouteAllowedForRole = (route, role) => {
    const normalized = normalizeRole(role);
    const path = String(route || "").toLowerCase();
    if (!path || path === "/login" || path.startsWith("/forgot-password") || path.startsWith("/reset-password")) {
      return false;
    }
    if (normalized === "FACULTY") return path.startsWith("/faculty/");
    if (normalized === "HOD") return path.startsWith("/hod/");
    if (normalized === "PRINCIPAL") return path.startsWith("/principal/");
    if (normalized === "ADMIN") return path.startsWith("/admin/");
    return false;
  };

  useEffect(() => {
    if (hasBootstrappedRef.current) return;
    hasBootstrappedRef.current = true;

    const bootstrapAuth = async () => {
      const access = localStorage.getItem("access") || sessionStorage.getItem("access");
      if (!access) return;

      // Do not trust persisted token blindly across deployments/sessions.
      // Verify auth before redirecting away from login page.
      try {
        const meRes = await API.get("me/");
        const user = meRes?.data || getStoredUser();
        const normalizedRole = normalizeRole(user?.role);
        if (!normalizedRole) {
          clearAuthStorage();
          return;
        }

        const lastRoute = sessionStorage.getItem("lastRoute");
        if (isRouteAllowedForRole(lastRoute, normalizedRole)) {
          navigate(lastRoute, { replace: true });
          return;
        }
        sessionStorage.removeItem("lastRoute");
        const defaultRoute = getDefaultRouteForRole(normalizedRole);
        if (defaultRoute) {
          if (normalizedRole === "ADMIN") {
            goToAdminPortal();
          } else {
            navigate(defaultRoute, { replace: true });
          }
        }
      } catch {
        clearAuthStorage();
      }
    };

    bootstrapAuth();
  }, [navigate]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");

    try {
      const response = await API.post("auth/login/", {
        username: email.trim(),
        password,
      });

      const payload = response?.data || {};
      const access = payload?.access;
      const refresh = payload?.refresh;
      if (!access || !refresh) {
        throw new Error("Login response missing access/refresh tokens");
      }

      const lastRoute = sessionStorage.getItem("lastRoute");

      clearAuthStorage();

      API.defaults.headers.common.Authorization = `Bearer ${access}`;
      // Temporary storage so interceptors/fallback API calls can authenticate immediately.
      sessionStorage.setItem("access", access);
      sessionStorage.setItem("refresh", refresh);

      let user = payload?.user;
      if (!user) {
        const meRes = await API.get("me/");
        user = meRes?.data || {};
      }

      user = { ...user, role: normalizeRole(user?.role) };
      saveAuth({ access, refresh, user, remember });

      if (user?.must_change_password) {
        navigate(`${getProfileRouteByRole(user?.role)}?tab=password`, { replace: true });
        return;
      }

      if (isRouteAllowedForRole(lastRoute, user?.role)) {
        navigate(lastRoute, { replace: true });
        return;
      }
      sessionStorage.removeItem("lastRoute");

      if (!routeByRole(navigate, user?.role, false)) {
        setError(`Unauthorized role: ${user?.role || "missing"}`);
      }
    } catch (err) {
      console.error(err);
      const detail = err?.response?.data?.detail;
      const message = Array.isArray(detail) ? detail[0] : detail;
      setError(message || "Login failed. Please check credentials and role mapping.");
    }
  };

  return (
    <div className="login-container">
      <section className="login-showcase" aria-label="College login page">
        <div className="branding-panel">
          <div className="branding-content">
            <img
              src={collegeLogo}
              alt="MES Wadia College of Engineering logo"
              className="college-logo"
            />
            <p className="brand-kicker">Modern Education Society&apos;s</p>
            <h1 className="college-name">
              Wadia College of Engineering
            </h1>
          </div>
        </div>

        <div className="form-panel">
          <div className="login-card">
            <div className="header-section">
              <p className="system-name">STAFF APPRAISAL SYSTEM</p>
              <h2 className="app-title">Sign in to get started</h2>
            </div>

            {error && <div className="error-message">{error}</div>}

            <form onSubmit={handleLogin} className="login-form">
              <div className="form-group">
                <label htmlFor="email">Username or Email</label>
                <input
                  id="email"
                  type="text"
                  placeholder="username or name@institution.ac.in"
                  value={email}
                  onChange={(e) => setEmail(e.target.value.trim())}
                  className="form-control"
                  required
                  autoFocus
                />
              </div>

              <div className="form-group">
                <label htmlFor="password">Password</label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="form-control"
                  required
                />
              </div>

              <div className="form-options">
                <label className="remember-label">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={() => setRemember(!remember)}
                  />
                  <span>Remember me</span>
                </label>

                <button
                  type="button"
                  className="forgot-link"
                  onClick={() => navigate("/forgot-password")}
                >
                  Forgot password?
                </button>
              </div>

              <button type="submit" className="btn btn-primary">
                Login
              </button>
            </form>
          </div>
        </div>
      </section>
    </div>
  );
}
