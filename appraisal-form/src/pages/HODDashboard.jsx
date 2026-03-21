import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import API, { clearAuthAndRedirect } from "../api";
import "../styles/dashboard.css";
import "../styles/HODDashboard.css";
import "../styles/profile.css";
import useSessionState from "../hooks/useSessionState";
import { buildApiUrl } from "../utils/apiUrl";
import { notifyAppraisalStatusChanged } from "../utils/appraisalStatusCache";
import { downloadWithAuth } from "../utils/downloadFile";
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

export default function HODDashboard() {
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useSessionState("hod.activeTab", "pending");
  const [selectedSubmission, setSelectedSubmission] = useSessionState("hod.selectedSubmission", null);
  const [remarks, setRemarks] = useSessionState("hod.remarks", "");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [profileSummary, setProfileSummary] = useState({
    full_name: "",
    designation: "",
    department: "",
  });

  /* ================= HOD SELF APPRAISAL ================= */
  const [hodOwnAppraisal, setHodOwnAppraisal] = useState({
    academicYear: "2024-25",
    status: "not_started", // not_started | in_progress | submitted
    submissionDate: null,
  });

  /* ================= FACULTY SUBMISSIONS ================= */
  const [submissions, setSubmissions] = useState({
    pending: [],
    processed: [],
  });

  /* ================= LOAD HOD SELF APPRAISAL ================= */
  useEffect(() => {
    const fetchProfileSummary = async () => {
      try {
        const res = await API.get("me/");
        const data = res?.data || {};
        setProfileSummary({
          full_name: data.full_name || data.name || data.username || "Faculty Member",
          designation: data.designation || "Head of Department",
          department: data.department || "Department",
        });
      } catch (err) {
        console.error("Failed to load profile summary", err);
      }
    };

    fetchProfileSummary();
  }, []);

  useEffect(() => {
    const handleFocus = () => {
      refreshDashboardData();
    };

    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, []);

  /* ================= FETCH APPRAISALS ================= */
  useEffect(() => {
    const fetchAppraisals = async () => {
      try {
        setLoading(true);
        setError("");

        // Fetch faculty submissions assigned to the HOD queue.
        const res = await API.get("hod/appraisals/");
        const data = res.data || [];

        const pendingStatuses = ["SUBMITTED", "REVIEWED_BY_HOD"];
        const pending = data.filter((a) => pendingStatuses.includes(a.status));
        const processed = data.filter((a) => !pendingStatuses.includes(a.status));

        setSubmissions({ pending, processed });

        // Fetch the HOD user's own appraisal history.
        const ownRes = await API.get("hod/appraisals/me/");
        const ownData = ownRes.data || [];
        if (ownData.length > 0) {
          const latest = ownData[0];
          const actualStatus = latest.status;
          const isReturned = actualStatus === "RETURNED_BY_PRINCIPAL";

          setHodOwnAppraisal({
            academicYear: latest.academic_year,
            status: (actualStatus.toLowerCase() === "draft" || isReturned) ? "in_progress" : "submitted",
            submissionDate: latest.updated_at ? latest.updated_at.split("T")[0] : null,
            appraisal_id: latest.appraisal_id,
            actual_status: actualStatus
          });
        }
      } catch (err) {
        console.error(err);
        setError("Failed to load appraisals");
      } finally {
        setLoading(false);
      }
    };

    fetchAppraisals();
  }, []);

  /* ================= FETCH DETAILS FOR REVIEW ================= */
  useEffect(() => {
    if (!selectedSubmission) return;

    const fetchDetails = async () => {
      try {
        const res = await API.get(`appraisal/${selectedSubmission.appraisal_id}/`);
        setSelectedSubmission((prev) => ({
          ...prev,
          appraisal_data: res.data.appraisal_data,
          verified_grade: res.data.verified_grade,
          sppu_review_data: res.data.sppu_review_data || null,
          calculated_total_score: res.data.calculated_total_score,
        }));
        const backendKeys = Array.isArray(res.data?.table2_verified_keys) && res.data.table2_verified_keys.length > 0
          ? res.data.table2_verified_keys
          : DEFAULT_TABLE2_VERIFIED_KEYS;
        setTable2FieldKeys(backendKeys);
        const grading = res.data?.verified_grading || {};
        setTable1VerifiedTeaching(grading.table1_verified_teaching || "");
        setTable1VerifiedActivities(grading.table1_verified_activities || "");
        setTable2VerifiedScores(
          withAutoTable2Total({
            ...buildEmptyTable2Verified(backendKeys),
            ...(grading.table2_verified_scores || {}),
          }, backendKeys)
        );
        const hodReview = res.data?.appraisal_data?.hod_review || {};
        setHodCommentsTable1(hodReview.comments_table1 || "");
        setHodCommentsTable2(hodReview.comments_table2 || "");
        setHodRemarksSuggestions(hodReview.remarks_suggestions || "");
        setHodNotSatisfactoryJustification(hodReview.justification || "");
        setVerificationSavedAt(res.data?.verification_saved_at || "");
      } catch (err) {
        console.error("Failed to fetch details", err);
      }
    };

    fetchDetails();
  }, [selectedSubmission?.appraisal_id]);

  const [table1VerifiedTeaching, setTable1VerifiedTeaching] = useSessionState("hod.table1VerifiedTeaching", "");
  const [table1VerifiedActivities, setTable1VerifiedActivities] = useSessionState("hod.table1VerifiedActivities", "");
  const [table2FieldKeys, setTable2FieldKeys] = useSessionState("hod.table2FieldKeys", DEFAULT_TABLE2_VERIFIED_KEYS);
  const [table2VerifiedScores, setTable2VerifiedScores] = useSessionState(
    "hod.table2VerifiedScores",
    withAutoTable2Total(
      buildEmptyTable2Verified(DEFAULT_TABLE2_VERIFIED_KEYS),
      DEFAULT_TABLE2_VERIFIED_KEYS
    )
  );
  const [hodCommentsTable1, setHodCommentsTable1] = useSessionState("hod.hodCommentsTable1", "");
  const [hodCommentsTable2, setHodCommentsTable2] = useSessionState("hod.hodCommentsTable2", "");
  const [hodRemarksSuggestions, setHodRemarksSuggestions] = useSessionState("hod.hodRemarksSuggestions", "");
  const [hodNotSatisfactoryJustification, setHodNotSatisfactoryJustification] = useSessionState("hod.hodNotSatisfactoryJustification", "");
  const [isSavingVerification, setIsSavingVerification] = useState(false);
  const [verificationSavedAt, setVerificationSavedAt] = useState("");
  const [isPreviewProcessing, setIsPreviewProcessing] = useState(false);
  const [previewNotice, setPreviewNotice] = useState("");

  const refreshDashboardData = async () => {
    try {
      setLoading(true);
      setError("");

      const res = await API.get("hod/appraisals/");
      const data = res.data || [];

      const pendingStatuses = ["SUBMITTED", "REVIEWED_BY_HOD"];
      const pending = data.filter((a) => pendingStatuses.includes(a.status));
      const processed = data.filter((a) => !pendingStatuses.includes(a.status));

      setSubmissions({ pending, processed });

      const ownRes = await API.get("hod/appraisals/me/");
      const ownData = ownRes.data || [];
      if (ownData.length > 0) {
        const latest = ownData[0];
        const actualStatus = latest.status;
        const isReturned = actualStatus === "RETURNED_BY_PRINCIPAL";

        setHodOwnAppraisal({
          academicYear: latest.academic_year,
          status: (actualStatus.toLowerCase() === "draft" || isReturned) ? "in_progress" : "submitted",
          submissionDate: latest.updated_at ? latest.updated_at.split("T")[0] : null,
          appraisal_id: latest.appraisal_id,
          actual_status: actualStatus,
        });
      }
    } catch (err) {
      console.error(err);
      setError("Failed to load appraisals");
    } finally {
      setLoading(false);
    }
  };

  /* ================= ACTIONS ================= */
  const handleStartReview = async () => {
    try {
      await API.post(`hod/appraisal/${selectedSubmission.appraisal_id}/start-review/`);

      alert("Moved to HOD Review");
      notifyAppraisalStatusChanged();
      await refreshDashboardData();

      setSelectedSubmission((prev) => ({
        ...prev,
        status: "REVIEWED_BY_HOD",
      }));
    } catch {
      alert("Failed to start review");
    }
  };

  const handleSaveVerifiedGrading = async () => {
    if (!table1VerifiedTeaching || !table1VerifiedActivities) {
      alert("Please set both Table 1 verified gradings before saving.");
      return false;
    }

    setIsSavingVerification(true);
    try {
      const res = await API.post(
        `hod/appraisal/${selectedSubmission.appraisal_id}/verify-grade/`,
        {
          table1_verified_teaching: table1VerifiedTeaching,
          table1_verified_activities: table1VerifiedActivities,
          table2_verified_scores: withAutoTable2Total(table2VerifiedScores, table2FieldKeys),
          hod_comments_table1: hodCommentsTable1,
          hod_comments_table2: hodCommentsTable2,
          hod_remarks: hodRemarksSuggestions,
          hod_justification_not_satisfactory: hodNotSatisfactoryJustification
        }
      );
      setVerificationSavedAt(res?.data?.saved_at || new Date().toISOString());
      alert("Verified grading saved.");
      return true;
    } catch (err) {
      console.error(err);
      alert(err?.response?.data?.error || "Failed to save verified grading");
      return false;
    } finally {
      setIsSavingVerification(false);
    }
  };

  const handleApprove = async () => {
    const saved = await handleSaveVerifiedGrading();
    if (!saved) return;

    try {
      await API.post(
        `hod/appraisal/${selectedSubmission.appraisal_id}/approve/`,
        {
          table1_verified_teaching: table1VerifiedTeaching,
          table1_verified_activities: table1VerifiedActivities,
          table2_verified_scores: withAutoTable2Total(table2VerifiedScores, table2FieldKeys),
          hod_comments_table1: hodCommentsTable1,
          hod_comments_table2: hodCommentsTable2,
          hod_remarks: hodRemarksSuggestions,
          hod_justification_not_satisfactory: hodNotSatisfactoryJustification
        }
      );

      alert("Approved by HOD");
      notifyAppraisalStatusChanged();
      await refreshDashboardData();
      setSelectedSubmission(null);
      setTable1VerifiedTeaching("");
      setTable1VerifiedActivities("");
      setTable2VerifiedScores(
        withAutoTable2Total(buildEmptyTable2Verified(table2FieldKeys), table2FieldKeys)
      );
      setHodCommentsTable1("");
      setHodCommentsTable2("");
      setHodRemarksSuggestions("");
      setHodNotSatisfactoryJustification("");
    } catch {
      alert("Approval failed");
    }
  };

  const handleSendBack = async () => {
    if (!remarks.trim()) {
      alert("Remarks required");
      return;
    }

    try {
      await API.post(`hod/appraisal/${selectedSubmission.appraisal_id}/return/`, { remarks });

      alert("Returned to faculty");
      notifyAppraisalStatusChanged();
      await refreshDashboardData();
      setSelectedSubmission(null);
      setRemarks("");
    } catch {
      alert("Failed to return appraisal");
    }
  };

  /* ================= AUTH ================= */
  const handleLogout = () => {
    clearAuthAndRedirect();
  };

  /* ================= HOD SELF APPRAISAL ================= */
  const handleFillOwnAppraisal = () => {
    const updated = { ...hodOwnAppraisal, status: "in_progress" };
    setHodOwnAppraisal(updated);
    navigate("/hod/appraisal-form");
  };

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
    selectedSubmission?.sppu_review_data,
    selectedSubmission?.appraisal_data
  );
  const selfActivities = selectedSubmission?.sppu_review_data?.table1_activities || {};
  const formattedTotalScore =
    selectedSubmission?.calculated_total_score === null ||
    selectedSubmission?.calculated_total_score === undefined
      ? "-"
      : Number(selectedSubmission.calculated_total_score).toFixed(2);

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

  const downloadPdf = async (url, filename) => {
    try {
      await downloadWithAuth(url, filename);
    } catch (err) {
      console.error(err);
      alert("Failed to download PDF.");
    }
  };

  const pendingCount = submissions.pending.length;
  const processedCount = submissions.processed.length;
  const ownStatusLabel =
    hodOwnAppraisal.actual_status?.replace(/_/g, " ") ||
    (hodOwnAppraisal.status === "submitted"
      ? "Submitted"
      : hodOwnAppraisal.status === "in_progress"
        ? "In Progress"
        : "Not Started");
  const heroName = profileSummary.full_name || "Faculty Member";
  const heroDesignation = profileSummary.designation || "Head of Department";
  const heroDepartment = profileSummary.department || "Department";
  const reviewStatusLabel = selectedSubmission?.status?.replace(/_/g, " ") || "Awaiting Review";



  /* ================= REVIEW SCREEN ================= */
  if (selectedSubmission) {
    return (
      <div className="hod-container">
        <div className="hod-shell review-shell">
          <div className="hod-topbar">
            <div className="topbar-brand">
              <div className="topbar-brand-icon">SA</div>
              <div className="topbar-brand-text">
                <span className="topbar-brand-title">Staff Appraisal System</span>
                <span className="topbar-brand-subtitle">Faculty Submission Review</span>
              </div>
            </div>
            <div className="topbar-nav">
              <button type="button" className="topbar-nav-link" onClick={() => setSelectedSubmission(null)}>
                Dashboard
              </button>
              <button type="button" className="topbar-nav-link" onClick={() => navigate("/hod/profile")}>
                My Profile
              </button>
              <button type="button" className="topbar-nav-link" onClick={handleFillOwnAppraisal}>
                Appraisal Form
              </button>
            </div>
            <div className="topbar-actions">
              <span className="topbar-badge">HOD Review</span>
              <button className="logout-btn" onClick={handleLogout}>
                Logout
              </button>
            </div>
          </div>

          <section className="review-hero">
            <div className="review-hero-copy">
              <button className="review-back-link" onClick={() => setSelectedSubmission(null)}>
                Back to Dashboard
              </button>
              <p className="review-hero-label">HOD Review Panel</p>
              <h1>Faculty Submission Review</h1>
              <div className="review-hero-meta">
                <span>{selectedSubmission.faculty_name}</span>
                <span>{selectedSubmission.department}</span>
                <span>{selectedSubmission.designation}</span>
                <span>AY {selectedSubmission.academic_year}</span>
              </div>
            </div>
            <div className="review-hero-status">
              <span className={`review-status-pill ${selectedSubmission.status === "REVIEWED_BY_HOD" ? "review-status-pill-review" : "review-status-pill-pending"}`}>
                {reviewStatusLabel}
              </span>
            </div>
          </section>

          <section className="review-score-grid">
            <article className="review-score-card review-score-card-featured">
              <span className="review-score-label">Auto-calculated Total Score</span>
              <strong className="review-score-value">{formattedTotalScore}</strong>
              <p className="review-score-sub">Computed from submitted data</p>
              <div className="review-score-bar">
                <span style={{ width: `${Math.max(0, Math.min(100, Number(selectedSubmission?.calculated_total_score || 0)))}%` }} />
              </div>
            </article>

            <article className="review-score-card">
              <span className="review-score-label review-score-label-blue">Teaching Grade</span>
              <strong className="review-mini-value">{selfTeaching.self_grade || "-"}</strong>
              <p className="review-score-sub">
                Assigned: {selfTeaching.total_assigned ?? 0} · Taught: {selfTeaching.total_taught ?? 0}
              </p>
            </article>

            <article className="review-score-card">
              <span className="review-score-label review-score-label-amber">Activity Grade</span>
              <strong className="review-mini-value">{selfActivities.self_grade || "-"}</strong>
              <p className="review-score-sub">Selected Activities: {selfActivities.count ?? 0}</p>
            </article>

            <article className="review-score-card">
              <span className="review-score-label review-score-label-green">Feedback Score</span>
              <strong className="review-mini-value">{selectedSubmission?.sppu_review_data?.student_feedback?.[0]?.score ?? "22"}</strong>
              <p className="review-score-sub">Student feedback summary</p>
            </article>
          </section>

          <section className="review-layout">
            <div className="review-main">
              <div className="review-panel">
                <div className="review-panel-header">
                  <div>
                    <h2 className="review-panel-title">Faculty Information</h2>
                    <p className="review-panel-summary">
                      {selectedSubmission.faculty_name} · {selectedSubmission.department} · AY {selectedSubmission.academic_year}
                    </p>
                  </div>
                </div>
                <div className="review-panel-body">
                  <div className="review-info-grid">
                    <div className="review-info-cell"><span>Name</span><strong>{selectedSubmission.faculty_name}</strong></div>
                    <div className="review-info-cell"><span>Department</span><strong>{selectedSubmission.department}</strong></div>
                    <div className="review-info-cell"><span>Designation</span><strong>{selectedSubmission.designation}</strong></div>
                    <div className="review-info-cell"><span>Academic Year</span><strong>{selectedSubmission.academic_year}</strong></div>
                  </div>
                </div>
              </div>

              {selectedSubmission.status === "REVIEWED_BY_HOD" && (
                <div className="review-panel">
                  <div className="review-panel-header">
                    <div>
                      <h2 className="review-panel-title">Verified Grading</h2>
                      <p className="review-panel-summary">Assign verified grades and confirm Table 2 values.</p>
                    </div>
                  </div>
                  <div className="review-panel-body">
                    <div className="review-grade-block">
                      <div className="review-grade-copy">
                        <h3>Table 1 - Teaching (Verified Grade)</h3>
                        <p>Assigned: <strong>{selfTeaching.total_assigned ?? 0}</strong> · Taught: <strong>{selfTeaching.total_taught ?? 0}</strong> · % Classes: <strong>{selfTeaching.percentage ?? "0.00"}%</strong></p>
                        <p>Self Grade: <strong>{selfTeaching.self_grade || "-"}</strong></p>
                      </div>
                      <select
                        className="review-select"
                        value={table1VerifiedTeaching}
                        onChange={(e) => setTable1VerifiedTeaching(e.target.value)}
                      >
                        <option value="">Select Grade...</option>
                        <option value="Good">Good</option>
                        <option value="Satisfactory">Satisfactory</option>
                        <option value="Not Satisfactory">Not Satisfactory</option>
                      </select>
                    </div>

                    <div className="review-grade-block">
                      <div className="review-grade-copy">
                        <h3>Table 1 - Activity (Verified Grade)</h3>
                        <p>Selected Activities: <strong>{selfActivities.count ?? 0}</strong></p>
                        <p>Self Grade: <strong>{selfActivities.self_grade || "-"}</strong></p>
                      </div>
                      <select
                        className="review-select"
                        value={table1VerifiedActivities}
                        onChange={(e) => setTable1VerifiedActivities(e.target.value)}
                      >
                        <option value="">Select Grade...</option>
                        <option value="Good">Good</option>
                        <option value="Satisfactory">Satisfactory</option>
                        <option value="Not Satisfactory">Not Satisfactory</option>
                      </select>
                    </div>

                    <div className="review-table2-wrap">
                      <div className="review-section-kicker">Table 2 - Verified Column</div>
                      {table2FieldKeys.map((fieldKey) => (
                        <div key={fieldKey} className="review-table2-row">
                          <span className="review-table2-label">{getTable2VerifiedLabel(fieldKey)}</span>
                          <span className="review-table2-self">Self: {getTable2SelfValue(selectedSubmission?.sppu_review_data, fieldKey)}</span>
                          <input
                            className="review-table2-input"
                            type="text"
                            value={table2VerifiedScores[fieldKey] || ""}
                            onChange={(e) => updateTable2Verified(fieldKey, e.target.value)}
                            placeholder={fieldKey === TABLE2_TOTAL_KEY ? "Auto" : "Verified"}
                            readOnly={fieldKey === TABLE2_TOTAL_KEY}
                          />
                        </div>
                      ))}
                    </div>

                    <div className="review-form-grid">
                      <div className="review-field">
                        <label>Justification of assessment of work as not satisfactory (optional)</label>
                        <textarea
                          placeholder="Enter justification if overall assessment is Not Satisfactory..."
                          value={hodNotSatisfactoryJustification}
                          onChange={(e) => setHodNotSatisfactoryJustification(e.target.value)}
                        />
                      </div>

                      <div className="review-field">
                        <label>Comments of HOD on Table 1</label>
                        <textarea
                          placeholder="Enter comments for Table 1..."
                          value={hodCommentsTable1}
                          onChange={(e) => setHodCommentsTable1(e.target.value)}
                        />
                      </div>

                      <div className="review-field">
                        <label>Comments of HOD on Table 2</label>
                        <textarea
                          placeholder="Enter comments for Table 2..."
                          value={hodCommentsTable2}
                          onChange={(e) => setHodCommentsTable2(e.target.value)}
                        />
                      </div>

                      <div className="review-field">
                        <label>Remarks and Suggestions</label>
                        <textarea
                          placeholder="Enter remarks and suggestions..."
                          value={hodRemarksSuggestions}
                          onChange={(e) => setHodRemarksSuggestions(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="review-panel">
                <div className="review-panel-header">
                  <div>
                    <h2 className="review-panel-title">HOD Remarks</h2>
                    <p className="review-panel-summary">These remarks will appear on the final review record.</p>
                  </div>
                </div>
                <div className="review-panel-body">
                  <textarea
                    className="review-remarks-area"
                    placeholder="Enter remarks here..."
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                  />
                </div>
              </div>

              {selectedSubmission.appraisal_id && (
                <div className="review-preview-row">
                  <button
                    type="button"
                    className="review-preview-btn"
                    onClick={() => previewPdf(`/api/appraisal/${selectedSubmission.appraisal_id}/pdf/sppu-enhanced/`)}
                  >
                    Preview SPPU Form
                  </button>
                  <button
                    type="button"
                    className="review-preview-btn"
                    onClick={() => previewPdf(`/api/appraisal/${selectedSubmission.appraisal_id}/pdf/pbas-enhanced/`)}
                  >
                    Preview PBAS Form
                  </button>
                </div>
              )}

              {(previewNotice || isPreviewProcessing) && (
                <div className="review-notice">
                  {previewNotice || "Generating preview..."}
                </div>
              )}

            </div>

            <aside className="review-sidebar">
              <div className="review-side-panel">
                <div className="review-side-header">
                  <h3>Review Checklist</h3>
                </div>
                <div className="review-side-body">
                  <ul className="review-checklist">
                    <li><span className="done">✓</span> Faculty info verified</li>
                    <li><span className="done">✓</span> Teaching data reviewed</li>
                    <li><span className={table1VerifiedTeaching ? "done" : "todo"}>{table1VerifiedTeaching ? "✓" : "!"}</span> Teaching grade assigned</li>
                    <li><span className={table1VerifiedActivities ? "done" : "todo"}>{table1VerifiedActivities ? "✓" : "!"}</span> Activity grade assigned</li>
                    <li><span className={remarks.trim() ? "done" : "todo"}>{remarks.trim() ? "✓" : "!"}</span> HOD remarks added</li>
                  </ul>
                </div>
              </div>

              <div className="review-side-panel">
                <div className="review-side-header">
                  <h3>Score Summary</h3>
                </div>
                <div className="review-side-body review-side-stats">
                  <div><span>Total Score</span><strong>{formattedTotalScore}</strong></div>
                  <div><span>Teaching</span><strong>{selfTeaching.self_grade || "-"}</strong></div>
                  <div><span>Activity</span><strong>{selfActivities.self_grade || "-"}</strong></div>
                  <div><span>Status</span><strong>{reviewStatusLabel}</strong></div>
                </div>
              </div>
            </aside>
          </section>

          <div className="review-footer">
            <div className="review-footer-copy">
              Reviewing <strong>{selectedSubmission.faculty_name}</strong> · AY {selectedSubmission.academic_year} · Score <strong>{formattedTotalScore}</strong>
              {verificationSavedAt && (
                <span className="review-saved-at">
                  Last saved: {new Date(verificationSavedAt).toLocaleString()}
                </span>
              )}
            </div>
            <div className="review-footer-actions">
              <button className="reject-btn" onClick={handleSendBack}>
                Request Changes
              </button>
              {selectedSubmission.status === "SUBMITTED" && (
                <button className="approve-btn" onClick={handleStartReview}>
                  Start Review
                </button>
              )}
              {selectedSubmission.status === "REVIEWED_BY_HOD" && (
                <button className="approve-btn" onClick={handleSaveVerifiedGrading} disabled={isSavingVerification}>
                  {isSavingVerification ? "Saving..." : "Save Verified Grading"}
                </button>
              )}
              {selectedSubmission.status === "REVIEWED_BY_HOD" && (
                <button className="approve-btn" onClick={handleApprove}>
                  Approve
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ================= MAIN DASHBOARD ================= */
  return (
    <div className="hod-container">
      <div className="hod-shell">
        <div className="hod-topbar">
          <div className="topbar-brand">
            <div className="topbar-brand-icon">SA</div>
            <div className="topbar-brand-text">
              <span className="topbar-brand-title">Staff Appraisal System</span>
              <span className="topbar-brand-subtitle">HOD Review Console</span>
            </div>
          </div>
          <div className="topbar-nav">
            <button type="button" className="topbar-nav-link topbar-nav-link-active">
              Dashboard
            </button>
            <button type="button" className="topbar-nav-link" onClick={() => navigate("/hod/profile")}>
              My Profile
            </button>
            <button type="button" className="topbar-nav-link" onClick={handleFillOwnAppraisal}>
              Appraisal Form
            </button>
          </div>
          <div className="topbar-actions">
            <span className="topbar-badge">AY {hodOwnAppraisal.academicYear || "2024-25"}</span>
            <button className="logout-btn" onClick={handleLogout}>
              Logout
            </button>
          </div>
        </div>

        <section className="profile-hero" style={{ borderRadius: "0 0 24px 24px", paddingBottom: "54px" }}>
          <div className="profile-hero-ring profile-hero-ring-left" />
          <div className="profile-hero-ring profile-hero-ring-right" />
          <div className="profile-hero-main">
            <div className="profile-hero-identity">
              <div className="profile-avatar-wrap">
                <div className="profile-avatar-frame">
                  <span className="profile-avatar-fallback">{String(heroName).trim().charAt(0).toUpperCase() || "H"}</span>
                </div>
              </div>
              <div className="profile-hero-copy">
                <p className="profile-hero-kicker">HOD Dashboard Workspace</p>
                <h1>{heroName}</h1>
                <div className="profile-hero-meta">
                  <span>{heroDesignation}</span>
                  <span className="profile-meta-dot" />
                  <span>{heroDepartment}</span>
                </div>
              </div>
            </div>
            <div className="profile-hero-actions">
              <span className="profile-year-pill">AY {hodOwnAppraisal.academicYear || "2024-25"}</span>
              <button type="button" className="profile-primary-action" onClick={() => navigate("/hod/profile")}>
                Open My Profile
              </button>
            </div>
          </div>
        </section>

        <section className="hod-stat-grid">
          <article className="hod-stat-card hod-stat-card-green">
            <div className="hod-stat-head">
              <span className="hod-stat-label">My Appraisal</span>
            </div>
            <strong className="hod-stat-value">{ownStatusLabel}</strong>
            <p className="hod-stat-meta">
              {hodOwnAppraisal.actual_status === "RETURNED_BY_PRINCIPAL"
                ? "Returned for correction and resubmission"
                : hodOwnAppraisal.status === "in_progress"
                  ? "Continue and submit your self-appraisal"
                  : hodOwnAppraisal.status === "not_started"
                    ? "Self-appraisal not started yet"
                    : "Current self-appraisal status"}
            </p>
          </article>

          <article className="hod-stat-card hod-stat-card-amber">
            <div className="hod-stat-head">
              <span className="hod-stat-label">Pending Reviews</span>
            </div>
            <strong className="hod-stat-value">{pendingCount}</strong>
            <p className="hod-stat-meta">Faculty forms awaiting HOD action</p>
          </article>

          <article className="hod-stat-card hod-stat-card-blue">
            <div className="hod-stat-head">
              <span className="hod-stat-label">Processed</span>
            </div>
            <strong className="hod-stat-value">{processedCount}</strong>
            <p className="hod-stat-meta">Reviews already handled in this cycle</p>
          </article>

        </section>

        <section className="hod-main-grid">
          <div className="hod-main-column">
            <div className="dashboard-history-section dashboard-history-highlight hod-history-shell">
              <div className="history-header">
                <h3>My Submission History</h3>
                <div className="tab-row hod-inline-tabs">
                  <button className={activeTab === "pending" ? "tab active" : "tab"} onClick={() => setActiveTab("pending")}>
                    Pending
                  </button>
                  <button className={activeTab === "processed" ? "tab active" : "tab"} onClick={() => setActiveTab("processed")}>
                    Processed
                  </button>
                </div>
              </div>

              {hodOwnAppraisal.appraisal_id && (
                <div className="history-list hod-own-history">
                  <div className="history-item">
                    <div className="history-info">
                      <span className="history-year">AY {hodOwnAppraisal.academicYear}</span>
                      <span className={`history-status ${hodOwnAppraisal.actual_status?.toLowerCase().replace(/_/g, "-")}`}>
                        {hodOwnAppraisal.actual_status?.replace(/_/g, " ")}
                      </span>
                    </div>
                    <button className="view-btn" onClick={() => setActiveTab("processed")}>
                      Track Status
                    </button>
                  </div>

                </div>
              )}

              {activeTab === "pending" && (
                <div className="list">
                  {loading && <p>Loading appraisals...</p>}
                  {error && <p className="error">{error}</p>}
                  {!loading && submissions.pending.length === 0 && <p>No pending appraisals.</p>}
                  {submissions.pending.map((sub) => (
                    <div className="list-card" key={sub.appraisal_id}>
                      <div>
                        <h3>{sub.faculty_name}</h3>
                        <p>{sub.department} | {sub.academic_year}</p>
                      </div>
                      <button className="primary-btn" onClick={() => setSelectedSubmission(sub)}>
                        Open
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === "processed" && (
                <div className="list">
                  {submissions.processed.length === 0 && <p>No processed appraisals.</p>}
                  {submissions.processed.map((sub) => (
                    <div className="list-card" key={sub.appraisal_id}>
                      <div>
                        <h3>{sub.faculty_name}</h3>
                        <p>{sub.department} | {sub.academic_year}</p>
                        <span className={`status ${sub.status?.toLowerCase().replace(/_/g, "-")}`}>
                          {sub.status?.replace(/_/g, " ")}
                        </span>
                      </div>
                      <button className="primary-btn" onClick={() => setSelectedSubmission(sub)}>
                        View
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <aside className="quick-actions-card">
            <div className="quick-actions-header">
              <h3>Quick Actions</h3>
              <p>Common HOD tasks and shortcuts</p>
            </div>
            <button type="button" className="quick-action-item" onClick={() => setActiveTab("pending")}>
              <span className="quick-action-icon quick-action-icon-amber">RV</span>
              <span className="quick-action-text">
                <strong>Open Pending Forms</strong>
                <small>{pendingCount} forms awaiting review</small>
              </span>
              <span className="quick-action-arrow">&gt;</span>
            </button>
            <button type="button" className="quick-action-item quick-action-item-featured" onClick={() => navigate("/hod/profile")}>
              <span className="quick-action-icon quick-action-icon-green">TR</span>
              <span className="quick-action-text">
                <strong>Open My Profile</strong>
                <small>Manage account and workspace access</small>
              </span>
              <span className="quick-action-arrow">&gt;</span>
            </button>
            <button type="button" className="quick-action-item" onClick={() => navigate("/hod/appraisal-form")}>
              <span className="quick-action-icon quick-action-icon-blue">AF</span>
              <span className="quick-action-text">
                <strong>Open My Appraisal Form</strong>
                <small>View or edit your appraisal based on workflow state</small>
              </span>
              <span className="quick-action-arrow">&gt;</span>
            </button>
            <button type="button" className="quick-action-item" onClick={() => navigate("/hod/appraisal/status")}>
              <span className="quick-action-icon quick-action-icon-violet">ST</span>
              <span className="quick-action-text">
                <strong>Track Submission Status</strong>
                <small>Open review status and download approved forms</small>
              </span>
              <span className="quick-action-arrow">&gt;</span>
            </button>
            {hodOwnAppraisal.appraisal_id && (
              <button
                type="button"
                className="quick-action-item"
                onClick={() => downloadPdf(`/api/appraisal/${hodOwnAppraisal.appraisal_id}/pdf/sppu-enhanced/`, `HOD_SPPU_${hodOwnAppraisal.academicYear}.pdf`)}
              >
                <span className="quick-action-icon quick-action-icon-amber">DL</span>
                <span className="quick-action-text">
                  <strong>Download My Appraisal</strong>
                  <small>Download latest SPPU form PDF</small>
                </span>
                <span className="quick-action-arrow">&gt;</span>
              </button>
            )}
          </aside>
        </section>
      </div>
    </div>
  );
}
