import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import "../../styles/profile.css";
import API from "../../api";
import useSessionState from "../../hooks/useSessionState";

const DEFAULT_AVATAR = "https://i.pravatar.cc/300?img=12";
const withCacheBust = (url) => (url && url !== DEFAULT_AVATAR ? `${url}${url.includes("?") ? "&" : "?"}v=${Date.now()}` : (url || DEFAULT_AVATAR));
const formatDateDisplay = (value) => {
  const text = String(value || "").trim();
  if (!text) return "";
  const isoMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return `${isoMatch[3]}-${isoMatch[2]}-${isoMatch[1]}`;
  return text;
};
const toISODate = (value) => {
  const text = String(value || "").trim();
  if (!text) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const match = text.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (match) return `${match[3]}-${match[2]}-${match[1]}`;
  return text;
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

export default function Profile() {
  const navigate = useNavigate();
  const location = useLocation();

  const tabFromQuery =
    new URLSearchParams(location.search).get("tab") === "password"
      ? "password"
      : "account";
  const [activeTab, setActiveTab] = useSessionState(
    "profile.activeTab",
    tabFromQuery
  );
  const [isEditing, setIsEditing] = useState(false);
  const [showLogout, setShowLogout] = useState(false);

  /* ================= PROFILE DATA ================= */

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
  const hiddenAccountFields = new Set(["must_change_password", "date_joined"]);
  const readOnlyAccountFields = new Set([
    "id",
    "username",
    "role",
    "department",
    "must_change_password",
    "date_joined",
  ]);

  const formatAccountLabel = (key) =>
    key
      .replace(/_/g, " ")
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .replace(/\b\w/g, (ch) => ch.toUpperCase());

 useEffect(() => {
  API.get("me/")
    .then(res => {
      const { profile_image, ...profileFields } = res.data || {};
      const normalizedFields = normalizeProfileFields(profileFields);
      setProfileData(normalizedFields);
      setEditData(normalizedFields);
      const imageUrl = withCacheBust(profile_image || DEFAULT_AVATAR);
      setProfileImage(imageUrl);
      setSavedProfileImage(imageUrl);
      setProfileImageFile(null);
      setProfileImageRemoved(false);
    })
    .catch(() => navigate("/login"));
}, []);

  /* ================= PROFILE IMAGE ================= */

  const [profileImage, setProfileImage] = useState(DEFAULT_AVATAR);
  const [savedProfileImage, setSavedProfileImage] = useState(DEFAULT_AVATAR);
  const [profileImageFile, setProfileImageFile] = useState(null);
  const [profileImageRemoved, setProfileImageRemoved] = useState(false);

  // 🔹 Image editor states
  const [tempImage, setTempImage] = useState(null);
  const [showImageEditor, setShowImageEditor] = useState(false);
  const [cropArea, setCropArea] = useState({ x: 50, y: 50, size: 200 });
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Step 1: Select image → open preview editor
  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setTempImage(reader.result);
      setCropArea({ x: 50, y: 50, size: 200 });
      setShowImageEditor(true);
    };
    reader.readAsDataURL(file);
  };

  // Mouse handlers for dragging crop area
  const handleCropMouseDown = (e) => {
    e.preventDefault();
    setIsDragging(true);
    setDragStart({ x: e.clientX - cropArea.x, y: e.clientY - cropArea.y });
  };

  const handleResizeMouseDown = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    setDragStart({ x: e.clientX, y: e.clientY, size: cropArea.size });
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (isDragging) {
        const container = document.querySelector('.image-preview-container');
        if (!container) return;
        
        const rect = container.getBoundingClientRect();
        let newX = e.clientX - dragStart.x;
        let newY = e.clientY - dragStart.y;

        // Constrain within container
        newX = Math.max(0, Math.min(newX, rect.width - cropArea.size));
        newY = Math.max(0, Math.min(newY, rect.height - cropArea.size));

        setCropArea(prev => ({ ...prev, x: newX, y: newY }));
      }

      if (isResizing) {
        const container = document.querySelector('.image-preview-container');
        if (!container) return;
        
        const rect = container.getBoundingClientRect();
        const deltaX = e.clientX - dragStart.x;
        const deltaY = e.clientY - dragStart.y;
        const delta = Math.max(deltaX, deltaY);
        
        let newSize = dragStart.size + delta;
        newSize = Math.max(100, Math.min(newSize, rect.width - cropArea.x, rect.height - cropArea.y));

        setCropArea(prev => ({ ...prev, size: newSize }));
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setIsResizing(false);
    };

    if (isDragging || isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, isResizing, dragStart, cropArea]);

  // Step 2: Save cropped image
  const saveImage = () => {
    const canvas = document.createElement("canvas");
    canvas.width = 300;
    canvas.height = 300;
    const ctx = canvas.getContext("2d");

    const img = new Image();
    img.src = tempImage;
    img.onload = () => {
      const container = document.querySelector('.image-preview-container');
      const rect = container.getBoundingClientRect();
      
      // Calculate actual image coordinates based on displayed size
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
          const file = new File([blob], `profile-${Date.now()}.jpg`, { type: "image/jpeg" });
          setProfileImageFile(file);
          setProfileImageRemoved(false);
        }
        setTempImage(null);
        setShowImageEditor(false);
      }, "image/jpeg", 0.9);
    };
  };

  const cancelImageEdit = () => {
    setTempImage(null);
    setShowImageEditor(false);
  };

  const deleteImage = () => {
    setProfileImage(DEFAULT_AVATAR);
    setProfileImageFile(null);
    setProfileImageRemoved(true);
  };

  /* ================= PROFILE EDIT ================= */

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
      formData.append("full_name", editData.full_name || "");
      formData.append("mobile_number", editData.mobile_number || "");
      formData.append("email", editData.email || "");
      formData.append("designation", editData.designation || "");
      formData.append("address", editData.address || "");
      formData.append("gradePay", editData.gradePay || "");
      formData.append("promotion_designation", editData.promotion_designation || "");
      formData.append("eligibility_date", editData.eligibility_date || "");
      formData.append("assessment_period", editData.assessment_period || "");
      formData.append("date_of_joining", editData.date_of_joining || "");
      if (profileImageFile) {
        formData.append("profile_image", profileImageFile);
      }
      if (profileImageRemoved) {
        formData.append("remove_profile_image", "true");
      }
      await API.patch("me/", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

    // 🔁 re-fetch updated data
      const res = await API.get("me/");
      const { profile_image, ...profileFields } = res.data || {};
      const normalizedFields = normalizeProfileFields(profileFields);
      setProfileData(normalizedFields);
      setEditData(normalizedFields);
      const imageUrl = withCacheBust(profile_image || DEFAULT_AVATAR);
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


  const handleProfileChange = (e) => {
    setEditData({ ...editData, [e.target.name]: e.target.value });
  };

  /* ================= PASSWORD ================= */

  const [password, setPassword] = useState({
    current: "",
    newPass: "",
    confirm: "",
  });
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");

  const passwordMismatch =
    password.newPass &&
    password.confirm &&
    password.newPass !== password.confirm;

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
      const res = await API.get("me/");
      const { profile_image, ...profileFields } = res.data || {};
      const normalizedFields = normalizeProfileFields(profileFields);
      setProfileData(normalizedFields);
      setEditData(normalizedFields);
      if (profile_image) {
        const imageUrl = withCacheBust(profile_image);
        setProfileImage(imageUrl);
        setSavedProfileImage(imageUrl);
      }
      setPasswordSuccess("Password updated successfully.");
    } catch (err) {
      setPasswordError(err?.response?.data?.detail || "Failed to update password.");
    }
  };

  return (
    <div className="dashboard">
      {/* ================= SIDEBAR ================= */}
      <div className="sidebar">
        <img
          src={profileImage}
          className="avatar"
          alt="Profile"
          style={{ objectFit: "cover" }}
        />

        {isEditing && (
          <div className="photo-actions">
            <label className="photo-btn">
              Change Photo
              <input type="file" accept="image/*" onChange={handleImageSelect} />
            </label>
            <button className="delete-btn" onClick={deleteImage}>
              Delete Photo
            </button>
          </div>
        )}

        {/* Back to dashboard */}
        <button
          className="sidebar-button"
          onClick={() => {
            if (String(profileData.role || "").toUpperCase() === "HOD") navigate("/hod/dashboard");
            else if (String(profileData.role || "").toUpperCase() === "PRINCIPAL")
              navigate("/principal/dashboard");
            else if (String(profileData.role || "").toUpperCase() === "ADMIN")
              navigate("/admin/dashboard");
            else navigate("/faculty/dashboard");
          }}
        >
          ← Back to Dashboard
        </button>

        <button
          className={`sidebar-button ${
            activeTab === "account" ? "active" : ""
          }`}
          onClick={() => setActiveTab("account")}
        >
          Account Details
        </button>

        <button
          className={`sidebar-button ${
            activeTab === "password" ? "active" : ""
          }`}
          onClick={() => setActiveTab("password")}
        >
          Change Password
        </button>

        <button className="sidebar-button" onClick={() => setShowLogout(true)}>
          Log Out
        </button>
      </div>

      {/* ================= CONTENT ================= */}
      <div className="content">
        {activeTab === "account" && (
          <>
            <div className="header">
              <h1 className="header-title">Account Details</h1>
              {!isEditing ? (
                <button className="edit-btn" onClick={startEdit}>
                  Edit Profile
                </button>
              ) : (
                <div className="header-actions">
                  <button className="save-btn" onClick={saveProfile}>
                    Save
                  </button>
                  <button className="cancel-header-btn" onClick={cancelEdit}>
                    Cancel
                  </button>
                </div>
              )}
            </div>

            <div className="form">
              {Object.entries(editData)
                .filter(([k]) => !hiddenAccountFields.has(k))
                .map(([k, v]) => (
                <div key={k} className="form-field">
                  <label className="label">
                      {formatAccountLabel(k)}
                  </label>

                  <input
                    name={k}
                    type={isEditing && ["date_of_joining", "eligibility_date", "assessment_period"].includes(k) ? "date" : "text"}
                    value={
                      !isEditing && ["date_of_joining", "eligibility_date", "assessment_period"].includes(k)
                        ? formatDateDisplay(v)
                        : v
                    }
                    onChange={handleProfileChange}
                    disabled={
                      !isEditing || readOnlyAccountFields.has(k)
                    }
                    className={`input ${
                      !isEditing || readOnlyAccountFields.has(k)
                        ? "disabled"
                        : ""
                    }`}
                  />
                </div>
              ))}
            </div>
          </>
        )}

        {activeTab === "password" && (
          <div className="password-box">
            <h1 className="password-title">Change Password</h1>

            <input
              type="password"
              placeholder="Current Password"
              className="password-input"
              value={password.current}
              onChange={(e) =>
                setPassword({ ...password, current: e.target.value })
              }
            />

            <input
              type="password"
              placeholder="New Password"
              className="password-input"
              value={password.newPass}
              onChange={(e) =>
                setPassword({ ...password, newPass: e.target.value })
              }
            />

            <input
              type="password"
              placeholder="Confirm Password"
              className="password-input"
              value={password.confirm}
              onChange={(e) =>
                setPassword({ ...password, confirm: e.target.value })
              }
            />

            {passwordMismatch && (
              <p className="error">Password does not match</p>
            )}
            {passwordError && <p className="error">{passwordError}</p>}
            {passwordSuccess && <p className="success">{passwordSuccess}</p>}

            <button className="update-btn" onClick={updatePassword}>
              Update Password
            </button>
          </div>
        )}
      </div>

      {/* ================= IMAGE EDITOR MODAL ================= */}
      {showImageEditor && (
        <div className="modal">
          <div className="crop-box">
            <h2 className="crop-title">Edit Photo</h2>

            <div className="image-preview-container">
              <img
                src={tempImage}
                alt="Preview"
                className="preview-image"
                draggable="false"
              />

              {/* Crop overlay */}
              <div
                className="crop-overlay"
                style={{
                  left: cropArea.x,
                  top: cropArea.y,
                  width: cropArea.size,
                  height: cropArea.size,
                  cursor: isDragging ? 'grabbing' : 'grab'
                }}
                onMouseDown={handleCropMouseDown}
              >
                <div className="crop-border"></div>

                {/* Resize handle */}
                <div
                  className="resize-handle"
                  onMouseDown={handleResizeMouseDown}
                ></div>
              </div>
            </div>

            <div className="editor-hint">
              Drag to move • Drag corner to resize
            </div>

            <div className="modal-actions">
              <button className="crop-save-btn" onClick={saveImage}>
                Save Photo
              </button>
              <button className="modal-cancel-btn" onClick={cancelImageEdit}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= LOGOUT MODAL ================= */}
      {showLogout && (
        <div className="modal">
          <div className="logout-box">
            <h2>Log out?</h2>
            <p>Are you sure you want to log out?</p>

            <div className="modal-actions">
              <button
                className="logout-yes-btn"
                onClick={() => {
                  localStorage.removeItem("loggedInUser");
                  localStorage.removeItem("userProfile");
                  navigate("/login");
                }}
              >
                Log Out
              </button>

              <button
                className="modal-cancel-btn"
                onClick={() => setShowLogout(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

