import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../../styles/FacultyAppraisalStatus.css";
import { downloadWithAuth } from "../../utils/downloadFile";
import {
  clearStatusCache,
  fetchAndCacheFacultyStatus,
  getStatusEventKey,
  readStatusCache,
} from "../../utils/appraisalStatusCache";
import { clearAuthAndRedirect, API_BASE_URL } from "../../api";

const getTabData = (statusData, tab) => {
  const underReview = statusData?.underReview || [];
  const approved = statusData?.approved || [];
  const changesRequested = statusData?.changesRequested || [];
  if (tab === "review") return underReview;
  if (tab === "approved") return approved;
  if (tab === "changes") return changesRequested;
  return [...underReview, ...approved, ...changesRequested].sort((a, b) => Number(b?.id || 0) - Number(a?.id || 0));
};

const getPipelineState = (workflowState) => {
  const s = String(workflowState || "").toUpperCase();
  if (s === "FINALIZED" || s === "PRINCIPAL_APPROVED") return 4;
  if (s === "HOD_APPROVED" || s === "REVIEWED_BY_PRINCIPAL") return 3;
  if (s === "REVIEWED_BY_HOD" || s === "SUBMITTED") return 2;
  if (s === "RETURNED_BY_HOD" || s === "RETURNED_BY_PRINCIPAL") return -1;
  return 1;
};

const StatusBadge = ({ item }) => {
  const state = String(item?.workflow_state || item?.status || "").toUpperCase();
  if (state.includes("RETURNED")) return <span className="badge b-red">↩ Changes Req.</span>;
  if (state === "FINALIZED" || state === "PRINCIPAL_APPROVED") return <span className="badge b-green">✓ Approved</span>;
  return <span className="badge b-amber">⏳ Under Review</span>;
};

const Pipeline = ({ state }) => {
  const step = getPipelineState(state);
  return (
    <div className="tl-mini">
      <div className="tl-step-wrap">
        <div className={`tl-dot ${step >= 1 ? "done" : ""}`}>{step >= 1 ? "✓" : "1"}</div>
        <div className={`tl-step-lbl ${step >= 1 ? "done" : ""}`}>Submitted</div>
      </div>
      <div className={`tl-line ${step >= 2 ? "done" : ""}`}></div>
      <div className="tl-step-wrap">
        <div className={`tl-dot ${step >= 2 ? "done" : step === -1 ? "warn" : step === 2 ? "active" : ""}`}>
          {step >= 2 ? "✓" : step === -1 ? "↩" : "2"}
        </div>
        <div className={`tl-step-lbl ${step >= 2 ? "done" : step === -1 ? "warn" : step === 2 ? "active" : ""}`}>HOD</div>
      </div>
      <div className={`tl-line ${step >= 3 ? "done" : ""}`}></div>
      <div className="tl-step-wrap">
        <div className={`tl-dot ${step >= 3 ? "done" : step === 3 ? "active" : ""}`}>{step >= 3 ? "✓" : "3"}</div>
        <div className={`tl-step-lbl ${step >= 3 ? "done" : step === 3 ? "active" : ""}`}>Principal</div>
      </div>
      <div className={`tl-line ${step >= 4 ? "done" : ""}`}></div>
      <div className="tl-step-wrap">
        <div className={`tl-dot ${step >= 4 ? "ok" : step === 4 ? "active" : ""}`}>{step >= 4 ? "✓" : "4"}</div>
        <div className={`tl-step-lbl ${step >= 4 ? "ok" : step === 4 ? "active" : ""}`}>Final</div>
      </div>
    </div>
  );
};

export default function FacultyAppraisalStatus() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
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
      setLoading(false);
    }

    const load = async () => {
      try {
        setError(null);
        const normalized = await fetchAndCacheFacultyStatus();
        if (!alive) return;
        setStatusData(normalized);
      } catch {
        if (alive) setError("Unable to load appraisal status");
      } finally {
        if (alive) setLoading(false);
      }
    };

    load();

    const fetchMe = async () => {
        try {
            const authToken = localStorage.getItem("access") || sessionStorage.getItem("access");
            const res = await fetch(`${API_BASE_URL}me/`, {
                headers: { Authorization: `Bearer ${authToken}` }
            });
            const data = await res.json();
            if (alive) {
                setProfileSummary({
                    full_name: data.full_name || data.username || "Staff Member",
                    designation: data.designation || "Staff",
                    department: data.department || "Department",
                });
            }
        } catch (e) {
            console.error("Failed to load profile summary", e);
        }
    };
    fetchMe();

    const refresh = () => {
      clearStatusCache();
      load();
    };
    const handleStorage = (event) => {
      if (event.key === getStatusEventKey()) refresh();
    };
    window.addEventListener("focus", refresh);
    window.addEventListener("storage", handleStorage);
    return () => {
      alive = false;
      window.removeEventListener("focus", refresh);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  const role = String(localStorage.getItem("role") || sessionStorage.getItem("role") || "").trim().toUpperCase();
  const isHOD = role === "HOD";
  const dashboardPath = isHOD ? "/hod/dashboard" : "/faculty/dashboard";
  const profilePath = isHOD ? "/hod/profile" : "/faculty/profile";
  const appraisalPath = isHOD ? "/hod/appraisal-form" : "/faculty/appraisal";
  
  const tabData = useMemo(() => getTabData(statusData, activeTab), [statusData, activeTab]);

  const counts = {
    all: (statusData.underReview.length + statusData.approved.length + statusData.changesRequested.length),
    review: statusData.underReview.length,
    approved: statusData.approved.length,
    changes: statusData.changesRequested.length,
  };

  const onDownload = async (item, type) => {
    const base = `/api/appraisal/${item.id}`;
    const url = type === "PBAS"
      ? item.download_urls?.pbas || `${base}/pdf/pbas-enhanced/`
      : item.download_urls?.sppu || `${base}/pdf/sppu-enhanced/`;
    try {
      await downloadWithAuth(url, `${type}_${item.academic_year}.pdf`);
    } catch {
      alert("Download not available yet.");
    }
  };

  return (
    <div className="status-page-body">
      {/* NAV */}
      <nav className="topnav">
        <div className="nav-brand">
          <div className="nav-icon"><svg viewBox="0 0 18 18" fill="none"><rect x="2" y="2" width="6" height="6" rx="1.5" fill="white" opacity=".95"/><rect x="10" y="2" width="6" height="6" rx="1.5" fill="white" opacity=".5"/><rect x="2" y="10" width="6" height="6" rx="1.5" fill="white" opacity=".5"/><rect x="10" y="10" width="6" height="6" rx="1.5" fill="white" opacity=".95"/></svg></div>
          <span className="nav-title">Staff Appraisal System</span>
        </div>
        <div className="nav-links">
          <div className="nav-link" onClick={() => navigate(dashboardPath)}>Dashboard</div>
          <div className="nav-link" onClick={() => navigate(profilePath)}>My Profile</div>
          <div className="nav-link" onClick={() => navigate(appraisalPath)}>Appraisal Form</div>
          <div className="nav-link active">Track Status</div>
        </div>
        <div className="nav-right">
          <div className="nav-av">{String(profileSummary.full_name).trim().split(' ').map(w => w[0] || '').join('').substring(0,2).toUpperCase() || "S"}</div>
          <button className="btn-logout" onClick={() => clearAuthAndRedirect()}>Logout</button>
        </div>
      </nav>

      {/* HERO */}
      <div className="hero">
        <div className="hero-ring"></div>
        <div className="hero-inner">
          <div>
            <button className="back-link" style={{background: 'none', border: 'none', cursor: 'pointer', padding: 0}} onClick={() => navigate(dashboardPath)}>← Back to Dashboard</button>
            <div className="hero-label">Track approval status</div>
            <div className="hero-title">Appraisal Status</div>
            <div className="hero-chips">
              <span className="hero-chip">{profileSummary.full_name}</span>
              <span className="hero-sep">·</span>
              <span className="hero-chip">{profileSummary.department}</span>
              <span className="hero-sep">·</span>
              <span className="hero-chip">AY 2025–26</span>
            </div>
          </div>
          <div className="hero-pill">
            <div className="hero-pill-dot" style={{background:"#fbbf24"}}></div>
            AY 2025–26 Active
          </div>
        </div>
      </div>

      {/* CONTENT */}
      <div className="content">
        <div className="tabs-card">
          {/* TABS */}
          <div className="tab-bar">
            <div className={`tab ${activeTab === 'all' ? 'active' : ''}`} onClick={() => setActiveTab('all')}>
              All <span className="tab-chip tc-blue">{counts.all}</span>
            </div>
            <div className={`tab ${activeTab === 'review' ? 'active' : ''}`} onClick={() => setActiveTab('review')}>
              Under Review <span className="tab-chip tc-amber">{counts.review}</span>
            </div>
            <div className={`tab ${activeTab === 'approved' ? 'active' : ''}`} onClick={() => setActiveTab('approved')}>
              Approved <span className="tab-chip tc-green">{counts.approved}</span>
            </div>
            <div className={`tab ${activeTab === 'changes' ? 'active' : ''}`} onClick={() => setActiveTab('changes')}>
              Changes Requested <span className="tab-chip tc-red">{counts.changes}</span>
            </div>
          </div>

          <div className="tab-content active">
            {loading && <div className="empty"><div className="empty-sub">Loading status...</div></div>}
            {error && <div className="empty"><div className="empty-title">Error</div><div className="empty-sub">{error}</div></div>}
            
            {!loading && !error && (
              <div className="tbl-wrap">
                <table className="appr-table">
                  <thead>
                    <tr>
                      <th>Academic Year</th>
                      <th>Approval Pipeline</th>
                      <th>Status</th>
                      <th>Score</th>
                      <th>Remark</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tabData.length === 0 ? (
                      <tr><td colSpan="6" className="empty"><div className="empty-title">No records found</div></td></tr>
                    ) : (
                      tabData.map(item => {
                        const score = Number(item.calculated_total_score || 0).toFixed(2);
                        const isApproved = ["FINALIZED", "PRINCIPAL_APPROVED"].includes(String(item.workflow_state || "").toUpperCase());
                        const isReturned = String(item.workflow_state || "").includes("RETURNED");
                        
                        return (
                          <tr key={item.id}>
                            <td>
                              <div style={{fontWeight:500,color:'var(--text)'}}>AY {item.academic_year}</div>
                              <div style={{fontSize:'11px',color:'var(--muted)',marginTop:'2px'}}>Submitted {item.submitted_date || "--"}</div>
                            </td>
                            <td><Pipeline state={item.workflow_state} /></td>
                            <td><StatusBadge item={item} /></td>
                            <td>
                              <span className="score-val" style={{color: isApproved ? 'var(--green)' : isReturned ? 'var(--red)' : ''}}>
                                {score}
                              </span>
                            </td>
                            <td><span className="remark-pill" title={item.remarks}>{item.remarks || "No remarks yet"}</span></td>
                            <td>
                              <div className="btns">
                                <button className="btn btn-ghost" onClick={() => navigate(appraisalPath)}>👁 View</button>
                                {(isApproved || item.download_available) && (
                                  <>
                                    <button className="btn btn-blue" onClick={() => onDownload(item, "SPPU")}>📄 SPPU</button>
                                    <button className="btn btn-purple" onClick={() => onDownload(item, "PBAS")}>📑 PBAS</button>
                                  </>
                                )}
                                {isReturned && (
                                  <button className="btn btn-red" onClick={() => navigate(appraisalPath)}>✎ Resubmit</button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* Changes alert banner at bottom (if any changes requested in the latest record) */}
            {!loading && statusData.changesRequested.length > 0 && (
              <div className="changes-alert">
                <strong>⚠ Action Required — AY {statusData.changesRequested[0].academic_year}</strong>
                {statusData.changesRequested[0].remarks || "Changes requested by reviewer. Please update and resubmit."}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
