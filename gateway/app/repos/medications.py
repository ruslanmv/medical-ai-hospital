from __future__ import annotations

async def list_medications(cur, patient_id: str):
    await cur.execute(
        "SELECT * FROM medications WHERE patient_id = %s ORDER BY created_at DESC",
        (patient_id,),
    )
    return await cur.fetchall()

async def add_medication(
    cur,
    patient_id: str,
    *,
    drug_name: str,
    dose: str | None = None,
    route: str | None = None,
    frequency: str | None = None,
    start_date: str | None = None,
    end_date: str | None = None,
    prn: bool | None = None,
):
    await cur.execute(
        """
        INSERT INTO medications (patient_id, drug_name, dose, route, frequency, start_date, end_date, prn)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        RETURNING id
        """,
        (patient_id, drug_name, dose, route, frequency, start_date, end_date, prn),
    )
    return await cur.fetchone()
