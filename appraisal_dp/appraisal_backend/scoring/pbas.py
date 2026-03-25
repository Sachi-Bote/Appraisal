from decimal import Decimal, ROUND_HALF_UP

from scoring.research import (
    POINTS,
    calculate_research_paper_score,
)


def calculate_pbas_score(appraisal_data: dict) -> dict:
    breakdown = {}
    total = Decimal("0")

    # 1. Research Papers
    research = appraisal_data.get("research", {})
    journal = research.get("journal_papers", 0)
    conference = research.get("conference_papers", 0)
    research_papers = research.get("papers", [])

    if isinstance(research_papers, list) and research_papers:
        journal_total = Decimal("0")
        journal_count = 0
        paper_breakdown = []

        for paper in research_papers:
            if not isinstance(paper, dict):
                continue
            scored = calculate_research_paper_score(paper)
            if scored["awarded_score"] <= 0:
                continue
            journal_count += 1
            journal_total += Decimal(str(scored["awarded_score"]))
            paper_breakdown.append({
                "title": paper.get("title", ""),
                "impact_factor_category": scored["impact_factor_category"],
                "author_category": scored["author_category"],
                "base_points": scored["base_points"],
                "share": scored["share"],
                "awarded_score": scored["awarded_score"],
            })

        breakdown["journal_papers"] = {
            "count": journal_count,
            "score": float(journal_total.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)),
            "papers": paper_breakdown,
        }
    else:
        breakdown["journal_papers"] = journal * POINTS["journal_papers"]

    breakdown["conference_papers"] = conference * POINTS["journal_papers"]

    journal_score = (
        breakdown["journal_papers"]["score"]
        if isinstance(breakdown["journal_papers"], dict)
        else breakdown["journal_papers"]
    )
    total += Decimal(str(journal_score + breakdown["conference_papers"]))

    # 2. Publications
    publications = appraisal_data.get("publications", {})
    for key in [
        "book_international",
        "book_national",
        "edited_book_chapter",
        "editor_book_international",
        "editor_book_national",
        "translation_chapter_or_paper",
        "translation_book"
    ]:
        count = publications.get(key, 0)
        breakdown[key] = count * POINTS[key]
        total += Decimal(str(breakdown[key]))

    # 3. ICT / MOOCs / E-Content
    ict = appraisal_data.get("ict", {})
    breakdown["innovative_pedagogy"] = (
        ict.get("innovative_pedagogy", 0) * POINTS["innovative_pedagogy"]
    )
    total += Decimal(str(breakdown["innovative_pedagogy"]))

    mooc = ict.get("mooc", {})
    breakdown["mooc_module"] = mooc.get("module", 0) * POINTS["mooc_module"]
    total += Decimal(str(breakdown["mooc_module"]))

    # 4. Research Guidance
    guidance = appraisal_data.get("research_guidance", {})
    breakdown["phd_awarded"] = guidance.get("phd_awarded", 0) * POINTS["phd_awarded"]
    total += Decimal(str(breakdown["phd_awarded"]))

    # 5. Patents
    patents = appraisal_data.get("patents", {})
    breakdown["patent_international"] = (
        patents.get("international", 0) * POINTS["patent_international"]
    )
    total += Decimal(str(breakdown["patent_international"]))

    # 6. Invited Lectures
    invited = appraisal_data.get("invited_lectures", {})
    breakdown["invited_lecture_national"] = (
        invited.get("national", 0) * POINTS["invited_lecture_national"]
    )
    total += Decimal(str(breakdown["invited_lecture_national"]))

    return {
        "breakdown": breakdown,
        "total": float(total.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))
    }
