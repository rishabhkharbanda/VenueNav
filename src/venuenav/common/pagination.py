from pydantic import BaseModel, Field, field_validator


class PaginationParams(BaseModel):
    page: int = Field(1, ge=1, description="1-based page index")
    page_size: int = Field(20, ge=1, le=100, alias="page_size")

    @field_validator("page")
    @classmethod
    def page_ok(cls, v: int) -> int:
        return v

    def offset(self) -> int:
        return (self.page - 1) * self.page_size

    def limit(self) -> int:
        return self.page_size
