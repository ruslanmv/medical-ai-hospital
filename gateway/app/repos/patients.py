# medical-ai-hospital/gateway/app/repos/patients.py
from __future__ import annotations

from typing import Optional, Dict, Any, Iterable
from psycopg.rows import dict_row

from .. import db  # shared pool (see repos/users.py)

# Allowlist of columns the API can write to
_ALLOWED_COLS = {
    "first_name",
    "middle_name",
    "last_name",
    "date_of_birth",  # ISO date YYYY-MM-DD
    "sex",            # 'male','female','intersex','other','unknown'
    "phone",
    "email",
    "address_line1",
    "address_line2",
    "city",
    "state",
    "postal_code",
    "country_code",   # ISO-3166-1 alpha-2
}


def _filter_payload(model: Any) -> Dict[str, Any]:
    """
    Return an allowlisted dict of the provided (non-empty) fields.
    Trims strings and drops empty values, to avoid sending blank updates.
    """
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


def _coerce_profile_row(row: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    """
    Coerce DB row types to API-friendly JSON types:
    - UUID -> str for 'patient_id'
    - date -> 'YYYY-MM-DD' for 'date_of_birth'
    """
    if not row:
        return None
    r = dict(row)
    if "patient_id" in r and r["patient_id"] is not None:
        r["patient_id"] = str(r["patient_id"])
    if "date_of_birth" in r and r["date_of_birth"] is not None:
        # psycopg returns a date object; expose as ISO date string
        r["date_of_birth"] = r["date_of_birth"].isoformat()
    return r


async def get_patient_id_for_user(user_id: str) -> Optional[str]:
    pool = db.get_pool()
    async with pool.connection() as conn:
        async with conn.cursor(row_factory=dict_row) as cur:
            await cur.execute(
                """
                SELECT patient_id
                FROM patient_users
                WHERE user_id = %s
                ORDER BY linked_at
                LIMIT 1
                """,
                (user_id,),
            )
            row = await cur.fetchone()
            if not row:
                return None
            # Ensure we return a string UUID
            return str(row["patient_id"]) if row.get("patient_id") is not None else None


async def fetch_profile_by_patient_id(patient_id: str) -> Optional[Dict[str, Any]]:
    pool = db.get_pool()
    async with pool.connection() as conn:
        async with conn.cursor(row_factory=dict_row) as cur:
            await cur.execute(
                "SELECT * FROM v_patient_profile WHERE patient_id = %s",
                (patient_id,),
            )
            row = await cur.fetchone()
            return _coerce_profile_row(row)


async def update_patient_by_id(patient_id: str, payload: Any) -> None:
    data = _filter_payload(payload)
    if not data:
        return  # nothing to update

    # Normalize country code if present
    cc = data.get("country_code")
    if isinstance(cc, str):
        data["country_code"] = cc.upper()

    set_sql = ", ".join(f"{col} = %s" for col in data.keys())
    params: Iterable[Any] = list(data.values()) + [patient_id]

    pool = db.get_pool()
    async with pool.connection() as conn:
        async with conn.cursor() as cur:
            await cur.execute(f"UPDATE patients SET {set_sql} WHERE id = %s", params)
        await conn.commit()


async def create_patient_and_link(user_id: str, payload: Any) -> str:
    """
    Create a new patients row from provided fields, then link as OWNER.

    DB requires: first_name, last_name, date_of_birth (NOT NULL).
    We enforce these here to avoid NOT NULL violations.
    """
    data = _filter_payload(payload)

    missing = [k for k in ("first_name", "last_name", "date_of_birth") if not data.get(k)]
    if missing:
        raise ValueError(f"Missing required field(s): {', '.join(missing)}")

    # Normalize country code if provided
    cc = data.get("country_code")
    if isinstance(cc, str):
        data["country_code"] = cc.upper()

    cols = list(data.keys())
    vals = list(data.values())

    pool = db.get_pool()
    async with pool.connection() as conn:
        async with conn.cursor(row_factory=dict_row) as cur:
            placeholders = ", ".join(["%s"] * len(cols))
            col_names = ", ".join(cols)
            await cur.execute(
                f"""
                INSERT INTO patients ({col_names})
                VALUES ({placeholders})
                RETURNING id
                """,
                vals,
            )
            row = await cur.fetchone()
            if not row or row.get("id") is None:
                raise RuntimeError("Failed to create patient")

            patient_id = str(row["id"])

            # Link as OWNER (idempotent on unique (patient_id, user_id))
            await cur.execute(
                """
                INSERT INTO patient_users (patient_id, user_id, role)
                VALUES (%s, %s, 'OWNER')
                ON CONFLICT (patient_id, user_id) DO NOTHING
                """,
                (patient_id, user_id),
            )
        await conn.commit()

    return patient_id
