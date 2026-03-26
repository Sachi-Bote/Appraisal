from django.test import TestCase

from scoring.activities import (
    calculate_departmental_activity_score,
    calculate_institute_activity_score,
    calculate_society_activity_score,
)
from scoring.research import calculate_research_score


class ActivityCreditCapTests(TestCase):
    def test_departmental_caps_total_to_20(self):
        payload = [{"credits_claimed": 3} for _ in range(7)]
        result = calculate_departmental_activity_score(payload)
        self.assertEqual(result["total_claimed"], 21.0)
        self.assertEqual(result["total_awarded"], 20.0)

    def test_institute_honors_per_activity_caps(self):
        payload = [
            {"activity_code": "HOD_DEAN", "credits_claimed": 4},
            {"activity_code": "COORDINATOR_APPOINTED_BY_HOI", "credits_claimed": 2},
            {"activity_code": "ORGANIZED_CONFERENCE", "credits_claimed": 2},
            {"activity_code": "FDP_CONFERENCE_COORDINATOR", "credits_claimed": 1},
            {"activity_code": "HOD_DEAN", "credits_claimed": 4},
        ]
        result = calculate_institute_activity_score(payload)
        self.assertEqual(result["total_claimed"], 13.0)
        self.assertEqual(result["total_awarded"], 10.0)

    def test_institute_rejects_claim_above_activity_cap(self):
        with self.assertRaises(ValueError):
            calculate_institute_activity_score(
                [{"activity_code": "FDP_CONFERENCE_COORDINATOR", "credits_claimed": 2}]
            )

    def test_institute_allows_fractional_fdp_split(self):
        result = calculate_institute_activity_score(
            [{"activity_code": "FDP_CONFERENCE_COORDINATOR", "credits_claimed": 0.5}]
        )
        self.assertEqual(result["total_awarded"], 0.5)

    def test_society_caps_total_to_10(self):
        payload = [
            {"activity_code": "INDUCTION_PROGRAM", "credits_claimed": 5},
            {"activity_code": "BLOOD_DONATION", "credits_claimed": 5},
            {"activity_code": "YOGA", "credits_claimed": 5},
        ]
        result = calculate_society_activity_score(payload)
        self.assertEqual(result["total_claimed"], 15.0)
        self.assertEqual(result["total_awarded"], 10.0)


class ResearchCountTests(TestCase):
    def test_research_uses_count_field(self):
        payload = {
            "entries": [
                {"type": "journal_papers", "count": 2},
                {"type": "book_national", "count": 1},
            ]
        }
        result = calculate_research_score(payload)
        self.assertEqual(result["breakdown"]["journal_papers"]["score"], 16)
        self.assertEqual(result["breakdown"]["book_national"]["score"], 10)
        self.assertEqual(result["total"], 26)

    def test_research_paper_uses_impact_factor_and_author_category(self):
        """
        New formula: awarded_score = impact_factor_points + (author_share × 8)
          Paper A: IF between_2_and_5 (15) + two_authors (0.70 × 8 = 5.60) = 20.60
          Paper B: IF greater_than_10 (25) + multi_author_joint (0.30 × 8 = 2.40) = 27.40
          Combined total = 48.00
        """
        payload = {
            "entries": [
                {
                    "type": "research_paper",
                    "title": "Paper A",
                    "impact_factor_category": "between_2_and_5",
                    "author_category": "two_authors",
                },
                {
                    "type": "research_paper",
                    "title": "Paper B",
                    "impact_factor_category": "greater_than_10",
                    "author_category": "multi_author_joint",
                },
            ]
        }

        result = calculate_research_score(payload)

        self.assertEqual(result["breakdown"]["research_paper"]["count"], 2)
        self.assertEqual(result["breakdown"]["research_paper"]["score"], 48.0)
        self.assertEqual(result["total"], 48.0)

    def test_research_paper_without_impact_factor_two_authors(self):
        """
        Paper in refereed journal without impact factor (0 pts) + two_authors (0.70 × 8 = 5.60) = 5.60
        """
        payload = {
            "entries": [
                {
                    "type": "research_paper",
                    "title": "Basic Paper",
                    "impact_factor_category": "without_impact_factor",
                    "author_category": "two_authors",
                }
            ]
        }
        result = calculate_research_score(payload)
        self.assertEqual(result["breakdown"]["research_paper"]["score"], 10.6)
        self.assertEqual(result["total"], 10.6)
