import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/CreateAccount.css";
import API from "../api";
export default function CreateAccount() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: "",
    designation: "", // Teaching Staff / HOD / Principal / Admin
    joiningDate: "",
    department: "",
    address: "",
    email: "",
    mobile: "",
    gradePay: "",
    promotionDesignation: "",
    eligibilityDate: "",
    assessmentPeriod: "",
    password: "",
    confirmPassword: "",
  });

  const [error, setError] = useState("");
  const [passwordMismatch, setPasswordMismatch] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    const updated = { ...form, [name]: value };
    setForm(updated);

    if (name === "password" || name === "confirmPassword") {
      setPasswordMismatch(
        updated.confirmPassword &&
        updated.password !== updated.confirmPassword
      );
    }

    setError("");
  };

  const handleSubmit = async (e) => {
  e.preventDefault();
  setError("");

  if (form.password !== form.confirmPassword) {
    setPasswordMismatch(true);
    return;
  }

  // ✅ BACKEND-EXPECTED ROLE VALUES
  const role =
    form.designation === "HOD"
      ? "HOD"
      : form.designation === "Principal"
      ? "PRINCIPAL"
      : form.designation === "Teaching Staff"
      ? "FACULTY"
      : form.designation === "Admin"
      ? "ADMIN"
      : "FACULTY"; // default to FACULTY

  // ✅ PAYLOAD MATCHES RegisterSerializer EXACTLY
  const payload = {
    email: form.email,                  // ✅ email (NOT username)
    password: form.password,
    role: role,                         // ✅ REQUIRED
    full_name: form.name,               // ✅ REQUIRED
    mobile: form.mobile,                // ✅ REQUIRED
    date_of_joining: form.joiningDate,   // ✅ REQUIRED),
    address: form.address,
  };

  // 🔒 department rules enforced by backend
  if (form.department && role !== "PRINCIPAL") {
  payload.department = form.department;
  }

  if (form.designation) {
    payload.designation = form.designation;
  }

  if (form.address) {
    payload.address = form.address;
  }

  if (form.gradePay) {
    payload.gradePay = form.gradePay;
  }

  if (form.promotionDesignation) {
    payload.promotion_designation = form.promotionDesignation;
  }

  if (form.eligibilityDate) {
    payload.eligibility_date = form.eligibilityDate;
  }

  if (form.assessmentPeriod) {
    payload.assessment_period = form.assessmentPeriod;
  }


  try {
    await API.post("register/", payload);
    navigate("/login");
  } catch (err) {
      const data = err.response?.data;
      console.error("REGISTER ERROR:", data);

      if (data && typeof data === "object") {
        const firstKey = Object.keys(data)[0];
        const message = Array.isArray(data[firstKey])
          ? data[firstKey][0]
          : data[firstKey];

        setError(message);
      } else {
        setError("Account creation failed.");
      }
    }

};


  return (
    <div className="signup-container">
      <div className="signup-card">

        {/* HEADER */}
        <div className="header-section">
          <h1 className="app-title">Create Account</h1>
          <p className="app-subtitle">
            Join our academic platform today
          </p>
        </div>

        {error && <div className="error-message">{error}</div>}

        {/* FORM */}
        <form className="signup-form" onSubmit={handleSubmit}>
          <div className="form-grid">

            <div className="form-group">
              <label>Name *</label>
              <input name="name" onChange={handleChange} />
            </div>

            <div className="form-group">
              <label>Designation *</label>
              <select name="designation" onChange={handleChange}>
                <option value="">-- Choose your designation --</option>

                {/* These values are mapped to roles internally */}
                <option>Teaching Staff</option> {/* → faculty */}
                <option>HOD</option>             {/* → hod */}
                <option>Principal</option>       {/* → principal */}
                <option>Admin</option>           {/* → admin */}
              </select>
            </div>

            <div className="form-group">
              <label>Date of Joining *</label>
              <input type="date" name="joiningDate" onChange={handleChange} />
            </div>

            <div className="form-group">
              <label>Department / Centre *</label>
              <input name="department" onChange={handleChange} />
            </div>

            <div className="form-group full-width">
              <label>Communication Address *</label>
              <textarea name="address" onChange={handleChange} />
            </div>

            <div className="form-group">
              <label>Email *</label>
              <input type="email" name="email" onChange={handleChange} />
            </div>

            <div className="form-group">
              <label>Mobile Number *</label>
              <input name="mobile" onChange={handleChange} />
            </div>

            <div className="form-group">
              <label>Current Designation & Grade Pay</label>
              <input name="gradePay" onChange={handleChange} />
            </div>

            <div className="form-group">
              <label>Designation of Promotion</label>
              <input name="promotionDesignation" onChange={handleChange} />
            </div>

            <div className="form-group">
              <label>Eligibility Date</label>
              <input type="date" name="eligibilityDate" onChange={handleChange} />
            </div>

            <div className="form-group">
              <label>Assessment Period</label>
              <input
                name="assessmentPeriod"
                type="date"
                placeholder="e.g. 2023–2024"
                onChange={handleChange}
              />
            </div>

            <div className="form-group">
              <label>Password *</label>
              <input type="password" name="password" onChange={handleChange} />
            </div>

            <div className="form-group">
              <label>Confirm Password *</label>
              <input
                type="password"
                name="confirmPassword"
                onChange={handleChange}
                className={passwordMismatch ? "input-error" : ""}
              />
              {passwordMismatch && (
                <span className="field-error">Passwords do not match</span>
              )}
            </div>

          </div>

          {/* ACTIONS */}
          <div className="form-actions">
            <button className="btn btn-primary">Create Account</button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => navigate("/login")}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
