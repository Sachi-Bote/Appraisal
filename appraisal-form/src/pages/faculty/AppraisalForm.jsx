import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import API from "../../api";
import "../../styles/AppraisalForm.css";

const getCurrentAcademicYear = () => {
  const now = new Date();
  const year = now.getFullYear();
  // Academic year starts in June.
  const startYear = now.getMonth() >= 5 ? year : year - 1;
  return `${startYear}-${String(startYear + 1).slice(-2)}`;
};

const buildAcademicYearOptions = (currentAcademicYear) => {
  const startYear = Number(String(currentAcademicYear).split("-")[0]);
  if (!Number.isFinite(startYear)) return [currentAcademicYear];
  return [
    `${startYear - 1}-${String(startYear).slice(-2)}`,
    currentAcademicYear,
    `${startYear + 1}-${String(startYear + 2).slice(-2)}`,
  ];
};

const DEFAULT_SPPU_ACTIVITY_SECTIONS = [
  {
    section_key: "a_administrative",
    label: "Administrative responsibilities (HOD / Dean / Coordinator etc.)",
    activities_with_scope: [
      { label: "Lab In charge", scope: "departmental" },
      { label: "Time table In charge", scope: "departmental" },
      { label: "Class Teacher", scope: "departmental" },
      { label: "Student registration In charge", scope: "departmental" },
      { label: "Student detention In charge", scope: "departmental" },
      { label: "Cleanliness in charge", scope: "departmental" },
      { label: "Departmental store/Purchase in-charge", scope: "departmental" },
      { label: "Student Feedback In charge", scope: "departmental" },
      { label: "Departmental Library in charge", scope: "departmental" },
      { label: "NBA coordinator", scope: "institute" },
      { label: "Internal/External Academic Monitoring Co-coordinator", scope: "institute" },
      { label: "In-charge Internship", scope: "institute" },
      { label: "Institute Web site Management", scope: "institute" },
      { label: "Institute level networking and maintenance", scope: "institute" },
      { label: "Building/Electrical Maintenance", scope: "institute" },
      { label: "EPBX Activity", scope: "institute" },
      { label: "Hardware and Software installation and maintenance", scope: "institute" },
      { label: "Institute MIS In charge", scope: "institute" },
      { label: "DTE MIS In charge", scope: "institute" },
      { label: "RO/RBTE/Administrative Activity/Duties", scope: "institute" },
      { label: "In-charge/Member of AICTE/State Govt./University Statutory Committee", scope: "institute" },
      { label: "NBA/NAAC coordinator", scope: "institute" },
      { label: "AICTE/University/DTE/AISHE/NIRF/ARIIA/RUSA/TEQIP/PCI/COA etc Activity in-charge", scope: "institute" },
      { label: "HoD/Dean/Associate Dean/Library In-charge", scope: "institute" },
      { label: "Rector/Warden/Canteen", scope: "institute" },
      { label: "Earn and Learn Scheme/Scholarship In-charge", scope: "institute" },
      { label: "Any other administrative activity", scope: "institute" },
    ],
  },
  {
    section_key: "b_exam_duties",
    label: "Examination & evaluation duties",
    activities_with_scope: [
      { label: "Practical/Exam Time table in charge", scope: "departmental" },
      { label: "Exam Activities/Duties", scope: "institute" },
      { label: "Internal/External Academic Monitoring Co-coordinator", scope: "institute" },
      { label: "Any other examination/evaluation duty", scope: "institute" },
    ],
  },
  {
    section_key: "c_student_related",
    label: "Student related co-curricular / extension activities",
    activities_with_scope: [
      { label: "Student Association/Chapter Co-coordinator", scope: "departmental" },
      { label: "Student Counseling", scope: "departmental" },
      { label: "Project Mentoring for project Competition", scope: "departmental" },
      { label: "Industrial visit In charge", scope: "departmental" },
      { label: "Final Year Student Project Guide", scope: "departmental" },
      { label: "Sports in charge and co-ordinator", scope: "institute" },
      { label: "PRO/Gymkhana/Gathering/Publicity/student club activity", scope: "institute" },
      { label: "Garden Maintenance/Tree Plantation", scope: "institute" },
      { label: "Blood donation activity organization", scope: "society" },
      { label: "Yoga Classes", scope: "society" },
      { label: "Medical Camp/Health Camp Organization", scope: "society" },
      { label: "Literacy Camp Organization", scope: "society" },
      { label: "Environmental awareness camp", scope: "society" },
      { label: "Swachh Bharat Mission/NCC/NSS activity", scope: "society" },
      { label: "Tree Plantation and Garden Maintenance", scope: "society" },
      { label: "Any other student-related activity", scope: "society" },
    ],
  },
  {
    section_key: "d_organizing_events",
    label: "Organizing seminars / workshops / conferences",
    activities_with_scope: [
      { label: "Guest Lecture Organization", scope: "institute" },
      { label: "Project/Seminar Coordinator", scope: "institute" },
      { label: "Initiative for CEP/STTP/Testing Consultancy", scope: "institute" },
      { label: "Organization of MOOCS/NPTEL/Spoken Tutorials/IUCEE webinars", scope: "institute" },
      { label: "Organization of FDP/Conference/Training/Workshop", scope: "institute" },
      { label: "Induction Program In charge", scope: "institute" },
      { label: "Any other event organization activity", scope: "institute" },
    ],
  },
  {
    section_key: "e_phd_guidance",
    label: "Guiding PhD students",
    activities_with_scope: [
      { label: "PhD Supervisor", scope: "departmental" },
      { label: "PhD Co-Supervisor", scope: "departmental" },
      { label: "PhD Progress Committee Member", scope: "departmental" },
      { label: "Any other PhD guidance activity", scope: "departmental" },
    ],
  },
  {
    section_key: "f_research_project",
    label: "Conducting minor / major research projects",
    activities_with_scope: [
      { label: "Consultancy (Research based)", scope: "institute" },
      { label: "Conducting minor research project", scope: "institute" },
      { label: "Conducting major research project", scope: "institute" },
      { label: "Any other research project activity", scope: "institute" },
    ],
  },
  {
    section_key: "g_sponsored_project",
    label: "Sponsored projects (national/international agencies)",
    activities_with_scope: [
      { label: "Sponsored project funded by national agency", scope: "institute" },
      { label: "Sponsored project funded by international agency", scope: "society" },
      { label: "Government Sponsored CSR Activities", scope: "society" },
      { label: "Any other sponsored project activity", scope: "society" },
    ],
  },
];

const normalizeActivitySections = (sections = []) =>
  (Array.isArray(sections) ? sections : [])
    .map((section) => {
      const list = Array.isArray(section?.activities_with_scope)
        ? section.activities_with_scope
        : Array.isArray(section?.activities)
          ? section.activities.map((label) => ({ label, scope: "institute" }))
          : [];
      const cleaned = list
        .map((item) => ({
          label: String(item?.label || "").trim(),
          scope: String(item?.scope || "").trim().toLowerCase(),
        }))
        .filter((item) => item.label);
      return {
        ...section,
        activities_with_scope: cleaned,
        activities: cleaned.map((item) => item.label),
      };
    })
    .filter((section) => section?.section_key);

const SECTION_TO_LEGACY = {
  a_administrative: "administrative_responsibility",
  b_exam_duties: "exam_duties",
  c_student_related: "student_related",
  d_organizing_events: "organizing_events",
  e_phd_guidance: "phd_guidance",
  f_research_project: "research_project",
  g_sponsored_project: "sponsored_project",
};


export default function FacultyAppraisalForm() {
  const CURRENT_ACADEMIC_YEAR = getCurrentAcademicYear();

  const location = useLocation();   // new added

  const navigate = useNavigate();

  const user = JSON.parse(localStorage.getItem("loggedInUser") || sessionStorage.getItem("loggedInUser") || "{}");
  const isHOD = location.pathname.startsWith("/hod") || user.role === "HOD";
  const refreshStateKey = `appraisal-form-refresh-v1:${isHOD ? "hod" : "faculty"}:${user.id || user.username || "anon"}`;

  const submitEndpoint = isHOD
    ? "/hod/submit/"
    : "/faculty/submit/";

  const [currentStep, setCurrentStep] = useState(1);
  const [errors, setErrors] = useState({});
  const from = location.pathname.startsWith("/hod")
    ? "/hod/dashboard"
    : "/faculty/dashboard";

  const [studentFeedback, setStudentFeedback] = useState([
    {
      semester: "",
      courseCode: "",
      courseName: "",
      averageScore: "",
      enclosureNo: ""
    }
  ]);



  const [activitySections, setActivitySections] = useState(
    normalizeActivitySections(DEFAULT_SPPU_ACTIVITY_SECTIONS)
  );
  //new added
  const [departmentalActivities, setDepartmentalActivities] = useState([
    {
      semester: "",
      section_key: "",
      activity: "",
      credit: "",
      criteria: "",
      enclosureNo: "",
      otherActivity: ""
    }
  ]);

  //new added



  const [instituteActivities, setInstituteActivities] = useState([
    {
      semester: "",
      activity: "",
      credit: "",
      criteria: "",
      enclosureNo: "",
      otherActivity: ""
    }
  ]);





  const [acrDetails, setAcrDetails] = useState({
    year: CURRENT_ACADEMIC_YEAR,
    acrAvailable: "",
    enclosureNo: "",
    creditPoints: ""   // new added
  });


  const [societyActivities, setSocietyActivities] = useState([
    {
      activity: "",
      semester: "",
      credit: "",
      criteria: "",
      enclosureNo: "",
      otherActivity: ""
    }
  ]);



  const [step2bActivities, setStep2bActivities] = useState([
    {
      id: `act_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      activityType: "",
      section_key: "",
      activity: "",
      isInvolved: "Yes",
      semester: "",
      credit: "",
      enclosureNo: "",
      criteria: "",
      otherActivity: ""
    }
  ]);

  /*LAST BLOCK OF <PAYLOAD></PAYLOAD>*/
  const [pbasScores, setPbasScores] = useState({
    teaching_process: 0,
    feedback: 0,
    department: 0,
    institute: 0,
    acr: 0,
    society: 0,
  });


  const addRow = (setter, row) => setter(prev => [...prev, row]);

  const removeRow = (setter, index) =>
    setter(prev => prev.filter((_, i) => i !== index));
  //new added all three 
  const DEPARTMENTAL_ACTIVITIES = [
    "Lab In charge",
    "Consultancy",
    "Time table In charge",
    "NBA coordinator",
    "Class Teacher",
    "Student registration",
    "Student detention In charge",
    "Final Year Student Project Guide",
    "Guest Lecture Organization",
    "Industrial visit in charge",
    "Project / Seminar Coordinator",
    "Departmental Library In charge",
    "Student Association / Chapter Co-coordinator",
    "Cleanliness in charge",
    "Practical / Exam Time table in charge",
    "Departmental store / Purchase in charge",
    "Internal / External Academic Monitoring Co-coordinator",
    "Department Level CSR Activities Co-coordinator",
    "Project Mentoring for project Competition",
    "Student Feedback In charge",
    "Student Counseling",
    "Initiative for CEP / STTP / Testing Consultancy",
    "Organization of MOOCS / NPTEL / Spoken Tutorials / IUCEE",
    "Any other Activity"
  ];

  const INSTITUTE_ACTIVITIES = [
    "In charge Internship",
    "Institute Web site Management",
    "Institute level networking and maintenance",
    "Building / Electrical Maintenance",
    "EPBX Activity",
    "Hardware and Software installation and maintenance",
    "Institute MIS In charge",
    "DTE MIS In charge",
    "Organization of FDP / Conference / Training / Workshop",
    "Exam Activities / Duties",
    "RO / RBTE / Administrative Activity / Duties",
    "Sports in charge and coordinator",
    "AICTE / University / Statutory committee member",
    "NBA / NAAC coordinator",
    "Garden Maintenance / Tree Plantation",
    "AICTE / NIRF / ARIIA / AISHE / TEQIP Activity in-charge",
    "PRO / Gymkhana / Student club activity",
    "HoD / Dean / Associate Dean / Library In-charge",
    "Rector / Warden / Canteen",
    "Earn and Learn Scheme / Scholarship In-charge",
    "Any other Activity"
  ];

  const SOCIETY_ACTIVITIES = [
    "Blood Donation Activity organization",
    "Yoga Classes",
    "Induction Program In charge",
    "Medical / Health Camp Organization",
    "Literacy Camp Organization",
    "Tree Plantation and garden maintenance",
    "Environmental awareness camp",
    "Swachh Bharat / Unnat Bharat / NSS / NCC Activity",
    "Any other Activity"
  ];

  const getInstitutePerActivityLimit = (activityName = "") => {
    const text = String(activityName || "").toUpperCase();
    if (text.includes("HOD") || text.includes("DEAN")) return 4;
    if (
      text.includes("COORDINATOR") &&
      (text.includes("APPOINTED") ||
        text.includes("HEAD OF INSTITUTE") ||
        text.includes("HOI"))
    ) {
      return 2;
    }
    if (text.includes("ORGANIZED") && text.includes("CONFERENCE")) return 2;
    if (
      (text.includes("FDP") ||
        text.includes("CO-COORDINATOR") ||
        text.includes("COORDINATOR")) &&
      text.includes("CONFERENCE")
    ) {
      return 1;
    }
    return 4;
  };

  const getDepartmentPerActivityLimit = () => 3;
  const getSocietyPerActivityLimit = () => 5;



  const createStep2BRow = () => ({
    id: `act_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    activityType: "",
    section_key: "",
    activity: "",
    isInvolved: "Yes",
    semester: "",
    credit: "",
    enclosureNo: "",
    criteria: "",
    otherActivity: ""
  });

  const STEP2_SOURCE_ACTIVITY_OPTIONS = activitySections.map((section) => ({
    value: section.section_key,
    label: section.label,
  }));

  const normalizeText = (value) => String(value || "").trim().toLowerCase();

  const getScopeLabel = (scope) => {
    if (scope === "departmental") return "Departmental";
    if (scope === "society") return "Society";
    return "Institutional";
  };

  const getSectionDefinition = (sectionKey) =>
    activitySections.find((item) => item.section_key === sectionKey);

  const findCanonicalActivity = (activityName) => {
    const normalizedActivity = normalizeText(activityName);
    if (!normalizedActivity) return null;
    for (const section of activitySections) {
      const list = Array.isArray(section?.activities_with_scope) ? section.activities_with_scope : [];
      const found = list.find((item) => normalizeText(item?.label) === normalizedActivity);
      if (found) {
        return {
          section_key: section.section_key,
          scope: found.scope,
          label: found.label,
        };
      }
    }
    return null;
  };

  const getScopeForSelection = (sectionKey, activityName, fallbackActivityType = "") => {
    const section = getSectionDefinition(sectionKey);
    const list = Array.isArray(section?.activities_with_scope) ? section.activities_with_scope : [];
    const normalizedActivity = normalizeText(activityName);
    const found = list.find((item) => normalizeText(item?.label) === normalizedActivity);
    if (found?.scope) return found.scope;
    const canonical = findCanonicalActivity(activityName);
    if (canonical?.scope) return canonical.scope;
    if (fallbackActivityType === "departmental") return "departmental";
    if (fallbackActivityType === "society") return "society";
    if (fallbackActivityType === "institutional") return "institute";
    return "institute";
  };

  const inferSectionKeyFromSelection = (activityType, activityName) => {
    const canonical = findCanonicalActivity(activityName);
    if (canonical?.section_key) return canonical.section_key;
    const text = String(activityName || "").toLowerCase();
    if (activityType === "society") return "c_student_related";
    if (text.includes("phd")) return "e_phd_guidance";
    if (text.includes("research") || text.includes("consultancy") || text.includes("project")) return "f_research_project";
    if (text.includes("sponsored") || text.includes("csr") || text.includes("national agency") || text.includes("international agency")) return "g_sponsored_project";
    if (text.includes("exam") || text.includes("evaluation") || text.includes("timetable")) return "b_exam_duties";
    if (text.includes("conference") || text.includes("workshop") || text.includes("fdp") || text.includes("webinar") || text.includes("mooc") || text.includes("induction")) return "d_organizing_events";
    if (text.includes("student") || text.includes("sports") || text.includes("counsel") || text.includes("ncc") || text.includes("nss") || text.includes("blood") || text.includes("yoga")) return "c_student_related";
    return "a_administrative";
  };

  const getMaxCreditForSelection = (sectionKey, activityName, fallbackActivityType = "") => {
    const mappedScope = getScopeForSelection(sectionKey, activityName, fallbackActivityType);
    if (mappedScope === "departmental") return getDepartmentPerActivityLimit();
    if (mappedScope === "society") return getSocietyPerActivityLimit();
    if (mappedScope === "institute") return getInstitutePerActivityLimit(activityName);
    return 0;
  };

  const getNormalizedStep2BRows = () =>
    (step2bActivities || [])
      .map((row, index) => {
        const activityName = row.otherActivity?.trim() || row.activity || "";
        const scope = getScopeForSelection(row.section_key, activityName, row.activityType);
        const credit = Number(row.credit || 0);
        return {
          row,
          index,
          activityName,
          scope,
          credit: Number.isFinite(credit) ? credit : 0,
        };
      })
      .filter(({ row, activityName }) => row.section_key && activityName);

  const deriveBucketsFromStep2B = () => {
    const normalizedRows = getNormalizedStep2BRows();
    const departmental = normalizedRows
      .filter(({ scope }) => scope === "departmental")
      .map(({ row, activityName, credit }) => ({
        mapping_id: row.id,
        semester: row.semester || "",
        section_key: row.section_key || inferSectionKeyFromSelection("departmental", activityName),
        activity: activityName,
        credit: row.credit || "",
        criteria: row.criteria || "",
        enclosureNo: row.enclosureNo || "",
        otherActivity: row.otherActivity || "",
        credits_claimed: credit,
      }));

    const institute = normalizedRows
      .filter(({ scope }) => scope === "institute")
      .map(({ row, activityName, credit }) => ({
        mapping_id: row.id,
        semester: row.semester || "",
        section_key: row.section_key || inferSectionKeyFromSelection("institutional", activityName),
        activity: activityName,
        credit: row.credit || "",
        criteria: row.criteria || "",
        enclosureNo: row.enclosureNo || "",
        otherActivity: row.otherActivity || "",
        credits_claimed: credit,
      }));

    const society = normalizedRows
      .filter(({ scope }) => scope === "society")
      .map(({ row, activityName, credit }) => ({
        mapping_id: row.id,
        semester: row.semester || "",
        section_key: row.section_key || inferSectionKeyFromSelection("society", activityName),
        activity: activityName,
        credit: row.credit || "",
        criteria: row.criteria || "",
        enclosureNo: row.enclosureNo || "",
        otherActivity: row.otherActivity || "",
        credits_claimed: credit,
      }));

    return { departmental, institute, society };
  };

  const mergeMappedRows = (existingRows, mappedRows) => {
    const manualRows = (existingRows || []).filter((row) => !row.mapping_id);
    const existingById = new Map((existingRows || []).filter((row) => row.mapping_id).map((row) => [row.mapping_id, row]));

    const mergedMapped = mappedRows.map((mapped) => {
      const existing = existingById.get(mapped.mapping_id);
      if (!existing) return mapped;
      return {
        ...mapped,
        credit: existing.credit !== undefined && existing.credit !== "" ? existing.credit : mapped.credit,
        criteria: existing.criteria !== undefined && existing.criteria !== "" ? existing.criteria : mapped.criteria,
        enclosureNo: existing.enclosureNo !== undefined && existing.enclosureNo !== "" ? existing.enclosureNo : mapped.enclosureNo,
        semester: existing.semester !== undefined && existing.semester !== "" ? existing.semester : mapped.semester,
        otherActivity: existing.otherActivity !== undefined && existing.otherActivity !== "" ? existing.otherActivity : mapped.otherActivity,
      };
    });

    return [...mergedMapped, ...manualRows];
  };

  const deriveStep2BFromLegacyRows = (deptRows, instRows, socRows) => {
    const rows = [];

    (deptRows || []).forEach((row, index) => {
      const activity = row.otherActivity?.trim() || row.activity || "";
      if (!activity) return;
      rows.push({
        id: `legacy_dept_${index}_${Date.now()}`,
        activityType: "departmental",
        section_key: row.section_key || inferSectionKeyFromSelection("departmental", activity),
        activity,
        isInvolved: "Yes",
        semester: row.semester || "",
        credit: row.credit || "",
        enclosureNo: row.enclosureNo || "",
        criteria: row.criteria || "",
        otherActivity: row.otherActivity || ""
      });
    });

    (instRows || []).forEach((row, index) => {
      const activity = row.otherActivity?.trim() || row.activity || "";
      if (!activity) return;
      const canonical = findCanonicalActivity(activity);
      rows.push({
        id: `legacy_inst_${index}_${Date.now()}`,
        activityType: "institutional",
        section_key: row.section_key || row.section || canonical?.section_key || inferSectionKeyFromSelection("institutional", activity),
        activity,
        isInvolved: "Yes",
        semester: row.semester || "",
        credit: row.credit || "",
        enclosureNo: row.enclosureNo || "",
        criteria: row.criteria || "",
        otherActivity: row.otherActivity || ""
      });
    });

    (socRows || []).forEach((row, index) => {
      const activity = row.otherActivity?.trim() || row.activity || "";
      if (!activity) return;
      const canonical = findCanonicalActivity(activity);
      rows.push({
        id: `legacy_soc_${index}_${Date.now()}`,
        activityType: "society",
        section_key: row.section_key || row.section || canonical?.section_key || inferSectionKeyFromSelection("society", activity),
        activity,
        isInvolved: "Yes",
        semester: row.semester || "",
        credit: row.credit || "",
        enclosureNo: row.enclosureNo || "",
        criteria: row.criteria || "",
        otherActivity: row.otherActivity || ""
      });
    });

    return rows;
  };

  const [research, setResearch] = useState({
    papers: [
      {
        title: "",
        journal: "",
        ugcCare: "",
        impactFactor: "",
        authorship: "",
        year: "",
        enclosureNo: ""
      }
    ],

    publications: [
      {
        type: "",
        title: "",
        publisherType: "",
        translationType: "",
        year: "",
        enclosureNo: ""
      }
    ],

    projects: [
      {
        status: "",
        amountSlab: "",
        role: "",
        enclosureNo: ""
      }
    ],

    patents: [
      {
        type: "",
        status: "",
        enclosureNo: ""
      }
    ],

    // THIS WAS MISSING
    guidance: [
      {
        degree: "",
        status: "",
        count: "",
        year: "",
        enclosureNo: ""
      }
    ],

    moocsIct: [
      {
        category: "",
        role: "",
        creditClaimed: "",
        year: "",
        enclosureNo: ""
      }
    ],

    consultancyPolicy: [
      {
        category: "",
        level: "",
        enclosureNo: ""
      }
    ],

    awards: [
      {
        level: "",
        title: "",
        year: "",
        enclosureNo: ""
      }
    ],

    invitedTalks: [
      {
        level: "",
        role: "",
        year: "",
        enclosureNo: ""
      }
    ]
  });



  /* ================= FORM STATE ================= */
  const [appraisalId, setAppraisalId] = useState(null);
  const [appraisalStatus, setAppraisalStatus] = useState("DRAFT");
  const [remarks, setRemarks] = useState("");
  const [justification, setJustification] = useState("");
  /* ================= SECTION 1 ================= */
  const [generalInfo, setGeneralInfo] = useState({
    facultyName: "",
    designation: "",
    department: "",
    dateOfJoining: "",
    email: "",
    mobile: "",
    communicationAddress: "",
    currentDesignation: "",
    payLevel: "",
    promotionDesignation: "",
    promotionDate: "",
    eligibilityDate: "",
    academicYear: CURRENT_ACADEMIC_YEAR
  });


  useEffect(() => {
    // 1️⃣ Fetch Profile Data
    API.get("me/")
      .then(res => {
        const data = res.data;
        setGeneralInfo(prev => ({
          ...prev,
          facultyName: data.full_name || "",
          designation: data.designation || "",
          department: data.department || "",
          email: data.email || "",
          mobile: data.mobile_number || "",
          dateOfJoining: (data.date_of_joining || data.date_joined || "").toString().split("T")[0],
          communicationAddress: data.address || "",
          currentDesignation: data.designation || "",
          payLevel: data.gradePay || "",
          promotionDesignation: data.promotion_designation || "",
          eligibilityDate: (data.eligibility_date || "").toString().split("T")[0],
        }));
      })
      .catch(err => console.error("Failed to fetch profile", err));

    // 2️⃣ Fetch Existing Draft
    API.get(`appraisal/current/?is_hod=${isHOD}`)
      .then(res => {
        if (Array.isArray(res.data?.activity_sections) && res.data.activity_sections.length > 0) {
          setActivitySections(normalizeActivitySections(res.data.activity_sections));
        }
        if (res.data && res.data.appraisal_data) {
          const aid = res.data.id || res.data.appraisal_id;
          setAppraisalId(aid);
          setAppraisalStatus(res.data.status);
          setRemarks(res.data.remarks || "");
          const draft = res.data.appraisal_data;
          const ui = draft._ui_state;

          if (ui) {
            // BEST: Restore from full state
            if (ui.generalInfo) {
              const nonEmptyGeneralInfo = Object.fromEntries(
                Object.entries(ui.generalInfo).filter(([, value]) => value !== "" && value !== null && value !== undefined)
              );
              setGeneralInfo(prev => ({ ...prev, ...nonEmptyGeneralInfo }));
            }
            if (ui.teachingActivities) setTeachingActivities(ui.teachingActivities);
            if (ui.studentFeedback) setStudentFeedback(ui.studentFeedback);
            if (ui.step2bActivities) setStep2bActivities(ui.step2bActivities);
            if (ui.departmentalActivities) setDepartmentalActivities(ui.departmentalActivities);
            if (ui.instituteActivities) setInstituteActivities(ui.instituteActivities);
            if (ui.societyActivities) setSocietyActivities(ui.societyActivities);
            if (ui.acrDetails) setAcrDetails(ui.acrDetails);
            if (ui.research) setResearch(ui.research);
            if (ui.pbasScores) setPbasScores(ui.pbasScores);
            if (ui.justification) setJustification(ui.justification);
            return;
          }

          // FALLBACK: Restore from structured data (lossy)
          if (draft.general) {
            const designationGradeRaw = (draft.general.present_designation_grade_pay || "").toString().trim();
            const designationGradeParts = designationGradeRaw.split("/").map((v) => v.trim()).filter(Boolean);
            const restoredCurrentDesignation = designationGradeParts[0] || "";
            const restoredPayLevel = designationGradeParts.slice(1).join(" / ");

            const promotionRaw = (draft.general.promotion_designation_due_date || "").toString().trim();
            const dateTokens = promotionRaw.match(/\d{4}-\d{2}-\d{2}/g) || [];
            const restoredPromotionDate = dateTokens[0] || "";
            const restoredEligibilityDate = dateTokens[1] || "";
            const restoredPromotionDesignation = promotionRaw
              .replace(restoredPromotionDate, "")
              .replace(restoredEligibilityDate, "")
              .replace(/\s+/g, " ")
              .trim();

            setGeneralInfo(prev => ({
              ...prev,
              academicYear: res.data.academic_year || prev.academicYear || CURRENT_ACADEMIC_YEAR,
              facultyName: draft.general.faculty_name || draft.general.name || prev.facultyName,
              department: draft.general.department || draft.general.department_center || prev.department,
              designation: draft.general.designation || prev.designation,
              dateOfJoining: draft.general.date_of_joining || prev.dateOfJoining,
              email: draft.general.email || prev.email,
              mobile: draft.general.mobile || prev.mobile,
              communicationAddress: draft.general.communication_address || prev.communicationAddress,
              currentDesignation: restoredCurrentDesignation || prev.currentDesignation,
              payLevel: restoredPayLevel || prev.payLevel,
              promotionDesignation: restoredPromotionDesignation || prev.promotionDesignation,
              promotionDate: restoredPromotionDate || prev.promotionDate,
              eligibilityDate: restoredEligibilityDate || prev.eligibilityDate,
            }));
          }

          if (draft.teaching && draft.teaching.courses) {
            setTeachingActivities(draft.teaching.courses.map(c => ({
              academicYear: res.data.academic_year || CURRENT_ACADEMIC_YEAR,
              semester: c.semester || "",
              courseCode: c.course_code || "",
              courseName: c.course_name || "",
              totalClassesAssigned: c.scheduled_classes || "",
              classesConducted: c.held_classes || "",
              teachingType: "Lecture",
              academicLevel: "UG",
              classDivision: "",
              enclosureNo: ""
            })));
          }

          if (draft.pbas) {
            if (draft.pbas.student_feedback || draft.pbas.students_feedback) {
              setStudentFeedback((draft.pbas.student_feedback || draft.pbas.students_feedback).map(f => ({
                semester: f.semester || "",
                courseCode: f.course_code || f.code || "",
                courseName: f.course_name || f.course || "",
                averageScore: f.feedback_score || f.average || "",
                enclosureNo: f.enclosure_no || f.enclosure || ""
              })));
            }
            if (draft.pbas.departmental_activities) {
              setDepartmentalActivities(draft.pbas.departmental_activities.map(d => ({
                activity: d.activity || "",
                semester: d.semester || "",
                section_key: d.section_key || d.section || "",
                credit: d.credits_claimed || d.credit || "",
                enclosureNo: d.enclosure_no || d.enclosure || ""
              })));
            }
            if (draft.pbas.institute_activities) {
              setInstituteActivities(draft.pbas.institute_activities.map(i => ({
                activity: i.activity || "",
                semester: i.semester || "",
                section_key: i.section_key || i.section || "",
                credit: i.credits_claimed || i.credit || "",
                criteria: i.criteria || i.remarks || "",
                enclosureNo: i.enclosure_no || i.enclosure || ""
              })));
            }
            if (draft.pbas.society_activities) {
              setSocietyActivities(draft.pbas.society_activities.map(s => ({
                activity: s.activity || "",
                semester: s.semester || "",
                section_key: s.section_key || s.section || "",
                credit: s.credits_claimed || s.credit || "",
                criteria: s.criteria || s.remarks || "",
                enclosureNo: s.enclosure_no || s.enclosure || ""
              })));
            }

            setPbasScores({
              teaching_process: draft.pbas.teaching_process || 0,
              feedback: draft.pbas.feedback || 0,
              department: draft.pbas.department || 0,
              institute: draft.pbas.institute || 0,
              acr: draft.pbas.acr || 0,
              society: draft.pbas.society || 0,
            });
          }

          if (draft.acr) {
            setAcrDetails(prev => ({
              ...prev,
              year: draft.acr.year || CURRENT_ACADEMIC_YEAR,
              acrAvailable: draft.acr.grade || "",
            }));
          }
          setJustification(draft.justification || draft.pbas?.justification || "");
        }
      })
      .catch(err => console.error("Failed to load draft", err));
  }, []);

  useEffect(() => {
    const hasMeaningfulStep2B = step2bActivities.some((row) => row.section_key || row.activity || row.credit || row.semester || row.enclosureNo);
    if (hasMeaningfulStep2B) return;

    const derived = deriveStep2BFromLegacyRows(departmentalActivities, instituteActivities, societyActivities);
    if (derived.length > 0) {
      setStep2bActivities(derived);
    }
  }, [departmentalActivities, instituteActivities, societyActivities]);

  useEffect(() => {
    const mapped = deriveBucketsFromStep2B();
    const mappedDepartmental = mapped.departmental;
    const mappedInstitutional = mapped.institute;
    const mappedSociety = mapped.society;

    setDepartmentalActivities((prev) => mergeMappedRows(prev, mappedDepartmental));
    setInstituteActivities((prev) => mergeMappedRows(prev, mappedInstitutional));
    setSocietyActivities((prev) => mergeMappedRows(prev, mappedSociety));
  }, [step2bActivities, activitySections]);

  const handleGeneralChange = (e) => {
    const { name, value } = e.target;

    setGeneralInfo({ ...generalInfo, [name]: value });

    if (errors[name]) {
      setErrors((prev) => {
        const copy = { ...prev };
        delete copy[name];
        return copy;
      });
    }
  };


  /* ================= SECTION 2 ================= */
  /* ================= SECTION 2 : TEACHING ================= */

  /* ================= SECTION 2 : TEACHING ================= */

  const SEMESTERS = ["Sem 1", "Sem 2"];
  const TEACHING_TYPES = ["Lecture", "Tutorial", "Practical", "Lab"];
  const ACADEMIC_LEVELS = ["UG", "PG"];
  const ACADEMIC_YEARS = buildAcademicYearOptions(CURRENT_ACADEMIC_YEAR);


  const deriveSppuFlagsFromSelections = (selections) => {
    const flags = {
      administrative_responsibility: false,
      exam_duties: false,
      student_related: false,
      organizing_events: false,
      phd_guidance: false,
      research_project: false,
      sponsored_project: false,
      publication_in_ugc: false,
    };

    (selections || []).forEach((item) => {
      const sectionKey = item?.section_key;
      const legacyKey = SECTION_TO_LEGACY[sectionKey];
      if (legacyKey) flags[legacyKey] = true;
      if (sectionKey === "g_sponsored_project") flags.publication_in_ugc = true;
    });

    return flags;
  };

  const getSectionActivities = (sectionKey) => {
    const section = activitySections.find((item) => item.section_key === sectionKey);
    return Array.isArray(section?.activities) ? section.activities : [];
  };

  const selectedSppuActivities = getNormalizedStep2BRows().map(({ row, activityName, scope, credit }) => ({
    section_key: row.section_key,
    activity_name: activityName,
    scope,
    credits_claimed: credit,
    semester: row.semester || "",
    criteria: row.criteria || "",
    enclosure_no: row.enclosureNo || "",
  }));

  const [teachingActivities, setTeachingActivities] = useState([
    {
      academicYear: CURRENT_ACADEMIC_YEAR,
      semester: "",
      courseCode: "",
      courseName: "",
      classDivision: "",
      teachingType: "",
      academicLevel: "",
      totalClassesAssigned: "",
      classesConducted: "",
      enclosureNo: ""
    }
  ]);
  const handleTeachingChange = (index, e) => {
    const updated = [...teachingActivities];
    updated[index][e.target.name] = e.target.value;
    setTeachingActivities(updated);
  };

  const addTeachingRow = () => {
    setTeachingActivities([
      ...teachingActivities,
      {
        academicYear: generalInfo.academicYear || CURRENT_ACADEMIC_YEAR,
        semester: "",
        courseCode: "",
        courseName: "",
        classDivision: "",
        teachingType: "",
        academicLevel: "",
        totalClassesAssigned: "",
        classesConducted: "",
        enclosureNo: ""
      }
    ]);
  };

  const removeTeachingRow = (index) => {
    if (teachingActivities.length > 1) {
      setTeachingActivities(teachingActivities.filter((_, i) => i !== index));
    }
  };



  /* ================= SECTION 3 ================= */
  const [categoryTwo, setCategoryTwo] = useState([
    { activityType: "", description: "", role: "", duration: "", year: " " }
  ]);




  /* ================= SECTION 4 ================= */


  /* ================= SUBMISSION ================= */
  const [declarationAccepted, setDeclarationAccepted] = useState(false);
  const [formStatus, setFormStatus] = useState("draft");
  const [processingNotice, setProcessingNotice] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(refreshStateKey);
      if (!raw) return;
      const cached = JSON.parse(raw);
      if (!cached || typeof cached !== "object") return;

      if (typeof cached.currentStep === "number") setCurrentStep(cached.currentStep);
      if (cached.generalInfo) setGeneralInfo((prev) => ({ ...prev, ...cached.generalInfo }));
      if (Array.isArray(cached.teachingActivities) && cached.teachingActivities.length) setTeachingActivities(cached.teachingActivities);
      if (Array.isArray(cached.studentFeedback) && cached.studentFeedback.length) setStudentFeedback(cached.studentFeedback);
      if (Array.isArray(cached.step2bActivities) && cached.step2bActivities.length) setStep2bActivities(cached.step2bActivities);
      if (Array.isArray(cached.departmentalActivities) && cached.departmentalActivities.length) setDepartmentalActivities(cached.departmentalActivities);
      if (Array.isArray(cached.instituteActivities) && cached.instituteActivities.length) setInstituteActivities(cached.instituteActivities);
      if (Array.isArray(cached.societyActivities) && cached.societyActivities.length) setSocietyActivities(cached.societyActivities);
      if (cached.acrDetails) setAcrDetails(cached.acrDetails);
      if (cached.research) setResearch(cached.research);
      if (cached.pbasScores) setPbasScores(cached.pbasScores);
      if (typeof cached.justification === "string") setJustification(cached.justification);
      if (Array.isArray(cached.categoryTwo)) setCategoryTwo(cached.categoryTwo);
      if (typeof cached.declarationAccepted === "boolean") setDeclarationAccepted(cached.declarationAccepted);
      if (typeof cached.formStatus === "string") setFormStatus(cached.formStatus);
    } catch (error) {
      console.error("Failed to restore refresh state", error);
    }
  }, [refreshStateKey]);

  useEffect(() => {
    const snapshot = {
      currentStep,
      generalInfo,
      teachingActivities,
      studentFeedback,
      step2bActivities,
      departmentalActivities,
      instituteActivities,
      societyActivities,
      acrDetails,
      research,
      pbasScores,
      justification,
      categoryTwo,
      declarationAccepted,
      formStatus,
    };

    try {
      sessionStorage.setItem(refreshStateKey, JSON.stringify(snapshot));
    } catch (error) {
      console.error("Failed to persist refresh state", error);
    }
  }, [
    refreshStateKey,
    currentStep,
    generalInfo,
    teachingActivities,
    studentFeedback,
          step2bActivities,
          departmentalActivities,
          instituteActivities,
          societyActivities,
          acrDetails,
    research,
    pbasScores,
    justification,
    categoryTwo,
    declarationAccepted,
    formStatus,
  ]);

  // DEPRECATED: Use buildAppraisalPayload instead to avoid data loss
  const buildBackendPayload = (submitAction = "draft") => {
    return buildAppraisalPayload(submitAction.toUpperCase());
  };


  const buildAppraisalPayload = (submitAction = "SUBMIT") => {
    const totalAssigned = teachingActivities.reduce(
      (sum, t) => sum + Number(t.totalClassesAssigned),
      0
    );

    const totalTaught = teachingActivities.reduce(
      (sum, t) => sum + Number(t.classesConducted),
      0
    );
    const mappedBuckets = deriveBucketsFromStep2B();

    return {
      academic_year: generalInfo.academicYear,
      semester: "SEM_1",
      form_type: "PBAS",

      appraisal_data: {
        submit_action: submitAction,
        justification: justification,

        general: {
          faculty_name: generalInfo.facultyName,
          designation: generalInfo.designation,
          department: generalInfo.department,
          date_of_joining: generalInfo.dateOfJoining,
          email: generalInfo.email,
          mobile: generalInfo.mobile,
          communication_address: generalInfo.communicationAddress,
          present_designation_grade_pay: `${generalInfo.currentDesignation} / ${generalInfo.payLevel}`.trim(),
          promotion_designation_due_date: `${generalInfo.promotionDesignation} ${generalInfo.promotionDate || ""} ${generalInfo.eligibilityDate || ""}`.trim(),
          assessment_period: generalInfo.academicYear
        },

        teaching: {
          total_classes_assigned: totalAssigned,
          classes_taught: totalTaught,
          courses: teachingActivities.map(t => ({
            semester: t.semester,
            course_code: t.courseCode,
            course_name: t.courseName,
            scheduled_classes: Number(t.totalClassesAssigned),
            held_classes: Number(t.classesConducted),
            total_classes_assigned: Number(t.totalClassesAssigned),
            classes_taught: Number(t.classesConducted),
            enclosure_no: t.enclosureNo || ""
          }))
        },

        activities: {
          selected_activities: selectedSppuActivities.map((item) => ({
            section_key: item.section_key,
            activity_name: item.activity_name,
            scope: item.scope,
            credits_claimed: item.credits_claimed,
            semester: item.semester,
            criteria: item.criteria,
            enclosure_no: item.enclosure_no,
          })),
          ...deriveSppuFlagsFromSelections(selectedSppuActivities),
        },

        research: {
          entries: buildResearchEntries()
        },

        acr: {
          grade: Number(acrDetails.creditPoints),
          year: acrDetails.year,
          enclosure_no: acrDetails.enclosureNo
        },

        // ✅ PBAS BLOCK
        pbas: {
          ...buildPBASScores(),
          ...buildPBASCounts(),
          justification: justification,

          teaching_process: teachingActivities.map(t => {
            const assigned = Number(t.totalClassesAssigned || 0);
            const conducted = Number(t.classesConducted || 0);
            const points = assigned > 0 ? (conducted / assigned) * 10 : 0; // Approximate per-course score
            return {
              semester: t.semester,
              course: `${t.courseName} (${t.courseCode})`,
              course_code: t.courseCode,
              course_name: t.courseName,
              scheduled: assigned,
              scheduled_classes: assigned,
              held: conducted,
              held_classes: conducted,
              points: parseFloat(points.toFixed(2)),
              enclosure: t.enclosureNo || "",
              enclosure_no: t.enclosureNo || ""
            };
          }),

          student_feedback: studentFeedback.map(f => ({
            semester: f.semester,
            course: `${f.courseName} (${f.courseCode})`,
            course_code: f.courseCode,
            course_name: f.courseName,
            average: Number(f.averageScore),
            feedback_score: Number(f.averageScore),
            enclosure: f.enclosureNo || "",
            enclosure_no: f.enclosureNo || ""
          })),

          departmental_activities: mappedBuckets.departmental.map(a => ({
            semester: a.semester,
            section_key: a.section_key || "",
            activity: a.otherActivity?.trim() || a.activity,
            criteria: a.criteria,
            credit: Number(a.credits_claimed || a.credit),
            credits_claimed: Number(a.credits_claimed || a.credit),
            enclosure: a.enclosureNo || "",
            enclosure_no: a.enclosureNo || ""
          })),

          institute_activities: mappedBuckets.institute.map(a => ({
            semester: a.semester,
            section_key: a.section_key || "",
            activity: a.activity,
            activity_name: a.activity,
            criteria: a.criteria || "",
            credits_claimed: Number(a.credits_claimed || a.credit),
            enclosure_no: a.enclosureNo || null
          })),

          society_activities: mappedBuckets.society.map(a => ({
            semester: a.semester,
            section_key: a.section_key || "",
            activity: a.activity,
            activity_name: a.activity,
            criteria: a.criteria || "",
            credits_claimed: Number(a.credits_claimed || a.credit),
            enclosure_no: a.enclosureNo || null
          }))
        },

        // Persist exact UI state for reliable draft restore without lossy remapping.
        _ui_state: {
          generalInfo,
          teachingActivities,
          studentFeedback,
          step2bActivities,
          departmentalActivities,
          instituteActivities,
          societyActivities,
          acrDetails,
          research,
          pbasScores,
          justification,
        },
      }
    };
  };


  const handleSaveDraft = async (silent = false) => {
    try {
      const payload = buildBackendPayload("draft");


      let url = submitEndpoint;
      if (appraisalId && appraisalStatus !== "DRAFT") {
        url = isHOD
          ? `/hod/resubmit/${appraisalId}/`
          : `/faculty/appraisal/${appraisalId}/resubmit/`;
      }

      const response = await API.post(url, payload, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("access")}`
        }
      });

      const savedAppraisalId = response?.data?.appraisal_id || appraisalId;
      const currentState = response?.data?.current_state;
      if (savedAppraisalId) setAppraisalId(savedAppraisalId);
      if (currentState) setAppraisalStatus(currentState);

      if (!silent) alert("Saved successfully");
      return savedAppraisalId;
    } catch (error) {
      console.error(error);
      if (!silent) {
        const message = error?.response?.data?.error || "Failed to save";
        alert(message);
      }
      return null;
    }
  };

  const previewGeneratedPdf = async (formType) => {
    setIsProcessing(true);
    setProcessingNotice("Do not refresh. Form is being processed.");
    try {
      let id = appraisalId;
      if (!id) {
        id = await handleSaveDraft(true);
      }
      if (!id) {
        alert("Save draft first, then preview the generated forms.");
        return;
      }

      const endpoint = formType === "SPPU"
        ? `appraisal/${id}/pdf/sppu-enhanced/`
        : `appraisal/${id}/pdf/pbas-enhanced/`;

      const response = await API.get(endpoint, { responseType: "blob" });
      const pdfBlobUrl = window.URL.createObjectURL(response.data);
      window.open(pdfBlobUrl, "_blank", "noopener,noreferrer");
      setTimeout(() => window.URL.revokeObjectURL(pdfBlobUrl), 60000);
      setProcessingNotice("Processing complete. You may continue.");
    } catch (error) {
      console.error("Preview failed", error);
      alert("Failed to load preview PDF.");
      setProcessingNotice("");
    } finally {
      setIsProcessing(false);
    }
  };



  const validateStep1 = () => {
    const newErrors = {};

    if (!generalInfo.facultyName)
      newErrors.facultyName = "Faculty Name is required";

    if (!generalInfo.designation)
      newErrors.designation = "Designation is required";

    if (!generalInfo.department)
      newErrors.department = "Department is required";

    if (!generalInfo.dateOfJoining)
      newErrors.dateOfJoining = "Date of Joining is required";

    if (!generalInfo.email)
      newErrors.email = "Email is required";

    if (!generalInfo.mobile)
      newErrors.mobile = "Mobile number is required";

    if (!generalInfo.communicationAddress)
      newErrors.communicationAddress = "Address is required";

    if (!generalInfo.currentDesignation)
      newErrors.currentDesignation = "Current designation is required";

    if (!generalInfo.payLevel)
      newErrors.payLevel = "Pay level is required";

    if (!generalInfo.academicYear)
      newErrors.academicYear = "Academic year is required";

    setErrors(newErrors);
    return newErrors;
  };


  // Teaching
  const validateStep2 = () => {
    const newErrors = {};

    // At least one teaching entry required
    if (!teachingActivities || teachingActivities.length === 0) {
      newErrors.teaching = "At least one teaching entry is required";
    } else {
      teachingActivities.forEach((t, index) => {
        if (!t.academicYear) {
          newErrors[`teaching_${index}_academicYear`] =
            "Academic Year is required";
        }

        if (!t.semester) {
          newErrors[`teaching_${index}_semester`] =
            "Semester is required";
        }

        if (!t.courseCode) {
          newErrors[`teaching_${index}_courseCode`] =
            "Course Code is required";
        }

        if (!t.courseName) {
          newErrors[`teaching_${index}_courseName`] =
            "Course Name is required";
        }

        if (!t.teachingType) {
          newErrors[`teaching_${index}_teachingType`] =
            "Teaching Type is required";
        }

        if (!t.totalClassesAssigned) {
          newErrors[`teaching_${index}_totalClassesAssigned`] =
            "Total Classes Assigned is required";
        }

        if (!t.classesConducted) {
          newErrors[`teaching_${index}_classesConducted`] =
            "Classes Conducted is required";
        }

        // Optional but logical check
        if (
          t.totalClassesAssigned &&
          t.classesConducted &&
          Number(t.classesConducted) > Number(t.totalClassesAssigned)
        ) {
          newErrors[`teaching_${index}_classesConducted`] =
            "Classes conducted cannot exceed classes assigned";
        }
      });
    }

    setErrors(newErrors);
    return newErrors;
  };
  const handleSaveAndNext = async () => {
    setErrors({});
    const saved = await handleSaveDraft(true);
    if (!saved) {
      alert("Please save before moving to the next step.");
      return;
    }
    setCurrentStep(2);
  };
  const validateSPPU = () => {
    const newErrors = {};
    const totals = { departmental: 0, institute: 0, society: 0 };
    step2bActivities.forEach((row, index) => {
      if (!row.section_key) newErrors[`step2b_${index}_section`] = "Select one source activity";
      if (!row.activity) newErrors[`step2b_${index}_activity`] = "Select activity";
      if (String(row.activity || "").toLowerCase().includes("any other") && !String(row.otherActivity || "").trim()) {
        newErrors[`step2b_${index}_other`] = "Specify other activity";
      }
      const maxCredit = getMaxCreditForSelection(row.section_key, row.activity, row.activityType);
      const creditValue = Number(row.credit || 0);
      if (!Number.isFinite(creditValue) || creditValue < 0) {
        newErrors[`step2b_${index}_credit`] = "Credit must be a non-negative number";
      } else if (maxCredit > 0 && creditValue > maxCredit) {
        newErrors[`step2b_${index}_credit`] = `Credit cannot exceed ${maxCredit} for selected activity`;
      } else {
        const activityName = row.otherActivity?.trim() || row.activity;
        const scope = getScopeForSelection(row.section_key, activityName, row.activityType);
        if (scope === "departmental") totals.departmental += creditValue;
        if (scope === "institute") totals.institute += creditValue;
        if (scope === "society") totals.society += creditValue;
      }
    });
    if (totals.departmental > 20) newErrors.step2b_department_total = "Total departmental credits cannot exceed 20";
    if (totals.institute > 10) newErrors.step2b_institute_total = "Total institutional credits cannot exceed 10";
    if (totals.society > 10) newErrors.step2b_society_total = "Total society credits cannot exceed 10";
    setErrors((prev) => ({ ...prev, ...newErrors }));
    return newErrors;
  };

  const validateStep3Credits = () => {
    const newErrors = {};
    const mapped = deriveBucketsFromStep2B();

    let deptTotal = 0;
    mapped.departmental.forEach((row, index) => {
      const val = Number(row.credits_claimed || row.credit || 0);
      if (!Number.isFinite(val) || val < 0) {
        newErrors[`dept_${index}_credit`] = "Credit must be a non-negative number";
        return;
      }
      if (val > 3) {
        newErrors[`dept_${index}_credit`] = "Departmental credit cannot exceed 3 per activity";
      }
      deptTotal += val;
    });
    if (deptTotal > 20) {
      newErrors.department_total = "Total departmental credits cannot exceed 20";
    }

    let instituteTotal = 0;
    mapped.institute.forEach((row, index) => {
      const val = Number(row.credits_claimed || row.credit || 0);
      if (!Number.isFinite(val) || val < 0) {
        newErrors[`inst_${index}_credit`] = "Credit must be a non-negative number";
        return;
      }
      const limit = getInstitutePerActivityLimit(row.activity);
      if (val > limit) {
        newErrors[`inst_${index}_credit`] = `Credit cannot exceed ${limit} for selected institute activity`;
      }
      instituteTotal += val;
    });
    if (instituteTotal > 10) {
      newErrors.institute_total = "Total institute credits cannot exceed 10";
    }

    let societyTotal = 0;
    mapped.society.forEach((row, index) => {
      const val = Number(row.credits_claimed || row.credit || 0);
      if (!Number.isFinite(val) || val < 0) {
        newErrors[`soc_${index}_credit`] = "Credit must be a non-negative number";
        return;
      }
      if (val > 5) {
        newErrors[`soc_${index}_credit`] = "Society credit cannot exceed 5 per activity";
      }
      societyTotal += val;
    });
    if (societyTotal > 10) {
      newErrors.society_total = "Total society credits cannot exceed 10";
    }

    return newErrors;
  };

  const showValidationSummary = (validationErrors) => {
    const messages = Object.values(validationErrors || {}).filter(Boolean);
    if (!messages.length) return;
    const preview = messages.slice(0, 5).join("\n- ");
    const suffix = messages.length > 5 ? "\n- ..." : "";
    alert(`Please fill required fields:\n- ${preview}${suffix}`);
  };

  const buildResearchEntries = () => {
    const entriesMap = {};
    const upsert = (type, title = "", year = "", enclosureNo = "", countInc = 1) => {
      if (!type) return;
      if (!entriesMap[type]) {
        entriesMap[type] = {
          type,
          count: 0,
          title: "",
          year: "",
          enclosure_no: "",
          _titles: []
        };
      }
      entriesMap[type].count += Number(countInc || 1);
      if (title) entriesMap[type]._titles.push(String(title).trim());
      if (!entriesMap[type].year && year) entriesMap[type].year = year;
      if (!entriesMap[type].enclosure_no && enclosureNo) entriesMap[type].enclosure_no = enclosureNo;
    };

    research.papers.forEach((p) => {
      if (!p.title) return;
      upsert("journal_papers", p.title, p.year, p.enclosureNo, 1);
    });

    research.publications.forEach((p) => {
      if (!p.type) return;
      if (p.type !== "Translation" && !p.publisherType) return;
      const title = p.title || p.type;
      if (p.type === "Book" && p.publisherType === "International") upsert("book_international", title, p.year, p.enclosureNo, 1);
      if (p.type === "Book" && p.publisherType === "National") upsert("book_national", title, p.year, p.enclosureNo, 1);
      if (p.type === "Chapter") upsert("edited_book_chapter", title, p.year, p.enclosureNo, 1);
      if (p.type === "Editor" && p.publisherType === "International") upsert("editor_book_international", title, p.year, p.enclosureNo, 1);
      if (p.type === "Editor" && p.publisherType === "National") upsert("editor_book_national", title, p.year, p.enclosureNo, 1);
      if (p.type === "Translation") {
        if (p.translationType === "Book") upsert("translation_book", title, p.year, p.enclosureNo, 1);
        else upsert("translation_chapter_or_paper", title, p.year, p.enclosureNo, 1);
      }
    });

    research.projects.forEach((p) => {
      if (!p.status || !p.amountSlab) return;
      const label = `${p.status || ""} ${p.amountSlab || ""} ${p.role || ""}`.trim();
      if (p.status === "Completed") {
        if (p.amountSlab === ">10L") upsert("project_completed_gt_10_lakhs", label, "", p.enclosureNo, 1);
        else upsert("project_completed_lt_10_lakhs", label, "", p.enclosureNo, 1);
      } else if (p.status === "Ongoing") {
        if (p.amountSlab === ">10L") upsert("project_ongoing_gt_10_lakhs", label, "", p.enclosureNo, 1);
        else upsert("project_ongoing_lt_10_lakhs", label, "", p.enclosureNo, 1);
      }
    });

    research.guidance.forEach((g) => {
      if (!g.degree || !g.status) return;
      const count = Number(g.count || 0) || 1;
      const label = `${g.degree || ""} ${g.status || ""}`.trim();
      if (g.degree === "PhD" && g.status === "Awarded") upsert("phd_awarded", label, g.year, g.enclosureNo, count);
      if (g.degree === "PhD" && g.status === "Submitted") upsert("mphil_submitted", label, g.year, g.enclosureNo, count);
      if (g.degree === "PG") upsert("pg_dissertation_awarded", label, g.year, g.enclosureNo, count);
    });

    research.moocsIct.forEach((m) => {
      if (!m.category || !m.role) return;
      const label = `${m.category || ""} ${m.role || ""}`.trim();
      if (m.category === "MOOC") {
        if (m.role === "Course Coordinator") upsert("mooc_course_coordinator", label, m.year, m.enclosureNo, 1);
        else if (m.role === "Per Module") upsert("mooc_per_module", label, m.year, m.enclosureNo, 1);
        else if (m.role === "4 Quadrant Course") upsert("mooc_complete_4_quadrant", label, m.year, m.enclosureNo, 1);
        else upsert("mooc_content_writer", label, m.year, m.enclosureNo, 1);
      }
      if (m.category === "E-Content") {
        if (m.role === "Complete Course") upsert("econtent_complete_course", label, m.year, m.enclosureNo, 1);
        else if (m.role === "Per Module") upsert("econtent_4quadrant_per_module", label, m.year, m.enclosureNo, 1);
        else if (m.role === "Contribution") upsert("econtent_module_contribution", label, m.year, m.enclosureNo, 1);
        else if (m.role === "Editor") upsert("econtent_editor", label, m.year, m.enclosureNo, 1);
        else upsert("econtent_module_contribution", label, m.year, m.enclosureNo, 1);
      }
      if (m.category === "Curriculum Design") {
        if (m.role === "Development of Innovative Pedagogy") {
          upsert("innovative_pedagogy_development", label, m.year, m.enclosureNo, 1);
        } else {
          upsert("new_curriculum", label, m.year, m.enclosureNo, 1);
        }
      }
    });

    research.consultancyPolicy.forEach((c) => {
      if (!c.category) return;
      const label = `${c.category || ""} ${c.level || ""}`.trim();
      if (c.category === "Consultancy") upsert("consultancy", label, "", c.enclosureNo, 1);
      if (c.category === "Policy Document") {
        if (!c.level) return;
        if (c.level === "International") upsert("policy_international", label, "", c.enclosureNo, 1);
        else if (c.level === "National") upsert("policy_national", label, "", c.enclosureNo, 1);
        else if (c.level === "State") upsert("policy_state", label, "", c.enclosureNo, 1);
      }
    });

    research.awards.forEach((a) => {
      if (!a.level) return;
      const label = a.title || a.level || "Award";
      if (a.level === "International") upsert("award_international", label, a.year, a.enclosureNo, 1);
      else upsert("award_national", label, a.year, a.enclosureNo, 1);
    });

    research.patents.forEach((p) => {
      if (!p.type) return;
      const label = `${p.type || ""} ${p.status || ""}`.trim();
      if (p.type === "International") upsert("patent_international", label, "", p.enclosureNo, 1);
      else upsert("patent_national", label, "", p.enclosureNo, 1);
    });

    research.invitedTalks.forEach((t) => {
      if (!t.level) return;
      const label = `${t.role || ""} ${t.level || ""}`.trim();
      if (t.level === "International Abroad") upsert("invited_lecture_international_abroad", label, t.year, t.enclosureNo, 1);
      else if (t.level === "International India") upsert("invited_lecture_international_india", label, t.year, t.enclosureNo, 1);
      else if (t.level === "National") upsert("invited_lecture_national", label, t.year, t.enclosureNo, 1);
      else upsert("invited_lecture_state_university", label, t.year, t.enclosureNo, 1);
    });

    return Object.values(entriesMap).map((entry) => ({
      type: entry.type,
      count: entry.count,
      title: entry._titles.length ? Array.from(new Set(entry._titles)).join("; ") : "",
      year: entry.year || "",
      enclosure_no: entry.enclosure_no || ""
    }));
  };


  const buildPBASScores = () => {
    const mapped = deriveBucketsFromStep2B();
    const totalAssigned = teachingActivities.reduce(
      (s, t) => s + Number(t.totalClassesAssigned || 0),
      0
    );

    const totalConducted = teachingActivities.reduce(
      (s, t) => s + Number(t.classesConducted || 0),
      0
    );

    const teaching_process =
      totalAssigned > 0
        ? Math.min(
          Math.round((totalConducted / totalAssigned) * 25),
          25
        )
        : 0;

    const feedback = Math.min(
      studentFeedback.reduce(
        (s, f) => s + Number(f.averageScore || 0),
        0
      ),
      25
    );

    const department = Math.min(
      mapped.departmental.reduce(
        (s, a) => s + Number(a.credits_claimed || a.credit || 0),
        0
      ),
      20
    );

    const institute = Math.min(
      mapped.institute.reduce(
        (s, a) => s + Number(a.credits_claimed || a.credit || 0),
        0
      ),
      10
    );

    const society = Math.min(
      mapped.society.reduce(
        (s, a) => s + Number(a.credits_claimed || a.credit || 0),
        0
      ),
      10
    );

    const acr = acrDetails.acrAvailable === "Yes" ? 10 : 0;

    return {
      teaching_process,
      feedback,
      department,
      institute,
      society,
      acr
    };
  };


  const buildPBASCounts = () => {
    return {
      research: {
        journal_papers: research.papers.filter(
          p => p.ugcCare === "Yes"
        ).length,
        conference_papers: 0
      },

      publications: {
        book_national: research.publications.filter(
          p => p.type === "Book" && p.publisherType === "National"
        ).length,

        book_international: research.publications.filter(
          p => p.type === "Book" && p.publisherType === "International"
        ).length
      },

      ict: {
        innovative_pedagogy: research.moocsIct.filter(
          m => m.category === "Curriculum Design"
        ).length,

        mooc: {
          module: research.moocsIct.reduce(
            (sum, m) => sum + Number(m.creditClaimed || 0),
            0
          )
        }
      },

      research_guidance: {
        phd_awarded: research.guidance.reduce(
          (sum, g) =>
            g.degree === "PhD" && g.status === "Awarded"
              ? sum + Number(g.count || 0)
              : sum,
          0
        )
      },

      patents: {
        international: research.patents.filter(
          p => p.type === "International" && p.status === "Granted"
        ).length
      },

      invited_lectures: {
        national: research.invitedTalks.filter(
          t => t.level === "National"
        ).length
      }
    };
  };


  const handleSubmitForm = async () => {
    const step1Errors = validateStep1();
    if (Object.keys(step1Errors).length > 0) {
      setCurrentStep(1);
      showValidationSummary(step1Errors);
      return;
    }

    const step2Errors = validateStep2();
    if (Object.keys(step2Errors).length > 0) {
      setCurrentStep(2);
      showValidationSummary(step2Errors);
      return;
    }

    const sppuErrors = validateSPPU();
    if (Object.keys(sppuErrors).length > 0) {
      setCurrentStep(2);
      showValidationSummary(sppuErrors);
      return;
    }

    const step3CreditErrors = validateStep3Credits();
    if (Object.keys(step3CreditErrors).length > 0) {
      setErrors((prev) => ({ ...prev, ...step3CreditErrors }));
      setCurrentStep(3);
      showValidationSummary(step3CreditErrors);
      return;
    }
    // 1️⃣ Declaration check
    if (!declarationAccepted) {
      alert("Please accept the declaration.");
      return;
    }

    // 2️⃣ Final confirmation
    const confirmed = window.confirm(
      "Once submitted, the form cannot be edited. Continue?"
    );
    if (!confirmed) return;

    try {
      setIsProcessing(true);
      setProcessingNotice("Do not refresh. Form is being processed.");
      // 3️⃣ Build payload (ONLY ONCE)
      const payload = buildBackendPayload("submit");


      // 4️⃣ API call
      let url = submitEndpoint;
      if (appraisalId && appraisalStatus !== "DRAFT") {
        url = isHOD
          ? `/hod/resubmit/${appraisalId}/`
          : `/faculty/appraisal/${appraisalId}/resubmit/`;
      }

      await API.post(url, payload, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("access")}`
        }
      });



      // 5️⃣ Post-submit actions
      setFormStatus("submitted");
      localStorage.removeItem("facultyDraft");

      alert(
        isHOD
          ? "Appraisal submitted and sent to Principal for review."
          : "Appraisal submitted and sent to HOD for review."
      );
      setProcessingNotice("Processing complete. You may continue.");
      navigate(isHOD ? "/HOD/dashboard" : "/faculty/dashboard");


    } catch (error) {
      // 6️⃣ Proper error handling
      console.error("❌ SUBMISSION ERROR");
      console.error("Status:", error.response?.status);
      console.error("Response:", error.response?.data);
      console.error("Full error:", error);

      const message = error?.response?.data?.error || "Submission failed. Please try again.";
      alert(message);
      setProcessingNotice("");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleStep3Next = async () => {
    const step3CreditErrors = validateStep3Credits();
    if (Object.keys(step3CreditErrors).length > 0) {
      setErrors((prev) => ({ ...prev, ...step3CreditErrors }));
      showValidationSummary(step3CreditErrors);
      return;
    }
    const saved = await handleSaveDraft(true);
    if (!saved) {
      alert("Please save before moving to the next step.");
      return;
    }
    setCurrentStep(4);
  };

  // ================= DEPARTMENTAL ACTIVITIES HANDLERS =================
  const handleDeptChange = (index, field, value) => {
    setDepartmentalActivities(prev => {
      const copy = [...prev];
      copy[index][field] = value;
      if (field === "section_key") {
        copy[index].activity = "";
        copy[index].otherActivity = "";
      }
      return copy;
    });
    if (field === "credit") {
      setErrors((prev) => {
        const copy = { ...prev };
        delete copy[`dept_${index}_credit`];
        delete copy.department_total;
        return copy;
      });
    }
  };

  const handleInstituteChange = (index, field, value) => {
    setInstituteActivities((prev) => {
      const copy = [...prev];
      copy[index][field] = value;
      return copy;
    });
    if (field === "credit" || field === "activity") {
      setErrors((prev) => {
        const copy = { ...prev };
        delete copy[`inst_${index}_credit`];
        delete copy.institute_total;
        return copy;
      });
    }
  };

  const handleSocietyChange = (index, field, value) => {
    setSocietyActivities((prev) => {
      const copy = [...prev];
      copy[index][field] = value;
      return copy;
    });
    if (field === "credit") {
      setErrors((prev) => {
        const copy = { ...prev };
        delete copy[`soc_${index}_credit`];
        delete copy.society_total;
        return copy;
      });
    }
  };

  const addDeptRow = () => {
    setDepartmentalActivities(prev => [
      ...prev,
      {
        semester: "",
        section_key: "",
        activity: "",
        credit: "",
        criteria: "",
        enclosureNo: "",
        otherActivity: ""
      }
    ]);
  };

  const removeDeptRow = (index) => {
    setDepartmentalActivities(prev =>
      prev.length > 1 ? prev.filter((_, i) => i !== index) : prev
    );
  };

  // ===== STEP 4 HANDLERS (RESEARCH SECTION) =====
  const handleResearchChange = (section, index, field, value) => {
    setResearch(prev => {
      const updated = [...prev[section]];
      updated[index][field] = value;
      return { ...prev, [section]: updated };
    });
  };

  const addResearchRow = (section, emptyRow) => {
    setResearch(prev => ({ ...prev, [section]: [...prev[section], emptyRow] }));
  };

  const removeResearchRow = (section, index) => {
    setResearch(prev => ({
      ...prev,
      [section]: prev[section].filter((_, i) => i !== index)
    }));
  };

  const handleStudentFeedbackChange = (index, field, value) => {
    setStudentFeedback(prev => {
      const copy = [...prev];
      copy[index][field] = value;
      return copy;
    });
  };

  const addStudentFeedbackRow = () => {
    setStudentFeedback(prev => [
      ...prev,
      {
        semester: "",
        courseCode: "",
        courseName: "",
        averageScore: "",
        enclosureNo: ""
      }
    ]);
  };

  const removeStudentFeedbackRow = (index) => {
    setStudentFeedback(prev =>
      prev.length > 1 ? prev.filter((_, i) => i !== index) : prev
    );
  };

  const handleAcrChange = (e) => {
    const { name, value } = e.target;
    setAcrDetails(prev => ({ ...prev, [name]: value }));
  };

  /* ================= RENDER ================= */
  return (
    <div className="form-container">
      <div className="form-header">
        <h2 className="form-title">Faculty Appraisal Form</h2>
        <div className="header-actions">
          <button
            className="btn-logout"
            onClick={() => navigate("/login")}
          >
            Logout
          </button>
        </div>
      </div>

      {processingNotice && (
        <div style={{
          background: "#fffbeb",
          border: "1px solid #fde68a",
          color: "#92400e",
          padding: "12px",
          borderRadius: "8px",
          marginBottom: "12px",
          marginTop: "12px"
        }}>
          {processingNotice}
          {isProcessing ? " Please wait..." : ""}
        </div>
      )}

      {remarks && (
        <div style={{
          background: "#fffbeb",
          border: "1px solid #fde68a",
          color: "#92400e",
          padding: "16px",
          borderRadius: "8px",
          marginBottom: "20px",
          marginTop: "20px"
        }}>
          <strong style={{ display: "block", marginBottom: "4px" }}>Reviewer Remarks:</strong>
          <p style={{ margin: 0 }}>{remarks}</p>
        </div>
      )}

      {currentStep === 1 && (
        <div className="form-section">
          <h3>Step 1: General Information</h3>
          <fieldset
            disabled={formStatus === "submitted"}
            style={{ border: "none", padding: 0 }}
          >
            <p className="section-note">
              This information will be used for both SPPU and PBAS appraisal forms.
              Fields marked with <span className="required">*</span> are compulsory.
            </p>

            <div className="form-grid">

              <div className="form-group">
                <label>
                  Faculty Name <span className="required">*</span>
                </label>
                <input
                  name="facultyName"
                  value={generalInfo.facultyName}
                  onChange={handleGeneralChange}
                />
                {errors.facultyName && (
                  <div className="field-error">{errors.facultyName}</div>
                )}
              </div>

              <div className="form-group">
                <label>
                  Designation <span className="required">*</span>
                </label>
                <input
                  name="designation"
                  value={generalInfo.designation}
                  onChange={handleGeneralChange}
                />
                {errors.designation && (
                  <div className="field-error">{errors.designation}</div>
                )}
              </div>

              <div className="form-group">
                <label>
                  Department / Centre <span className="required">*</span>
                </label>
                <input
                  name="department"
                  value={generalInfo.department}
                  onChange={handleGeneralChange}
                />
                {errors.department && (
                  <div className="field-error">{errors.department}</div>
                )}
              </div>

              <div className="form-group">
                <label>
                  Date of Joining <span className="required">*</span>
                </label>
                <input
                  type="date"
                  name="dateOfJoining"
                  value={generalInfo.dateOfJoining}
                  onChange={handleGeneralChange}
                />
              </div>

              <div className="form-group">
                <label>
                  Email ID <span className="required">*</span>
                </label>
                <input
                  type="email"
                  name="email"
                  value={generalInfo.email}
                  onChange={handleGeneralChange}
                />
              </div>

              <div className="form-group">
                <label>
                  Mobile Number <span className="required">*</span>
                </label>
                <input
                  type="tel"
                  name="mobile"
                  value={generalInfo.mobile}
                  onChange={handleGeneralChange}
                />
              </div>

              <div className="form-group full">
                <label>
                  Communication Address <span className="required">*</span>
                </label>
                <textarea
                  rows={3}
                  name="communicationAddress"
                  value={generalInfo.communicationAddress}
                  onChange={handleGeneralChange}
                />
              </div>

              <div className="form-group">
                <label>
                  Current Designation (Present Position)
                  <span className="required">*</span>
                </label>
                <input
                  name="currentDesignation"
                  value={generalInfo.currentDesignation}
                  onChange={handleGeneralChange}
                />
              </div>

              <div className="form-group">
                <label>
                  Pay Level / Grade Pay <span className="required">*</span>
                </label>
                <input
                  name="payLevel"
                  value={generalInfo.payLevel}
                  onChange={handleGeneralChange}
                  placeholder="e.g. Level 13A / AGP 8000"
                />
              </div>

              <div className="form-group">
                <label>Promotion Designation (if any)</label>
                <input
                  name="promotionDesignation"
                  value={generalInfo.promotionDesignation}
                  onChange={handleGeneralChange}
                />
              </div>

              <div className="form-group">
                <label>Promotion Date</label>
                <input
                  type="date"
                  name="promotionDate"
                  value={generalInfo.promotionDate}
                  onChange={handleGeneralChange}
                />
              </div>

              <div className="form-group">
                <label>Date of Eligibility</label>
                <input
                  type="date"
                  name="eligibilityDate"
                  value={generalInfo.eligibilityDate}
                  onChange={handleGeneralChange}
                />
              </div>

              <div className="form-group">
                <label>
                  Academic Year (Assessment Period)
                  <span className="required">*</span>
                </label>
                <input
                  name="academicYear"
                  value={generalInfo.academicYear}
                  onChange={handleGeneralChange}
                />
              </div>

            </div>
          </fieldset>

          <div className="form-actions">
            <button
              type="button"
              className="btn-primary"
              onClick={() => {
                const validationErrors = validateStep1();
                if (Object.keys(validationErrors).length === 0) {
                  handleSaveAndNext(); // this should setCurrentStep(2)
                } else {
                  showValidationSummary(validationErrors);
                }
              }}
            >
              Next →
            </button>
          </div>
        </div>
      )
      }



      {/* ================= SECTION 2 ================= */}
      {/* ================= STEP 2 ================= */}
      {
        currentStep === 2 && (
          <div className="form-section">

            {/* ================= TEACHING ================= */}
            <h3>
              Step 2A: Teaching Process (Category I)
              <span className="required">*</span>
            </h3>

            <fieldset
              disabled={formStatus === "submitted"}
              style={{ border: "none", padding: 0 }}
            >
              <p className="section-note">
                Fields marked with <span className="required">*</span> are compulsory.
                At least one teaching entry must be provided.
              </p>

              {teachingActivities.map((row, index) => (
                <div className="entry-card" key={index}>

                  <div className="entry-header">
                    <h4>Teaching Entry {index + 1}</h4>

                    {teachingActivities.length > 1 && (
                      <button
                        type="button"
                        className="btn-remove"
                        onClick={() => removeTeachingRow(index)}
                      >
                        Remove
                      </button>
                    )}
                  </div>

                  {/* ROW 1 */}
                  <div className="form-row">
                    <div className="form-group">
                      <label>Academic Year <span className="required">*</span></label>
                      <select
                        name="academicYear"
                        value={row.academicYear}
                        onChange={(e) => handleTeachingChange(index, e)}
                      >
                        {ACADEMIC_YEARS.map((year) => (
                          <option key={year} value={year}>{year}</option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group">
                      <label>Semester <span className="required">*</span></label>
                      <select
                        name="semester"
                        value={row.semester}
                        onChange={(e) => handleTeachingChange(index, e)}
                      >
                        <option value="">-- Select Semester --</option>
                        {SEMESTERS.map((sem) => (
                          <option key={sem} value={sem}>{sem}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* ROW 2 */}
                  <div className="form-row">
                    <div className="form-group">
                      <label>Course Code <span className="required">*</span></label>
                      <input
                        name="courseCode"
                        placeholder="e.g. CSL301"
                        value={row.courseCode}
                        onChange={(e) => handleTeachingChange(index, e)}
                      />
                    </div>

                    <div className="form-group">
                      <label>Course Name <span className="required">*</span></label>
                      <input
                        name="courseName"
                        placeholder="e.g.Database Management Systems"
                        value={row.courseName}
                        onChange={(e) => handleTeachingChange(index, e)}
                      />
                    </div>
                  </div>

                  {/* ROW 3 */}
                  <div className="form-row three">
                    <div className="form-group">
                      <label>Class / Division</label>
                      <input
                        name="classDivision"
                        value={row.classDivision}
                        onChange={(e) => handleTeachingChange(index, e)}
                      />
                    </div>

                    <div className="form-group">
                      <label>Teaching Type <span className="required">*</span></label>
                      <select
                        name="teachingType"
                        value={row.teachingType}
                        onChange={(e) => handleTeachingChange(index, e)}
                      >
                        <option value="">-- Select Type --</option>
                        {TEACHING_TYPES.map((type) => (
                          <option key={type} value={type}>{type}</option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group">
                      <label>Level</label>
                      <select
                        name="academicLevel"
                        value={row.academicLevel}
                        onChange={(e) => handleTeachingChange(index, e)}
                      >
                        <option value="">-- Select Level --</option>
                        {ACADEMIC_LEVELS.map((level) => (
                          <option key={level} value={level}>{level}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* ROW 4 */}
                  <div className="form-row">
                    <div className="form-group">
                      <label>Total Classes Assigned <span className="required">*</span></label>
                      <input
                        type="number"
                        placeholder="e.g: 3"
                        name="totalClassesAssigned"
                        value={row.totalClassesAssigned}
                        onChange={(e) => handleTeachingChange(index, e)}
                      />
                    </div>

                    <div className="form-group">
                      <label>Classes Conducted <span className="required">*</span></label>
                      <input
                        type="number"
                        name="classesConducted"
                        placeholder="e.g: 45"
                        value={row.classesConducted}
                        onChange={(e) => handleTeachingChange(index, e)}
                      />
                    </div>
                  </div>

                  {/* ROW 5 */}
                  <div className="form-row full">
                    <div className="form-group">
                      <label>Enclosure / Proof Reference</label>
                      <input
                        name="enclosureNo"
                        value={row.enclosureNo}
                        onChange={(e) => handleTeachingChange(index, e)}
                      />
                    </div>
                  </div>

                </div>
              ))}

              <button
                type="button"
                className="add-row-btn"
                onClick={addTeachingRow}
              >
                + Add Teaching Entry
              </button>

              <hr />


              {/* ================= SPPU INVOLVEMENT ================= */}
              <h3>Step 2B: Involvement in University / College Activities (SPPU)</h3>

              <p className="section-note">
                Add activities here first. They are auto-mapped to Departmental / Institutional / Society tables in the next step.
              </p>

              {step2bActivities.map((row, index) => {
                const activityOptions = getSectionActivities(row.section_key);
                const maxCredit = getMaxCreditForSelection(row.section_key, row.activity, row.activityType);
                const mappedScope = getScopeForSelection(row.section_key, row.activity || row.otherActivity, row.activityType);
                const scopeLabel = getScopeLabel(mappedScope);
                const sectionLabel = activitySections.find((s) => s.section_key === row.section_key)?.label || "-";

                return (
                  <div className="activity-card" key={row.id || index}>
                    <div className="activity-row">
                      <select
                        value={row.section_key}
                        onChange={(e) => {
                          const section_key = e.target.value;
                          setStep2bActivities((prev) => {
                            const copy = [...prev];
                            const next = { ...copy[index] };
                            next.section_key = section_key;
                            next.activity = "";
                            next.credit = "";
                            copy[index] = next;
                            return copy;
                          });
                        }}
                      >
                        <option value="">Select Source Activity</option>
                        {STEP2_SOURCE_ACTIVITY_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>

                      <select
                        value={row.activity}
                        disabled={!row.section_key}
                        onChange={(e) => {
                          const activity = e.target.value;
                          setStep2bActivities((prev) => {
                            const copy = [...prev];
                            const next = { ...copy[index] };
                            next.activity = activity;
                            const nextMax = getMaxCreditForSelection(next.section_key, activity, next.activityType);
                            if (!next.credit || Number(next.credit) <= 0) {
                              next.credit = nextMax > 0 ? String(nextMax) : "";
                            }
                            copy[index] = next;
                            return copy;
                          });
                        }}
                      >
                        <option value="">Select Activity</option>
                        {activityOptions.map((act, i) => (
                          <option key={row.section_key + "_" + i} value={act}>{act}</option>
                        ))}
                      </select>

                      <select
                        value={row.isInvolved}
                        onChange={(e) => {
                          const isInvolved = e.target.value;
                          setStep2bActivities((prev) => {
                            const copy = [...prev];
                            copy[index] = { ...copy[index], isInvolved: "Yes" };
                            return copy;
                          });
                          if (isInvolved !== "Yes") {
                            alert("All Step 2B rows are treated as included for mapping. 'No' is ignored.");
                          }
                        }}
                      >
                        <option value="Yes">Yes</option>
                        <option value="No">No</option>
                      </select>

                      <input
                        type="number"
                        min="0"
                        placeholder="Credit"
                        value={row.credit}
                        onChange={(e) => {
                          const credit = e.target.value;
                          setStep2bActivities((prev) => {
                            const copy = [...prev];
                            const next = { ...copy[index], credit };
                            const maxCredit = getMaxCreditForSelection(next.section_key, next.activity || next.otherActivity, next.activityType);
                            let numeric = Number(next.credit || 0);
                            if (!Number.isFinite(numeric) || numeric < 0) numeric = 0;
                            if (maxCredit > 0 && numeric > maxCredit) {
                              alert(`Credit cannot exceed ${maxCredit} for selected activity. Value has been adjusted.`);
                              numeric = maxCredit;
                            }
                            next.credit = String(numeric);
                            copy[index] = next;

                            const totals = { departmental: 0, institute: 0, society: 0 };
                            copy.forEach((item) => {
                              const activityName = item.otherActivity?.trim() || item.activity || "";
                              if (!item.section_key || !activityName) return;
                              const scope = getScopeForSelection(item.section_key, activityName, item.activityType);
                              const value = Number(item.credit || 0);
                              if (!Number.isFinite(value) || value < 0) return;
                              if (scope === "departmental") totals.departmental += value;
                              if (scope === "institute") totals.institute += value;
                              if (scope === "society") totals.society += value;
                            });
                            if (totals.departmental > 20) {
                              alert("Total departmental credits cannot exceed 20. Please reduce credits.");
                            } else if (totals.institute > 10) {
                              alert("Total institutional credits cannot exceed 10. Please reduce credits.");
                            } else if (totals.society > 10) {
                              alert("Total society credits cannot exceed 10. Please reduce credits.");
                            }
                            return copy;
                          });
                        }}
                      />
                    </div>

                    <div className="activity-row">
                      <input
                        placeholder="Semester / Year"
                        value={row.semester}
                        onChange={(e) => {
                          const semester = e.target.value;
                          setStep2bActivities((prev) => {
                            const copy = [...prev];
                            copy[index] = { ...copy[index], semester };
                            return copy;
                          });
                        }}
                      />

                      <input
                        placeholder="Criteria (optional)"
                        value={row.criteria}
                        onChange={(e) => {
                          const criteria = e.target.value;
                          setStep2bActivities((prev) => {
                            const copy = [...prev];
                            copy[index] = { ...copy[index], criteria };
                            return copy;
                          });
                        }}
                      />

                      <input
                        placeholder="Enclosure No."
                        value={row.enclosureNo}
                        onChange={(e) => {
                          const enclosureNo = e.target.value;
                          setStep2bActivities((prev) => {
                            const copy = [...prev];
                            copy[index] = { ...copy[index], enclosureNo };
                            return copy;
                          });
                        }}
                      />

                      <div className="section-note" style={{ marginTop: "4px" }}>
                        Max credit: {maxCredit || "-"} | Selected source: {sectionLabel} | Auto-mapped to: {scopeLabel}
                      </div>

                      {step2bActivities.length > 1 && (
                        <button
                          type="button"
                          className="btn-remove"
                          onClick={() => setStep2bActivities((prev) => prev.filter((_, i) => i !== index))}
                        >
                          x
                        </button>
                      )}
                    </div>

                    {String(row.activity || "").toLowerCase().includes("any other") && (
                      <div className="activity-row">
                        <input
                          placeholder={"Specify other " + scopeLabel.toLowerCase() + " activity"}
                          value={row.otherActivity}
                          onChange={(e) => {
                            const otherActivity = e.target.value;
                            setStep2bActivities((prev) => {
                              const copy = [...prev];
                              copy[index] = { ...copy[index], otherActivity };
                              return copy;
                            });
                          }}
                        />
                      </div>
                    )}
                  </div>
                );
              })}

              <button
                type="button"
                className="btn-outline"
                onClick={() => setStep2bActivities((prev) => [...prev, createStep2BRow()])}
              >
                + Add Activity Row
              </button>

            </fieldset>
            {/* NAVIGATION */}
            <div className="form-actions">
              <button
                type="button"
                className="btn-back"
                onClick={() => setCurrentStep(1)}
              >
                ← Back
              </button>

              <button
                type="button"
                className="btn-primary"
                onClick={async () => {
                  const teachingErrors = validateStep2();
                  if (Object.keys(teachingErrors).length > 0) {
                    showValidationSummary(teachingErrors);
                    return;
                  }
                  const sppuErrors = validateSPPU();
                  if (Object.keys(sppuErrors).length > 0) {
                    showValidationSummary(sppuErrors);
                    return;
                  }
                  const saved = await handleSaveDraft(true);
                  if (!saved) {
                    alert("Please save before moving to the next step.");
                    return;
                  }
                  setCurrentStep(3);
                }}
              >
                Next →
              </button>

            </div>

          </div>
        )
      }

      {
        currentStep === 3 && (

          <div className="form-section">
            <fieldset
              disabled={formStatus === "submitted"}
              style={{ border: "none", padding: 0 }}
            >
              <h4>A. ACR Details</h4>

              <div className="activity-card">
                <div className="activity-row">
                  <input
                    name="year"
                    placeholder="ACR Year (e.g. 2024-25)"
                    value={acrDetails.year}
                    onChange={handleAcrChange}
                  />

                  <select
                    name="acrAvailable"
                    value={acrDetails.acrAvailable}
                    onChange={handleAcrChange}
                  >
                    <option value="">Is ACR Available?</option>
                    <option value="Yes">Yes</option>
                    <option value="No">No</option>
                  </select>

                  <input
                    name="enclosureNo"
                    placeholder="Enclosure No."
                    value={acrDetails.enclosureNo}
                    onChange={handleAcrChange}
                  />
                  {/*new added */}
                  {/*  Credit Points Input */}

                  <input
                    type="number"
                    name="creditPoints"
                    placeholder="Credit Points"
                    value={acrDetails.creditPoints}
                    onChange={handleAcrChange}
                    min="0"
                  />
                </div>
              </div>



              <hr />

              <h4>B. Student Feedback (Max Point 25)</h4>

              {studentFeedback.map((row, index) => (
                <div className="activity-card" key={index}>

                  {/* ROW 1 */}
                  <div className="activity-row">
                    <input
                      placeholder="Semester (e.g. 1/2024-25)"
                      value={row.semester}
                      onChange={(e) =>
                        handleStudentFeedbackChange(index, "semester", e.target.value)
                      }
                    />

                    <input
                      placeholder="Course Code"
                      value={row.courseCode}
                      onChange={(e) =>
                        handleStudentFeedbackChange(index, "courseCode", e.target.value)
                      }
                    />

                    <input
                      placeholder="Course Name"
                      value={row.courseName}
                      onChange={(e) =>
                        handleStudentFeedbackChange(index, "courseName", e.target.value)
                      }
                    />
                  </div>

                  {/* ROW 2 */}
                  <div className="activity-row">
                    <input
                      type="number"
                      min="0"
                      max="25"
                      placeholder="Average Feedback (out of 25)"
                      value={row.averageScore}
                      onChange={(e) =>
                        handleStudentFeedbackChange(index, "averageScore", e.target.value)
                      }
                    />

                    <input
                      placeholder="Enclosure No."
                      value={row.enclosureNo}
                      onChange={(e) =>
                        handleStudentFeedbackChange(index, "enclosureNo", e.target.value)
                      }
                    />

                    {studentFeedback.length > 1 ? (
                      <button
                        type="button"
                        className="btn-remove"
                        onClick={() => removeStudentFeedbackRow(index)}
                      >
                        ✕
                      </button>
                    ) : (
                      <div />
                    )}
                  </div>

                </div>
              ))}

              <button
                type="button"
                className="btn-outline"
                onClick={addStudentFeedbackRow}
              >
                + Add Student Feedback Entry
              </button>
              <hr />
            </fieldset>
            {/* ================= NAVIGATION ================= */}
            <div className="form-actions">
              <button
                type="button"
                className="btn-back"
                onClick={() => setCurrentStep(2)}
              >
                ← Back
              </button>

              <button
                type="button"
                className="btn-primary"
                onClick={handleStep3Next}
              >
                Next →
              </button>
            </div>

          </div>
        )
      }

      {/* ================= STEP 4: RESEARCH & ACADEMIC CONTRIBUTIONS ================= */}
      {
        currentStep === 4 && (
          <div className="form-section">

            <h3>Step 4: Research & Academic Contributions</h3>
            <fieldset
              disabled={formStatus === "submitted"}
              style={{ border: "none", padding: 0 }}
            >
              {/* ========== 1. RESEARCH PAPERS ========== */}
              <h4>1. Research Papers</h4>


              {research.papers.map((row, index) => (
                <div className="research-card" key={index}>

                  <input placeholder="Title"
                    value={row.title}
                    onChange={e => handleResearchChange("papers", index, "title", e.target.value)}
                  />

                  <input placeholder="Journal"
                    value={row.journal}
                    onChange={e => handleResearchChange("papers", index, "journal", e.target.value)}
                  />

                  <select
                    value={row.ugcCare}
                    onChange={e => handleResearchChange("papers", index, "ugcCare", e.target.value)}
                  >
                    <option value="">UGC CARE?</option>
                    <option value="Yes">Yes</option>
                    <option value="No">No</option>
                  </select>

                  <select
                    value={row.authorship}
                    onChange={e => handleResearchChange("papers", index, "authorship", e.target.value)}
                  >
                    <option value="">Authorship</option>
                    <option value="Single">Single</option>
                    <option value="First">First / Corresponding</option>
                    <option value="Co-author">Co-author</option>
                  </select>

                  <input placeholder="Impact Factor"
                    value={row.impactFactor}
                    onChange={e => handleResearchChange("papers", index, "impactFactor", e.target.value)}
                  />

                  <input placeholder="Year"
                    value={row.year}
                    onChange={e => handleResearchChange("papers", index, "year", e.target.value)}
                  />

                  <input placeholder="Enclosure No"
                    value={row.enclosureNo}
                    onChange={e => handleResearchChange("papers", index, "enclosureNo", e.target.value)}
                  />

                  {research.papers.length > 1 && (
                    <button className="btn-remove-small" onClick={() => removeResearchRow("papers", index)}>✕</button>
                  )}
                </div>
              ))}

              <button className="btn-add" onClick={() =>
                addResearchRow("papers", {
                  title: "", journal: "", ugcCare: "",
                  impactFactor: "", authorship: "",
                  year: "", enclosureNo: ""
                })
              }>
                + Add Paper
              </button>

              <hr />

              {/* ========== 2. PUBLICATIONS ========== */}
              <h4>2. Books / Chapters / Publications</h4>

              {research.publications.map((row, index) => (
                <div className="research-card" key={index}>

                  <select
                    value={row.type}
                    onChange={e => handleResearchChange("publications", index, "type", e.target.value)}
                  >
                    <option value="">Type</option>
                    <option value="Book">Book</option>
                    <option value="Chapter">Chapter</option>
                    <option value="Editor">Editor</option>
                    <option value="Translation">Translation</option>
                  </select>

                  <select
                    value={row.publisherType}
                    onChange={e => handleResearchChange("publications", index, "publisherType", e.target.value)}
                  >
                    <option value="">Publisher</option>
                    <option value="International">International</option>
                    <option value="National">National</option>
                  </select>

                  {row.type === "Translation" && (
                    <select
                      value={row.translationType || ""}
                      onChange={e => handleResearchChange("publications", index, "translationType", e.target.value)}
                    >
                      <option value="">Translation Type</option>
                      <option value="Chapter/Research Paper">Chapter / Research Paper</option>
                      <option value="Book">Book</option>
                    </select>
                  )}

                  <input placeholder="Title"
                    value={row.title}
                    onChange={e => handleResearchChange("publications", index, "title", e.target.value)}
                  />

                  <input placeholder="Year"
                    value={row.year}
                    onChange={e => handleResearchChange("publications", index, "year", e.target.value)}
                  />

                  <input placeholder="Enclosure No"
                    value={row.enclosureNo}
                    onChange={e => handleResearchChange("publications", index, "enclosureNo", e.target.value)}
                  />

                  <button className="btn-remove-small" onClick={() => removeResearchRow("publications", index)}>✕</button>
                </div>
              ))}

              <button className="btn-add" onClick={() =>
                addResearchRow("publications", {
                  type: "", title: "",
                  publisherType: "", translationType: "", year: "",
                  enclosureNo: ""
                })
              }>
                + Add Publication
              </button>

              <hr />

              {/* ========== 3. RESEARCH PROJECTS ========== */}
              <h4>3. Research Projects</h4>

              {research.projects.map((row, index) => (
                <div className="research-card" key={index}>

                  <select
                    value={row.status}
                    onChange={e => handleResearchChange("projects", index, "status", e.target.value)}
                  >
                    <option value="">Status</option>
                    <option value="Completed">Completed</option>
                    <option value="Ongoing">Ongoing</option>
                  </select>

                  <select
                    value={row.amountSlab}
                    onChange={e => handleResearchChange("projects", index, "amountSlab", e.target.value)}
                  >
                    <option value="">Grant</option>
                    <option value=">10L">More than 10 Lakhs</option>
                    <option value="<10L">Less than 10 Lakhs</option>
                  </select>

                  <select
                    value={row.role}
                    onChange={e => handleResearchChange("projects", index, "role", e.target.value)}
                  >
                    <option value="">Role</option>
                    <option value="PI">PI</option>
                    <option value="Co-PI">Co-PI</option>
                  </select>

                  <input placeholder="Enclosure No"
                    value={row.enclosureNo}
                    onChange={e => handleResearchChange("projects", index, "enclosureNo", e.target.value)}
                  />

                  <button className="btn-remove-small" onClick={() => removeResearchRow("projects", index)}>✕</button>
                </div>
              ))}

              <button className="btn-add" onClick={() =>
                addResearchRow("projects", {
                  status: "", amountSlab: "",
                  role: "", enclosureNo: ""
                })
              }>
                + Add Project
              </button>

              <hr />

              {/* ========== 4. PATENTS ========== */}
              <h4>4. Patents</h4>

              {research.patents.map((row, index) => (
                <div className="research-card" key={index}>

                  <select
                    value={row.type}
                    onChange={e => handleResearchChange("patents", index, "type", e.target.value)}
                  >
                    <option value="">Type</option>
                    <option value="National">National</option>
                    <option value="International">International</option>
                  </select>

                  <select
                    value={row.status}
                    onChange={e => handleResearchChange("patents", index, "status", e.target.value)}
                  >
                    <option value="">Status</option>
                    <option value="Filed">Filed</option>
                    <option value="Granted">Granted</option>
                  </select>

                  <input placeholder="Enclosure No"
                    value={row.enclosureNo}
                    onChange={e => handleResearchChange("patents", index, "enclosureNo", e.target.value)}
                  />

                  <button className="btn-remove-small" onClick={() => removeResearchRow("patents", index)}>✕</button>
                </div>
              ))}

              <button className="btn-add" onClick={() =>
                addResearchRow("patents", {
                  type: "", status: "", enclosureNo: ""
                })
              }>
                + Add Patent
              </button>

              <hr />
              <hr />
              <h4>5. Research Guidance</h4>

              {research.guidance.map((row, index) => (
                <div className="research-card" key={index}>

                  <select
                    value={row.degree}
                    onChange={e =>
                      handleResearchChange("guidance", index, "degree", e.target.value)
                    }
                  >
                    <option value="">Degree</option>
                    <option value="PhD">Ph.D</option>
                    <option value="PG">PG</option>
                  </select>

                  <select
                    value={row.status}
                    onChange={e =>
                      handleResearchChange("guidance", index, "status", e.target.value)
                    }
                  >
                    <option value="">Status</option>
                    <option value="Awarded">Awarded</option>
                    <option value="Submitted">Submitted</option>
                  </select>

                  <input
                    type="number"
                    placeholder="Number of Students"
                    value={row.count}
                    onChange={e =>
                      handleResearchChange("guidance", index, "count", e.target.value)
                    }
                  />

                  <input
                    placeholder="Year"
                    value={row.year}
                    onChange={e =>
                      handleResearchChange("guidance", index, "year", e.target.value)
                    }
                  />

                  <input
                    placeholder="Enclosure No"
                    value={row.enclosureNo}
                    onChange={e =>
                      handleResearchChange("guidance", index, "enclosureNo", e.target.value)
                    }
                  />

                  <button
                    className="btn-remove-small"
                    onClick={() => removeResearchRow("guidance", index)}
                  >
                    ✕
                  </button>
                </div>
              ))}

              <button
                className="btn-add"
                onClick={() =>
                  addResearchRow("guidance", {
                    degree: "",
                    status: "",
                    count: "",
                    year: "",
                    enclosureNo: ""
                  })
                }
              >
                + Add Research Guidance
              </button>
              <hr />
              <h4>6. MOOCs / ICT Enabled Content</h4>

              {research.moocsIct.map((row, index) => (
                <div className="research-card" key={index}>

                  <select
                    value={row.category}
                    onChange={e =>
                      handleResearchChange("moocsIct", index, "category", e.target.value)
                    }
                  >
                    <option value="">Category</option>
                    <option value="MOOC">MOOC</option>
                    <option value="E-Content">E-Content</option>
                    <option value="Curriculum Design">Curriculum Design</option>
                  </select>

                  <select
                    value={row.role}
                    onChange={e =>
                      handleResearchChange("moocsIct", index, "role", e.target.value)
                    }
                  >
                    <option value="">Role</option>
                    <option value="4 Quadrant Course">4 Quadrant Course</option>
                    <option value="Course Coordinator">Course Coordinator</option>
                    <option value="Content Developer">Content Developer</option>
                    <option value="Module Writer">Module Writer</option>
                    <option value="Subject Expert">Subject Expert</option>
                    <option value="Complete Course">Complete Course</option>
                    <option value="Per Module">Per Module</option>
                    <option value="Contribution">Contribution</option>
                    <option value="Editor">Editor</option>
                    <option value="Development of Innovative Pedagogy">Development of Innovative Pedagogy</option>
                  </select>

                  <input
                    type="number"
                    placeholder="Number of Quadrants (1–4)"
                    min="1"
                    max="4"
                    value={row.creditClaimed}
                    onChange={e =>
                      handleResearchChange("moocsIct", index, "creditClaimed", e.target.value)
                    }
                  />

                  <input
                    placeholder="Year"
                    value={row.year}
                    onChange={e =>
                      handleResearchChange("moocsIct", index, "year", e.target.value)
                    }
                  />

                  <input
                    placeholder="Enclosure No"
                    value={row.enclosureNo}
                    onChange={e =>
                      handleResearchChange("moocsIct", index, "enclosureNo", e.target.value)
                    }
                  />

                  <button
                    className="btn-remove-small"
                    onClick={() => removeResearchRow("moocsIct", index)}
                  >
                    ✕
                  </button>
                </div>
              ))}

              <button
                className="btn-add"
                onClick={() =>
                  addResearchRow("moocsIct", {
                    category: "",
                    role: "",
                    creditClaimed: "",
                    year: "",
                    enclosureNo: ""
                  })
                }
              >
                + Add MOOCs / ICT Entry
              </button>
              <hr />
              <h4>7. Consultancy</h4>

              {research.consultancyPolicy.map((row, index) => (
                <div className="research-card" key={index}>

                  <select
                    value={row.category}
                    onChange={e =>
                      handleResearchChange("consultancyPolicy", index, "category", e.target.value)
                    }
                  >
                    <option value="">Type</option>
                    <option value="Consultancy">Consultancy</option>
                    <option value="Policy Document">Policy Document</option>
                  </select>

                  <select
                    value={row.level}
                    onChange={e =>
                      handleResearchChange("consultancyPolicy", index, "level", e.target.value)
                    }
                  >
                    <option value="">Level</option>
                    <option value="International">International</option>
                    <option value="National">National</option>
                    <option value="State">State</option>
                  </select>

                  <input
                    placeholder="Enclosure No"
                    value={row.enclosureNo}
                    onChange={e =>
                      handleResearchChange("consultancyPolicy", index, "enclosureNo", e.target.value)
                    }
                  />

                  <button
                    className="btn-remove-small"
                    onClick={() => removeResearchRow("consultancyPolicy", index)}
                  >
                    ✕
                  </button>
                </div>
              ))}

              <button
                className="btn-add"
                onClick={() =>
                  addResearchRow("consultancyPolicy", {
                    category: "",
                    level: "",
                    enclosureNo: ""
                  })
                }
              >
                + Add Consultancy / Policy Document
              </button>
              <hr />
              <h4>8. Awards / Fellowship</h4>

              {research.awards.map((row, index) => (
                <div className="research-card" key={index}>

                  <select
                    value={row.level}
                    onChange={e =>
                      handleResearchChange("awards", index, "level", e.target.value)
                    }
                  >
                    <option value="">Level</option>
                    <option value="International">International</option>
                    <option value="National">National</option>
                  </select>

                  <input
                    placeholder="Award Title"
                    value={row.title}
                    onChange={e =>
                      handleResearchChange("awards", index, "title", e.target.value)
                    }
                  />

                  <input
                    placeholder="Year"
                    value={row.year}
                    onChange={e =>
                      handleResearchChange("awards", index, "year", e.target.value)
                    }
                  />

                  <input
                    placeholder="Enclosure No"
                    value={row.enclosureNo}
                    onChange={e =>
                      handleResearchChange("awards", index, "enclosureNo", e.target.value)
                    }
                  />

                  <button
                    className="btn-remove-small"
                    onClick={() => removeResearchRow("awards", index)}
                  >
                    ✕
                  </button>
                </div>
              ))}
              <button
                className="btn-add"
                onClick={() =>
                  addResearchRow("awards", {
                    level: "",
                    title: "",
                    year: "",
                    enclosureNo: ""
                  })
                }
              >
                + Add Award / Fellowship
              </button>
              <hr />
              <h4>9. Invited Lectures / Resource Person</h4>

              {research.invitedTalks.map((row, index) => (
                <div className="research-card" key={index}>

                  <select
                    value={row.level}
                    onChange={e =>
                      handleResearchChange("invitedTalks", index, "level", e.target.value)
                    }
                  >
                    <option value="">Level</option>
                    <option value="International Abroad">International (Abroad)</option>
                    <option value="International India">International (India)</option>
                    <option value="National">National</option>
                    <option value="State">State / University</option>
                  </select>

                  <select
                    value={row.role}
                    onChange={e =>
                      handleResearchChange("invitedTalks", index, "role", e.target.value)
                    }
                  >
                    <option value="">Role</option>
                    <option value="Invited Lecture">Invited Lecture</option>
                    <option value="Resource Person">Resource Person</option>
                    <option value="Paper Presentation">Paper Presentation</option>
                  </select>

                  <input
                    placeholder="Year"
                    value={row.year}
                    onChange={e =>
                      handleResearchChange("invitedTalks", index, "year", e.target.value)
                    }
                  />

                  <input
                    placeholder="Enclosure No"
                    value={row.enclosureNo}
                    onChange={e =>
                      handleResearchChange("invitedTalks", index, "enclosureNo", e.target.value)
                    }
                  />

                  <button
                    className="btn-remove-small"
                    onClick={() => removeResearchRow("invitedTalks", index)}
                  >
                    ✕
                  </button>
                </div>
              ))}
              <button
                className="btn-add"
                onClick={() =>
                  addResearchRow("invitedTalks", {
                    level: "",
                    role: "",
                    year: "",
                    enclosureNo: ""
                  })
                }
              >
                + Add Invited Lecture
              </button>

            </fieldset>
            {/* ========== NAVIGATION ========== */}
            <div className="form-actions">
              <button className="btn-back" onClick={() => setCurrentStep(3)}>
                ← Back
              </button>

              <button
                className="btn-primary"
                onClick={async () => {
                  const saved = await handleSaveDraft(true);
                  if (!saved) {
                    alert("Please save before moving to the next step.");
                    return;
                  }
                  setCurrentStep(5);
                }}
              >
                Next →
              </button>
            </div>

          </div>
        )
      }


      {
        currentStep === 5 && (
          <div className="form-section">

            <h3>Step 5: Final Preview & Declaration</h3>

            <p className="section-note">
              Please preview both appraisal forms carefully before final submission.
            </p>

            {/* ================= PREVIEW BUTTONS ================= */}
            <div className="entry-card">

              <h4>Preview Generated Forms</h4>

              <div style={{ display: "flex", gap: "16px", marginTop: "12px" }}>
                <button
                  type="button"
                  className="btn-outline"
                  onClick={() => previewGeneratedPdf("SPPU")}
                >
                  Preview SPPU Form
                </button>
                <button
                  type="button"
                  className="btn-outline"
                  onClick={() => previewGeneratedPdf("PBAS")}
                >
                  Preview PBAS Form
                </button>
              </div>
            </div>

            {/* ================= DECLARATION ================= */}

            <fieldset
              disabled={formStatus === "submitted"}
              style={{ border: "none", padding: 0 }}
            >
              <div className="form-group" style={{ marginTop: "16px" }}>
                <label>Justification (for PBAS/SPPU)</label>
                <textarea
                  value={justification}
                  onChange={(e) => setJustification(e.target.value)}
                  placeholder="Enter brief justification/notes for this appraisal"
                  rows={4}
                />
              </div>

              <div className="declaration-row" style={{ marginTop: "20px" }}>
                <input
                  type="checkbox"
                  checked={declarationAccepted}
                  onChange={(e) => setDeclarationAccepted(e.target.checked)}
                />
                <label>
                  I hereby declare that I have reviewed both appraisal forms and confirm
                  that the information provided is correct.
                </label>
              </div>
            </fieldset>


            {/* ================= ACTIONS ================= */}
            <div className="form-actions">
              <button
                type="button"
                className="btn-back"
                onClick={() => setCurrentStep(4)}
              >
                ← Back
              </button>

              <button
                type="button"
                className="btn-primary"
                onClick={handleSubmitForm}
                disabled={formStatus === "submitted"}
              >
                {formStatus === "submitted" ? "Submitted" : "Final Submit"}
              </button>

            </div>

          </div>
        )
      }



      {/* FINAL ACTIONS */}
      <div className="form-actions">
        <div className="actions-left">
          <button
            type="button"
            className="btn-back"
            onClick={() => navigate(from)}
          >
            ← Back to Dashboard
          </button>
        </div>

        <div className="actions-right">
          {formStatus !== "submitted" && currentStep < 5 && (
            <button
              type="button"
              className="btn-outline"
              onClick={handleSaveDraft}
            >
              Save
            </button>
          )}




        </div>
      </div>
    </div >
  );
}









