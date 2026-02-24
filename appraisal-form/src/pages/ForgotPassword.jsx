import { useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../api";
import "../styles/forgotPassword.css";

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");
    setError("");

    if (!email.trim()) {
      setError("Please enter your registered email.");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await API.post(
        "auth/forgot-password/",
        { email: email.trim() },
        { timeout: 15000 }
      );

      if (response?.data?.email_exists) {
        navigate(`/reset-password?email=${encodeURIComponent(email.trim())}`);
        return;
      }

      setError(response?.data?.detail || "No active account found for this email.");
    } catch (err) {
      const detail = err?.response?.data?.detail;
      const timeoutHit = err?.code === "ECONNABORTED";
      setError(
        timeoutHit
          ? "Request timed out. Please try again."
          : Array.isArray(detail)
            ? detail.join(" ")
            : detail || "Failed to process request."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fp-page">
      <div className="fp-header">
        <div className="fp-icon">AC</div>
        <h1>Wadia College of Engineering</h1>
        <p>Faculty Appraisal System</p>
      </div>

      <div className="fp-card">
        <h2>Forgot Password</h2>
        <p className="fp-subtitle">Enter your registered email to continue resetting password.</p>

        <form onSubmit={handleSubmit}>
          <label>Email</label>
          <input
            type="email"
            placeholder="your.email@college.edu"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          {error && <p className="fp-message" style={{ color: "#b91c1c" }}>{error}</p>}
          {message && <p className="fp-message">{message}</p>}

          <button type="submit" className="fp-btn" disabled={isSubmitting}>
            {isSubmitting ? "Checking..." : "Continue"}
          </button>
        </form>

        <div className="fp-back">
          <span onClick={() => navigate("/login")}>Back to Login</span>
        </div>
      </div>
    </div>
  );
}
