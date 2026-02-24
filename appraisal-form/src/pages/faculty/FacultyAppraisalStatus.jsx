import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../../styles/FacultyAppraisalStatus.css";
import { downloadWithAuth } from "../../utils/downloadFile";
import {
  fetchAndCacheFacultyStatus,
  readStatusCache,
} from "../../utils/appraisalStatusCache";

const USE_DUMMY_DATA = false;

export default function FacultyAppraisalStatus() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("under-review");
  const [loading, setLoading] = useState(!USE_DUMMY_DATA);
  const [error, setError] = useState(null);

  const [appraisalData, setAppraisalData] = useState({
    underReview: [],
    approved: [],
    changesRequested: [],
  });

  const dummyData = {
    underReview: [
      {
        id: 1,
        academic_year: "2024-25",
        submitted_date: "15 Jan 2025",
        current_level: "HOD",
        status: "Under Review",
      },
    ],
    approved: [],
    changesRequested: [],
  };

  useEffect(() => {
    if (USE_DUMMY_DATA) {
      setAppraisalData(dummyData);
      setLoading(false);
      return;
    }

    let alive = true;
    const cached = readStatusCache();
    if (cached) {
      setAppraisalData(cached);
      setLoading(false);
    }

    const fetchStatus = async () => {
      try {
        setError(null);
        const normalized = await fetchAndCacheFacultyStatus();
        if (!alive) return;
        setAppraisalData(normalized);
      } catch (err) {
        console.error(err);
        if (alive) setError("Unable to load appraisal status");
      } finally {
        if (alive) setLoading(false);
      }
    };

    fetchStatus();

    return () => {
      alive = false;
    };
  }, []);

  const downloadFile = async (url, filename) => {
    try {
      await downloadWithAuth(url, filename);
    } catch {
      alert("Failed to download PDF. It might not be generated yet.");
    }
  };

  const renderEmpty = (msg) => (
    <div className="empty-state">
      <p>{msg}</p>
    </div>
  );

  const renderContent = () => {
    if (loading) return renderEmpty("Loading appraisal status...");
    if (error) return renderEmpty(error);

    const dataMap = {
      "under-review": appraisalData.underReview,
      approved: appraisalData.approved,
      "changes-requested": appraisalData.changesRequested,
    };

    const list = dataMap[activeTab];
    if (!list || list.length === 0) return renderEmpty("No records found");

    return list.map((item) => {
      const canDownload =
        activeTab === "approved" &&
        (item.download_available === true ||
          ["FINALIZED", "PRINCIPAL_APPROVED", "COMPLETED"].includes(item.workflow_state || item.status));

      const sppuUrl = item.download_urls?.sppu || `/api/appraisal/${item.id}/download/`;
      const pbasUrl = item.download_urls?.pbas || `/api/appraisal/${item.id}/download/?pdf_type=PBAS`;

      return (
        <div key={item.id} className="status-card">
          <div className="status-card-header">
            <h3>Academic Year {item.academic_year}</h3>
          </div>

          <div className="status-card-body">
            <div className="status-info-grid">
              <div className="status-info-item">
                <span className="status-info-label">Submitted Date</span>
                <span className="status-info-value">{item.submitted_date || "-"}</span>
              </div>

              <div className="status-info-item">
                <span className="status-info-label">Current Level</span>
                <span className="status-info-value">{item.current_level || "-"}</span>
              </div>

              <div className="status-info-item">
                <span className="status-info-label">Status</span>
                <span className={`status-badge ${activeTab}`}>{item.status}</span>
              </div>
            </div>

            {activeTab === "changes-requested" && item.remarks && (
              <div className="remarks-section">
                <h4>Remarks</h4>
                <p>{item.remarks}</p>
              </div>
            )}

            {activeTab === "changes-requested" && (
              <button className="edit-btn" onClick={() => navigate(editPath)}>
                Edit & Re-submit
              </button>
            )}

            {canDownload && (
              <div className="action-buttons">
                <button
                  className="download-btn"
                  onClick={() => downloadFile(sppuUrl, `SPPU_${item.academic_year}.pdf`)}
                >
                  Download SPPU
                </button>
                <button
                  className="download-btn"
                  style={{ backgroundColor: "#6d28d9" }}
                  onClick={() => downloadFile(pbasUrl, `PBAS_${item.academic_year}.pdf`)}
                >
                  Download PBAS
                </button>
              </div>
            )}
          </div>
        </div>
      );
    });
  };

  const role = localStorage.getItem("role") || sessionStorage.getItem("role");
  const isHOD = role === "HOD";
  const backPath = isHOD ? "/hod/dashboard" : "/faculty/dashboard";
  const editPath = isHOD ? "/hod/appraisal-form" : "/faculty/appraisal";

  return (
    <div className="status-page">
      <button className="back-btn" onClick={() => navigate(backPath)}>
        Back to Dashboard
      </button>

      <div className="status-header-card">
        <h1>Appraisal Status</h1>
        <p className="subtitle">Track approval status</p>
      </div>

      <div className="status-tabs">
        <button
          className={`status-tab ${activeTab === "under-review" ? "active" : ""}`}
          onClick={() => setActiveTab("under-review")}
        >
          Under Review
        </button>

        <button
          className={`status-tab ${activeTab === "approved" ? "active" : ""}`}
          onClick={() => setActiveTab("approved")}
        >
          Approved
        </button>

        <button
          className={`status-tab ${activeTab === "changes-requested" ? "active" : ""}`}
          onClick={() => setActiveTab("changes-requested")}
        >
          Changes Requested
        </button>
      </div>

      <div className="status-content">{renderContent()}</div>
    </div>
  );
}
