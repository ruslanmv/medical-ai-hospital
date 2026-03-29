# gateway/app/repos/patients.py — SQLite version
from __future__ import annotations

import json
from typing import Optional, Dict, Any

from .. import db

_ALLOWED_COLS = {
    "first_name", "middle_name", "last_name", "date_of_birth",
    "sex", "phone", "email", "address_line1", "address_line2",
    "city", "state", "postal_code", "country_code",
}


def _filter_payload(model: Any) -> Dict[str, Any]:
    raw = model.model_dump(exclude_unset=True)
    out: Dict[str, Any] = {}
    for k, v in raw.items():
        if k not in _ALLOWED_COLS:
            continue
        if isinstance(v, str):
            v = v.strip()
        if v is None or (isinstance(v, str) and v == ""):
            continue
        out[k] = v
    return out


async def get_patient_id_for_user(user_id: str) -> Optional[str]:
    conn = await db.get_conn()
    try:
        cursor = await conn.execute(
            "SELECT patient_id FROM patient_users WHERE user_id = ? ORDER BY linked_at LIMIT 1",
            (user_id,),
        )
        row = await cursor.fetchone()
        if not row:
            return None
        return str(dict(row)["patient_id"])
    finally:
        await conn.close()


async def fetch_profile_by_patient_id(patient_id: str) -> Optional[Dict[str, Any]]:
    conn = await db.get_conn()
    try:
        cursor = await conn.execute("SELECT * FROM patients WHERE id = ?", (patient_id,))
        row = await cursor.fetchone()
        if not row:
            return None
        profile = dict(row)
        profile["patient_id"] = profile.pop("id")

        # Fetch conditions
        cursor = await conn.execute(
            "SELECT name, icd_code, onset_date, status FROM conditions WHERE patient_id = ?",
            (patient_id,),
        )
        conditions = [dict(r) for r in await cursor.fetchall()]
        profile["conditions"] = conditions if conditions else None

        # Fetch allergies
        cursor = await conn.execute(
            "SELECT substance, reaction, severity FROM allergies WHERE patient_id = ?",
            (patient_id,),
        )
        allergies = [dict(r) for r in await cursor.fetchall()]
        profile["allergies"] = allergies if allergies else None

        # Fetch medications
        cursor = await conn.execute(
            "SELECT drug_name, dose, route, frequency FROM medications WHERE patient_id = ?",
            (patient_id,),
        )
        medications = [dict(r) for r in await cursor.fetchall()]
        profile["medications"] = medications if medications else None

        # Fetch latest vitals
        cursor = await conn.execute(
            """SELECT systolic_mmhg, diastolic_mmhg, heart_rate_bpm, resp_rate_min,
                      temperature_c, spo2_percent, weight_kg, height_cm, bmi, timestamp
               FROM vitals WHERE patient_id = ? ORDER BY timestamp DESC LIMIT 1""",
            (patient_id,),
        )
        vitals_row = await cursor.fetchone()
        profile["latest_vitals"] = dict(vitals_row) if vitals_row else None

        return profile
    finally:
        await conn.close()


async def update_patient_by_id(patient_id: str, payload: Any) -> None:
    data = _filter_payload(payload)
    if not data:
        return

    cc = data.get("country_code")
    if isinstance(cc, str):
        data["country_code"] = cc.upper()

    # Convert date objects to strings for SQLite
    for k, v in data.items():
        if hasattr(v, 'isoformat'):
            data[k] = v.isoformat()

    set_sql = ", ".join(f"{col} = ?" for col in data.keys())
    params = list(data.values()) + [patient_id]

    conn = await db.get_conn()
    try:
        await conn.execute(f"UPDATE patients SET {set_sql} WHERE id = ?", params)
        await conn.commit()
    finally:
        await conn.close()


async def create_patient_and_link(user_id: str, payload: Any) -> str:
    data = _filter_payload(payload)

    missing = [k for k in ("first_name", "last_name", "date_of_birth") if not data.get(k)]
    if missing:
        raise ValueError(f"Missing required field(s): {', '.join(missing)}")

    cc = data.get("country_code")
    if isinstance(cc, str):
        data["country_code"] = cc.upper()

    # Convert date objects to strings for SQLite
    for k, v in data.items():
        if hasattr(v, 'isoformat'):
            data[k] = v.isoformat()

    cols = list(data.keys())
    vals = list(data.values())

    conn = await db.get_conn()
    try:
        placeholders = ", ".join(["?"] * len(cols))
        col_names = ", ".join(cols)
        await conn.execute(
            f"INSERT INTO patients ({col_names}) VALUES ({placeholders})",
            vals,
        )
        # Get the last inserted patient id
        cursor = await conn.execute("SELECT last_insert_rowid()")
        rowid_row = await cursor.fetchone()

        # SQLite uses randomblob for id, so we need to get the actual id
        cursor = await conn.execute(
            "SELECT id FROM patients WHERE rowid = ?",
            (dict(rowid_row)["last_insert_rowid()"],),
        )
        id_row = await cursor.fetchone()
        patient_id = dict(id_row)["id"]

        await conn.execute(
            "INSERT OR IGNORE INTO patient_users (patient_id, user_id, role) VALUES (?, ?, 'OWNER')",
            (patient_id, user_id),
        )
        await conn.commit()
        return patient_id
    finally:
        await conn.close()
