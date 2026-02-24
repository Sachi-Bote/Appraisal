import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import API from "../api";
import "../styles/HODDashboard.css";
import "../styles/dashboard.css";
import AppraisalSummary from "../components/AppraisalSummary";
import useSessionState from "../hooks/useSessionState";
import { downloadWithAuth, getAccessToken } from "../utils/downloadFile";
import { buildApiUrl } from "../utils/apiUrl";
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
  const token = getAccessToken();

  const [activeTab, setActiveTab] = useSessionState("hod.activeTab", "pending");
  const [selectedSubmission, setSelectedSubmission] = useSessionState("hod.selectedSubmission", null);
  const [remarks, setRemarks] = useSessionState("hod.remarks", "");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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
    const stored = localStorage.getItem("hodOwnAppraisal");
    if (stored) setHodOwnAppraisal(JSON.parse(stored));
  }, []);

  /* ================= FETCH APPRAISALS ================= */
  useEffect(() => {
    const fetchAppraisals = async () => {
      try {
        setLoading(true);
        setError("");

        // 1️⃣ Fetch Faculty submissions to review
        const res = await API.get("hod/appraisals/");
        const data = res.data || [];

        const pendingStatuses = ["SUBMITTED", "REVIEWED_BY_HOD"];
        const pending = data.filter((a) => pendingStatuses.includes(a.status));
        const processed = data.filter((a) => !pendingStatuses.includes(a.status));

        setSubmissions({ pending, processed });

        // 2️⃣ Fetch HOD's OWN appraisals
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

  /* ================= ACTIONS ================= */
  const handleStartReview = async () => {
    try {
      await API.post(`hod/appraisal/${selectedSubmission.appraisal_id}/start-review/`);

      alert("Moved to HOD Review");

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
      setSelectedSubmission(null);
      setRemarks("");
    } catch {
      alert("Failed to return appraisal");
    }
  };

  /* ================= AUTH ================= */
  const handleLogout = () => {
    localStorage.clear();
    sessionStorage.clear();
    navigate("/login");
  };

  /* ================= HOD SELF APPRAISAL ================= */
  const handleFillOwnAppraisal = () => {
    const updated = { ...hodOwnAppraisal, status: "in_progress" };
    setHodOwnAppraisal(updated);
    localStorage.setItem("hodOwnAppraisal", JSON.stringify(updated));
    navigate("/hod/appraisal-form");
  };

  const handleSubmitOwnAppraisal = async () => {
    try {
      const token =
        localStorage.getItem("access") ||
        sessionStorage.getItem("access");

      if (!token) {
        alert("Not authenticated");
        return;
      }

      const payload = JSON.parse(
        localStorage.getItem("hodAppraisalPayload")
      );

      if (!payload) {
        alert("No appraisal data found");
        return;
      }

      await API.post("hod/submit/", payload);

      alert("HOD appraisal submitted successfully");

      const updated = {
        academicYear: payload.academic_year,
        status: "submitted",
        submissionDate: new Date().toISOString().split("T")[0],
      };

      setHodOwnAppraisal(updated);
      localStorage.setItem(
        "hodOwnAppraisal",
        JSON.stringify(updated)
      );
    } catch (err) {
      console.error(err);
      alert(err.message || "Failed to submit appraisal");
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



  /* ================= REVIEW SCREEN ================= */
  if (selectedSubmission) {
    return (
      <div className="hod-container">
        <button className="back-btn" onClick={() => setSelectedSubmission(null)}>
          ← Back to Dashboard
        </button>

        <div className="card">
          <h2>Faculty Submission Review</h2>

          <div className="info-grid">
            <div><b>Name:</b> {selectedSubmission.faculty_name}</div>
            <div><b>Department:</b> {selectedSubmission.department}</div>
            <div><b>Designation:</b> {selectedSubmission.designation}</div>
            <div><b>Academic Year:</b> {selectedSubmission.academic_year}</div>
          </div>

          <h3>HOD Remarks</h3>
          <textarea
            placeholder="Enter remarks here..."
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
          />

          {/* VERIFIED GRADE INPUT */}
          {
            selectedSubmission.status === "REVIEWED_BY_HOD" && (
              <div style={{ marginTop: '16px' }}>
                <h3>Verified Grading</h3>
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
                          Self: {getTable2SelfValue(selectedSubmission?.sppu_review_data, fieldKey)}
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

                <div style={{ marginTop: '10px' }}>
                  <label style={{ fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                    Justification of assessment of work as not satisfactory (optional)
                  </label>
                  <textarea
                    placeholder="Enter justification if overall assessment is Not Satisfactory..."
                    value={hodNotSatisfactoryJustification}
                    onChange={(e) => setHodNotSatisfactoryJustification(e.target.value)}
                  />
                </div>

                <div style={{ marginTop: '14px' }}>
                  <label style={{ fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                    Comments of HOD on Table 1
                  </label>
                  <textarea
                    placeholder="Enter comments for Table 1..."
                    value={hodCommentsTable1}
                    onChange={(e) => setHodCommentsTable1(e.target.value)}
                  />
                </div>

                <div style={{ marginTop: '10px' }}>
                  <label style={{ fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                    Comments of HOD on Table 2
                  </label>
                  <textarea
                    placeholder="Enter comments for Table 2..."
                    value={hodCommentsTable2}
                    onChange={(e) => setHodCommentsTable2(e.target.value)}
                  />
                </div>

                <div style={{ marginTop: '10px' }}>
                  <label style={{ fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                    Remarks and Suggestions
                  </label>
                  <textarea
                    placeholder="Enter remarks and suggestions..."
                    value={hodRemarksSuggestions}
                    onChange={(e) => setHodRemarksSuggestions(e.target.value)}
                  />
                </div>
              </div>
            )
          }


          {
            selectedSubmission.appraisal_id && (
              <div style={{ marginTop: '18px', marginBottom: '4px' }}>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="approve-btn"
                    style={{ height: '36px', padding: '0 14px' }}
                    onClick={() => previewPdf(`/api/appraisal/${selectedSubmission.appraisal_id}/pdf/sppu-enhanced/`)}
                  >
                    Preview SPPU Form
                  </button>
                  <button
                    type="button"
                    className="approve-btn"
                    style={{ height: '36px', padding: '0 14px' }}
                    onClick={() => previewPdf(`/api/appraisal/${selectedSubmission.appraisal_id}/pdf/pbas-enhanced/`)}
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
            )
          }

          {
            selectedSubmission.appraisal_data && (
              <div className="form-data-view" style={{ marginTop: '20px', padding: '16px', background: '#f9fafb', borderRadius: '8px', border: '1px solid #e5e7eb', maxHeight: '400px', overflowY: 'auto' }}>
                <AppraisalSummary data={selectedSubmission.appraisal_data} />
              </div>
            )
          }


          <div className="action-btn-row">
            {selectedSubmission.status === "SUBMITTED" && (
              <button className="approve-btn" onClick={handleStartReview}>
                Start Review
              </button>
            )}

            {selectedSubmission.status === "REVIEWED_BY_HOD" && (
              <button className="approve-btn" onClick={handleSaveVerifiedGrading} disabled={isSavingVerification}>
                {isSavingVerification ? "Saving..." : "Save/Confirm Verified Grading"}
              </button>
            )}

            {selectedSubmission.status === "REVIEWED_BY_HOD" && (
              <button className="approve-btn" onClick={handleApprove}>
                Approve
              </button>
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
        </div >
      </div >
    );
  }

  /* ================= MAIN DASHBOARD ================= */
  return (
    <div className="hod-container">
      <div className="hod-header-card">
        <div>
          <h1>HOD Dashboard</h1>
          <p className="subtitle">Faculty Review & Self Appraisal</p>
        </div>
        <button className="logout-btn" onClick={handleLogout}>
          Logout
        </button>
      </div>

      <div className="dashboard-grid">
        {/* PROFILE */}
        <div
          className="dashboard-card"
          onClick={() => navigate("/faculty/profile")}
        >
          <h3>My Profile</h3>
          <p>View official details and update personal information</p>
        </div>

        {/* APPRAISAL FORM */}
        <div
          className={`dashboard-card ${hodOwnAppraisal.status === "submitted" ? "disabled" : ""}`}
          onClick={() => {
            if (hodOwnAppraisal.status !== "submitted") handleFillOwnAppraisal();
          }}
        >
          <h3>My Appraisal Form</h3>
          <p>
            {hodOwnAppraisal.actual_status === "RETURNED_BY_PRINCIPAL"
              ? "Returned for Changes - Please edit and resubmit"
              : hodOwnAppraisal.status === "not_started"
                ? "Fill and submit your annual faculty appraisal"
                : hodOwnAppraisal.status === "in_progress"
                  ? "Continue filling your appraisal form"
                  : "Appraisal already submitted"}
          </p>

          {(hodOwnAppraisal.status === "in_progress" || hodOwnAppraisal.actual_status === "RETURNED_BY_PRINCIPAL") && (
            <button className="approve-btn" style={{ marginTop: '12px', height: '40px', padding: '0 16px', fontSize: '14px' }} onClick={(e) => { e.stopPropagation(); navigate("/hod/appraisal-form"); }}>
              {hodOwnAppraisal.actual_status === "RETURNED_BY_PRINCIPAL" ? "✍️ Edit & Resubmit" : "📤 Submit to Principal"}
            </button>
          )}
        </div>
      </div>

      <div className="tab-row" style={{ marginTop: '32px' }}>
        <button
          className={activeTab === "pending" ? "tab active" : "tab"}
          onClick={() => setActiveTab("pending")}
        >
          Pending
        </button>
        <button
          className={activeTab === "processed" ? "tab active" : "tab"}
          onClick={() => setActiveTab("processed")}
        >
          Processed
        </button>
      </div>

      {/* SUBMISSION HISTORY (HOD OWN) moved down */}
      {hodOwnAppraisal.appraisal_id && (
        <div className="dashboard-history-section" style={{ marginBottom: '32px' }}>
          <h3>My Submission History</h3>
          <div className="history-list">
            <div className="history-item">
              <div className="history-info">
                <span className="history-year">AY {hodOwnAppraisal.academicYear}</span>
                <span className={`history-status ${hodOwnAppraisal.actual_status?.toLowerCase().replace(/_/g, "-")}`}>
                  {hodOwnAppraisal.actual_status?.replace(/_/g, " ")}
                </span>
              </div>
              <button
                className="view-btn"
                onClick={() => navigate("/faculty/appraisal/status")}
              >
                Track Status
              </button>
            </div>

            {/* PDF Download Buttons for HOD's Own Finalized Appraisal */}
            {hodOwnAppraisal.actual_status === "FINALIZED" && (
              <div style={{ marginTop: '12px', padding: '12px', background: '#f0fdf4', borderRadius: '8px', border: '1px solid #86efac' }}>
                <p style={{ fontWeight: 'bold', marginBottom: '8px', color: '#166534', fontSize: '14px' }}>📄 Download Your Appraisal PDFs:</p>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button type="button" onClick={() => downloadPdf(`/api/appraisal/${hodOwnAppraisal.appraisal_id}/pdf/sppu-enhanced/`, `SPPU_${hodOwnAppraisal.academicYear}.pdf`)} style={{ padding: '8px 16px', background: '#3b82f6', color: 'white', borderRadius: '6px', border: 'none', fontSize: '13px', fontWeight: '500', cursor: 'pointer' }}>SPPU PDF</button>
                  <button type="button" onClick={() => downloadPdf(`/api/appraisal/${hodOwnAppraisal.appraisal_id}/pdf/pbas-enhanced/`, `PBAS_${hodOwnAppraisal.academicYear}.pdf`)} style={{ padding: '8px 16px', background: '#8b5cf6', color: 'white', borderRadius: '6px', border: 'none', fontSize: '13px', fontWeight: '500', cursor: 'pointer' }}>PBAS PDF</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "pending" && (
        <div className="list">
          {loading && <p>Loading appraisals...</p>}
          {error && <p className="error">{error}</p>}

          {!loading && submissions.pending.length === 0 && (
            <p>No pending appraisals.</p>
          )}

          {submissions.pending.map((sub) => (
            <div className="list-card" key={sub.appraisal_id}>
              <div>
                <h3>{sub.faculty_name}</h3>
                <p>{sub.department} | {sub.academic_year}</p>
              </div>
              <button
                className="primary-btn"
                onClick={() => setSelectedSubmission(sub)}
              >
                👁 View
              </button>
            </div>
          ))}
        </div>
      )}

      {activeTab === "processed" && (
        <div className="list">
          {submissions.processed.length === 0 && (
            <p>No processed appraisals.</p>
          )}

          {submissions.processed.map((sub) => (
            <div className="list-card" key={sub.appraisal_id}>
              <div>
                <h3>{sub.faculty_name}</h3>
                <p>{sub.department} | {sub.academic_year}</p>
                <span className={`status ${sub.status?.toLowerCase().replace(/_/g, "-")}`}>
                  {sub.status?.replace(/_/g, " ")}
                </span>

                {/* PDF Download Buttons for Finalized Faculty Appraisals */}
                {sub.status === "FINALIZED" && (
                  <div style={{ marginTop: '10px' }}>
                    <p style={{ fontWeight: 'bold', marginBottom: '5px', fontSize: '13px' }}>Download PDFs:</p>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      <button type="button" onClick={() => downloadPdf(`/api/appraisal/${sub.appraisal_id}/pdf/sppu-enhanced/`, `SPPU_${sub.academic_year}.pdf`)} style={{ padding: '6px 12px', background: '#3b82f6', color: 'white', borderRadius: '4px', border: 'none', fontSize: '12px', fontWeight: '500', cursor: 'pointer' }}>SPPU</button>
                      <button type="button" onClick={() => downloadPdf(`/api/appraisal/${sub.appraisal_id}/pdf/pbas-enhanced/`, `PBAS_${sub.academic_year}.pdf`)} style={{ padding: '6px 12px', background: '#8b5cf6', color: 'white', borderRadius: '4px', border: 'none', fontSize: '12px', fontWeight: '500', cursor: 'pointer' }}>PBAS</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


