from pydantic import BaseModel, EmailStr, Field

class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)

class LoginIn(BaseModel):
    email: EmailStr
    password: str

class MeOut(BaseModel):
    id: str
    email: EmailStr
    is_verified: bool = False
