# scoring/pbas.py


# CONSTANTS (PBAS RULES)
MAX_TEACHING = 25
MAX_FEEDBACK = 25
MAX_DEPARTMENT = 20
MAX_INSTITUTE = 10
MAX_ACR = 10
MAX_SOCIETY = 10

MAX_PBAS_RAW = 100
MAX_PBAS_FINAL = 10


ACR_GRADE_POINTS = {
    "A+": 10,
    "A": 8,
    "B": 6,
    "C": 4
}

# SECTION A — TEACHING PROCESS

def calculate_teaching_process(courses: list) -> float:
    """
    courses = [
      {"scheduled": 40, "held": 38},
      {"scheduled": 42, "held": 40}
    ]
    """

    total_scheduled = sum(c["scheduled"] for c in courses)
    total_held = sum(c["held"] for c in courses)

    if total_scheduled == 0:
        return 0.0

    score = (total_held / total_scheduled) * MAX_TEACHING
    return round(min(score, MAX_TEACHING), 2)



# SECTION B — STUDENTS' FEEDBACK
def calculate_feedback(feedback_scores: list) -> float:
    """
    feedback_scores = [22, 24, 18]
    """

    if not feedback_scores:
        return 0.0

    avg = sum(feedback_scores) / len(feedback_scores)
    return round(min(avg, MAX_FEEDBACK), 2)


# SECTION C — DEPARTMENTAL ACTIVITIES

def calculate_departmental(activities: list) -> int:
    """
    activities = [
      {"credits": 3},
      {"credits": 3},
      {"credits": 3}
    ]
    """

    total = sum(a["credits"] for a in activities)
    return min(total, MAX_DEPARTMENT)

# SECTION D — INSTITUTE ACTIVITIES

def calculate_institute(activities: list) -> int:
    """
    activities = [
      {"credits": 4},
      {"credits": 2}
    ]
    """

    total = sum(a["credits"] for a in activities)
    return min(total, MAX_INSTITUTE)

# SECTION E — ACR

def calculate_acr(grade: str) -> int:
    """
    grade = "A+"
    """

    return ACR_GRADE_POINTS.get(grade.upper(), 0)

# SECTION F — CONTRIBUTION TO SOCIETY

def calculate_society(activities: list) -> int:
    """
    activities = [
      {"credits": 5},
      {"credits": 5}
    ]
    """

    total = sum(a["credits"] for a in activities)
    return min(total, MAX_SOCIETY)



"""def calculate_pbas_score(payload: dict) -> dict:
    
    payload = {
        "teaching": [
            {"scheduled": 82, "held": 79}
        ],
        "feedback": [22, 24, 18],
        "department": [{"credits": 3}, {"credits": 3}],
        "institute": [{"credits": 4}],
        "acr": "A+",
        "society": [{"credits": 5}, {"credits": 5}]
    }
    

    teaching_score = calculate_teaching_process(payload.get("teaching", []))
    feedback_score = calculate_feedback(payload.get("feedback", []))
    department_score = calculate_departmental(payload.get("department", []))
    institute_score = calculate_institute(payload.get("institute", []))
    acr_score = calculate_acr(payload.get("acr", ""))
    society_score = calculate_society(payload.get("society", []))

    raw_total = (
        teaching_score +
        feedback_score +
        department_score +
        institute_score +
        acr_score +
        society_score
    )

    final_score = round((raw_total / MAX_PBAS_RAW) * MAX_PBAS_FINAL, 2)

    return {
        "section_wise": {
            "teaching_process": teaching_score,
            "students_feedback": feedback_score,
            "departmental_activities": department_score,
            "institute_activities": institute_score,
            "acr": acr_score,
            "contribution_to_society": society_score
        },
        "raw_total_out_of_100": round(raw_total, 2),
        "final_pbas_score_out_of_10": final_score
    }"""