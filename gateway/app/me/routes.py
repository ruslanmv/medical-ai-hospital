from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from ..deps import get_current_user, get_conn
from ..models.patient import PatientProfileOut, PatientUpdateIn
from ..repos.patients import (
    get_patient_id_for_user,
    fetch_profile_by_patient_id,
    update_patient_by_id,
)

router = APIRouter()

@router.get("/patient", response_model=PatientProfileOut | None)
async def get_patient_profile(user=Depends(get_current_user), cur=Depends(get_conn)):
    pid = await get_patient_id_for_user(cur, user["id"])
    if not pid:
        return None
    row = await fetch_profile_by_patient_id(cur, pid)
    return row

@router.put("/patient")
async def update_patient(payload: PatientUpdateIn, user=Depends(get_current_user), cur=Depends(get_conn)):
    pid = await get_patient_id_for_user(cur, user["id"])
    if not pid:
        raise HTTPException(status_code=404, detail="Patient not linked")
    await update_patient_by_id(cur, pid, payload)
    return {"ok": True}
