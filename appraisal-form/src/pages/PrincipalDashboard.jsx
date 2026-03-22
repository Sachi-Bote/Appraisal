import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import API, { clearAuthAndRedirect } from "../api";
import "../styles/HODDashboard.css";
import "../styles/PrincipalDashboard.css";
import "../styles/profile.css";
import AppraisalSummary from "../components/AppraisalSummary";
import useSessionState from "../hooks/useSessionState";
import { downloadWithAuth, getAccessToken } from "../utils/downloadFile";
import { buildApiUrl } from "../utils/apiUrl";
import { notifyAppraisalStatusChanged } from "../utils/appraisalStatusCache";
import {
  DEFAULT_TABLE2_VERIFIED_KEYS,
  getTable2VerifiedLabel,
} from "../constants/verifiedGrading";

const TABLE2_TOTAL_KEY = "total";
const buildEmptyTable2Verified = (keys = DEFAULT_TABLE2_VERIFIED_KEYS) =>
  keys.reduce((acc, key) => {
    acc[key] = "";
    return acc;
  }, {});

const parseScoreValue = (value) => {
  const parsed = Number(String(value ?? "").trim());
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatScoreValue = (value) => {
  const rounded = Math.round(value * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
};

const computeTable2VerifiedTotal = (scores = {}, keys = DEFAULT_TABLE2_VERIFIED_KEYS) => {
  const table2ItemKeys = keys.filter((key) => key !== TABLE2_TOTAL_KEY);
  const total = table2ItemKeys.reduce((sum, key) => sum + parseScoreValue(scores[key]), 0);
  return formatScoreValue(total);
};

const withAutoTable2Total = (scores = {}, keys = DEFAULT_TABLE2_VERIFIED_KEYS) => ({
  ...scores,
  [TABLE2_TOTAL_KEY]: computeTable2VerifiedTotal(scores, keys),
});

const toNumber = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const deriveSelfTeaching = (reviewData, appraisalData) => {
  if (reviewData?.table1_teaching) return reviewData.table1_teaching;
  const courses = appraisalData?.teaching?.courses || [];
  const totalAssigned = courses.reduce(
    (sum, c) => sum + toNumber(c.total_classes_assigned ?? c.scheduled_classes),
    0
  );
  const totalTaught = courses.reduce(
    (sum, c) => sum + toNumber(c.classes_taught ?? c.held_classes),
    0
  );
  const percentage = totalAssigned > 0 ? (totalTaught / totalAssigned) * 100 : 0;
  const selfGrade =
    percentage >= 80 ? "Good" : percentage >= 70 ? "Satisfactory" : "Not Satisfactory";
  return {
    total_assigned: totalAssigned,
    total_taught: totalTaught,
    percentage: percentage.toFixed(2),
    self_grade: selfGrade,
  };
};

const getTable2SelfValue = (reviewData, key) => {
  if (!reviewData) return "";
  if (key === "total") return reviewData.table2_total_score ?? "";
  const row = reviewData.table2_research?.[key];
  return row?.total_score ?? "";
};

export default function PrincipalDashboard() {
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useSessionState("principal.activeTab", "pending");
  const [selected, setSelected] = useSessionState("principal.selected", null);
  const [remarks, setRemarks] = useSessionState("principal.remarks", "");
  const token = getAccessToken();
  const [isSavingVerification, setIsSavingVerification] = useState(false);
  const [verificationSavedAt, setVerificationSavedAt] = useState("");
  const [isPreviewProcessing, setIsPreviewProcessing] = useState(false);
  const [previewNotice, setPreviewNotice] = useState("");
  const [isFinalizingPdf, setIsFinalizingPdf] = useState(false);

  const handleStartReview = async () => {
    try {
      await API.post(`principal/appraisal/${selected.id}/start-review/`);

      alert("Moved to Principal Review");
      notifyAppraisalStatusChanged();
      await refreshPrincipalAppraisals();

      setSelected((prev) => ({
        ...prev,
        status: "REVIEWED_BY_PRINCIPAL",
      }));
    } catch (err) {
      alert("Failed to start review");
      console.error(err);
    }
  };

  const handleSaveVerifiedGrading = async () => {
    if (selected.is_hod_appraisal && (!table1VerifiedTeaching || !table1VerifiedActivities)) {
      alert("Please set both Table 1 verified gradings for HOD submission before saving.");
      return false;
    }

    setIsSavingVerification(true);
    try {
      const res = await API.post(
        `principal/appraisal/${selected.id}/verify-grade/`,
        {
          table1_verified_teaching: table1VerifiedTeaching,
          table1_verified_activities: table1VerifiedActivities,
          table2_verified_scores: withAutoTable2Total(table2VerifiedScores, table2FieldKeys),
          principal_remarks: remarks,
        }
      );
      setVerificationSavedAt(res?.data?.saved_at || new Date().toISOString());
      alert("Verified grading saved.");
      return true;
    } catch (err) {
      alert(err?.response?.data?.error || "Failed to save verified grading");
      console.error(err);
      return false;
    } finally {
      setIsSavingVerification(false);
    }
  };

  const handleApprove = async () => {
    if (selected.is_hod_appraisal) {
      const saved = await handleSaveVerifiedGrading();
      if (!saved) return;
    }

    try {
      await API.post(
        `principal/appraisal/${selected.id}/approve/`,
        {
          table1_verified_teaching: table1VerifiedTeaching,
          table1_verified_activities: table1VerifiedActivities,
          table2_verified_scores: withAutoTable2Total(table2VerifiedScores, table2FieldKeys),
          principal_remarks: remarks
        }
      );

      alert("Approved by Principal. Now finalize.");
      notifyAppraisalStatusChanged();
      await refreshPrincipalAppraisals();

      // Update UI state
      setSelected((prev) => ({
        ...prev,
        status: "PRINCIPAL_APPROVED",
        remarks: remarks,
      }));
      setTable1VerifiedTeaching("");
      setTable1VerifiedActivities("");
      setTable2VerifiedScores(
        withAutoTable2Total(buildEmptyTable2Verified(table2FieldKeys), table2FieldKeys)
      );
    } catch (err) {
      alert("Approval failed");
      console.error(err);
    }
  };

  const handleFinalize = async () => {
    try {
      setIsFinalizingPdf(true);
      await API.post(`principal/appraisal/${selected.id}/finalize/`);

      alert("Appraisal finalized & PDFs generated");
      notifyAppraisalStatusChanged();
      await refreshPrincipalAppraisals();

      setSelected(null); // go back to list
    } catch (err) {
      alert("Finalize failed");
      console.error(err);
    } finally {
      setIsFinalizingPdf(false);
    }
  };

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [submissions, setSubmissions] = useState({
    pending: [],
    processed: [],
  });

  const [profileSummary, setProfileSummary] = useState({
    full_name: "",
    designation: "",
    department: "",
  });

  /* ================= LOAD PRINCIPAL PROFILE ================= */
  useEffect(() => {
    const fetchProfileSummary = async () => {
      try {
        const res = await API.get("me/");
        const data = res?.data || {};
        setProfileSummary({
          full_name: data.full_name || data.name || data.username || "Dr. Anita Patil",
          designation: data.designation || "Principal",
          department: data.department || "SPPU Affiliated College",
        });
      } catch (err) {
        console.error("Failed to load profile summary", err);
      }
    };
    fetchProfileSummary();
  }, []);

  const refreshPrincipalAppraisals = async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await API.get("principal/appraisals/");
      const data = res.data || [];

      const pending = [];
      const processed = [];

      data.forEach((a) => {
        if (
          a.status === "REVIEWED_BY_PRINCIPAL" ||
          a.status === "HOD_APPROVED" ||
          a.status === "SUBMITTED"
        ) {
          pending.push(a);
        } else {
          processed.push(a);
        }
      });

      setSubmissions({ pending, processed });
    } catch (err) {
      console.error(err);
      setError("Unable to load appraisals");
    } finally {
      setLoading(false);
    }
  };

  const downloadPdf = async (url, filename) => {
    try {
      await downloadWithAuth(url, filename);
    } catch (err) {
      console.error(err);
      alert("Failed to download PDF.");
    }
  };

  const previewPdf = async (url) => {
    setIsPreviewProcessing(true);
    setPreviewNotice("Do not refresh. Form is being processed.");
    try {
      const authToken =
        localStorage.getItem("access") || sessionStorage.getItem("access");
      const requestUrl = buildApiUrl(url);
      let res = await fetch(requestUrl, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (!res.ok) {
        await new Promise((resolve) => setTimeout(resolve, 1200));
        res = await fetch(requestUrl, {
          headers: { Authorization: `Bearer ${authToken}` },
        });
      }
      if (!res.ok) throw new Error("Preview failed");
      const contentType = (res.headers.get("content-type") || "").toLowerCase();
      if (!contentType.includes("application/pdf")) throw new Error("Invalid preview payload");
      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      window.open(blobUrl, "_blank", "noopener,noreferrer");
      setTimeout(() => window.URL.revokeObjectURL(blobUrl), 60000);
      setPreviewNotice("Processing complete. You may continue to view the PDF.");
    } catch (err) {
      console.error(err);
      alert("Failed to preview PDF.");
      setPreviewNotice("");
    } finally {
      setIsPreviewProcessing(false);
    }
  };

  /* ================= FETCH PRINCIPAL APPRAISALS ================= */
  useEffect(() => {
    refreshPrincipalAppraisals();
  }, []);

  useEffect(() => {
    const handleFocus = () => {
      refreshPrincipalAppraisals();
    };

    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, []);

  /* ================= FETCH DETAILS WHEN SELECTED ================= */
  useEffect(() => {
    if (!selected) return;

    const fetchDetails = async () => {
      try {
        const res = await API.get(`appraisal/${selected.id}/`);
        const data = res.data;
        setSelected((prev) => ({
          ...prev,
          appraisal_data: data.appraisal_data,
          verified_grade: data.verified_grade,
          sppu_review_data: data.sppu_review_data || null,
          calculated_total_score: data.calculated_total_score,
        }));
        const backendKeys = Array.isArray(data?.table2_verified_keys) && data.table2_verified_keys.length > 0
          ? data.table2_verified_keys
          : DEFAULT_TABLE2_VERIFIED_KEYS;
        setTable2FieldKeys(backendKeys);
        const grading = data?.verified_grading || {};
        setTable1VerifiedTeaching(grading.table1_verified_teaching || "");
        setTable1VerifiedActivities(grading.table1_verified_activities || "");
        setTable2VerifiedScores(
          withAutoTable2Total({
            ...buildEmptyTable2Verified(backendKeys),
            ...(grading.table2_verified_scores || {}),
          }, backendKeys)
        );
        const principalReviewRemarks = data?.appraisal_data?.principal_review?.remarks || data?.remarks || "";
        setRemarks(principalReviewRemarks);
        setVerificationSavedAt(data?.verification_saved_at || "");
      } catch (err) {
        console.error("Failed to fetch appraisal data", err);
      }
    };

    fetchDetails();
  }, [selected?.id]);

  const [table1VerifiedTeaching, setTable1VerifiedTeaching] = useSessionState("principal.table1VerifiedTeaching", "");
  const [table1VerifiedActivities, setTable1VerifiedActivities] = useSessionState("principal.table1VerifiedActivities", "");
  const [table2FieldKeys, setTable2FieldKeys] = useSessionState("principal.table2FieldKeys", DEFAULT_TABLE2_VERIFIED_KEYS);
  const [table2VerifiedScores, setTable2VerifiedScores] = useSessionState(
    "principal.table2VerifiedScores",
    withAutoTable2Total(
      buildEmptyTable2Verified(DEFAULT_TABLE2_VERIFIED_KEYS),
      DEFAULT_TABLE2_VERIFIED_KEYS
    )
  );

  const updateTable2Verified = (key, value) => {
    if (key === TABLE2_TOTAL_KEY) return;
    setTable2VerifiedScores((prev) =>
      withAutoTable2Total({
        ...prev,
        [key]: value,
      }, table2FieldKeys)
    );
  };

  const selfTeaching = deriveSelfTeaching(
    selected?.sppu_review_data,
    selected?.appraisal_data
  );
  const selfActivities = selected?.sppu_review_data?.table1_activities || {};
  const formattedTotalScore =
    selected?.calculated_total_score === null ||
    selected?.calculated_total_score === undefined
      ? "-"
      : Number(selected.calculated_total_score).toFixed(2);


  /* ================= FINAL APPROVE ================= */
  const handleFinalApprove = async () => {
    if (!selected) return;

    try {
      await API.post(`principal/appraisal/${selected.id}/finalize/`);

      setSubmissions((prev) => ({
        pending: prev.pending.filter((a) => a.id !== selected.id),
        processed: [...prev.processed, { ...selected, status: "APPROVED" }],
      }));

      notifyAppraisalStatusChanged();
      await refreshPrincipalAppraisals();
      setSelected(null);
      setRemarks("");
      alert("Final approval completed");
    } catch (err) {
      console.error(err);
      alert("Failed to approve appraisal");
    }
  };

  /* ================= REQUEST CHANGES ================= */
  const handleSendBack = async () => {
    if (!remarks.trim()) {
      alert("Remarks are required");
      return;
    }

    try {
      await API.post(`principal/appraisal/${selected.id}/return/`, { remarks });

      setSubmissions((prev) => ({
        pending: prev.pending.filter((a) => a.id !== selected.id),
        processed: [
          ...prev.processed,
          { ...selected, status: "CHANGES_REQUESTED", remarks },
        ],
      }));

      notifyAppraisalStatusChanged();
      await refreshPrincipalAppraisals();
      setSelected(null);
      setRemarks("");
      alert("Sent back to faculty");
    } catch (err) {
      console.error(err);
      alert("Failed to send back");
    }
  };

  /* ================= UNIFIED DASHBOARD LAYOUT ================= */
  const heroName = profileSummary.full_name || "Dr. Anita Patil";
  const heroDesignation = profileSummary.designation || "Principal";
  const heroDepartment = profileSummary.department || "SPPU Affiliated College";
  const avatarInitials = String(heroName).trim().split(' ').map(w => w[0]).join('').substring(0,2).toUpperCase() || "P";
  
  const pendingCount = submissions.pending.length;
  const processedCount = submissions.processed.length;
  const totalFacultyCount = pendingCount + processedCount;

  return (
    <div className="profile-page-shell">
      <nav className="profile-topnav">
        <div className="profile-brand">
          <div className="profile-brand-icon">SA</div>
          <div className="profile-brand-copy">
            <span className="profile-brand-title">Staff Appraisal System</span>
            <span className="profile-brand-subtitle">Principal Dashboard</span>
          </div>
        </div>
        <div className="profile-topnav-links">
          <button type="button" className="profile-topnav-link profile-topnav-link-active" onClick={() => navigate("/principal")}>
            Dashboard
          </button>
          <button type="button" className="profile-topnav-link" onClick={() => navigate("/principal/profile")}>
            My Profile
          </button>
        </div>
        <div className="profile-topnav-actions">
          <span className="profile-topnav-badge">Principal Portal</span>
          <div className="profile-avatar-wrap" style={{width: "32px", height: "32px", cursor: "pointer"}} onClick={() => navigate("/principal/profile")}>
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
                <span className="profile-avatar-fallback">
                  {avatarInitials}
                </span>
              </div>
            </div>
            <div className="profile-hero-copy">
              <p className="profile-hero-kicker">Principal Review Console</p>
              <h1>{heroName}</h1>
              <div className="profile-hero-meta">
                <span>{heroDesignation}</span>
                <span className="profile-meta-dot" />
                <span>Final Approval Authority</span>
                <span className="profile-meta-dot" />
                <span>{heroDepartment}</span>
              </div>
            </div>
          </div>
          <div className="profile-hero-actions">
            <span className="profile-year-pill" style={{background: 'rgba(251,191,36,.2)', color: '#fbbf24', borderColor: 'rgba(251,191,36,.3)'}}>
               {pendingCount} Pending Approvals
            </span>
            <span className="profile-year-pill">AY {submissions.pending[0]?.academic_year || "2025-26"} Active</span>
          </div>
        </div>
      </section>

      <main className="profile-content">
        <div className="principal-dashboard-container" style={{ minHeight: 'auto', background: 'transparent' }}>
          {/* CONTENT */}
          <div className="content" style={{ marginTop: 0, padding: 0 }}>
        
        {/* STAT CARDS */}
        <div className="stat-grid">
          <div className="stat-card">
            <div className="sc-top"><span className="sc-lbl">Total Appraisals</span><div className="sc-icon ic-blue">👥</div></div>
            <div className="sc-val">{totalFacultyCount}</div>
            <div className="sc-sub">Faculty submitted current cycle</div>
          </div>
          <div className="stat-card">
            <div className="sc-top"><span className="sc-lbl">Pending Approval</span><div className="sc-icon ic-amber">⏳</div></div>
            <div className="sc-val">{pendingCount}</div>
            <span className="badge b-amber">Action needed</span>
          </div>
          <div className="stat-card">
            <div className="sc-top"><span className="sc-lbl">Approved</span><div className="sc-icon ic-green">✓</div></div>
            <div className="sc-val">{processedCount}</div>
            <span className="badge b-green">Finalized</span>
          </div>
          <div className="stat-card">
            <div className="sc-top"><span className="sc-lbl">Not Submitted</span><div className="sc-icon ic-red">!</div></div>
            <div className="sc-val">0</div>
            <span className="badge b-red">Data unavailable</span>
          </div>
        </div>

        {/* MAIN GRID */}
        <div className="main-grid">
          <div>
            <div className="panel">
              <div className="tab-bar">
                <div className={`tab ${activeTab === 'pending' ? 'active' : ''}`} onClick={() => setActiveTab('pending')}>
                  Pending Approvals <span className="tab-badge tb-amber">{pendingCount}</span>
                </div>
                <div className={`tab ${activeTab === 'processed' ? 'active' : ''}`} onClick={() => setActiveTab('processed')}>
                  Processed <span className="tab-badge tb-green">{processedCount}</span>
                </div>
              </div>

              <div className="filter-bar">
                <div className="search-wrap">
                  <span className="search-icon">🔍</span>
                  <input type="text" placeholder="Search faculty by name or department..." />
                </div>
              </div>

              {loading && <p className="empty-state">Loading appraisals...</p>}
              {error && <p className="empty-state">{error}</p>}

              {/* PENDING TAB */}
              <div className={`tab-content ${activeTab === 'pending' ? 'active' : ''}`}>
                <div style={{overflowX: 'auto'}}>
                  <table className="rev-table">
                    <thead><tr><th>Faculty</th><th>Auto Score</th><th>Status</th><th>Submitted</th><th>Actions</th></tr></thead>
                    <tbody>
                      {submissions.pending.length === 0 && <tr><td colSpan="5" className="empty-state">No pending appraisals</td></tr>}
                      {submissions.pending.map(sub => (
                        <tr key={sub.id} onClick={() => setSelected(sub)}>
                          <td><div className="fac-name">{sub.faculty_name}</div><div className="fac-dept">{sub.department}</div></td>
                          <td>
                            <div className="score-bar-wrap">
                              <div className="score-bar-mini"><div className="score-bar-fill" style={{ width: `${Math.min(parseScoreValue(sub.calculated_total_score || 0), 100)}%` }}></div></div>
                              <span className="score-num">{Number(sub.calculated_total_score || 0).toFixed(2)}</span>
                            </div>
                          </td>
                          <td><span className="badge b-amber">{sub.status?.replace(/_/g, " ")}</span></td>
                          <td style={{fontSize: '12px', color: 'var(--muted)'}}>{sub.academic_year}</td>
                          <td>
                            <div className="btns-row">
                              <button className="btn-review" onClick={(e) => { e.stopPropagation(); setSelected(sub); }}>Review →</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* PROCESSED TAB */}
              <div className={`tab-content ${activeTab === 'processed' ? 'active' : ''}`}>
                <div style={{overflowX: 'auto'}}>
                  <table className="rev-table">
                    <thead><tr><th>Faculty</th><th>Final Score</th><th>Status</th><th>Academic Year</th><th>Downloads</th></tr></thead>
                    <tbody>
                      {submissions.processed.length === 0 && <tr><td colSpan="5" className="empty-state">No processed appraisals</td></tr>}
                      {submissions.processed.map(sub => (
                        <tr key={sub.id} onClick={() => setSelected(sub)}>
                          <td><div className="fac-name">{sub.faculty_name}</div><div className="fac-dept">{sub.department}</div></td>
                          <td>
                            <div className="score-bar-wrap">
                              <div className="score-bar-mini"><div className="score-bar-fill" style={{ width: `${Math.min(parseScoreValue(sub.calculated_total_score || 0), 100)}%` }}></div></div>
                              <span className="score-num">{Number(sub.calculated_total_score || 0).toFixed(2)}</span>
                            </div>
                          </td>
                          <td><span className={`badge ${sub.status === 'APPROVED' || sub.status === 'FINALIZED' ? 'b-green' : 'b-amber'}`}>{sub.status?.replace(/_/g, " ")}</span></td>
                          <td style={{fontSize: '12px', color: 'var(--muted)'}}>{sub.academic_year}</td>
                          <td>
                            <div className="btns-row">
                              {sub.status === 'FINALIZED' && (
                                <>
                                  <button className="btn-dl-sm sppu" onClick={(e) => { e.stopPropagation(); downloadPdf(`/api/appraisal/${sub.id}/pdf/sppu-enhanced/`, `SPPU_${sub.academic_year}.pdf`); }}>SPPU PDF</button>
                                  <button className="btn-dl-sm pbas" onClick={(e) => { e.stopPropagation(); downloadPdf(`/api/appraisal/${sub.id}/pdf/pbas-enhanced/`, `PBAS_${sub.academic_year}.pdf`); }}>PBAS PDF</button>
                                </>
                              )}
                              {sub.status !== 'FINALIZED' && (
                                <button className="btn-review" onClick={(e) => { e.stopPropagation(); setSelected(sub); }}>Open →</button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          </div>

          {/* SIDEBAR */}
          <div className="sidebar">
            <div className="side-card">
              <div className="sc-body">
                <button className="btn-approve-all" onClick={() => alert('Bulk approval not implemented yet.')}>✓ Approve All Pending ({pendingCount})</button>
                <div style={{fontSize: '11px', color: 'var(--muted)', marginTop: '8px', textAlign: 'center', lineHeight: 1.5}}>This will finalize all pending submissions. This action cannot be undone.</div>
              </div>
            </div>

            <div className="side-card">
              <div className="sc-hdr"><span className="sc-hdr-title">Department Breakdown</span></div>
              <div className="sc-body">
                {Array.from(new Set([...submissions.pending, ...submissions.processed].map(x => x.department))).map(dept => {
                   const dPending = submissions.pending.filter(x => x.department === dept).length;
                   const dProcessed = submissions.processed.filter(x => x.department === dept).length;
                   return (
                     <div className="dept-row" key={dept}>
                       <span className="dept-name">{dept}</span>
                       <div className="dept-counts">
                         {dProcessed > 0 && <span className="dept-pill tb-green">{dProcessed} done</span>}
                         {dPending > 0 && <span className="dept-pill tb-amber">{dPending} pending</span>}
                       </div>
                     </div>
                   )
                })}
              </div>
            </div>
            
          </div>
        </div>
      </div>

      {/* REVIEW MODAL */}
      <div className={`modal-overlay ${selected ? "open" : ""}`} id="reviewModal" onClick={(e) => { if (e.target.id === 'reviewModal') setSelected(null); }}>
        {selected && (
          <div className="modal">
            <div className="mhdr">
              <div className="mhdr-left">
                <div className="mhdr-title">{selected.faculty_name || "Faculty Review"}</div>
                <div className="mhdr-sub">{selected.department || "Department"} · AY {selected.academic_year} · Principal Final Approval</div>
              </div>
              <div style={{display: 'flex', alignItems: 'center', gap: '12px'}}>
                <div className="mhdr-score">
                  <div className="mhdr-score-val">{formattedTotalScore}</div>
                  <div className="mhdr-score-lbl">Total Score</div>
                </div>
                <button className="modal-close" onClick={() => setSelected(null)}>×</button>
              </div>
            </div>
            
            <div className="modal-body">
              <div className="mf-grid" style={{marginBottom: '20px'}}>
                <div className="mf-row"><div className="mf-key">Faculty Name</div><div className="mf-val">{selected.faculty_name}</div></div>
                <div className="mf-row"><div className="mf-key">Department</div><div className="mf-val">{selected.department}</div></div>
                <div className="mf-row"><div className="mf-key">Academic Year</div><div className="mf-val">{selected.academic_year}</div></div>
                <div className="mf-row"><div className="mf-key">Current Status</div><div className="mf-val"><span className="badge b-amber" style={{margin:0}}>{selected.status?.replace(/_/g, " ")}</span></div></div>
              </div>

              <div className="msec-title">Full Appraisal Summary</div>
              <div style={{ padding: '0', background: '#f9fafb', borderRadius: '8px', border: '1px solid #e5e7eb', marginBottom: '20px', minHeight: '100px', maxHeight: '400px', overflowY: 'auto' }}>
                <AppraisalSummary data={selected.appraisal_data} />
              </div>

              {selected.status === 'REVIEWED_BY_PRINCIPAL' && (
                <>
                  <div className="msec-title">Principal's Final Decision</div>
                  <label style={{fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.4px', color: '#6b7280', display: 'block', marginBottom: '6px'}}>Principal's Remarks</label>
                  <textarea className="remarks-area" placeholder="Enter your remarks for this faculty member's appraisal..." value={remarks} onChange={(e) => setRemarks(e.target.value)}></textarea>
                </>
              )}

              {selected.status === 'CHANGES_REQUESTED' && (
                <>
                  <div className="msec-title">Principal's Remarks for Returning</div>
                  <textarea className="remarks-area" disabled value={selected.remarks || "No remarks provided"}></textarea>
                </>
              )}
            </div>
            
            <div className="mfooter">
              <button className="btn-mfooter btn-mf-close" onClick={() => setSelected(null)}>Cancel</button>

              {(selected.status === "HOD_APPROVED" || (selected.status === "SUBMITTED" && selected.is_hod_appraisal)) && (
                <button className="btn-mfooter btn-mf-approve" onClick={handleStartReview}>Start Review</button>
              )}

              {selected.status === "REVIEWED_BY_PRINCIPAL" && selected.is_hod_appraisal && (
                <button className="btn-mfooter btn-mf-approve" onClick={handleSaveVerifiedGrading} disabled={isSavingVerification}>
                  {isSavingVerification ? "Saving..." : "Save Verified Grading"}
                </button>
              )}

              {selected.status === "REVIEWED_BY_PRINCIPAL" && (
                <>
                  <button className="btn-mfooter btn-mf-reject" onClick={handleSendBack}>↩ Request Changes</button>
                  <button className="btn-mfooter btn-mf-approve" onClick={handleApprove}>✓ Approve</button>
                </>
              )}

              {selected.status === "PRINCIPAL_APPROVED" && (
                <>
                  <button className="btn-mfooter btn-mf-approve" onClick={handleFinalize} disabled={isFinalizingPdf}>
                    Finalize & Generate PDF
                  </button>
                  {isFinalizingPdf && (
                    <span style={{ fontSize: "12px", color: "#92400e", fontWeight: 600, display: "flex", alignItems: "center", marginLeft: "8px" }}>
                      Finalizing...
                    </span>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>

        </div>
      </main>
    </div>
  );
}
