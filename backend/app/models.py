from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator


class IntakePayload(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    phone: str = Field(min_length=7, max_length=20)
    age: int = Field(ge=13, le=90)
    gender: str = Field(min_length=1, max_length=40)
    city: str = Field(min_length=2, max_length=80)
    consent: bool
    goals: list[str] = Field(min_length=1)
    height_cm: float = Field(ge=120, le=230)
    weight_kg: float = Field(ge=35, le=220)
    target_weight_kg: float = Field(ge=35, le=220)
    diet_type: Literal["vegetarian", "eggetarian", "non_vegetarian", "vegan", "jain"]
    cuisine_preferences: list[str] = Field(default_factory=list)
    wake_time: str = Field(min_length=4, max_length=10)
    sleep_time: str = Field(min_length=4, max_length=10)
    work_schedule: str = Field(min_length=1, max_length=80)
    workout_level: str = Field(min_length=1, max_length=80)
    cravings: list[str] = Field(default_factory=list)
    water_intake: str = Field(min_length=1, max_length=80)
    eating_out_frequency: str = Field(min_length=1, max_length=80)
    cooking_help: str = Field(min_length=1, max_length=80)
    allergies_dislikes: list[str] = Field(default_factory=list)
    medical_risks: list[str] = Field(default_factory=list)
    active_medication: bool = False
    abnormal_reports: bool = False
    optional_note: str = Field(default="", max_length=600)

    @field_validator("name", "phone", "gender", "city", "wake_time", "sleep_time", "work_schedule", "workout_level", "water_intake", "eating_out_frequency", "cooking_help")
    @classmethod
    def strip_text(cls, value: str) -> str:
        return value.strip()

    @field_validator("consent")
    @classmethod
    def require_consent(cls, value: bool) -> bool:
        if not value:
            raise ValueError("Consent is required to create a plan or nutrition brief.")
        return value


class TriageResult(BaseModel):
    eligible_for_ai_plan: bool
    risk_flags: list[str]
    reason: str
    recommended_action: str


class PlanValidationResult(BaseModel):
    valid: bool
    issues: list[str] = Field(default_factory=list)


class CheckInPayload(BaseModel):
    day_number: int = Field(ge=1, le=7)
    adherence: Literal["low", "partial", "mostly", "complete"]
    hunger: Literal["low", "okay", "high"]
    energy: Literal["low", "okay", "good"]
    digestion: Literal["okay", "bloating", "constipation", "acidity", "other_issue"]
    cravings: Literal["none", "manageable", "strong"]
    notes: str = Field(default="", max_length=500)


class UpgradeIntentPayload(BaseModel):
    plan_type: Literal["ai_continuation", "human_dietician"]
    contact_preference: Literal["whatsapp", "phone_call"]
    message: str = Field(default="", max_length=500)


class ApiLeadResponse(BaseModel):
    lead_id: str
    status: str
    triage: TriageResult
    result_type: Literal["plan", "brief"]
    result: dict[str, Any]



class ClientCreatePayload(BaseModel):
    name: str = Field(default="", max_length=80)
    phone: str = Field(default="", max_length=24)
    email: str = Field(default="", max_length=160)
    city: str = Field(default="", max_length=80)
    consent: bool = False
    start_date: str = Field(default="", max_length=10)
    end_date: str = Field(default="", max_length=10)

    @field_validator("name", "phone", "email", "city", "start_date", "end_date")
    @classmethod
    def strip_client_text(cls, value: str) -> str:
        return value.strip()


class ClientUpdatePayload(BaseModel):
    name: str | None = Field(default=None, max_length=80)
    phone: str | None = Field(default=None, max_length=24)
    email: str | None = Field(default=None, max_length=160)
    city: str | None = Field(default=None, max_length=80)
    consent: bool | None = None
    start_date: str | None = Field(default=None, max_length=10)
    end_date: str | None = Field(default=None, max_length=10)
    data: dict[str, Any] | None = None

    @field_validator("start_date", "end_date")
    @classmethod
    def strip_optional_date(cls, value: str | None) -> str | None:
        return value.strip() if value is not None else None


class ClientOptionPayload(BaseModel):
    category: str = Field(min_length=1, max_length=120)
    value: str = Field(min_length=1, max_length=80)


class CustomTabFieldPayload(BaseModel):
    label: str = Field(min_length=1, max_length=80)
    type: str = Field(default="text")
    options: list[str] = Field(default_factory=list)
    span: int = 1
    placeholder: str = Field(default="", max_length=120)
    help: str = Field(default="", max_length=300)


class ClientTabPayload(BaseModel):
    label: str = Field(min_length=1, max_length=60)
    description: str = Field(default="", max_length=200)
    fields: list[CustomTabFieldPayload] = Field(min_length=1)


class StrategyCreatePayload(BaseModel):
    name: str = Field(default="", max_length=120)


class StrategyUpdatePayload(BaseModel):
    name: str | None = Field(default=None, max_length=120)
    data: dict[str, Any] | None = None


class StrategyPublishPayload(BaseModel):
    attestation: bool = False
    note: str = Field(default="", max_length=1000)


class StrategyRefreshPayload(BaseModel):
    scope: Literal["clinical", "body", "support", "all"] = "clinical"
