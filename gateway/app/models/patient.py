from pydantic import BaseModel, EmailStr
from typing import Optional, Any

class PatientUpdateIn(BaseModel):
    first_name: Optional[str] = None
    middle_name: Optional[str] = None
    last_name: Optional[str] = None
    date_of_birth: Optional[str] = None  # ISO date
    sex: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[EmailStr] = None
    address_line1: Optional[str] = None
    address_line2: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    postal_code: Optional[str] = None
    country_code: Optional[str] = None

class PatientProfileOut(BaseModel):
    patient_id: str
    first_name: Optional[str]
    middle_name: Optional[str]
    last_name: Optional[str]
    date_of_birth: Optional[str]
    sex: Optional[str]
    email: Optional[EmailStr] | None
    phone: Optional[str]
    address_line1: Optional[str]
    address_line2: Optional[str]
    city: Optional[str]
    state: Optional[str]
    postal_code: Optional[str]
    country_code: Optional[str]
    conditions: Optional[Any]
    allergies: Optional[Any]
    medications: Optional[Any]
    latest_vitals: Optional[Any]
