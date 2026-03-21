import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import "../../styles/profile.css";
import API, { clearAuthAndRedirect } from "../../api";
import useSessionState from "../../hooks/useSessionState";
import { buildApiUrl } from "../../utils/apiUrl";
import { normalizeRole } from "../../utils/profileRoutes";

const DEFAULT_AVATAR = "https://i.pravatar.cc/300?img=12";
const accountSections = [
  { title: "System Information", fields: ["id", "username", "email", "role"] },
  { title: "Personal Information", fields: ["full_name", "mobile_number", "address"] },
  {
    title: "Institutional Details",
    fields: [
      "department",
      "designation",
      "date_of_joining",
      "gradePay",
      "promotion_designation",
      "eligibility_date",
      "assessment_period",
    ],
  },
];

const resolveProfileImageUrl = (url) => {
  const raw = String(url || "").trim();
  return raw ? buildApiUrl(raw) : DEFAULT_AVATAR;
};
const withCacheBust = (url) =>
  url && url !== DEFAULT_AVATAR ? `${url}${url.includes("?") ? "&" : "?"}v=${Date.now()}` : url || DEFAULT_AVATAR;
const toISODate = (value) => {
  const text = String(value || "").trim();
  if (!text) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const match = text.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : text;
};
const normalizeProfileFields = (fields = {}) => {
  const currentYearIso = `${new Date().getFullYear()}-01-01`;
  return {
    ...fields,
    date_of_joining: toISODate(fields.date_of_joining),
    eligibility_date: toISODate(fields.eligibility_date),
    assessment_period: toISODate(fields.assessment_period) || currentYearIso,
  };
};
const formatDateDisplay = (value) => {
  const text = String(value || "").trim();
  if (!text) return "Not specified";
  const date = new Date(text);
  return Number.isNaN(date.getTime())
    ? text
    : date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
};
const getInitials = (name) =>
  String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("") || "U";
const getAcademicYearLabel = (value) => {
  const date = value ? new Date(value) : new Date();
  const year = Number.isNaN(date.getTime()) ? new Date().getFullYear() : date.getFullYear();
  return `${year}-${String((year + 1) % 100).padStart(2, "0")}`;
};
const getRoleMeta = (role) => {
  const normalized = normalizeRole(role);
  if (normalized === "HOD") {
    return {
      title: "Head of Department",
      short: "HOD",
      dashboardPath: "/hod/dashboard",
      appraisalPath: "/hod/appraisal-form",
      activityTitle: "Review Access",
      activityBody:
        "Review faculty submissions, manage your own self-appraisal, and keep your account details current from one place.",
    };
  }
  if (normalized === "PRINCIPAL") {
    return {
      title: "Principal",
      short: "Principal",
      dashboardPath: "/principal/dashboard",
      appraisalPath: "/principal/dashboard",
      activityTitle: "Approval Access",
      activityBody:
        "Manage final approval workflow, password updates, and core profile information from a shared executive profile layout.",
    };
  }
  return {
    title: "Faculty Member",
    short: "Faculty",
    dashboardPath: "/faculty/dashboard",
    appraisalPath: "/faculty/appraisal",
    activityTitle: "Submission Access",
    activityBody:
      "Keep your details updated and jump back into the appraisal workspace whenever you are ready to continue.",
  };
};

export default function Profile() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryTab = new URLSearchParams(location.search).get("tab");
  const normalizedTab = queryTab === "password" || queryTab === "activity" ? queryTab : "account";
  const [activeTab, setActiveTab] = useSessionState("profile.activeTab", normalizedTab);
  const [isEditing, setIsEditing] = useState(false);
  const [showLogout, setShowLogout] = useState(false);
  const [profileImage, setProfileImage] = useState(DEFAULT_AVATAR);
  const [savedProfileImage, setSavedProfileImage] = useState(DEFAULT_AVATAR);
  const [profileImageFile, setProfileImageFile] = useState(null);
  const [profileImageRemoved, setProfileImageRemoved] = useState(false);
  const [tempImage, setTempImage] = useState(null);
  const [showImageEditor, setShowImageEditor] = useState(false);
  const [cropArea, setCropArea] = useState({ x: 50, y: 50, size: 200 });
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const initialProfile = {
    full_name: "",
    designation: "",
    date_of_joining: "",
    department: "",
    address: "",
    email: "",
    mobile_number: "",
    gradePay: "",
    promotion_designation: "",
    eligibility_date: "",
    assessment_period: "",
    role: "",
    username: "",
    id: "",
  };
  const [profileData, setProfileData] = useState(initialProfile);
  const [editData, setEditData] = useState(initialProfile);
  const [password, setPassword] = useState({ current: "", newPass: "", confirm: "" });
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");
  const [showPassword, setShowPassword] = useState({ current: false, newPass: false, confirm: false });

  const hiddenAccountFields = new Set(["must_change_password", "date_joined"]);
  const readOnlyAccountFields = new Set(["id", "username", "role", "department", "must_change_password", "date_joined"]);
  const dateFields = new Set(["date_of_joining", "eligibility_date", "assessment_period"]);
  const roleMeta = useMemo(() => getRoleMeta(profileData.role), [profileData.role]);
  const displayName = profileData.full_name || profileData.username || "Staff Member";
  const displayRole = profileData.designation || roleMeta.title;
  const displayDepartment = profileData.department || "Department";
  const avatarInitials = getInitials(displayName);
  const academicYearLabel = getAcademicYearLabel(profileData.assessment_period);
  const passwordMismatch = password.newPass && password.confirm && password.newPass !== password.confirm;

  const passwordStrength = useMemo(() => {
    let score = 0;
    if (password.newPass.length >= 8) score += 1;
    if (/[A-Z]/.test(password.newPass)) score += 1;
    if (/[0-9]/.test(password.newPass)) score += 1;
    if (/[^A-Za-z0-9]/.test(password.newPass)) score += 1;
    return {
      score,
      label: ["Enter a new password", "Weak", "Fair", "Good", "Strong"][score],
      tone: ["neutral", "weak", "fair", "good", "strong"][score],
    };
  }, [password.newPass]);

  useEffect(() => {
    API.get("me/")
      .then((res) => {
        const { profile_image, ...profileFields } = res.data || {};
        const normalized = normalizeProfileFields(profileFields);
        setProfileData(normalized);
        setEditData(normalized);
        const imageUrl = withCacheBust(resolveProfileImageUrl(profile_image));
        setProfileImage(imageUrl);
        setSavedProfileImage(imageUrl);
        setProfileImageFile(null);
        setProfileImageRemoved(false);
      })
      .catch(() => navigate("/login"));
  }, [navigate]);

  useEffect(() => {
    if (activeTab !== normalizedTab) setActiveTab(normalizedTab);
  }, [activeTab, normalizedTab, setActiveTab]);

  useEffect(() => {
    const move = (e) => {
      if (isDragging) {
        const container = document.querySelector(".profile-image-preview");
        if (!container) return;
        const rect = container.getBoundingClientRect();
        const x = Math.max(0, Math.min(e.clientX - dragStart.x, rect.width - cropArea.size));
        const y = Math.max(0, Math.min(e.clientY - dragStart.y, rect.height - cropArea.size));
        setCropArea((prev) => ({ ...prev, x, y }));
      }
      if (isResizing) {
        const container = document.querySelector(".profile-image-preview");
        if (!container) return;
        const rect = container.getBoundingClientRect();
        const delta = Math.max(e.clientX - dragStart.x, e.clientY - dragStart.y);
        const size = Math.max(100, Math.min(dragStart.size + delta, rect.width - cropArea.x, rect.height - cropArea.y));
        setCropArea((prev) => ({ ...prev, size }));
      }
    };
    const up = () => {
      setIsDragging(false);
      setIsResizing(false);
    };
    if (isDragging || isResizing) {
      document.addEventListener("mousemove", move);
      document.addEventListener("mouseup", up);
    }
    return () => {
      document.removeEventListener("mousemove", move);
      document.removeEventListener("mouseup", up);
    };
  }, [cropArea.size, cropArea.x, cropArea.y, dragStart, isDragging, isResizing]);

  const formLabel = (key) =>
    key
      .replace(/_/g, " ")
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .replace(/\b\w/g, (ch) => ch.toUpperCase());

  const displayValue = (key, value) => {
    if (!value) return "Not specified";
    return dateFields.has(key) ? formatDateDisplay(value) : value;
  };

  const handleImageSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setTempImage(reader.result);
      setCropArea({ x: 50, y: 50, size: 200 });
      setShowImageEditor(true);
    };
    reader.readAsDataURL(file);
  };

  const saveImage = () => {
    const canvas = document.createElement("canvas");
    canvas.width = 300;
    canvas.height = 300;
    const ctx = canvas.getContext("2d");
    const img = new Image();
    img.src = tempImage;
    img.onload = () => {
      const container = document.querySelector(".profile-image-preview");
      if (!container || !ctx) return;
      const rect = container.getBoundingClientRect();
      const scaleX = img.width / rect.width;
      const scaleY = img.height / rect.height;
      ctx.drawImage(
        img,
        cropArea.x * scaleX,
        cropArea.y * scaleY,
        cropArea.size * scaleX,
        cropArea.size * scaleY,
        0,
        0,
        300,
        300
      );
      const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
      canvas.toBlob((blob) => {
        setProfileImage(dataUrl);
        if (blob) {
          setProfileImageFile(new File([blob], `profile-${Date.now()}.jpg`, { type: "image/jpeg" }));
          setProfileImageRemoved(false);
        }
        setTempImage(null);
        setShowImageEditor(false);
      }, "image/jpeg", 0.9);
    };
  };

  const startEdit = () => {
    setEditData(profileData);
    setProfileImageFile(null);
    setProfileImageRemoved(false);
    setIsEditing(true);
  };

  const cancelEdit = () => {
    setEditData(profileData);
    setProfileImage(savedProfileImage || DEFAULT_AVATAR);
    setProfileImageFile(null);
    setProfileImageRemoved(false);
    setIsEditing(false);
  };

  const saveProfile = async () => {
    try {
      const formData = new FormData();
      [
        "full_name",
        "mobile_number",
        "email",
        "designation",
        "address",
        "gradePay",
        "promotion_designation",
        "eligibility_date",
        "assessment_period",
        "date_of_joining",
      ].forEach((field) => formData.append(field, editData[field] || ""));
      if (profileImageFile) formData.append("profile_image", profileImageFile);
      if (profileImageRemoved) formData.append("remove_profile_image", "true");
      await API.patch("me/", formData, { headers: { "Content-Type": "multipart/form-data" } });
      const res = await API.get("me/");
      const { profile_image, ...profileFields } = res.data || {};
      const normalized = normalizeProfileFields(profileFields);
      setProfileData(normalized);
      setEditData(normalized);
      const imageUrl = withCacheBust(resolveProfileImageUrl(profile_image));
      setProfileImage(imageUrl);
      setSavedProfileImage(imageUrl);
      setProfileImageFile(null);
      setProfileImageRemoved(false);
      setIsEditing(false);
    } catch (err) {
      console.error(err.response?.data);
      alert(err?.response?.data?.detail || "Failed to update profile");
    }
  };

  const updatePassword = async () => {
    setPasswordError("");
    setPasswordSuccess("");
    if (!password.current || !password.newPass || !password.confirm) {
      setPasswordError("All password fields are required.");
      return;
    }
    if (passwordMismatch) {
      setPasswordError("Password does not match.");
      return;
    }
    try {
      await API.post("auth/change-password/", {
        old_password: password.current,
        new_password: password.newPass,
      });
      setPassword({ current: "", newPass: "", confirm: "" });
      setPasswordSuccess("Password updated successfully.");
    } catch (err) {
      setPasswordError(err?.response?.data?.detail || "Failed to update password.");
    }
  };

  const statCards = [
    { label: "Role", value: roleMeta.short, note: roleMeta.title, tone: "blue" },
    { label: "Grade Pay", value: profileData.gradePay || "--", note: profileData.gradePay ? "Active" : "Awaiting update", tone: "green" },
    { label: "Assessment Period", value: formatDateDisplay(profileData.assessment_period), note: `AY ${academicYearLabel}`, tone: "amber" },
  ];

  const navItems = [
    { id: "account", label: "Account Details", icon: "Ac", color: "blue" },
    { id: "password", label: "Change Password", icon: "Pw", color: "amber" },
    { id: "activity", label: roleMeta.activityTitle, icon: "Av", color: "green" },
  ];

  return (
    <div className="profile-page-shell">
      <nav className="profile-topnav">
        <div className="profile-brand">
          <div className="profile-brand-icon">SA</div>
          <div className="profile-brand-copy">
            <span className="profile-brand-title">Staff Appraisal System</span>
            <span className="profile-brand-subtitle">Profile Workspace</span>
          </div>
        </div>
        <div className="profile-topnav-links">
          <button type="button" className="profile-topnav-link" onClick={() => navigate(roleMeta.dashboardPath)}>Dashboard</button>
          <button type="button" className="profile-topnav-link profile-topnav-link-active">My Profile</button>
          {normalizeRole(profileData.role) !== "PRINCIPAL" && (
            <button type="button" className="profile-topnav-link" onClick={() => navigate(roleMeta.appraisalPath)}>
              Appraisal
            </button>
          )}
        </div>
        <div className="profile-topnav-actions">
          <span className="profile-topnav-badge">{roleMeta.short} · {displayDepartment}</span>
          <button type="button" className="profile-topnav-logout" onClick={() => setShowLogout(true)}>Logout</button>
        </div>
      </nav>

      <section className="profile-hero">
        <div className="profile-hero-ring profile-hero-ring-left" />
        <div className="profile-hero-ring profile-hero-ring-right" />
        <div className="profile-hero-main">
          <div className="profile-hero-identity">
            <div className="profile-avatar-wrap">
              <div className="profile-avatar-frame">
                {profileImage && profileImage !== DEFAULT_AVATAR ? (
                  <img src={profileImage} alt={displayName} className="profile-avatar-image" />
                ) : (
                  <span className="profile-avatar-fallback">{avatarInitials}</span>
                )}
              </div>
              {isEditing && (
                <label className="profile-avatar-edit">
                  Edit
                  <input type="file" accept="image/*" onChange={handleImageSelect} />
                </label>
              )}
            </div>
            <div className="profile-hero-copy">
              <p className="profile-hero-kicker">Account Profile</p>
              <h1>{displayName}</h1>
              <div className="profile-hero-meta">
                <span>{displayRole}</span>
                <span className="profile-meta-dot" />
                <span>{displayDepartment}</span>
                <span className="profile-meta-dot" />
                <span>ID #{profileData.id || "--"}</span>
              </div>
            </div>
          </div>
          <div className="profile-hero-actions">
            <span className="profile-year-pill">AY {academicYearLabel}</span>
            {!isEditing ? (
              <button type="button" className="profile-primary-action" onClick={startEdit}>Edit Profile</button>
            ) : (
              <div className="profile-inline-actions">
                <button type="button" className="profile-secondary-action" onClick={cancelEdit}>Cancel</button>
                <button type="button" className="profile-primary-action" onClick={saveProfile}>Save Changes</button>
              </div>
            )}
          </div>
        </div>
      </section>

      <main className="profile-content">
        <section className="profile-stat-grid">
          {statCards.map((card) => (
            <article key={card.label} className={`profile-stat-card profile-stat-${card.tone}`}>
              <span className="profile-stat-label">{card.label}</span>
              <strong className="profile-stat-value">{card.value}</strong>
              <span className={`profile-stat-chip profile-stat-chip-${card.tone}`}>{card.note}</span>
            </article>
          ))}
        </section>

        <section className="profile-main-grid">
          <aside className="profile-sidecard">
            <div className="profile-sidecard-head">
              <div className="profile-side-avatar">
                {profileImage && profileImage !== DEFAULT_AVATAR ? (
                  <img src={profileImage} alt={displayName} className="profile-side-avatar-image" />
                ) : (
                  <span>{avatarInitials}</span>
                )}
              </div>
              <h2>{displayName}</h2>
              <p>{displayRole}</p>
              <span className="profile-sidecard-badge">{displayDepartment}</span>
            </div>

            <div className="profile-sidecard-nav">
              <span className="profile-sidecard-label">Workspace</span>
              {navItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`profile-side-nav-btn ${activeTab === item.id ? "profile-side-nav-btn-active" : ""}`}
                  onClick={() => setActiveTab(item.id)}
                >
                  <span className={`profile-side-nav-icon profile-side-nav-icon-${item.color}`}>{item.icon}</span>
                  <span>{item.label}</span>
                </button>
              ))}
            </div>

            <button type="button" className="profile-back-btn" onClick={() => navigate(roleMeta.dashboardPath)}>
              Back to Dashboard
            </button>
          </aside>

          <div className="profile-panels">
            {activeTab === "account" && (
              <section className="profile-panel">
                <header className="profile-panel-header">
                  <div>
                    <p className="profile-panel-kicker">Account Details</p>
                    <h3>Personal and institutional information</h3>
                  </div>
                  <div className="profile-panel-actions">
                    {!isEditing ? (
                      <button type="button" className="profile-outline-btn" onClick={startEdit}>Edit</button>
                    ) : (
                      <>
                        <button type="button" className="profile-muted-btn" onClick={cancelEdit}>Cancel</button>
                        <button type="button" className="profile-filled-btn" onClick={saveProfile}>Save Changes</button>
                      </>
                    )}
                  </div>
                </header>

                <div className="profile-panel-body">
                  {isEditing && (
                    <div className="profile-photo-toolbar">
                      <label className="profile-photo-btn">
                        Change Photo
                        <input type="file" accept="image/*" onChange={handleImageSelect} />
                      </label>
                      <button type="button" className="profile-photo-delete" onClick={() => { setProfileImage(DEFAULT_AVATAR); setProfileImageFile(null); setProfileImageRemoved(true); }}>
                        Remove Photo
                      </button>
                    </div>
                  )}

                  {accountSections.map((section) => (
                    <div key={section.title} className="profile-form-section">
                      <div className="profile-form-section-title">{section.title}</div>
                      <div className="profile-form-grid">
                        {section.fields.filter((field) => !hiddenAccountFields.has(field)).map((field) => {
                          const isWide = field === "address";
                          const value = editData[field] || "";
                          const isReadOnly = readOnlyAccountFields.has(field);
                          const isDate = dateFields.has(field);
                          return (
                            <div key={field} className={`profile-form-field ${isWide ? "profile-form-field-wide" : ""}`}>
                              <label className="profile-field-label">{formLabel(field)}</label>
                              {!isEditing ? (
                                <div className={`profile-field-value ${!value ? "profile-field-value-empty" : ""}`}>
                                  {displayValue(field, value)}
                                </div>
                              ) : isWide ? (
                                <textarea
                                  name={field}
                                  value={value}
                                  onChange={(e) => setEditData((prev) => ({ ...prev, [field]: e.target.value }))}
                                  disabled={isReadOnly}
                                  className="profile-input"
                                />
                              ) : (
                                <input
                                  name={field}
                                  type={isDate ? "date" : "text"}
                                  value={value}
                                  onChange={(e) => setEditData((prev) => ({ ...prev, [field]: e.target.value }))}
                                  disabled={isReadOnly}
                                  className="profile-input"
                                />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {activeTab === "password" && (
              <section className="profile-panel">
                <header className="profile-panel-header">
                  <div>
                    <p className="profile-panel-kicker">Change Password</p>
                    <h3>Secure your account access</h3>
                  </div>
                </header>
                <div className="profile-panel-body">
                  <div className="profile-password-grid">
                    {[
                      { key: "current", label: "Current Password" },
                      { key: "newPass", label: "New Password" },
                      { key: "confirm", label: "Confirm New Password" },
                    ].map((field) => (
                      <label key={field.key} className="profile-password-field">
                        <span className="profile-field-label">{field.label}</span>
                        <div className="profile-password-input-wrap">
                          <input
                            type={showPassword[field.key] ? "text" : "password"}
                            value={password[field.key]}
                            onChange={(e) => setPassword((prev) => ({ ...prev, [field.key]: e.target.value }))}
                            className="profile-input"
                            placeholder={field.label}
                          />
                          <button
                            type="button"
                            className="profile-password-toggle"
                            onClick={() => setShowPassword((prev) => ({ ...prev, [field.key]: !prev[field.key] }))}
                          >
                            {showPassword[field.key] ? "Hide" : "Show"}
                          </button>
                        </div>
                      </label>
                    ))}
                  </div>

                  <div className="profile-password-strength">
                    <div className="profile-password-strength-bar">
                      <div
                        className={`profile-password-strength-fill profile-password-strength-${passwordStrength.tone}`}
                        style={{ width: `${passwordStrength.score * 25}%` }}
                      />
                    </div>
                    <span className="profile-password-strength-label">{passwordStrength.label}</span>
                  </div>

                  {passwordMismatch && <p className="profile-message profile-message-error">Password does not match.</p>}
                  {passwordError && <p className="profile-message profile-message-error">{passwordError}</p>}
                  {passwordSuccess && <p className="profile-message profile-message-success">{passwordSuccess}</p>}

                  <button type="button" className="profile-filled-btn profile-password-submit" onClick={updatePassword}>
                    Update Password
                  </button>
                </div>
              </section>
            )}

            {activeTab === "activity" && (
              <section className="profile-panel">
                <header className="profile-panel-header">
                  <div>
                    <p className="profile-panel-kicker">{roleMeta.activityTitle}</p>
                    <h3>Workspace summary</h3>
                  </div>
                </header>
                <div className="profile-panel-body profile-activity-layout">
                  <article className="profile-activity-card">
                    <h4>{roleMeta.activityTitle}</h4>
                    <p>{roleMeta.activityBody}</p>
                  </article>
                  <article className="profile-activity-card">
                    <h4>Quick Facts</h4>
                    <ul className="profile-activity-list">
                      <li>Email: {profileData.email || "Not specified"}</li>
                      <li>Mobile: {profileData.mobile_number || "Not specified"}</li>
                      <li>Designation: {displayRole}</li>
                      <li>Date of Joining: {formatDateDisplay(profileData.date_of_joining)}</li>
                    </ul>
                  </article>
                  <article className="profile-activity-card profile-activity-card-highlight">
                    <h4>Open Workspace</h4>
                    <p>
                      Continue to your {normalizeRole(profileData.role) === "PRINCIPAL" ? "dashboard" : "appraisal workspace"} to manage submissions and workflows.
                    </p>
                    <button
                      type="button"
                      className="profile-filled-btn"
                      onClick={() => navigate(normalizeRole(profileData.role) === "PRINCIPAL" ? roleMeta.dashboardPath : roleMeta.appraisalPath)}
                    >
                      {normalizeRole(profileData.role) === "PRINCIPAL" ? "Open Dashboard" : "Open Appraisal"}
                    </button>
                  </article>
                </div>
              </section>
            )}

            <section className="profile-panel">
              <header className="profile-panel-header">
                <div>
                  <p className="profile-panel-kicker">Session</p>
                  <h3>Manage your current session</h3>
                </div>
              </header>
              <div className="profile-panel-body">
                <div className="profile-session-card">
                  <div>
                    <h4>Sign Out</h4>
                    <p>End your current session and return to the login page.</p>
                  </div>
                  <button type="button" className="profile-danger-btn" onClick={() => setShowLogout(true)}>
                    Log Out
                  </button>
                </div>
              </div>
            </section>
          </div>
        </section>
      </main>

      {showImageEditor && (
        <div className="profile-modal">
          <div className="profile-modal-card">
            <h3>Edit Photo</h3>
            <div className="profile-image-preview">
              <img src={tempImage} alt="Preview" className="profile-preview-image" draggable="false" />
              <div
                className="profile-crop-overlay"
                style={{ left: cropArea.x, top: cropArea.y, width: cropArea.size, height: cropArea.size, cursor: isDragging ? "grabbing" : "grab" }}
                onMouseDown={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                  setDragStart({ x: e.clientX - cropArea.x, y: e.clientY - cropArea.y });
                }}
              >
                <div className="profile-crop-border" />
                <div
                  className="profile-crop-resize"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsResizing(true);
                    setDragStart({ x: e.clientX, y: e.clientY, size: cropArea.size });
                  }}
                />
              </div>
            </div>
            <p className="profile-modal-hint">Drag to reposition. Drag the corner to resize the crop area.</p>
            <div className="profile-modal-actions">
              <button type="button" className="profile-muted-btn" onClick={() => { setTempImage(null); setShowImageEditor(false); }}>Cancel</button>
              <button type="button" className="profile-filled-btn" onClick={saveImage}>Save Photo</button>
            </div>
          </div>
        </div>
      )}

      {showLogout && (
        <div className="profile-modal">
          <div className="profile-logout-card">
            <h3>Log out?</h3>
            <p>Are you sure you want to end your current session?</p>
            <div className="profile-modal-actions">
              <button type="button" className="profile-muted-btn" onClick={() => setShowLogout(false)}>Cancel</button>
              <button type="button" className="profile-danger-btn" onClick={() => clearAuthAndRedirect()}>Log Out</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
