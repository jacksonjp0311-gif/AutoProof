from typing import Literal, Optional
from pydantic import BaseModel, Field


class SessionCreate(BaseModel):
    theorem: str = Field(min_length=1, max_length=20_000)
    natural_language: Optional[str] = Field(default=None, max_length=2_000)
    title: str = Field(default="Untitled proof", max_length=120)


class SuggestRequest(BaseModel):
    session_id: str
    goal: str = Field(min_length=1, max_length=10_000)
    context: str = Field(default="", max_length=20_000)


class ApplyTacticRequest(BaseModel):
    session_id: str
    tactic: str = Field(min_length=1, max_length=2_000)
    code: str = Field(min_length=1, max_length=40_000)


class FeedbackRequest(BaseModel):
    session_id: str
    tactic: str
    verdict: Literal["approved", "edited", "rejected"]
    edited_tactic: Optional[str] = None
    note: Optional[str] = Field(default=None, max_length=4_000)


class CounterexampleRequest(BaseModel):
    statement: str = Field(min_length=1, max_length=10_000)
    bounds: int = Field(default=12, ge=1, le=100)

