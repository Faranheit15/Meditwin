from __future__ import annotations

from datetime import date, timedelta

CONDITION_MAP: dict[str, dict[str, list[str]]] = {
    "type_2_diabetes": {"icd_codes": ["E11"], "names": ["type 2 diabetes", "t2dm"]},
    "type_1_diabetes": {"icd_codes": ["E10"], "names": ["type 1 diabetes", "t1dm"]},
    "rheumatoid_arthritis": {"icd_codes": ["M05", "M06"], "names": ["rheumatoid arthritis"]},
    "active_liver_disease": {
        "icd_codes": ["K70", "K71", "K72", "K73", "K74", "K75", "K76"],
        "names": ["liver disease", "hepatic"],
    },
    "liver_disease": {
        "icd_codes": ["K70", "K71", "K72", "K73", "K74", "K75", "K76"],
        "names": ["liver disease", "hepatic"],
    },
    "malignancy": {
        "icd_codes": ["C"],
        "names": ["malignancy", "cancer", "carcinoma", "lymphoma", "leukemia"],
    },
    "active_serious_infection": {"icd_codes": ["A", "B"], "names": ["infection", "sepsis"]},
    "pregnancy_or_breastfeeding": {"icd_codes": ["O", "Z33"], "names": ["pregnancy", "pregnant", "breastfeeding"]},
}

MEDICATION_MAP: dict[str, list[str]] = {
    "anti_cd20_therapy": ["rituximab", "ocrelizumab", "ofatumumab", "obinutuzumab"],
    "major_cv_event": [],
    "major_cardiovascular_event": [],
    "other_trial_participation": [],
    "other_clinical_trial": [],
    "live_vaccine": ["mmr", "varicella", "bcg", "yellow fever", "rotavirus"],
}


def has_condition(condition_param: str, conditions: list[dict]) -> bool:
    mapping = CONDITION_MAP.get(condition_param)
    if not mapping:
        return False

    for condition in conditions:
        icd = str(condition.get("icd_code", "")).upper()
        name = str(condition.get("name", "")).lower()

        if any(icd.startswith(prefix.upper()) for prefix in mapping["icd_codes"]):
            return True
        if any(keyword in name for keyword in mapping["names"]):
            return True

    return False


def has_medication_within(
    medication_param: str,
    days: int,
    medications: list[dict],
    *,
    reference_date: date | None = None,
) -> bool:
    med_names = MEDICATION_MAP.get(medication_param, [])
    if not med_names:
        return False

    today = reference_date or date.today()
    cutoff_date = today - timedelta(days=days)

    for med in medications:
        med_name = str(med.get("name", "")).lower()
        matches = any(known.lower() in med_name or med_name in known.lower() for known in med_names)
        if not matches:
            continue

        start = _coerce_date(med.get("start_date"))
        end = _coerce_date(med.get("end_date"))

        if start and start <= today and (end is None or end >= cutoff_date):
            return True

    return False


def _coerce_date(value: object) -> date | None:
    if value is None or value == "":
        return None
    if isinstance(value, date):
        return value
    return date.fromisoformat(str(value))
