import { Routes, Route, Navigate, Outlet, useLocation } from "react-router-dom";
import { lazy, Suspense, useEffect } from "react";

const Login = lazy(() => import("../pages/Login"));
const ForgotPassword = lazy(() => import("../pages/ForgotPassword"));
const ResetPassword = lazy(() => import("../pages/ResetPassword"));

const FacultyDashboard = lazy(() => import("../pages/faculty/Dashboard"));
const FacultyProfile = lazy(() => import("../pages/faculty/Profile"));
const AppraisalForm = lazy(() => import("../pages/faculty/AppraisalForm"));
const FacultyAppraisalStatus = lazy(() => import("../pages/faculty/FacultyAppraisalStatus"));

const HODDashboard = lazy(() => import("../pages/HODDashboard"));
const PrincipalDashboard = lazy(() => import("../pages/PrincipalDashboard"));

function RouteFallback() {
  return (
    <div style={{ minHeight: "30vh", display: "grid", placeItems: "center", fontWeight: 600 }}>
      Loading...
    </div>
  );
}

function getStoredRole() {
  try {
    const rawUser =
      localStorage.getItem("loggedInUser") || sessionStorage.getItem("loggedInUser");
    const parsedUser = rawUser ? JSON.parse(rawUser) : null;
    return String(
      parsedUser?.role ||
      localStorage.getItem("role") ||
      sessionStorage.getItem("role") ||
      ""
    )
      .trim()
      .toUpperCase();
  } catch {
    return "";
  }
}

function ProtectedRoute({ allowedRoles }) {
  const role = getStoredRole();
  const accessToken =
    localStorage.getItem("access") ||
    sessionStorage.getItem("access") ||
    localStorage.getItem("access_token") ||
    sessionStorage.getItem("access_token");

  if (!accessToken) {
    return <Navigate to="/login" replace />;
  }

  if (!allowedRoles.includes(role)) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}

export default function AppRouter() {
  const location = useLocation();

  useEffect(() => {
    const path = `${location.pathname}${location.search || ""}`;
    const isAuthPage = ["/login", "/forgot-password", "/reset-password"].includes(location.pathname);
    if (!isAuthPage) {
      sessionStorage.setItem("lastRoute", path);
    }
  }, [location.pathname, location.search]);

  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="/" element={<Navigate to="/login" />} />

        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        <Route element={<ProtectedRoute allowedRoles={["FACULTY"]} />}>
          <Route path="/faculty/dashboard" element={<FacultyDashboard />} />
          <Route path="/faculty/profile" element={<FacultyProfile />} />
          <Route path="/faculty/appraisal" element={<AppraisalForm />} />
          <Route path="/faculty/appraisal/status" element={<FacultyAppraisalStatus />} />
        </Route>

        <Route element={<ProtectedRoute allowedRoles={["HOD"]} />}>
          <Route path="/hod/dashboard" element={<HODDashboard />} />
          <Route path="/hod/profile" element={<FacultyProfile />} />
          <Route path="/hod/appraisal-form" element={<AppraisalForm />} />
        </Route>

        <Route element={<ProtectedRoute allowedRoles={["PRINCIPAL"]} />}>
          <Route path="/principal/dashboard" element={<PrincipalDashboard />} />
          <Route path="/principal/profile" element={<FacultyProfile />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
