from __future__ import annotations

import re

import fitz

from app.core.logging import get_logger

logger = get_logger(__name__)


class PDFParserService:
    """Extract and structure text from protocol PDFs."""

    SECTION_PATTERNS: dict[str, tuple[str, ...]] = {
        "inclusion_criteria": (
            r"\bInclusion Criteria\b",
            r"\bEligibility Criteria\b",
            r"§?\s*\d+(?:\.\d+)*\s*Inclusion\b",
            r"\bKey Inclusion Criteria\b",
        ),
        "exclusion_criteria": (
            r"\bExclusion Criteria\b",
            r"§?\s*\d+(?:\.\d+)*\s*Exclusion\b",
            r"\bKey Exclusion Criteria\b",
        ),
        "study_timeline": (
            r"\bStudy Timeline\b",
            r"\bStudy Procedures\b",
            r"\bVisit Schedule\b",
            r"\bSchedule of Assessments\b",
        ),
    }

    def extract_text(self, pdf_bytes: bytes) -> str:
        """Extract full text from PDF bytes using PyMuPDF."""
        with fitz.open(stream=pdf_bytes, filetype="pdf") as document:
            page_text = [page.get_text("text") for page in document]

        full_text = "\n".join(text.strip() for text in page_text if text.strip())
        logger.info("Extracted PDF text", event="pdf_extract", characters=len(full_text))
        return full_text

    def extract_sections(self, full_text: str) -> dict[str, str]:
        """Split extracted text into named sections."""
        normalized_text = re.sub(r"\r\n?", "\n", full_text)
        sections: dict[str, str] = {"full_text": normalized_text}

        header_matches: list[tuple[int, int, str]] = []
        for section_name, patterns in self.SECTION_PATTERNS.items():
            for pattern in patterns:
                match = re.search(pattern, normalized_text, flags=re.IGNORECASE)
                if match:
                    header_matches.append((match.start(), match.end(), section_name))
                    break

        if not header_matches:
            logger.warning("No protocol sections matched", event="pdf_sections")
            return sections

        header_matches.sort(key=lambda item: item[0])
        for index, (_, header_end, section_name) in enumerate(header_matches):
            next_start = header_matches[index + 1][0] if index + 1 < len(header_matches) else len(normalized_text)
            section_text = normalized_text[header_end:next_start].strip()
            if section_text:
                sections[section_name] = section_text

        logger.info(
            "Protocol sections extracted",
            event="pdf_sections",
            sections=",".join(sorted(key for key in sections.keys() if key != "full_text")),
        )
        return sections
