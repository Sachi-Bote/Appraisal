import { Routes, Route, Navigate, useLocation } from "react-router-dom";
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

        <Route path="/faculty/dashboard" element={<FacultyDashboard />} />
        <Route path="/faculty/profile" element={<FacultyProfile />} />
        <Route path="/faculty/appraisal" element={<AppraisalForm />} />
        <Route path="/faculty/appraisal/status" element={<FacultyAppraisalStatus />} />

        <Route path="/hod/dashboard" element={<HODDashboard />} />
        <Route path="/hod/appraisal-form" element={<AppraisalForm />} />

        <Route path="/principal/dashboard" element={<PrincipalDashboard />} />
      </Routes>
    </Suspense>
  );
}
