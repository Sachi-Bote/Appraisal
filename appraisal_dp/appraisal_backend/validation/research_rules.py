# validation/research_rules.py
"""
Validations for research/publication-related fields (PBAS - Section C).
"""

from scoring.research import (
    POINTS,
    RESEARCH_PAPER_AUTHOR_SHARES,
    RESEARCH_PAPER_IMPACT_POINTS,
    RESEARCH_PAPER_TYPE,
)


def validate_research_payload(payload: dict):
    if not isinstance(payload, dict):
        return False, "research must be an object"

    entries = payload.get("entries")
    if not isinstance(entries, list):
        return False, "research.entries must be a list"

    if len(entries) == 0:
        return True, ""  # research is optional

    for i, entry in enumerate(entries):
        if not isinstance(entry, dict):
            return False, f"Research entry {i+1} must be an object"

        activity_type = entry.get("type")
        if not activity_type:
            return False, f"Research entry {i+1} missing 'type'"

        if activity_type == RESEARCH_PAPER_TYPE:
            impact_category = entry.get("impact_factor_category")
            author_category = entry.get("author_category")

            if impact_category not in RESEARCH_PAPER_IMPACT_POINTS:
                return False, (
                    f"Research entry {i+1} has invalid 'impact_factor_category'"
                )
            if author_category not in RESEARCH_PAPER_AUTHOR_SHARES:
                return False, f"Research entry {i+1} has invalid 'author_category'"
            continue

        if activity_type not in POINTS:
            return False, f"Unknown research activity '{activity_type}'"

        if "count" in entry:
            try:
                count_val = int(float(entry.get("count", 0)))
            except (TypeError, ValueError):
                return False, f"Research entry {i+1} has invalid 'count'"
            if count_val < 0:
                return False, f"Research entry {i+1} count cannot be negative"

    return True, ""
