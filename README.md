# 🎓 Faculty Performance Appraisal System

A full-stack web application designed to digitize and streamline the faculty appraisal process within academic institutions.

The system replaces manual paperwork with a structured, role-based workflow that ensures transparency, accountability, and efficient evaluation tracking.

---

## 📌 Key Objectives

- Allow faculty members to submit structured self-appraisal forms
- Enable HoD-level review and evaluation
- Support Principal-level final approval
- Generate downloadable PDF reports
- Maintain controlled state-based workflow transitions

---

# 🔄 System Workflow

### 🟢 Step 1 – Faculty
- Fill appraisal form (Part A & Part B)
- Save as Draft
- Submit for HoD review
- Track status and remarks

### 🟡 Step 2 – HoD
- View pending submissions
- Review faculty details
- Add remarks
- Approve or send back for correction

### 🔵 Step 3 – Principal
- View HoD-approved submissions
- Perform final review
- Approve and finalize

### 🟣 Step 4 – Finalized
- Lock submission
- Enable PDF generation
- Mark appraisal process as completed

---

# ✨ Features

## 👨‍🏫 Faculty Dashboard
- Create & edit appraisal forms
- Draft & submit functionality
- Status tracking
- View HoD/Principal remarks
- Download PDF report

## 👨‍💼 HoD Dashboard
- Pending submissions tab
- Processed submissions tab
- Add evaluation remarks
- Approve / Reject workflow control

## 👩‍💼 Principal Dashboard
- View HoD-approved forms
- Final review & approval
- Access finalized submissions

---

## 📄 PDF Generation
- Structured A4 layout
- Proper table alignment
- Printable & downloadable format
- Locked after final approval

---

## 🔐 Authentication & Authorization
- JWT-based authentication
- Role-based access control
- Protected API routes
- Secure token refresh mechanism

---

# 🛠 Tech Stack

## 🔹 Frontend
- React.js
- React Router
- Axios
- CSS

## 🔹 Backend
- Django
- Django REST Framework
- JWT Authentication

## 🔹 Database
- PostgreSQL (Production)

## 🔹 Deployment
- Frontend & Backend: Render

---



