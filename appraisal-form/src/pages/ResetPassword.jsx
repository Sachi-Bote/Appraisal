import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import API from "../api";
import "../styles/resetPassword.css";

const normalizeDetail = (detail) => {
  if (Array.isArray(detail)) {
    return detail.join(" ");
  }
  return detail || "Unable to reset password.";
};

export default function ResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const email = searchParams.get("email") || "";

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const hasValidParams = Boolean(email);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");
    setError("");

    if (!hasValidParams) {
      setError("Email is missing. Start again from Forgot Password.");
      return;
    }

    if (!newPassword || !confirmPassword) {
      setError("Please fill in all fields.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await API.post("auth/reset-password/", {
        email,
        new_password: newPassword,
      });

      setMessage(response?.data?.detail || "Password reset successful.");
      setTimeout(() => {
        navigate("/login");
      }, 1500);
    } catch (err) {
      const detail = err?.response?.data?.detail;
      setError(normalizeDetail(detail));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="rp-page">
      <div className="rp-header">
        <div className="rp-icon">AC</div>
        <h1>Wadia College of Engineering</h1>
        <p>Faculty Appraisal System</p>
      </div>

      <div className="rp-card">
        <h2>Reset Password</h2>
        <p className="rp-subtitle">Enter your new password below.</p>

        {!hasValidParams && (
          <p className="rp-message" style={{ color: "#b91c1c" }}>
            Invalid request. Please use Forgot Password again.
          </p>
        )}

        <form onSubmit={handleSubmit}>
          <label>Email</label>
          <input type="text" value={email} disabled />

          <label>New Password</label>
          <input
            type="password"
            placeholder="Enter new password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            disabled={!hasValidParams}
          />

          <label>Confirm Password</label>
          <input
            type="password"
            placeholder="Confirm new password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            disabled={!hasValidParams}
          />

          {error && <p className="rp-message" style={{ color: "#b91c1c" }}>{error}</p>}
          {message && <p className="rp-message">{message}</p>}

          <button type="submit" className="rp-btn" disabled={isSubmitting || !hasValidParams}>
            {isSubmitting ? "Resetting..." : "Reset Password"}
          </button>
        </form>

        <div className="rp-back">
          <span onClick={() => navigate("/login")}>Back to Login</span>
        </div>
      </div>
    </div>
  );
}
