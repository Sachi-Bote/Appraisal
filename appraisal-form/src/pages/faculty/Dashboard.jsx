import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import API from "../../api";
import "../../styles/dashboard.css";
import { formatStatus } from "../../utils/textFormatters";
import { downloadWithAuth } from "../../utils/downloadFile";
import {
  fetchAndCacheFacultyStatus,
  getLatestAppraisal,
  readStatusCache,
} from "../../utils/appraisalStatusCache";

export default function FacultyDashboard() {
  const navigate = useNavigate();

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

    return () => {
      alive = false;
    };
  }, []);

  const disableNewForm =
    appraisal &&
    appraisal.status &&
    !["DRAFT", "Changes Requested"].includes(appraisal.status);

  const statusClassName = appraisal?.status
    ? formatStatus(appraisal.status).toLowerCase().replace(/\s+/g, "-")
    : "draft";

  const downloadPdf = async (url, filename) => {
    try {
      await downloadWithAuth(url, filename);
    } catch {
      alert("Failed to download PDF.");
    }
  };

  return (
    <div className="dashboard-page">
      <div className="dashboard-header-card">
        <div>
          <h2>Faculty Dashboard</h2>
          <p className="dashboard-subtitle">
            Access your profile, appraisal forms, and status
          </p>
        </div>

        <button
          className="logout-btn"
          onClick={() => {
            localStorage.clear();
            sessionStorage.clear();
            navigate("/login");
          }}
        >
          Logout
        </button>
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
                : appraisal.status === "Changes Requested"
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
                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    className="view-btn"
                    onClick={() => navigate("/faculty/appraisal/status")}
                  >
                    Track Status
                  </button>
                  {["FINALIZED", "APPROVED", "PRINCIPAL_APPROVED"].includes(appraisal.status) && (
                    <button
                      className="view-btn"
                      style={{ background: "#059669" }}
                      onClick={async () => {
                        try {
                          await downloadWithAuth(`/api/appraisal/${appraisal.id}/pdf/sppu-enhanced/`, `SPPU_${appraisal.academic_year}.pdf`);
                        } catch {
                          alert("Failed to download PDF. It might not be generated yet.");
                        }
                      }}
                    >
                      Download PDF
                    </button>
                  )}
                </div>
              </div>

              {appraisal.status === "FINALIZED" && (
                <div style={{ marginTop: "12px", padding: "12px", background: "#f0fdf4", borderRadius: "8px", border: "1px solid #86efac" }}>
                  <p style={{ fontWeight: "bold", marginBottom: "8px", color: "#166534", fontSize: "14px" }}>
                    Download Your Appraisal PDFs:
                  </p>
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                    <button
                      type="button"
                      onClick={() => downloadPdf(`/api/appraisal/${appraisal.id}/pdf/sppu-enhanced/`, `SPPU_${appraisal.academic_year}.pdf`)}
                      style={{ padding: "8px 16px", background: "#3b82f6", color: "white", borderRadius: "6px", border: "none", fontSize: "13px", fontWeight: "500", cursor: "pointer" }}
                    >
                      SPPU PDF
                    </button>
                    <button
                      type="button"
                      onClick={() => downloadPdf(`/api/appraisal/${appraisal.id}/pdf/pbas-enhanced/`, `PBAS_${appraisal.academic_year}.pdf`)}
                      style={{ padding: "8px 16px", background: "#8b5cf6", color: "white", borderRadius: "6px", border: "none", fontSize: "13px", fontWeight: "500", cursor: "pointer" }}
                    >
                      PBAS PDF
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
