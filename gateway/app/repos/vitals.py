async def list_latest_vitals(cur, patient_id: str):
    await cur.execute("SELECT * FROM v_latest_vitals WHERE patient_id = %s", (patient_id,))
    return await cur.fetchone()
