import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import API, { clearAuthAndRedirect } from "../../api";
import "../../styles/dashboard.css";
import "../../styles/HODDashboard.css";
import "../../styles/profile.css";
import "../../styles/FacultyDashboard.css";
import { formatStatus } from "../../utils/textFormatters";
import { downloadWithAuth, getAccessToken } from "../../utils/downloadFile";
import {
  clearStatusCache,
  fetchAndCacheFacultyStatus,
  getStatusEventKey,
  getLatestAppraisal,
  readStatusCache,
} from "../../utils/appraisalStatusCache";

// Import AppraisalSummary for modal
import AppraisalSummary from "../../components/AppraisalSummary";

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

  const [selectedAppraisal, setSelectedAppraisal] = useState(null);

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
        const fn = data.full_name || data.username || "Faculty Member";
        setProfileSummary({
          full_name: fn,
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

  const normalizedStatus = String(appraisal?.workflow_state || appraisal?.status || "").trim().toUpperCase();
  const isEditable = ["DRAFT", "RETURNED_BY_HOD", "RETURNED_BY_PRINCIPAL", "CHANGES_REQUESTED"].includes(normalizedStatus);
  const hasAppraisal = Boolean(appraisal);
  const lastSubmittedDate = appraisal?.submitted_date || "--";
  const trackStatusText = loading
    ? "Checking..."
    : hasAppraisal
      ? formatStatus(appraisal.status || appraisal.workflow_state || "DRAFT")
      : "Not Submitted";
  const profileName = profileSummary.full_name || "Faculty Member";
  const profileDesignation = profileSummary.designation || "Faculty";
  const profileDepartment = profileSummary.department || "Department";
  const currentAy = appraisal?.academic_year || "2025-26";
  const avatarInitials = String(profileName).trim().split(' ').map(w => w[0] || '').join('').substring(0,2).toUpperCase() || "F";

  const allHistory = [
    ...(statusData.underReview || []),
    ...(statusData.approved || []),
    ...(statusData.changesRequested || [])
  ].sort((a, b) => Number(b.id) - Number(a.id));

  const handleDownloadLatest = async (type, specificAppraisal) => {
    const target = specificAppraisal || appraisal;
    if (!target) return;
    const baseUrl = `/api/appraisal/${target.id}`;
    const url = type === "PBAS"
      ? target.download_urls?.pbas || `${baseUrl}/pdf/pbas-enhanced/`
      : target.download_urls?.sppu || `${baseUrl}/pdf/sppu-enhanced/`;
    const filename = `${type}_${target.academic_year || "appraisal"}.pdf`;
    try {
      await downloadWithAuth(url, filename);
    } catch {
      alert("Download not available yet.");
    }
  };

  const getStatusStepObj = () => {
    const s = normalizedStatus;
    // steps: Drafted(1), Submitted(2), HOD(3), Principal(4), Finalized(5)
    if (!hasAppraisal) return { step: 0, pendingOn: 1, text: "Not Started" };
    if (s === "DRAFT") return { step: 1, pendingOn: 2, text: "Draft Saved" };
    if (s === "SUBMITTED") return { step: 2, pendingOn: 3, text: "Awaiting HOD" };
    if (s === "REVIEWED_BY_HOD" || s === "HOD_APPROVED") return { step: 3, pendingOn: 4, text: "Awaiting Principal" };
    if (s === "PRINCIPAL_APPROVED" || s === "FINALIZED") return { step: 5, pendingOn: 0, text: "Finalized" };
    if (s === "CHANGES_REQUESTED" || s.includes("RETURNED")) return { step: 1, pendingOn: 2, text: "Changes Requested" };
    return { step: 2, pendingOn: 3, text: "Under Review" };
  };

  const stepObj = getStatusStepObj();
  const openFormText = !hasAppraisal ? "Start Appraisal" : isEditable ? "Continue Appraisal" : "View Appraisal";

  return (
    <div className="profile-page-shell">
      <nav className="profile-topnav">
        <div className="profile-brand">
          <div className="profile-brand-icon">SA</div>
          <div className="profile-brand-copy">
            <span className="profile-brand-title">Staff Appraisal System</span>
            <span className="profile-brand-subtitle">Faculty Workspace</span>
          </div>
        </div>
        <div className="profile-topnav-links">
          <button type="button" className="profile-topnav-link profile-topnav-link-active" onClick={() => navigate("/faculty")}>
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
          <div className="profile-avatar-wrap" style={{width: "32px", height: "32px", cursor: "pointer"}} onClick={() => navigate("/faculty/profile")}>
             <div className="profile-avatar-frame" style={{width: "100%", height: "100%"}}>
                <span className="profile-avatar-fallback" style={{fontSize: "13px"}}>{avatarInitials}</span>
             </div>
          </div>
          <button type="button" className="profile-topnav-logout" onClick={() => clearAuthAndRedirect()}>
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
                <span className="profile-avatar-fallback">{avatarInitials}</span>
              </div>
            </div>
            <div className="profile-hero-copy">
              <p className="profile-hero-kicker">Faculty Dashboard</p>
              <h1>{profileName}</h1>
              <div className="profile-hero-meta">
                <span>{profileDesignation}</span>
                <span className="profile-meta-dot" />
                <span>{profileDepartment}</span>
                <span className="profile-meta-dot" />
                <span>SPPU</span>
              </div>
            </div>
          </div>
          <div className="profile-hero-actions">
            <span className="profile-year-pill">AY {currentAy} Active</span>
            <button type="button" className="profile-primary-action" style={{marginLeft: '8px'}} onClick={() => navigate("/faculty/appraisal")}>
              📄 {openFormText}
            </button>
          </div>
        </div>
      </section>

      <main className="profile-content">
        <div className="faculty-dashboard-container" style={{ minHeight: 'auto', background: 'transparent' }}>
          
          <div className="content" style={{ marginTop: 0, padding: 0 }}>

            {/* STAT CARDS */}
            <div className="stat-grid">
              <div className="stat-card">
                <div className="sc-top"><span className="sc-lbl">Appraisal Status</span><div className="sc-icon ic-green">✓</div></div>
                <div className="sc-val" style={{fontSize: '18px'}}>{trackStatusText}</div>
                {hasAppraisal && <span className={`badge ${normalizedStatus === 'FINALIZED' ? 'b-green' : 'b-amber'}`}>● {normalizedStatus === 'FINALIZED' ? 'Finalized' : isEditable ? 'Needs Action' : 'Locked'}</span>}
              </div>
              <div className="stat-card">
                <div className="sc-top"><span className="sc-lbl">Total Score</span><div className="sc-icon ic-blue">📊</div></div>
                <div className="sc-val">{appraisal ? Number(appraisal.calculated_total_score || 0).toFixed(2) : '--'}</div>
                <div className="sc-sub">Out of 100 points</div>
              </div>
              <div className="stat-card">
                <div className="sc-top"><span className="sc-lbl">HOD Review</span><div className="sc-icon ic-amber">⏳</div></div>
                <div className="sc-val" style={{fontSize: '18px'}}>{stepObj.step >= 3 ? "Completed" : "Pending"}</div>
                <span className={stepObj.step >= 3 ? "badge b-green" : "badge b-amber"}>{stepObj.step >= 3 ? 'HOD Approved' : 'Awaiting HOD'}</span>
              </div>
              <div className="stat-card">
                <div className="sc-top"><span className="sc-lbl">Teaching Grade</span><div className="sc-icon ic-purple">🎓</div></div>
                <div className="sc-val" style={{fontSize: '18px'}}>Evaluating..</div>
                <div className="sc-sub">Data synced</div>
              </div>
            </div>

            {/* MAIN GRID */}
            <div className="main-grid">
              <div>
                {/* APPRAISAL FORM STATUS */}
                <div className="panel">
                  <div className="ph">
                    <div className="ph-left"><div className="pa pa-blue"></div><div><div className="pt">My Appraisal Form</div><div className="ps">AY {currentAy} · Submission status</div></div></div>
                    <div style={{display:'flex', gap:'8px', flexWrap:'wrap', justifyContent:'flex-end'}}>
                      <button className="btn-view-form" onClick={() => navigate("/faculty/appraisal/status")} disabled={!hasAppraisal}>👁 Track Status</button>
                      <button className="btn-continue-form" onClick={() => navigate("/faculty/appraisal")}>✎ {openFormText}</button>
                    </div>
                  </div>
                  <div className="pb" style={{overflowX: 'auto'}}>

                    {/* completion progress */}
                    <div className="prog-wrap" style={{marginBottom:'20px'}}>
                      <div className="prog-top"><span className="prog-lbl">Form Submission Progress</span><span className="prog-pct">{stepObj.step} / 5 steps done</span></div>
                      <div className="prog-bar"><div className="prog-fill" style={{width:`${Math.max(20, stepObj.step * 20)}%`}}></div></div>
                      <div className="prog-steps">
                        <span className={`prog-step-lbl ${stepObj.step >= 1 ? 'done' : ''}`}>Drafted</span>
                        <span className={`prog-step-lbl ${stepObj.step >= 2 ? 'done' : ''}`}>Submitted</span>
                        <span className={`prog-step-lbl ${stepObj.step >= 3 ? 'done' : ''}`}>HOD Reviewed</span>
                        <span className={`prog-step-lbl ${stepObj.step >= 4 ? 'done' : ''}`}>Principal</span>
                        <span className={`prog-step-lbl ${stepObj.step === 5 ? 'done' : ''}`}>Finalized</span>
                      </div>
                    </div>

                    {/* status tracker */}
                    <div className="status-track" style={{minWidth:'450px'}}>
                      <div className="st-step">
                        <div className="st-row">
                          <div className={`st-dot ${stepObj.step >= 1 ? 'done' : 'active'}`}>{stepObj.step >= 1 ? '✓' : '1'}</div>
                          <div className={`st-line ${stepObj.step >= 1 ? 'done' : ''}`}></div>
                        </div>
                        <div className={`st-label ${stepObj.step >= 1 ? 'done' : 'active'}`}>Drafted</div>
                        <div className="st-sub">Saved</div>
                      </div>
                      
                      <div className="st-step">
                        <div className="st-row">
                          <div className={`st-dot ${stepObj.step >= 2 ? 'done' : stepObj.pendingOn === 2 ? 'pending' : ''}`}>{stepObj.step >= 2 ? '✓' : stepObj.pendingOn === 2 ? '⏳' : '2'}</div>
                          <div className={`st-line ${stepObj.step >= 2 ? 'done' : ''}`}></div>
                        </div>
                        <div className={`st-label ${stepObj.step >= 2 ? 'done' : stepObj.pendingOn === 2 ? 'pending' : ''}`}>Submitted</div>
                        <div className="st-sub">{stepObj.step >= 2 ? lastSubmittedDate : (stepObj.pendingOn === 2 ? 'In progress' : '')}</div>
                      </div>

                      <div className="st-step">
                        <div className="st-row">
                          <div className={`st-dot ${stepObj.step >= 3 ? 'done' : stepObj.pendingOn === 3 ? 'pending' : ''}`}>{stepObj.step >= 3 ? '✓' : stepObj.pendingOn === 3 ? '⏳' : '3'}</div>
                          <div className={`st-line ${stepObj.step >= 3 ? 'done' : ''}`}></div>
                        </div>
                        <div className={`st-label ${stepObj.step >= 3 ? 'done' : stepObj.pendingOn === 3 ? 'pending' : ''}`}>HOD Review</div>
                        <div className="st-sub">{stepObj.step >= 3 ? 'Completed' : stepObj.pendingOn === 3 ? 'In progress' : 'Awaiting'}</div>
                      </div>

                      <div className="st-step">
                        <div className="st-row">
                          <div className={`st-dot ${stepObj.step >= 4 ? 'done' : stepObj.pendingOn === 4 ? 'pending' : ''}`}>{stepObj.step >= 4 ? '✓' : stepObj.pendingOn === 4 ? '⏳' : '4'}</div>
                          <div className={`st-line ${stepObj.step >= 4 ? 'done' : ''}`}></div>
                        </div>
                        <div className={`st-label ${stepObj.step >= 4 ? 'done' : stepObj.pendingOn === 4 ? 'pending' : ''}`}>Principal</div>
                        <div className="st-sub">{stepObj.step >= 4 ? 'Approved' : stepObj.pendingOn === 4 ? 'In progress' : 'Awaiting'}</div>
                      </div>

                      <div className="st-step">
                        <div className="st-row"><div className={`st-dot ${stepObj.step === 5 ? 'done' : ''}`}>{stepObj.step === 5 ? '✓' : '5'}</div></div>
                        <div className={`st-label ${stepObj.step === 5 ? 'done' : ''}`}>Finalized</div>
                        <div className="st-sub">{stepObj.step === 5 ? 'Done' : '—'}</div>
                      </div>
                    </div>

                    {/* remarks preview */}
                    {appraisal?.remarks && (
                      <div style={{marginTop:'16px', padding:'14px 16px', background:'#fffbeb', border:'1px solid #fde68a', borderRadius:'10px', fontSize:'12px', color:'var(--amber)'}}>
                        <strong style={{display:'block', marginBottom:'3px', fontSize:'11px', textTransform:'uppercase', letterSpacing:'.4px'}}>Reviewer Remark</strong>
                        {appraisal.remarks}
                      </div>
                    )}
                  </div>
                </div>

                {/* SUBMISSION HISTORY */}
                <div className="panel">
                  <div className="ph">
                    <div className="ph-left"><div className="pa pa-green"></div><div><div className="pt">Submission History</div><div className="ps">All academic years</div></div></div>
                  </div>
                  <div style={{overflowX:'auto'}}>
                    <table className="hist-table">
                      <thead><tr><th>Academic Year</th><th>Status</th><th>Submitted On</th><th>Score</th><th>Actions</th></tr></thead>
                      <tbody>
                        {allHistory.length === 0 && <tr><td colSpan="5" style={{textAlign: "center", padding: "20px", color: "var(--muted)"}}>No submissions found</td></tr>}
                        {allHistory.map(row => {
                           const isFinal = row.status === 'FINALIZED' || row.status === 'PRINCIPAL_APPROVED';
                           return (
                             <tr key={row.id}>
                               <td className="yr-cell">AY {row.academic_year}</td>
                               <td><span className={`badge ${isFinal ? 'b-green' : 'b-amber'}`}>● {formatStatus(row.status)}</span></td>
                               <td style={{color:'var(--muted)', fontSize:'12px'}}>{row.submitted_date || '--'}</td>
                               <td style={{fontWeight:600, color:'var(--blue)'}}>{Number(row.calculated_total_score || 0).toFixed(2)}</td>
                               <td style={{display:'flex', gap:'6px', flexWrap:'wrap', borderBottom: 'none'}}>
                                 <button className="btn-track" onClick={() => navigate("/faculty/appraisal/status")}>👁 Track</button>
                                 <button className="btn-dl btn-dl-sppu" onClick={() => handleDownloadLatest('SPPU', row)} disabled={!isFinal}>SPPU</button>
                                 <button className="btn-dl btn-dl-pbas" onClick={() => handleDownloadLatest('PBAS', row)} disabled={!isFinal}>PBAS</button>
                               </td>
                             </tr>
                           );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* SIDEBAR */}
              <div className="sidebar" style={{ marginTop: 0, paddingTop: 0 }}>
                {/* deadline */}
                <div className="deadline-card">
                  <div className="dl-label">Submission Deadline</div>
                  <div className="dl-date">31 March 2026</div>
                  <div className="dl-sub">AY 2025–26 · SPPU</div>
                  <div className="dl-countdown">
                    <div className="dl-unit"><div className="dl-num">10</div><div className="dl-u">Days</div></div>
                    <div className="dl-unit"><div className="dl-num">04</div><div className="dl-u">Hours</div></div>
                    <div className="dl-unit"><div className="dl-num">22</div><div className="dl-u">Mins</div></div>
                  </div>
                </div>

                {/* quick actions */}
                <div className="side-card">
                  <div className="sc-hdr"><span className="sc-hdr-title">Quick Actions</span></div>
                  <div className="sc-body" style={{padding:'10px 12px'}}>
                    <button className="qa-item" onClick={() => navigate("/faculty/appraisal/status")} disabled={!hasAppraisal}><div className="qa-icon ic-blue">📄</div>Track Workflow Status<span className="qa-arrow">›</span></button>
                    <button className="qa-item" onClick={() => navigate("/faculty/appraisal")}><div className="qa-icon ic-purple">✎</div>{openFormText}<span className="qa-arrow">›</span></button>
                    <button className="qa-item" onClick={() => handleDownloadLatest("SPPU")} disabled={stepObj.step < 4}><div className="qa-icon ic-green">↓</div>Download SPPU PDF<span className="qa-arrow">›</span></button>
                    <button className="qa-item" onClick={() => handleDownloadLatest("PBAS")} disabled={stepObj.step < 4}><div className="qa-icon" style={{background:'#ede9fe', color: 'var(--purple)'}}>↓</div>Download PBAS PDF<span className="qa-arrow">›</span></button>
                    <button className="qa-item" onClick={() => navigate("/faculty/profile")}><div className="qa-icon ic-amber">👤</div>Edit My Profile<span className="qa-arrow">›</span></button>
                  </div>
                </div>

                {/* checklist */}
                <div className="side-card">
                  <div className="sc-hdr"><span className="sc-hdr-title">Form Checklist</span></div>
                  <div className="sc-body">
                    <div className="chk-item"><div className={`chk-icon ${hasAppraisal ? 'ci-done' : 'ci-act'}`}>{hasAppraisal ? '✓' : '→'}</div>General information</div>
                    <div className="chk-item"><div className={`chk-icon ${hasAppraisal ? 'ci-done' : 'ci-todo'}`}>{hasAppraisal ? '✓' : ''}</div>Teaching activities</div>
                    <div className="chk-item"><div className={`chk-icon ${hasAppraisal ? 'ci-done' : 'ci-todo'}`}>{hasAppraisal ? '✓' : ''}</div>Research &amp; publications</div>
                    <div className="chk-item"><div className={`chk-icon ${hasAppraisal ? 'ci-done' : 'ci-todo'}`}>{hasAppraisal ? '✓' : ''}</div>Activities &amp; contributions</div>
                  </div>
                </div>

              </div>
            </div>
          </div>

          {/* VIEW APPRAISAL MODAL */}
          <div className={`modal-overlay ${selectedAppraisal ? 'open' : ''}`} id="appraisalModal" onClick={(e) => { if(e.target.id === 'appraisalModal') setSelectedAppraisal(null); }}>
            {selectedAppraisal && (
              <div className="modal">
                <div className="modal-header">
                  <div>
                    <div className="modal-title">My Appraisal Form — AY {selectedAppraisal.academic_year}</div>
                    <div className="modal-sub">{profileName} · {profileDepartment} · View Mode</div>
                  </div>
                  <button className="modal-close" onClick={() => setSelectedAppraisal(null)}>×</button>
                </div>
                <div className="modal-body">
                  
                  {/* General Info mapped to full layout logic via AppraisalSummary safely */}
                  {selectedAppraisal.appraisal_data ? (
                     <div style={{ padding: '0', background: '#f9fafb', borderRadius: '8px', border: '1px solid #e5e7eb', marginBottom: '20px', minHeight: '100px', maxHeight: '500px', overflowY: 'auto' }}>
                       <AppraisalSummary data={selectedAppraisal.appraisal_data} />
                     </div>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
                      Detailed form data is not directly injected to the history block. 
                      <br/>Please open the "Track Status" page to view full details safely.
                    </div>
                  )}

                  {/* Score */}
                  <div className="modal-section" style={{marginTop: '20px'}}>
                    <div className="modal-section-title">Score Summary</div>
                    <div style={{background:'linear-gradient(135deg,#eff6ff 0%,#f0fdf4 100%)', border:'1px solid #c7d9f5', borderRadius:'12px', padding:'16px', display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:'12px'}}>
                      <div style={{textAlign:'center', padding:'0 20px', borderRight:'1px solid var(--border)'}}>
                        <div style={{fontSize:'11px', color:'var(--muted)', textTransform:'uppercase', letterSpacing:'.4px'}}>Total Score</div>
                        <div style={{fontSize:'36px', fontWeight:600, color:'var(--blue)', lineHeight:1.1}}>{Number(selectedAppraisal.calculated_total_score || 0).toFixed(2)}</div>
                        <div style={{fontSize:'11px', color:'var(--muted)'}}>out of 100</div>
                      </div>
                      <div style={{flex:1, minWidth:'200px'}}>
                        <div style={{display:'flex', justifyContent:'space-between', fontSize:'12px', padding:'6px 0', borderBottom:'1px solid var(--border)'}}><span style={{color:'var(--muted)'}}>Workflow Status</span><span style={{fontWeight:500}}>{formatStatus(selectedAppraisal.status)}</span></div>
                        <div style={{display:'flex', justifyContent:'space-between', fontSize:'12px', padding:'6px 0', borderBottom:'1px solid var(--border)'}}><span style={{color:'var(--muted)'}}>Submitted On</span><span style={{fontWeight:500}}>{selectedAppraisal.submitted_date || "--"}</span></div>
                        <div style={{display:'flex', justifyContent:'space-between', fontSize:'12px', padding:'6px 0'}}><span style={{color:'var(--muted)'}}>Final Status</span><span className={`badge ${selectedAppraisal.status === 'FINALIZED' ? 'b-green' : 'b-amber'}`} style={{marginTop:0}}>{selectedAppraisal.status === 'FINALIZED' ? 'Finalized' : 'Pending'}</span></div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  <button className="btn-close-modal" onClick={() => setSelectedAppraisal(null)}>Close</button>
                  <button className="btn-dl-modal pbas" onClick={() => handleDownloadLatest("PBAS", selectedAppraisal)}>📑 Download PBAS PDF</button>
                  <button className="btn-dl-modal sppu" onClick={() => handleDownloadLatest("SPPU", selectedAppraisal)}>📄 Download SPPU PDF</button>
                </div>
              </div>
            )}
          </div>

        </div>
      </main>
    </div>
  );
}
