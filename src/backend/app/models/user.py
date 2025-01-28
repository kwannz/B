from pydantic import BaseModel, EmailStr

class User(BaseModel):
    username: str
    email: EmailStr
    full_name: str
    disabled: bool = False
