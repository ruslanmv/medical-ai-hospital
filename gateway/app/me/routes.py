# medical-ai-hospital/gateway/app/me/routes.py
from __future__ import annotations

from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from ..deps import get_current_user
from ..models.patient import PatientProfileOut, PatientUpdateIn
from ..repos.patients import (
    get_patient_id_for_user,
    fetch_profile_by_patient_id,
    update_patient_by_id,
    create_patient_and_link,
)
from ..repos import encounters as enc_repo  # NEW

router = APIRouter()


# ---------------- Existing profile endpoints ----------------

@router.get("/patient", response_model=PatientProfileOut | None)
async def get_patient_profile(user=Depends(get_current_user)):
    user_id = str(user["id"])
    pid = await get_patient_id_for_user(user_id)
    if not pid:
        return None
    row = await fetch_profile_by_patient_id(pid)
    return row


@router.put("/patient")
async def upsert_patient(payload: PatientUpdateIn, user=Depends(get_current_user)):
    """
    Create a patient + link if missing (enforces requirements in repo),
    otherwise update existing record with provided fields.
    """
    user_id = str(user["id"])
    pid = await get_patient_id_for_user(user_id)

    if not pid:
        try:
            pid = await create_patient_and_link(user_id, payload)
        except ValueError as e:
            # Missing required fields for creation (e.g., date_of_birth)
            raise HTTPException(status_code=422, detail=str(e)) from e
    else:
        await update_patient_by_id(pid, payload)

    return {"ok": True}


# ---------------- Clinical Intake endpoints ----------------

class IntakeSaveIn(BaseModel):
    chief_complaint: str = Field(..., min_length=1)
    content: Optional[str] = ""
    data: Dict[str, Any] = Field(default_factory=dict)


class IntakeOut(BaseModel):
    encounter_id: str
    note_id: str
    chief_complaint: Optional[str] = None
    content: Optional[str] = None
    data: Dict[str, Any]


@router.get("/intake", response_model=IntakeOut | None)
async def get_latest_intake(user=Depends(get_current_user)):
    """
    Return the latest patient-authored intake note for this patient, if any.
    """
    user_id = str(user["id"])
    pid = await get_patient_id_for_user(user_id)
    if not pid:
        # No patient profile yet => no intake
        return None

    row = await enc_repo.fetch_latest_patient_intake_for_patient(pid)
    if not row:
        return None

    return IntakeOut(
        encounter_id=str(row["encounter_id"]),
        note_id=str(row["note_id"]),
        chief_complaint=row.get("chief_complaint"),
        content=row.get("content"),
        data=row.get("data") or {},
    )


@router.post("/intake")
async def save_intake(payload: IntakeSaveIn, user=Depends(get_current_user)):
    """
    Create (or reuse) an open encounter and attach a structured patient_note
    based on the clinical intake wizard/JSON.
    """
    user_id = str(user["id"])
    pid = await get_patient_id_for_user(user_id)
    if not pid:
        # Keep UX clear: profile must exist (DOB etc.) before intake
        raise HTTPException(
            status_code=409,
            detail="Please complete your profile before starting a clinical intake.",
        )

    # Reuse any open encounter, otherwise create a fresh one
    encounter_id = await enc_repo.create_or_get_open_encounter(
        patient_id=pid, chief_complaint=payload.chief_complaint
    )

    note_id = await enc_repo.insert_patient_note(
        encounter_id=encounter_id,
        author_user_id=user_id,
        content=payload.content or "",
        data=payload.data or {},
    )

    return {"ok": True, "encounter_id": encounter_id, "note_id": note_id}
