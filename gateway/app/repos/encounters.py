# medical-ai-hospital/gateway/app/repos/encounters.py
from __future__ import annotations

from typing import Any, Dict, Optional

from psycopg.rows import dict_row
from psycopg.types.json import Json  # <-- key: adapts Python dict to JSON/JSONB

from .. import db


async def create_or_get_open_encounter(patient_id: str, chief_complaint: str) -> str:
    """
    Return the most recent OPEN encounter for this patient; if none exists, create one.
    """
    pool = db.get_pool()
    async with pool.connection() as conn:
        async with conn.cursor(row_factory=dict_row) as cur:
            # Reuse an open encounter if present (pre-visit intake session)
            await cur.execute(
                """
                SELECT id
                FROM encounters
                WHERE patient_id = %s
                  AND status = 'open'
                ORDER BY started_at DESC
                LIMIT 1
                """,
                (patient_id,),
            )
            row = await cur.fetchone()
            if row and row.get("id"):
                encounter_id = str(row["id"])
            else:
                await cur.execute(
                    """
                    INSERT INTO encounters (patient_id, encounter_type, status, chief_complaint)
                    VALUES (%s, 'chat', 'open', %s)
                    RETURNING id
                    """,
                    (patient_id, chief_complaint),
                )
                new_row = await cur.fetchone()
                encounter_id = str(new_row["id"])
        await conn.commit()
    return encounter_id


async def insert_patient_note(
    *,
    encounter_id: str,
    author_user_id: str,
    content: str,
    data: Dict[str, Any],
) -> str:
    """
    Insert a patient-authored note for the encounter (structured intake).
    IMPORTANT: Wrap the dict in Json(...) so psycopg can adapt it for JSONB.
    """
    safe_data: Dict[str, Any] = data or {}

    pool = db.get_pool()
    async with pool.connection() as conn:
        async with conn.cursor(row_factory=dict_row) as cur:
            await cur.execute(
                """
                INSERT INTO encounter_notes (encounter_id, author_user_id, kind, content, data)
                VALUES (%s, %s, 'patient_note', %s, %s)
                RETURNING id
                """,
                (encounter_id, author_user_id, content, Json(safe_data)),
            )
            row = await cur.fetchone()
        await conn.commit()
    return str(row["id"])


async def fetch_latest_patient_intake_for_patient(patient_id: str) -> Optional[Dict[str, Any]]:
    """
    Return the latest patient-authored intake note for this patient (joined to its encounter).
    """
    pool = db.get_pool()
    async with pool.connection() as conn:
        async with conn.cursor(row_factory=dict_row) as cur:
            await cur.execute(
                """
                SELECT
                  n.id           AS note_id,
                  e.id           AS encounter_id,
                  e.chief_complaint,
                  n.content,
                  n.data,
                  n.created_at
                FROM encounter_notes n
                JOIN encounters e ON e.id = n.encounter_id
                WHERE e.patient_id = %s
                  AND n.kind = 'patient_note'
                ORDER BY n.created_at DESC
                LIMIT 1
                """,
                (patient_id,),
            )
            return await cur.fetchone()
