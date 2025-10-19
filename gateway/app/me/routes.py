# medical-ai-hospital/gateway/app/me/routes.py
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from ..deps import get_current_user
from ..models.patient import PatientProfileOut, PatientUpdateIn
from ..repos.patients import (
    get_patient_id_for_user,
    fetch_profile_by_patient_id,
    update_patient_by_id,
    create_patient_and_link,
)

router = APIRouter()


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
    Create a patient + link if missing (requires first_name, last_name, date_of_birth),
    otherwise update existing record with provided fields.
    """
    user_id = str(user["id"])
    pid = await get_patient_id_for_user(user_id)

    if not pid:
        # Enforce required fields at the API boundary for a clear 422 error
        missing = [k for k in ("first_name", "last_name", "date_of_birth") if not getattr(payload, k, None)]
        if missing:
            raise HTTPException(
                status_code=422,
                detail=f"Missing required field(s) to create your profile: {', '.join(missing)}",
            )
        try:
            pid = await create_patient_and_link(user_id, payload)
        except ValueError as e:
            raise HTTPException(status_code=422, detail=str(e)) from e
    else:
        await update_patient_by_id(pid, payload)

    return {"ok": True}
