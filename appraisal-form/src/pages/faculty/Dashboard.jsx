import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import API, { clearAuthAndRedirect } from "../../api";
import "../../styles/dashboard.css";
import "../../styles/HODDashboard.css";
import "../../styles/profile.css";
import { formatStatus } from "../../utils/textFormatters";
import { downloadWithAuth } from "../../utils/downloadFile";
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
  const [statusData, setStatusData] = useState({
    underReview: [],
    approved: [],
    changesRequested: [],
  });
  const [profileSummary, setProfileSummary] = useState({
    full_name: "",
    designation: "",
    department: "",
  });

  useEffect(() => {
    let alive = true;
    const cached = readStatusCache();

    if (cached) {
      setStatusData(cached);
      setAppraisal(getLatestAppraisal(cached));
      setLoading(false);
    }

    const fetchCurrentAppraisal = async () => {
      try {
        const nextStatusData = await fetchAndCacheFacultyStatus();
        if (!alive) return;
        setStatusData(nextStatusData);
        setAppraisal(getLatestAppraisal(nextStatusData));
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
  const normalizedStatus = String(appraisal?.workflow_state || appraisal?.status || "").trim().toUpperCase();
  const isEditable = ["DRAFT", "RETURNED_BY_HOD", "RETURNED_BY_PRINCIPAL", "CHANGES_REQUESTED"].includes(normalizedStatus);
  const hasAppraisal = Boolean(appraisal);
  const approvedCount = statusData.approved.length;
  const pendingCount = statusData.underReview.length;
  const changesCount = statusData.changesRequested.length;
  const lastSubmittedDate = appraisal?.submitted_date || "--";
  const trackStatusText = loading
    ? "Checking latest submission..."
    : hasAppraisal
      ? formatStatus(appraisal.status || appraisal.workflow_state || "DRAFT")
      : "Not Submitted";
  const openFormText = !hasAppraisal
    ? "Start Appraisal"
    : isEditable
      ? "Continue / Edit Appraisal"
      : "View Filled Appraisal";
  const profileName = profileSummary.full_name || "Faculty Member";
  const profileDesignation = profileSummary.designation || "Faculty Member";
  const profileDepartment = profileSummary.department || "Department";
  const currentAy = appraisal?.academic_year || "Current";

  const handleDownloadLatest = async (type) => {
    if (!appraisal) return;
    const baseUrl = `/api/appraisal/${appraisal.id}`;
    const url = type === "PBAS"
      ? appraisal.download_urls?.pbas || `${baseUrl}/pdf/pbas-enhanced/`
      : appraisal.download_urls?.sppu || `${baseUrl}/pdf/sppu-enhanced/`;
    const filename = `${type}_${appraisal.academic_year || "appraisal"}.pdf`;
    try {
      await downloadWithAuth(url, filename);
    } catch {
      alert("Download not available yet.");
    }
  };

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
              <span className="profile-year-pill">AY {currentAy}</span>
              <button type="button" className="profile-primary-action" onClick={() => navigate("/faculty/profile")}>
                Open My Profile
              </button>
            </div>
          </div>
        </section>

        <main className="profile-content">
          <div className="dashboard-shell">
            <section className="hod-stat-grid" style={{ marginTop: "16px", padding: 0, gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}>
              <article className="hod-stat-card hod-stat-card-green">
                <div className="hod-stat-head"><span className="hod-stat-label">Current Status</span></div>
                <strong className="hod-stat-value">{trackStatusText}</strong>
                <p className="hod-stat-meta">Latest workflow state</p>
              </article>
              <article className="hod-stat-card hod-stat-card-amber">
                <div className="hod-stat-head"><span className="hod-stat-label">Under Review</span></div>
                <strong className="hod-stat-value">{pendingCount}</strong>
                <p className="hod-stat-meta">Pending in HOD/Principal review</p>
              </article>
              <article className="hod-stat-card hod-stat-card-blue">
                <div className="hod-stat-head"><span className="hod-stat-label">Approved</span></div>
                <strong className="hod-stat-value">{approvedCount}</strong>
                <p className="hod-stat-meta">Ready for PDF download</p>
              </article>
              <article className="hod-stat-card hod-stat-card-violet">
                <div className="hod-stat-head"><span className="hod-stat-label">Changes Requested</span></div>
                <strong className="hod-stat-value">{changesCount}</strong>
                <p className="hod-stat-meta">Need correction and resubmission</p>
              </article>
            </section>

        <section className="hod-main-grid" style={{ padding: 0, gridTemplateColumns: "1fr 320px", marginTop: "14px" }}>
          <div className="dashboard-history-section" style={{ marginTop: 0 }}>
            <div className="history-header">
              <h3>My Appraisal Submission</h3>
            </div>
            <div className="history-list">
              <div className="history-item" style={{ alignItems: "flex-start", flexDirection: "column" }}>
                <div className="history-info">
                  <span className="history-year">AY {currentAy}</span>
                  <span className={`history-status ${statusClassName}`}>{trackStatusText}</span>
                </div>
                <p className="hod-stat-meta">Last submitted: {lastSubmittedDate}</p>
                <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginTop: "6px" }}>
                  <button className="primary-btn" onClick={() => navigate("/faculty/appraisal")}>{openFormText}</button>
                  <button className="view-btn" onClick={() => navigate("/faculty/appraisal")}>View Filled Form</button>
                  <button className="view-btn" onClick={() => navigate("/faculty/appraisal/status")}>Track Detailed Status</button>
                </div>
              </div>
            </div>

            <div className="history-download-panel" style={{ marginTop: "16px" }}>
              <p className="history-download-title">Downloads</p>
              <div className="history-download-actions">
                <button
                  className="history-download-btn history-download-btn-blue"
                  onClick={() => handleDownloadLatest("SPPU")}
                  disabled={!appraisal}
                >
                  Download SPPU
                </button>
                <button
                  className="history-download-btn history-download-btn-violet"
                  onClick={() => handleDownloadLatest("PBAS")}
                  disabled={!appraisal}
                >
                  Download PBAS
                </button>
              </div>
            </div>
          </div>
            <aside className="quick-actions-card">
              <div className="quick-actions-header">
                <h3>Quick Actions</h3>
                <p>Faculty shortcuts</p>
              </div>
              <button type="button" className="quick-action-item" onClick={() => navigate("/faculty/appraisal")}>
                <span className="quick-action-icon quick-action-icon-blue">AF</span>
                <span className="quick-action-text"><strong>Open Appraisal Form</strong><small>Fill, edit, or view submitted form</small></span>
                <span className="quick-action-arrow">&gt;</span>
              </button>
              <button type="button" className="quick-action-item" onClick={() => navigate("/faculty/appraisal/status")}>
                <span className="quick-action-icon quick-action-icon-amber">ST</span>
                <span className="quick-action-text"><strong>Track Status</strong><small>Review stage-wise progress</small></span>
                <span className="quick-action-arrow">&gt;</span>
              </button>
              <button type="button" className="quick-action-item" onClick={() => navigate("/faculty/profile")}>
                <span className="quick-action-icon quick-action-icon-green">PR</span>
                <span className="quick-action-text"><strong>Open Profile</strong><small>Manage account details and password</small></span>
                <span className="quick-action-arrow">&gt;</span>
              </button>
            </aside>
          </section>
          </div>
        </main>
    </div>
  );
}
