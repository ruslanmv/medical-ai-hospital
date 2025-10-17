from __future__ import annotations

async def list_allergies(cur, patient_id: str):
    await cur.execute(
        "SELECT * FROM allergies WHERE patient_id = %s ORDER BY created_at DESC",
        (patient_id,),
    )
    return await cur.fetchall()

async def add_allergy(cur, patient_id: str, *, substance: str, reaction: str | None, severity: str | None, note: str | None = None):
    await cur.execute(
        """
        INSERT INTO allergies (patient_id, substance, reaction, severity, note)
        VALUES (%s, %s, %s, %s, %s)
        RETURNING id
        """,
        (patient_id, substance, reaction, severity, note),
    )
    return await cur.fetchone()
