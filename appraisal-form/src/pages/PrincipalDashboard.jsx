import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import API, { clearAuthAndRedirect } from "../api";
import "../styles/HODDashboard.css";
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

  /* ================= REVIEW SCREEN ================= */
  if (selected) {
    return (
      <div className="hod-container">
        <div className="hod-shell review-shell">
          <div className="hod-topbar">
            <div className="topbar-brand">
              <div className="topbar-brand-icon">SA</div>
              <div className="topbar-brand-text">
                <span className="topbar-brand-title">Staff Appraisal System</span>
                <span className="topbar-brand-subtitle">Principal Final Review</span>
              </div>
            </div>
            <div className="topbar-nav">
              <button type="button" className="topbar-nav-link" onClick={() => setSelected(null)}>
                Dashboard
              </button>
              <button type="button" className="topbar-nav-link" onClick={() => navigate("/principal/profile")}>
                My Profile
              </button>
            </div>
            <div className="topbar-actions">
              <span className="topbar-badge">Principal Review</span>
              <button className="logout-btn" onClick={() => clearAuthAndRedirect()}>
                Logout
              </button>
            </div>
          </div>

          <section className="review-hero">
            <div className="review-hero-copy">
              <button className="review-back-link" onClick={() => setSelected(null)}>Back to Dashboard</button>
              <p className="review-hero-label">Principal Review Panel</p>
              <h1>Final Appraisal Review</h1>
              <div className="review-hero-meta">
                <span>{selected.faculty_name}</span>
                <span>{selected.department}</span>
                <span>AY {selected.academic_year}</span>
              </div>
            </div>
            <div className="review-hero-status">
              <span className="review-status-pill review-status-pill-pending">{selected.status?.replace(/_/g, " ")}</span>
            </div>
          </section>

          <div className="card">
            <h2>Appraisal Review (Final)</h2>

          <div className="info-grid">
            <div><b>Name:</b> {selected.faculty_name}</div>
            <div><b>Department:</b> {selected.department}</div>
            <div><b>Designation:</b> {selected.designation}</div>
            <div><b>Academic Year:</b> {selected.academic_year}</div>
          </div>

          <h3>Principal Remarks</h3>
          <textarea
            placeholder="Enter final remarks..."
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
          />

          {/* VERIFIED GRADE INPUT (Only for HOD Appraisals) */}
          {selected.status === "REVIEWED_BY_PRINCIPAL" && selected.is_hod_appraisal && (
            <div style={{ marginTop: '16px' }}>
              <h3>Verified Grading (HOD Appraisal)</h3>
              <p style={{ fontSize: '0.9rem', color: '#666' }}>
                Enter verified grading for Table 1 and the verified column values for Table 2.
              </p>
              <div style={{ margin: '12px 0', padding: '12px', border: '1px dashed #d1d5db', borderRadius: '6px', background: '#f8fafc' }}>
                <div style={{ fontSize: '0.9rem', color: '#4b5563' }}>Auto-calculated Total Score</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#111827' }}>{formattedTotalScore}</div>
                <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>Computed from submitted data; updates after reload/approval.</div>
              </div>
              <label style={{ fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                Table 1 - Teaching (Verified Grade)
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: '12px', alignItems: 'start' }}>
                <div style={{ border: '1px solid #e5e7eb', borderRadius: '6px', padding: '10px', background: '#fafafa' }}>
                  <div style={{ fontSize: '0.85rem', color: '#4b5563', marginBottom: '4px' }}><b>Self Appraisal</b></div>
                  <div style={{ fontSize: '0.9rem' }}>Assigned: {selfTeaching.total_assigned ?? 0}</div>
                  <div style={{ fontSize: '0.9rem' }}>Taught: {selfTeaching.total_taught ?? 0}</div>
                  <div style={{ fontSize: '0.9rem' }}>% Classes: {selfTeaching.percentage ?? "0.00"}%</div>
                  <div style={{ fontSize: '0.9rem' }}><b>Grade: {selfTeaching.self_grade || "-"}</b></div>
                </div>
                <select
                  value={table1VerifiedTeaching}
                  onChange={(e) => setTable1VerifiedTeaching(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px',
                    marginTop: '8px',
                    borderRadius: '4px',
                    border: '1px solid #ddd'
                  }}
                >
                  <option value="">Select Grade...</option>
                  <option value="Good">Good</option>
                  <option value="Satisfactory">Satisfactory</option>
                  <option value="Not Satisfactory">Not Satisfactory</option>
                </select>
              </div>
              <label style={{ fontWeight: 600, display: 'block', marginTop: '10px', marginBottom: '6px' }}>
                Table 1 - Activity (Verified Grade)
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: '12px', alignItems: 'start' }}>
                <div style={{ border: '1px solid #e5e7eb', borderRadius: '6px', padding: '10px', background: '#fafafa' }}>
                  <div style={{ fontSize: '0.85rem', color: '#4b5563', marginBottom: '4px' }}><b>Self Appraisal</b></div>
                  <div style={{ fontSize: '0.9rem' }}>Selected Activities: {selfActivities.count ?? 0}</div>
                  <div style={{ fontSize: '0.9rem' }}><b>Grade: {selfActivities.self_grade || "-"}</b></div>
                </div>
                <select
                  value={table1VerifiedActivities}
                  onChange={(e) => setTable1VerifiedActivities(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '4px',
                    border: '1px solid #ddd'
                  }}
                >
                  <option value="">Select Grade...</option>
                  <option value="Good">Good</option>
                  <option value="Satisfactory">Satisfactory</option>
                  <option value="Not Satisfactory">Not Satisfactory</option>
                </select>
              </div>
              <div style={{ marginTop: '14px' }}>
                <label style={{ fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                  Table 2 - Verified Column
                </label>
                <div style={{ display: 'grid', gap: '8px', maxHeight: '300px', overflowY: 'auto', border: '1px solid #eee', borderRadius: '6px', padding: '10px' }}>
                  {table2FieldKeys.map((fieldKey) => (
                    <div key={fieldKey} style={{ display: 'grid', gridTemplateColumns: '1fr 120px 130px', gap: '10px', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.9rem' }}>{getTable2VerifiedLabel(fieldKey)}</span>
                      <span style={{ fontSize: '0.85rem', color: '#4b5563' }}>
                        Self: {getTable2SelfValue(selected?.sppu_review_data, fieldKey)}
                      </span>
                      <input
                        type="text"
                        value={table2VerifiedScores[fieldKey] || ""}
                        onChange={(e) => updateTable2Verified(fieldKey, e.target.value)}
                        placeholder={fieldKey === TABLE2_TOTAL_KEY ? "Auto" : "Verified"}
                        readOnly={fieldKey === TABLE2_TOTAL_KEY}
                        style={{
                          width: '100%',
                          padding: '8px',
                          borderRadius: '4px',
                          border: '1px solid #ddd',
                          background: fieldKey === TABLE2_TOTAL_KEY ? '#f3f4f6' : '#fff',
                          color: fieldKey === TABLE2_TOTAL_KEY ? '#111827' : 'inherit',
                          fontWeight: fieldKey === TABLE2_TOTAL_KEY ? 600 : 400,
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {selected.id && (
            <div style={{ marginTop: '18px', marginBottom: '4px' }}>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="approve-btn"
                  style={{ height: '36px', padding: '0 14px' }}
                  onClick={() => previewPdf(`/api/appraisal/${selected.id}/pdf/sppu-enhanced/`)}
                >
                  Preview SPPU Form
                </button>
                <button
                  type="button"
                  className="approve-btn"
                  style={{ height: '36px', padding: '0 14px' }}
                  onClick={() => previewPdf(`/api/appraisal/${selected.id}/pdf/pbas-enhanced/`)}
                >
                  Preview PBAS Form
                </button>
              </div>
              {(previewNotice || isPreviewProcessing) && (
                <div style={{ marginTop: "10px", padding: "10px 12px", borderRadius: "6px", background: "#fffbeb", color: "#92400e", fontWeight: 600 }}>
                  {previewNotice || "Generating preview..."}
                </div>
              )}
            </div>
          )}

          {selected.appraisal_data && (
            <div className="form-data-view" style={{ marginTop: '20px', padding: '16px', background: '#f9fafb', borderRadius: '8px', border: '1px solid #e5e7eb', maxHeight: '400px', overflowY: 'auto' }}>
              <AppraisalSummary data={selected.appraisal_data} />
            </div>
          )}


          <div className="action-btn-row">

            {(selected.status === "HOD_APPROVED" || (selected.status === "SUBMITTED" && selected.is_hod_appraisal)) && (
              <button className="approve-btn" onClick={handleStartReview}>
                Start Review
              </button>
            )}


            {selected.status === "REVIEWED_BY_PRINCIPAL" && selected.is_hod_appraisal && (
              <button className="approve-btn" onClick={handleSaveVerifiedGrading} disabled={isSavingVerification}>
                {isSavingVerification ? "Saving..." : "Save/Confirm Verified Grading"}
              </button>
            )}

            {selected.status === "REVIEWED_BY_PRINCIPAL" && (
              <button className="approve-btn" onClick={handleApprove}>
                Approve
              </button>
            )}

            {selected.status === "PRINCIPAL_APPROVED" && (
              <>
                <button className="approve-btn" onClick={handleFinalize} disabled={isFinalizingPdf}>
                  Finalize & Generate PDF
                </button>
                {isFinalizingPdf && (
                  <p style={{ marginTop: "8px", color: "#92400e", fontWeight: 600 }}>
                    Finalizing the pdf's please wait. Do not refresh
                  </p>
                )}
              </>
            )}

            <button className="reject-btn" onClick={handleSendBack}>
              Request Changes
            </button>
          </div>
          {verificationSavedAt && (
            <p style={{ fontSize: "0.85rem", color: "#4b5563", marginTop: "8px" }}>
              Last saved verified grading: {new Date(verificationSavedAt).toLocaleString()}
            </p>
          )}
          </div>
        </div>
      </div>
    );
  }

  /* ================= LIST VIEW ================= */
  return (
    <div className="hod-container">
      <div className="hod-shell">
        <div className="hod-topbar">
          <div className="topbar-brand">
            <div className="topbar-brand-icon">SA</div>
            <div className="topbar-brand-text">
              <span className="topbar-brand-title">Staff Appraisal System</span>
              <span className="topbar-brand-subtitle">Principal Review Console</span>
            </div>
          </div>
          <div className="topbar-nav">
            <button type="button" className="topbar-nav-link topbar-nav-link-active">Dashboard</button>
            <button type="button" className="topbar-nav-link" onClick={() => navigate("/principal/profile")}>My Profile</button>
          </div>
          <div className="topbar-actions">
            <span className="topbar-badge">Principal Portal</span>
            <button className="logout-btn" onClick={() => clearAuthAndRedirect()}>Logout</button>
          </div>
        </div>

        <section className="hod-hero">
          <div className="hod-hero-copy">
            <p className="hero-greeting">Final approval desk</p>
            <h1>Principal Dashboard</h1>
            <p className="subtitle">Review, approve, finalize, and download appraisal forms.</p>
          </div>
          <div className="hod-hero-status">
            <span className="hero-status-pill">Pending {submissions.pending.length}</span>
          </div>
        </section>

        <section className="hod-stat-grid" style={{ padding: 0, marginTop: "16px", gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}>
          <article className="hod-stat-card hod-stat-card-blue">
            <div className="hod-stat-head"><span className="hod-stat-label">Total Records</span></div>
            <strong className="hod-stat-value">{submissions.pending.length + submissions.processed.length}</strong>
            <p className="hod-stat-meta">Faculty appraisals in current view</p>
          </article>
          <article className="hod-stat-card hod-stat-card-amber">
            <div className="hod-stat-head"><span className="hod-stat-label">Pending Approval</span></div>
            <strong className="hod-stat-value">{submissions.pending.length}</strong>
            <p className="hod-stat-meta">Requires principal action</p>
          </article>
          <article className="hod-stat-card hod-stat-card-green">
            <div className="hod-stat-head"><span className="hod-stat-label">Processed</span></div>
            <strong className="hod-stat-value">{submissions.processed.length}</strong>
            <p className="hod-stat-meta">Reviewed/approved items</p>
          </article>
          <article className="hod-stat-card hod-stat-card-violet">
            <div className="hod-stat-head"><span className="hod-stat-label">HOD Submissions</span></div>
            <strong className="hod-stat-value">{[...submissions.pending, ...submissions.processed].filter((x) => x.is_hod_appraisal).length}</strong>
            <p className="hod-stat-meta">HOD self appraisals in list</p>
          </article>
        </section>

        <section className="hod-main-grid" style={{ padding: 0, gridTemplateColumns: "1fr 320px", marginTop: "14px" }}>
          <div className="dashboard-history-section" style={{ marginTop: 0, padding: 0, overflow: "hidden" }}>
            <div className="tab-row" style={{ margin: 0, borderRadius: 0, boxShadow: "none", borderLeft: "none", borderRight: "none", borderTop: "none" }}>
              <button
                className={`tab ${activeTab === "pending" ? "active" : ""}`}
                onClick={() => setActiveTab("pending")}
              >
                Pending ({submissions.pending.length})
              </button>
              <button
                className={`tab ${activeTab === "processed" ? "active" : ""}`}
                onClick={() => setActiveTab("processed")}
              >
                Processed ({submissions.processed.length})
              </button>
            </div>

            <div style={{ padding: "12px 16px", borderBottom: "1px solid #e5e9f2", background: "#fff" }}>
              <input
                type="text"
                placeholder="Search faculty by name or department"
                style={{ width: "100%", height: "38px", borderRadius: "10px", border: "1px solid #d5dce5", padding: "0 12px", font: "inherit" }}
              />
            </div>

            {loading && <p className="empty">Loading…</p>}
            {error && <p className="empty">{error}</p>}

            {!loading && !error && (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "#f7fafd", borderBottom: "1px solid #e5e9f2" }}>
                      <th style={{ textAlign: "left", padding: "11px 14px", fontSize: "11px", color: "#6b7280", textTransform: "uppercase" }}>Faculty</th>
                      <th style={{ textAlign: "left", padding: "11px 14px", fontSize: "11px", color: "#6b7280", textTransform: "uppercase" }}>Department</th>
                      <th style={{ textAlign: "left", padding: "11px 14px", fontSize: "11px", color: "#6b7280", textTransform: "uppercase" }}>AY</th>
                      <th style={{ textAlign: "left", padding: "11px 14px", fontSize: "11px", color: "#6b7280", textTransform: "uppercase" }}>Status</th>
                      <th style={{ textAlign: "left", padding: "11px 14px", fontSize: "11px", color: "#6b7280", textTransform: "uppercase" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(activeTab === "pending" ? submissions.pending : submissions.processed).map((s) => (
                      <tr key={`${activeTab}-${s.id}`} style={{ borderBottom: "1px solid #edf1f7" }}>
                        <td style={{ padding: "12px 14px", fontSize: "13px", fontWeight: 600 }}>{s.faculty_name}</td>
                        <td style={{ padding: "12px 14px", fontSize: "13px", color: "#6b7280" }}>{s.department}</td>
                        <td style={{ padding: "12px 14px", fontSize: "13px", color: "#6b7280" }}>{s.academic_year}</td>
                        <td style={{ padding: "12px 14px" }}>
                          <span className={`status ${s.status?.toLowerCase()}`}>{s.status?.replace(/_/g, " ")}</span>
                        </td>
                        <td style={{ padding: "12px 14px" }}>
                          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                            {(activeTab === "pending") && (
                              <button className="primary-btn" style={{ marginTop: 0, height: "34px", padding: "0 14px" }} onClick={() => setSelected(s)}>
                                Review
                              </button>
                            )}
                            {activeTab === "processed" && s.status === "FINALIZED" && (
                              <>
                                <button type="button" className="view-btn" onClick={() => downloadPdf(`/api/appraisal/${s.id}/pdf/sppu-enhanced/`, `SPPU_${s.academic_year}.pdf`)}>
                                  SPPU
                                </button>
                                <button type="button" className="view-btn" onClick={() => downloadPdf(`/api/appraisal/${s.id}/pdf/pbas-enhanced/`, `PBAS_${s.academic_year}.pdf`)}>
                                  PBAS
                                </button>
                              </>
                            )}
                            {activeTab === "processed" && s.status !== "FINALIZED" && (
                              <button className="view-btn" onClick={() => setSelected(s)}>Open</button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {(activeTab === "pending" && submissions.pending.length === 0) && <p className="empty">No pending approvals</p>}
                {(activeTab === "processed" && submissions.processed.length === 0) && <p className="empty">No processed appraisals</p>}
              </div>
            )}
          </div>

          <aside className="quick-actions-card">
            <div className="quick-actions-header">
              <h3>Principal Actions</h3>
              <p>Common review controls</p>
            </div>
            <button type="button" className="quick-action-item" onClick={() => setActiveTab("pending")}>
              <span className="quick-action-icon quick-action-icon-amber">PD</span>
              <span className="quick-action-text"><strong>Open Pending</strong><small>{submissions.pending.length} needing final approval</small></span>
              <span className="quick-action-arrow">&gt;</span>
            </button>
            <button type="button" className="quick-action-item" onClick={() => setActiveTab("processed")}>
              <span className="quick-action-icon quick-action-icon-green">PR</span>
              <span className="quick-action-text"><strong>View Processed</strong><small>Approved, returned, and finalized forms</small></span>
              <span className="quick-action-arrow">&gt;</span>
            </button>
            <button type="button" className="quick-action-item quick-action-item-featured" onClick={() => navigate("/principal/profile")}>
              <span className="quick-action-icon quick-action-icon-blue">MP</span>
              <span className="quick-action-text"><strong>My Profile</strong><small>Update profile details and password</small></span>
              <span className="quick-action-arrow">&gt;</span>
            </button>
          </aside>
        </section>
      </div>
    </div>
  );
}









