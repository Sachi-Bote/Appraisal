from decimal import Decimal, ROUND_HALF_UP


RESEARCH_PAPER_TYPE = "research_paper"

RESEARCH_PAPER_IMPACT_POINTS = {
    "without_impact_factor": 0,
    "less_than_1": 5,
    "between_1_and_2": 10,
    "between_2_and_5": 15,
    "between_5_and_10": 20,
    "greater_than_10": 25,
}

RESEARCH_PAPER_AUTHOR_SHARES = {
    "two_authors": Decimal("0.70"),
    "multi_author_principal": Decimal("0.70"),
    "multi_author_joint": Decimal("0.30"),
    "joint_project": Decimal("0.50"),
}


POINTS = {
    # 1. Research Papers
    "journal_papers": 8,  # per paper (UGC / Peer-reviewed)

    # 2. Publications (other than research papers)
    # (a) Books
    "book_international": 12,
    "book_national": 10,
    "edited_book_chapter": 5,
    "editor_book_international": 10,
    "editor_book_national": 8,

    # (b) Translation works
    "translation_chapter_or_paper": 3,
    "translation_book": 8,

    # 3. ICT / Pedagogy / MOOCs / E-Content
    "innovative_pedagogy": 5,
    "new_curriculum": 2,
    "new_course": 2,

    "mooc_complete_4_quadrant": 20,
    "mooc_module": 5,
    "mooc_content_writer": 2,
    "mooc_course_coordinator": 8,

    "econtent_complete_course": 12,
    "econtent_module": 5,
    "econtent_contribution": 2,
    "econtent_editor": 10,
    # Frontend alias keys used by current appraisal form payload.
    "econtent_4quadrant_complete": 12,
    "econtent_4quadrant_per_module": 5,
    "econtent_module_contribution": 2,

    # 4. Research Guidance
    "phd_awarded": 10,
    "mphil_submitted": 5,
    "pg_dissertation_awarded": 2,

    # Research Projects Completed
    "project_completed_gt_10_lakhs": 10,
    "project_completed_lt_10_lakhs": 5,

    # Research Projects Ongoing
    "project_ongoing_gt_10_lakhs": 5,
    "project_ongoing_lt_10_lakhs": 2,

    # Consultancy
    "consultancy": 3,

    # 5. Patents
    "patent_international": 10,
    "patent_national": 7,

    # Policy Documents
    "policy_international": 10,
    "policy_national": 7,
    "policy_state": 4,

    # Awards / Fellowship
    "award_international": 7,
    "award_national": 5,

    # 6. Invited Lectures / Conferences
    "invited_lecture_international_abroad": 7,
    "invited_lecture_international_india": 5,
    "invited_lecture_national": 3,
    "invited_lecture_state_university": 2,
}


def _to_decimal(value) -> Decimal:
    try:
        return Decimal(str(value))
    except (TypeError, ValueError, ArithmeticError):
        return Decimal("0")


# Base score per journal paper (UGC/Peer-reviewed)
BASE_JOURNAL_PAPER_SCORE = Decimal("8")


def calculate_research_paper_score(entry: dict) -> dict:
    """
    Formula: awarded_score = impact_factor_points + (author_share × 8)

    Example: IF between 2 and 5, two authors
      = 20 + (0.70 × 8) = 20 + 5.6 = 25.6

    The impact factor points are the primary score; the author share
    determines the fraction of the base paper score (8) added on top.
    """
    impact_category = str(entry.get("impact_factor_category", "")).strip()
    author_category = str(entry.get("author_category", "")).strip()

    impact_points = Decimal(str(RESEARCH_PAPER_IMPACT_POINTS.get(impact_category, 0)))
    share = RESEARCH_PAPER_AUTHOR_SHARES.get(author_category, Decimal("0"))
    author_contribution = (BASE_JOURNAL_PAPER_SCORE * share).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    awarded_score = (impact_points + author_contribution).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    return {
        "impact_factor_category": impact_category,
        "author_category": author_category,
        "impact_points": float(impact_points),
        "author_contribution": float(author_contribution),
        "share": float(share),
        "awarded_score": float(awarded_score),
    }


def calculate_research_score(payload: dict) -> dict:
    """
    Expected input:
    {
        "entries": [
            {"type": "journal_papers", "count": 2},
            {"type": "book_international", "count": 1},
            {"type": "invited_lecture_national", "count": 1}
        ]
    }
    """

    entries = payload.get("entries", [])

    breakdown = {}
    total = Decimal("0")

    for entry in entries:
        activity_type = entry.get("type")

        if activity_type == RESEARCH_PAPER_TYPE:
            paper_score = calculate_research_paper_score(entry)
            if paper_score["awarded_score"] <= 0:
                continue

            if activity_type not in breakdown:
                breakdown[activity_type] = {
                    "count": 0,
                    "score": 0,
                    "papers": [],
                }

            breakdown[activity_type]["count"] += 1
            breakdown[activity_type]["papers"].append({
                "title": entry.get("title", ""),
                "journal": entry.get("journal", ""),
                "year": entry.get("year", ""),
                "enclosure_no": entry.get("enclosure_no", ""),
                **paper_score,
            })
            breakdown[activity_type]["score"] = round(
                breakdown[activity_type]["score"] + paper_score["awarded_score"], 2
            )
            total += _to_decimal(paper_score["awarded_score"])
            continue

        if activity_type not in POINTS:
            continue

        try:
            unit_count = int(float(entry.get("count", 1)))
        except (TypeError, ValueError):
            unit_count = 0

        if unit_count <= 0:
            continue

        if activity_type not in breakdown:
            breakdown[activity_type] = {
                "count": 0,
                "points_per_unit": POINTS[activity_type],
                "score": 0,
            }

        breakdown[activity_type]["count"] += unit_count

    for _, data in breakdown.items():
        if "points_per_unit" not in data:
            continue
        data["score"] = data["count"] * data["points_per_unit"]
        total += _to_decimal(data["score"])

    return {
        "breakdown": breakdown,
        "total": float(total.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)),
    }
