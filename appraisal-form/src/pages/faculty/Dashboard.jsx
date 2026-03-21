import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import API, { clearAuthAndRedirect } from "../../api";
import "../../styles/dashboard.css";
import { formatStatus } from "../../utils/textFormatters";
import {
  clearStatusCache,
  fetchAndCacheFacultyStatus,
  getStatusEventKey,
  getLatestAppraisal,
  readStatusCache,
} from "../../utils/appraisalStatusCache";

export default function FacultyDashboard() {
  const navigate = useNavigate();

  const editableStatuses = ["DRAFT", "CHANGES_REQUESTED", "RETURNED_BY_HOD", "RETURNED_BY_PRINCIPAL"];
  const [appraisal, setAppraisal] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    const cached = readStatusCache();

    if (cached) {
      setAppraisal(getLatestAppraisal(cached));
      setLoading(false);
    }

    const fetchCurrentAppraisal = async () => {
      try {
        const statusData = await fetchAndCacheFacultyStatus();
        if (!alive) return;
        setAppraisal(getLatestAppraisal(statusData));
      } catch (error) {
        console.error("Failed to load appraisal status", error);
      } finally {
        if (alive) setLoading(false);
      }
    };

    fetchCurrentAppraisal();

    const refreshFromLatest = () => {
      clearStatusCache();
      fetchCurrentAppraisal();
    };

    const handleStorage = (event) => {
      if (event.key === getStatusEventKey()) {
        refreshFromLatest();
      }
    };

    window.addEventListener("focus", refreshFromLatest);
    window.addEventListener("storage", handleStorage);

    return () => {
      alive = false;
      window.removeEventListener("focus", refreshFromLatest);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  const disableNewForm =
    appraisal &&
    appraisal.status &&
    !editableStatuses.includes(String(appraisal.status).trim().toUpperCase());

  const statusClassName = appraisal?.status
    ? formatStatus(appraisal.status).toLowerCase().replace(/\s+/g, "-")
    : "draft";

  return (
    <div className="dashboard-page">
      <div className="dashboard-shell">
        <div className="dashboard-topbar">
          <div className="dashboard-topbar-brand">
            <div className="dashboard-topbar-icon">SA</div>
            <span className="dashboard-topbar-title">Staff Appraisal System</span>
          </div>

          <div className="dashboard-topbar-nav">
            <button type="button" className="dashboard-nav-link dashboard-nav-link-active">
              Dashboard
            </button>
            <button type="button" className="dashboard-nav-link" onClick={() => navigate("/faculty/profile")}>
              My Profile
            </button>
            <button type="button" className="dashboard-nav-link" onClick={() => navigate("/faculty/appraisal")}>
              Appraisal Form
            </button>
          </div>

          <div className="dashboard-topbar-actions">
            <span className="dashboard-topbar-badge">Faculty Portal</span>
            <button
              className="logout-btn"
              onClick={() => {
                clearAuthAndRedirect();
              }}
            >
              Logout
            </button>
          </div>
        </div>

        <div className="dashboard-header-card">
          <div className="dashboard-title-group">
            <p className="portal-kicker">Staff Appraisal System</p>
            <h2>Faculty Dashboard</h2>
            <p className="dashboard-subtitle">
              Access your profile, appraisal forms, and status
            </p>
          </div>
        </div>

        <div className="dashboard-grid">
          <div className="dashboard-card" onClick={() => navigate("/faculty/profile")}>
            <h3>My Profile</h3>
            <p>View official details and update personal information</p>
          </div>

          <div
            className={`dashboard-card ${disableNewForm ? "disabled" : ""}`}
            onClick={() => {
              if (!disableNewForm) navigate("/faculty/appraisal");
            }}
          >
            <h3>Appraisal Form</h3>
            <p>
              {loading
                ? "Checking appraisal status..."
                : !appraisal || !appraisal.status
                  ? "Fill and submit your annual faculty appraisal"
                  : editableStatuses.includes(String(appraisal.status).trim().toUpperCase()) &&
                    String(appraisal.status).trim().toUpperCase() !== "DRAFT"
                    ? "Edit and re-submit appraisal"
                    : "Appraisal already submitted"}
            </p>
          </div>

          <div className="dashboard-history-section">
            <h3>Submission History</h3>
            {loading ? (
              <p>Loading history...</p>
            ) : !appraisal ? (
              <p className="empty-state-text">No previous submissions found.</p>
            ) : (
              <div className="history-list">
                <div className="history-item">
                  <div className="history-info">
                    <span className="history-year">AY {appraisal.academic_year}</span>
                    <span className={`history-status ${statusClassName}`}>
                      {formatStatus(appraisal.status)}
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: "8px" }} />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
