# gateway/app/medical_tools/tools.py
# All 12 medical tools from medical-mcp-toolkit, ported for direct use
from __future__ import annotations

import math
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional


# ---------------------------------------------------------------------------
# Patient tools
# ---------------------------------------------------------------------------

def get_patient(patient_id: str = "PT-0001", name: str = "John Doe",
                age: int = 45, sex: str = "male") -> Dict[str, Any]:
    return {"patient_id": patient_id, "name": name, "age": age, "sex": sex}


def get_patient_vitals(patient_id: str = "PT-0001") -> Dict[str, Any]:
    return {
        "patient_id": patient_id,
        "heart_rate_bpm": 88,
        "systolic_bp_mmHg": 132,
        "diastolic_bp_mmHg": 84,
        "respiratory_rate_bpm": 16,
        "temperature_c": 36.9,
        "spo2_percent": 98,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


def get_patient_medical_profile(patient_id: str = "PT-0001") -> Dict[str, Any]:
    return {
        "patient_id": patient_id,
        "conditions": ["hypertension"],
        "allergies": ["penicillin"],
        "medications": ["lisinopril 10 mg daily"],
    }


def calc_clinical_scores(age: int, sex: str, weight_kg: float,
                         height_cm: float, serum_creatinine_mg_dl: float) -> Dict[str, Any]:
    height_m = height_cm / 100.0
    bmi = weight_kg / (height_m ** 2) if height_m > 0 else 0.0
    bsa = math.sqrt((height_cm * weight_kg) / 3600.0)
    crcl = ((140 - age) * weight_kg) / (72.0 * serum_creatinine_mg_dl)
    if sex.lower().startswith("f"):
        crcl *= 0.85
    return {
        "bmi": round(bmi, 2),
        "bsa_m2": round(bsa, 2),
        "creatinine_clearance_ml_min": round(crcl, 1),
        "egfr_ml_min_1_73m2": round(crcl, 1),
        "notes": ["Demo calculations; not for clinical use."],
    }


# ---------------------------------------------------------------------------
# Drug tools
# ---------------------------------------------------------------------------

DRUG_DB = {
    "ibuprofen": {
        "name": "ibuprofen", "brand_names": ["Advil", "Motrin"],
        "drug_class": "NSAID",
        "mechanism": "Non-selective COX inhibitor; analgesic and anti-inflammatory",
        "indications": ["pain", "fever", "inflammation"],
        "contraindications": ["Active GI bleed"],
        "warnings": ["Use caution in renal or hepatic impairment"],
        "common_adverse_effects": ["dyspepsia", "nausea", "headache"],
        "serious_adverse_effects": ["GI bleeding", "renal failure"],
    },
    "warfarin": {
        "name": "warfarin", "brand_names": ["Coumadin"],
        "drug_class": "Vitamin K antagonist anticoagulant",
        "mechanism": "Inhibits vitamin K epoxide reductase complex 1",
        "indications": ["thromboembolism prevention"],
        "contraindications": ["Pregnancy (X)", "Hemorrhagic tendencies"],
        "common_adverse_effects": ["bleeding", "bruising"],
        "serious_adverse_effects": ["major bleeding"],
    },
    "lisinopril": {
        "name": "lisinopril", "brand_names": ["Prinivil", "Zestril"],
        "drug_class": "ACE inhibitor",
        "mechanism": "Inhibits ACE; reduces angiotensin II",
        "indications": ["hypertension", "heart failure"],
        "contraindications": ["History of angioedema related to ACE inhibitor"],
        "common_adverse_effects": ["cough", "dizziness"],
        "serious_adverse_effects": ["angioedema", "renal failure"],
    },
}


def get_drug_info(name: str) -> Dict[str, Any]:
    key = name.lower().strip()
    if key in DRUG_DB:
        return DRUG_DB[key]
    return {
        "name": name,
        "indications": ["information not available in demo dataset"],
        "dosage": "Consult prescribing information",
        "adverse_effects": [],
    }


def get_drug_interactions(drugs: List[str]) -> Dict[str, Any]:
    drug_set = {d.lower().strip() for d in drugs}
    if {"ibuprofen", "warfarin"} <= drug_set:
        return {
            "interacting_drugs": drugs,
            "severity": "major",
            "description": "Additive anticoagulant/platelet inhibition increases bleeding risk. Avoid combination; if necessary, close INR monitoring.",
        }
    if {"ibuprofen", "lisinopril"} <= drug_set:
        return {
            "interacting_drugs": drugs,
            "severity": "moderate",
            "description": "NSAIDs may reduce antihypertensive effect and impair renal function. Monitor BP and renal function.",
        }
    return {
        "interacting_drugs": drugs,
        "severity": "none",
        "description": "No major interactions found in demo dataset.",
    }


def get_drug_contraindications(drug: str, allergies: Optional[List[str]] = None) -> Dict[str, Any]:
    reasons = []
    if allergies:
        for a in allergies:
            if a.lower() == drug.lower():
                reasons.append(f"Patient allergy to {drug}")
    severity = "high" if reasons else "none"
    return {"drug": drug, "reasons": reasons, "severity": severity}


def get_drug_alternatives(drug: str) -> List[Dict[str, str]]:
    if drug.lower() == "lisinopril":
        return [
            {"drug": "Losartan", "rationale": "ARB alternative to ACE inhibitor."},
            {"drug": "Amlodipine", "rationale": "Calcium channel blocker for hypertension."},
        ]
    if drug.lower() == "ibuprofen":
        return [
            {"drug": "Acetaminophen", "rationale": "First-line analgesic with lower GI/renal risk."},
            {"drug": "Topical diclofenac", "rationale": "Topical NSAID reduces systemic exposure."},
        ]
    return [{"drug": "Consult formulary", "rationale": "No demo alternatives available."}]


# ---------------------------------------------------------------------------
# Triage tools
# ---------------------------------------------------------------------------

def triage_symptoms(age: int = 0, sex: str = "unknown",
                    symptoms: Optional[List[str]] = None,
                    duration_text: Optional[str] = None,
                    query: Optional[str] = None) -> Dict[str, Any]:
    symptom_list = symptoms or []

    # If query is provided but symptoms list is empty, extract from query
    if query and not symptom_list:
        query_lower = query.lower()
        possible = ["chest pain", "headache", "fever", "cough", "shortness of breath",
                     "nausea", "vomiting", "dizziness", "fatigue", "sweating",
                     "diaphoresis", "abdominal pain", "back pain"]
        symptom_list = [s for s in possible if s in query_lower]
        if not symptom_list:
            symptom_list = [query]

    s = {x.lower() for x in symptom_list}
    rules = []
    next_steps = []
    acuity = "routine"
    advice = "Monitor symptoms and schedule a routine appointment if they persist."

    # Emergency rules
    if "chest pain" in s and ("sweating" in s or "diaphoresis" in s):
        acuity = "emergent"
        advice = "Call emergency services immediately (911). Do not drive yourself."
        rules = ["chest_pain_with_diaphoresis"]
        next_steps = ["ECG within 10 minutes", "Troponin levels", "Aspirin if not contraindicated",
                      "IV access", "Continuous monitoring"]
    elif "chest pain" in s:
        acuity = "urgent"
        advice = "Seek urgent medical evaluation. Visit nearest emergency department."
        rules = ["chest_pain"]
        next_steps = ["ECG", "Troponin", "Chest X-ray", "Vital signs monitoring"]
    elif "shortness of breath" in s:
        acuity = "urgent"
        advice = "Seek medical evaluation promptly."
        rules = ["dyspnea"]
        next_steps = ["Pulse oximetry", "Chest X-ray", "ABG if severe"]
    elif "fever" in s and any(x in s for x in ["headache", "neck stiffness"]):
        acuity = "urgent"
        advice = "Seek urgent evaluation to rule out meningitis."
        rules = ["fever_with_neurological"]
        next_steps = ["LP consideration", "Blood cultures", "CT head"]

    return {
        "acuity": acuity,
        "advice": advice,
        "symptoms_identified": list(s),
        "rules_matched": rules,
        "next_steps": next_steps,
        "disclaimer": "This is an AI-assisted triage tool. Always consult a healthcare professional.",
    }


def search_medical_kb(query: str, limit: int = 3) -> Dict[str, Any]:
    hits = [
        {"title": "Chest Pain Initial Evaluation",
         "snippet": "Assess ACS risk, ECG within 10 minutes.",
         "score": 0.92, "source": "Clinical Guidelines"},
        {"title": "Hypertension Management",
         "snippet": "Start ACE inhibitor or ARB unless contraindicated.",
         "score": 0.83, "source": "JNC Guidelines"},
        {"title": "Diabetes Screening",
         "snippet": "ADA recommendations for screening and A1c targets.",
         "score": 0.71, "source": "ADA Standards"},
    ][:limit]
    return {"query": query, "hits": hits}


# ---------------------------------------------------------------------------
# Scheduling tools
# ---------------------------------------------------------------------------

def schedule_appointment(patient_id: str, datetime_iso: str,
                         reason: str = "General consultation") -> Dict[str, Any]:
    return {
        "appointment_id": f"APT-{abs(hash(patient_id + datetime_iso)) % 100000:05d}",
        "patient_id": patient_id,
        "datetime": datetime_iso,
        "reason": reason,
        "status": "scheduled",
        "provider": "Dr. Rivera",
        "location": "Main Hospital",
    }


def get_patient_360(patient_id: str = "PT-0001") -> Dict[str, Any]:
    return {
        "patient": get_patient(patient_id=patient_id),
        "vitals": get_patient_vitals(patient_id=patient_id),
        "profile": get_patient_medical_profile(patient_id=patient_id),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


# ---------------------------------------------------------------------------
# Tool registry
# ---------------------------------------------------------------------------

TOOL_REGISTRY = {
    "getPatient": get_patient,
    "getPatientVitals": get_patient_vitals,
    "getPatientMedicalProfile": get_patient_medical_profile,
    "calcClinicalScores": calc_clinical_scores,
    "getDrugInfo": get_drug_info,
    "getDrugInteractions": get_drug_interactions,
    "getDrugContraindications": get_drug_contraindications,
    "getDrugAlternatives": get_drug_alternatives,
    "triageSymptoms": triage_symptoms,
    "searchMedicalKB": search_medical_kb,
    "scheduleAppointment": schedule_appointment,
    "getPatient360": get_patient_360,
}
