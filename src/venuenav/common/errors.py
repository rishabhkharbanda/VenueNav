from fastapi import HTTPException, status


class AppError(Exception):
    def __init__(self, code: str, message: str, status_code: int = status.HTTP_400_BAD_REQUEST) -> None:
        self.code = code
        self.message = message
        self.status_code = status_code
        super().__init__(message)


def http_error(detail: str, code: str = "ERROR", sc: int = status.HTTP_400_BAD_REQUEST) -> HTTPException:
    return HTTPException(status_code=sc, detail={"code": code, "message": detail})


def not_found(what: str) -> HTTPException:
    return http_error(f"{what} not found", "NOT_FOUND", status.HTTP_404_NOT_FOUND)
