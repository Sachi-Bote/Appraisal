# scoring/pbas.py

# ============================================================
# CONSTANTS
# ============================================================

MAX_LIMITS = {
    "teaching_process": 25,
    "student_feedback": 25,
    "departmental_activities": 20,
    "institute_activites": 10,
    "acr_at_institute_level": 10,
    "contribution_to_society": 10,
}

ACR_GRADE_POINTS = {
    "A+": 10,
    "A": 8,
    "B": 6,
    "C": 4,
}

# ============================================================
# SECTION A — TEACHING PROCESS
# ============================================================

def calculate_teaching_process(courses: list) -> float:
    total_scheduled = sum(c["scheduled_classes"] for c in courses)
    total_held = sum(c["held_classes"] for c in courses)

    if total_scheduled == 0:
        return 0.0

    score = (total_held / total_scheduled) * MAX_LIMITS["teaching_process"]
    return round(min(score, MAX_LIMITS["teaching_process"]), 2)

# ============================================================
# SECTION B — STUDENTS FEEDBACK
# ============================================================

def calculate_feedback(feedback_scores: list) -> float:
    if not feedback_scores:
        return 0.0

    avg = sum(feedback_scores) / len(feedback_scores)
    return round(min(avg, MAX_LIMITS["student_feedback"]), 2)

# ============================================================
# SECTION C — DEPARTMENTAL ACTIVITIES
# ============================================================

def calculate_department(activities: list) -> int:
    total = sum(a["credits"] for a in activities)
    return min(total, MAX_LIMITS["departmental_activities"])

# ============================================================
# SECTION D — INSTITUTE ACTIVITIES
# ============================================================

def calculate_institute(activities: list) -> int:
    total = sum(a["credits"] for a in activities)
    return min(total, MAX_LIMITS["institute_activites"])

# ============================================================
# SECTION E — ACR
# ============================================================

def calculate_acr(grade: str) -> int:
    return ACR_GRADE_POINTS.get(grade.upper(), 0)

# ============================================================
# SECTION F — CONTRIBUTION TO SOCIETY
# ============================================================

def calculate_society(activities: list) -> int:
    total = sum(a["credits"] for a in activities)
    return min(total, MAX_LIMITS["contribution_to_society"])

# ============================================================
# MASTER PBAS CALCULATOR
# ============================================================

"""def calculate_pbas_score(payload: dict) -> dict:
    
    INPUT (RAW DATA FROM FRONTEND):
    {
      "teaching": [{"scheduled": 82, "held": 79}],
      "feedback": [22.5, 24],
      "department": [{"credits": 3}, {"credits": 3}],
      "institute": [{"credits": 4}],
      "acr": "A+",
      "society": [{"credits": 5}]
    }
   

    section_scores = {
        "teaching_process": calculate_teaching_process(payload.get("teaching", [])),
        "feedback": calculate_feedback(payload.get("feedback", [])),
        "department": calculate_department(payload.get("department", [])),
        "institute": calculate_institute(payload.get("institute", [])),
        "acr": calculate_acr(payload.get("acr", "")),
        "society": calculate_society(payload.get("society", [])),
    }

    raw_total = sum(section_scores.values())
    final_score = round((raw_total / 100) * 10, 2)

    return {
        "section_scores": section_scores,     # <-- VALIDATION INPUT
        "raw_total_out_of_100": round(raw_total, 2),
        "final_pbas_score_out_of_10": final_score
    }
"""