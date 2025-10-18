# gateway/app/me/routes.py
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status

from ..deps import get_current_user
from ..models.auth import MeOut
from ..models.patient import PatientProfileOut, PatientUpdateIn
from ..repos.patients import (
    get_patient_id_for_user,
    fetch_profile_by_patient_id,
    update_patient_by_id,
)

router = APIRouter()


@router.get("", response_model=MeOut)
async def me(user=Depends(get_current_user)):
    """Return the authenticated account summary."""
    return MeOut(
        id=str(user["id"]),
        email=user["email"],
        is_verified=bool(user.get("is_verified", False)),
    )


@router.get("/patient", response_model=PatientProfileOut | None)
async def get_patient_profile(user=Depends(get_current_user)):
    """Return the patient profile linked to the current user (if any)."""
    pid = await get_patient_id_for_user(user_id=str(user["id"]))
    if not pid:
        return None
    row = await fetch_profile_by_patient_id(patient_id=pid)
    return row


@router.put("/patient")
async def update_patient(payload: PatientUpdateIn, user=Depends(get_current_user)):
    """Allow the current user to update their linked patient's demographics."""
    pid = await get_patient_id_for_user(user_id=str(user["id"]))
    if not pid:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient not linked")
    await update_patient_by_id(patient_id=pid, payload=payload)
    return {"ok": True}
