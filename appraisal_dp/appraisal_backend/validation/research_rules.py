# validation/research_rules.py
"""
Validations for research/publication-related fields (PBAS - Section C).
"""

import re
from urllib.parse import urlparse

from scoring.research import (
    POINTS,
    RESEARCH_PAPER_AUTHOR_SHARES,
    RESEARCH_PAPER_IMPACT_POINTS,
    RESEARCH_PAPER_TYPE,
)


def is_valid_reference_link(link) -> bool:
    """
    Validates that a reference link, if provided, is a valid URL or DOI.
    Empty, None, and whitespace-only values are accepted as valid (field is optional).
    """
    if link is None:
        return True
    if not isinstance(link, str):
        return False
    trimmed = link.strip()
    if not trimmed:
        return True
    if len(trimmed) > 2048:
        return False
    # Standard DOI check (e.g. 10.1000/182, doi:10.1000/182)
    if re.match(r"^(doi:\s*)?10\.\d{4,9}/[-._;()/:A-Za-z0-9]+$", trimmed, re.IGNORECASE):
        return True
    # Standard URL check (http://, https://, ftp://)
    if trimmed.startswith(("http://", "https://", "ftp://")):
        parsed = urlparse(trimmed)
        return bool(parsed.netloc)
    # www. prefix
    if trimmed.startswith("www."):
        parsed = urlparse("https://" + trimmed)
        return bool(parsed.netloc)
    # Generic domain/path format e.g. "example.org/docs/123"
    if re.match(r"^[a-zA-Z0-9][-a-zA-Z0-9.]*\.[a-zA-Z]{2,}(/.*)?$", trimmed):
        return True
    return False


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

        ref_link = entry.get("reference_link")
        if ref_link is None:
            ref_link = entry.get("referenceLink")
        if not is_valid_reference_link(ref_link):
            return False, f"Research entry {i+1} has an invalid Reference Link / DOI format"

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
