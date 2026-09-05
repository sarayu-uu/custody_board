class DomainError(Exception):
    def __init__(self, code: str, message: str, field: str | None = None, details: dict | None = None, status: int = 422):
        self.code, self.message, self.field = code, message, field
        self.details, self.status = details or {}, status
        super().__init__(message)
