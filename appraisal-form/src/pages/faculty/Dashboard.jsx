import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import API, { clearAuthAndRedirect } from "../../api";
import "../../styles/dashboard.css";
import "../../styles/profile.css";
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

  const [appraisal, setAppraisal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profileSummary, setProfileSummary] = useState({
    full_name: "",
    designation: "",
    department: "",
  });

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
    API.get("me/")
      .then((res) => {
        const data = res?.data || {};
        setProfileSummary({
          full_name: data.full_name || data.username || "Faculty Member",
          designation: data.designation || "Faculty Member",
          department: data.department || "Department",
        });
      })
      .catch(() => {});

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

  const statusClassName = appraisal?.status
    ? formatStatus(appraisal.status).toLowerCase().replace(/\s+/g, "-")
    : "draft";
  const profileName = profileSummary.full_name || "Faculty Member";
  const profileDesignation = profileSummary.designation || "Faculty Member";
  const profileDepartment = profileSummary.department || "Department";

  return (
    <div className="profile-page-shell">
      <nav className="profile-topnav">
        <div className="profile-brand">
          <div className="profile-brand-icon">SA</div>
          <div className="profile-brand-copy">
            <span className="profile-brand-title">Staff Appraisal System</span>
            <span className="profile-brand-subtitle">Faculty Dashboard</span>
          </div>
        </div>

        <div className="profile-topnav-links">
          <button type="button" className="profile-topnav-link profile-topnav-link-active">
            Dashboard
          </button>
          <button type="button" className="profile-topnav-link" onClick={() => navigate("/faculty/profile")}>
            My Profile
          </button>
          <button type="button" className="profile-topnav-link" onClick={() => navigate("/faculty/appraisal")}>
            Appraisal Form
          </button>
        </div>

        <div className="profile-topnav-actions">
          <span className="profile-topnav-badge">Faculty Portal</span>
          <button
            type="button"
            className="profile-topnav-logout"
            onClick={() => {
              clearAuthAndRedirect();
            }}
          >
            Logout
          </button>
        </div>
      </nav>

      <section className="profile-hero">
          <div className="profile-hero-ring profile-hero-ring-left" />
          <div className="profile-hero-ring profile-hero-ring-right" />
          <div className="profile-hero-main">
            <div className="profile-hero-identity">
              <div className="profile-avatar-wrap">
                <div className="profile-avatar-frame">
                  <span className="profile-avatar-fallback">{String(profileName).trim().charAt(0).toUpperCase() || "F"}</span>
                </div>
              </div>
              <div className="profile-hero-copy">
                <p className="profile-hero-kicker">Dashboard Workspace</p>
                <h1>{profileName}</h1>
                <div className="profile-hero-meta">
                  <span>{profileDesignation}</span>
                  <span className="profile-meta-dot" />
                  <span>{profileDepartment}</span>
                </div>
              </div>
            </div>
            <div className="profile-hero-actions">
              <button type="button" className="profile-primary-action" onClick={() => navigate("/faculty/profile")}>
                Open My Profile
              </button>
            </div>
          </div>
        </section>

        <main className="profile-content">
          <div className="dashboard-shell">
            <div className="dashboard-grid">
          <div className="dashboard-card" onClick={() => navigate("/faculty/profile")}>
            <h3>My Profile</h3>
            <p>View official details and update personal information</p>
          </div>

          <div className="dashboard-card" onClick={() => navigate("/faculty/appraisal/status")}>
            <h3>Track Status & Download</h3>
            <p>View review status and download approved SPPU/PBAS forms.</p>
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
        </main>
    </div>
  );
}
