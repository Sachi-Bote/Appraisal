
import React from "react";
import { formatKeyLabel } from "../utils/textFormatters";

/**
 * A reusable component to display appraisal form data in a read-only format.
 * Can handle both the "Draft" state (direct props) and "Submitted" state (nested in appraisal_data).
 */
export default function AppraisalSummary({ data }) {
    if (!data) return <p>No data available.</p>;

    // Helper to safely access nested properties
    // The structure depends on whether we are viewing a draft (flat props often) OR a submitted JSON (nested)
    // We'll normalize it here.

    const general = data.general || data.generalInfo || {};
    const teaching = data.teaching || (data.teachingActivities ? { courses: data.teachingActivities } : { courses: [] });

    // Research is tricky. In Form it's "research.papers", in Backend it might be "research.entries" list
    // If it's the raw form state (Step 5 Preview), 'research' has keys like 'papers', 'projects', etc.
    // If it's backend JSON, 'research' has 'entries'.
    // We will try to display what is available.

    const research = data.research || {};

    // PBAS / Activities
    const deptActivities = data.departmentalActivities || (data.pbas ? data.pbas.departmental_activities : []) || [];
    const instActivities = data.instituteActivities || (data.pbas ? data.pbas.institute_activities : []) || [];
    const socActivities = data.societyActivities || (data.pbas ? data.pbas.society_activities : []) || [];
    const feedback = data.studentFeedback || (data.pbas ? data.pbas.student_feedback : []) || [];

    const renderCourseName = (row) => {
        const name = row.courseName || row.course_name || "";
        const code = row.courseCode || row.course_code || "";
        return code ? `${name} (${code})` : name || "-";
    };

    return (
        <div className="appraisal-summary">
            <style>{`
        .appraisal-summary h4 { margin-top: 1.5rem; border-bottom: 2px solid #eee; padding-bottom: 0.5rem; color: #333; }
        .appraisal-summary h5 { margin-top: 1rem; color: #555; }
        .summary-table { width: 100%; border-collapse: collapse; margin-top: 0.5rem; font-size: 0.9rem; }
        .summary-table th, .summary-table td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        .summary-table th { background-color: #f9fafb; font-weight: 600; }
        .info-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem; margin-top: 0.5rem; }
        .info-item label { font-weight: 600; display: block; color: #666; font-size: 0.8rem; }
        .info-item span { color: #111; }
      `}</style>

            <h3>Appraisal Summary</h3>

            {/* 1. GENERAL INFO */}
            <h4>General Information</h4>
            <div className="info-grid">
                <div className="info-item"><label>Name</label><span>{general.facultyName || general.faculty_name}</span></div>
                <div className="info-item"><label>Designation</label><span>{general.designation}</span></div>
                <div className="info-item"><label>Department</label><span>{general.department}</span></div>
                <div className="info-item"><label>Academic Year</label><span>{general.academicYear || general.academic_year}</span></div>
            </div>

            {/* 2. TEACHING */}
            <h4>Teaching Activities</h4>
            {teaching.courses && teaching.courses.length > 0 ? (
                <table className="summary-table">
                    <thead>
                        <tr>
                            <th>Semester</th>
                            <th>Course</th>
                            <th>Scheduled Classes</th>
                            <th>Held Classes</th>
                        </tr>
                    </thead>
                    <tbody>
                        {teaching.courses.map((t, i) => (
                            <tr key={i}>
                                <td>{t.semester}</td>
                                <td>{renderCourseName(t)}</td>
                                <td>{t.totalClassesAssigned || t.total_classes_assigned || t.scheduled_classes || "-"}</td>
                                <td>{t.classesConducted || t.held_classes || "-"}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            ) : <p>No teaching data.</p>}

            {/* 3. ACTIVITIES */}
            <h4>Activities & Contributions</h4>

            <h5>Departmental Activities</h5>
            {deptActivities.length > 0 ? (
                <table className="summary-table">
                    <thead><tr><th>Activity</th><th>Credit</th><th>Sem</th></tr></thead>
                    <tbody>
                        {deptActivities.map((row, i) => (
                            <tr key={i}>
                                <td>{row.activity}</td>
                                <td>{row.credit || row.credits_claimed}</td>
                                <td>{row.semester}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            ) : <p className="text-sm text-gray-500">None</p>}

            <h5>Institute Activities</h5>
            {instActivities.length > 0 ? (
                <table className="summary-table">
                    <thead><tr><th>Activity</th><th>Credit</th><th>Sem</th></tr></thead>
                    <tbody>
                        {instActivities.map((row, i) => (
                            <tr key={i}>
                                <td>{row.activity}</td>
                                <td>{row.credit || row.credits_claimed}</td>
                                <td>{row.semester}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            ) : <p className="text-sm text-gray-500">None</p>}

            <h5>Society Activities</h5>
            {socActivities.length > 0 ? (
                <table className="summary-table">
                    <thead><tr><th>Activity</th><th>Credit</th><th>Sem</th></tr></thead>
                    <tbody>
                        {socActivities.map((row, i) => (
                            <tr key={i}>
                                <td>{row.activity}</td>
                                <td>{row.credit || row.credits_claimed}</td>
                                <td>{row.semester}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            ) : <p className="text-sm text-gray-500">None</p>}

            {/* STUDENT FEEDBACK */}
            <h4>Student Feedback</h4>
            {feedback.length > 0 ? (
                <table className="summary-table">
                    <thead><tr><th>Course</th><th>Feedback Score</th></tr></thead>
                    <tbody>
                        {feedback.map((f, i) => (
                            <tr key={i}>
                                <td>{renderCourseName(f)}</td>
                                <td>{f.averageScore || f.feedback_score}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            ) : <p className="text-sm text-gray-500">None</p>}


            {/* 4. RESEARCH (Handling draft state vs submitted state nuances loosely) */}
            <h4>Research Summary</h4>

            {/* Papers */}
            {(research.papers || []).length > 0 && (
                <>
                    <h5>Research Papers</h5>
                    <table className="summary-table">
                        <thead><tr><th>Title</th><th>Journal</th><th>Year</th></tr></thead>
                        <tbody>
                            {research.papers.map((p, i) => (
                                <tr key={i}>
                                    <td>{p.title}</td>
                                    <td>{p.journal}</td>
                                    <td>{p.year}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </>
            )}

            {/* If it's submitted data, research might be in 'entries' list or specialized counts. 
          For simplicty, identifying 'entries' usually requires mapping types. 
          If 'research.entries' exists (backend payload), we show that.
      */}
            {research.entries && research.entries.length > 0 && (
                <>
                    <h5>Research Entries</h5>
                    <table className="summary-table">
                        <thead><tr><th>Category</th><th>Title / Details</th><th>Year</th></tr></thead>
                        <tbody>
                            {research.entries.map((e, i) => (
                                <tr key={i}>
                                    <td>{formatKeyLabel(e.type)}</td>
                                    <td>{e.title || "Count: " + e.count}</td>
                                    <td>{e.year}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </>
            )}

            {/* Projects */}
            {(research.projects || []).length > 0 && (
                <>
                    <h5>Projects</h5>
                    <table className="summary-table">
                        <thead><tr><th>Role</th><th>Status</th><th>Amount Slab</th></tr></thead>
                        <tbody>
                            {research.projects.map((p, i) => (
                                <tr key={i}>
                                    <td>{p.role}</td>
                                    <td>{p.status}</td>
                                    <td>{p.amountSlab}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </>
            )}

        </div>
    );
}
