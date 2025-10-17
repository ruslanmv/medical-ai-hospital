from __future__ import annotations

from typing import Optional, Dict, Any

async def get_patient_id_for_user(cur, user_id: str) -> Optional[str]:
    await cur.execute(
        "SELECT patient_id FROM patient_users WHERE user_id = %s ORDER BY linked_at LIMIT 1",
        (user_id,),
    )
    row = await cur.fetchone()
    return row["patient_id"] if row else None

async def fetch_profile_by_patient_id(cur, patient_id: str) -> Optional[Dict[str, Any]]:
    await cur.execute("SELECT * FROM v_patient_profile WHERE patient_id = %s", (patient_id,))
    return await cur.fetchone()

async def update_patient_by_id(cur, patient_id: str, payload) -> None:
    data = {k: v for k, v in payload.model_dump(exclude_unset=True).items()}
    if not data:
        return
    cols = ", ".join([f"{k} = %s" for k in data.keys()])
    params = list(data.values()) + [patient_id]
    await cur.execute(f"UPDATE patients SET {cols} WHERE id = %s", params)
