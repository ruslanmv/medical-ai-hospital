from __future__ import annotations

async def list_vitals(cur, patient_id: str, limit: int = 50):
    await cur.execute(
        """
        SELECT *
        FROM vitals
        WHERE patient_id = %s
        ORDER BY timestamp_utc DESC
        LIMIT %s
        """,
        (patient_id, limit),
    )
    return await cur.fetchall()

async def add_vital(
    cur,
    patient_id: str,
    *,
    timestamp_utc: str,
    systolic_mmhg: int | None = None,
    diastolic_mmhg: int | None = None,
    heart_rate_bpm: int | None = None,
    resp_rate_min: int | None = None,
    temperature_c: float | None = None,
    spo2_percent: float | None = None,
    weight_kg: float | None = None,
    height_cm: float | None = None,
    bmi: float | None = None,
    serum_creatinine: float | None = None,
    egfr_ml_min_1_73m2: float | None = None,
):
    await cur.execute(
        """
        INSERT INTO vitals (
          patient_id, timestamp_utc, systolic_mmhg, diastolic_mmhg,
          heart_rate_bpm, resp_rate_min, temperature_c, spo2_percent,
          weight_kg, height_cm, bmi, serum_creatinine, egfr_ml_min_1_73m2
        )
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
        RETURNING id
        """,
        (
            patient_id, timestamp_utc, systolic_mmhg, diastolic_mmhg,
            heart_rate_bpm, resp_rate_min, temperature_c, spo2_percent,
            weight_kg, height_cm, bmi, serum_creatinine, egfr_ml_min_1_73m2
        ),
    )
    return await cur.fetchone()
