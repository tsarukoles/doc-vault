"""Pure validation functions; this module has no external dependencies."""


def has_identifier(record):
    return bool(record.get("id"))


def has_nonnegative_amount(record):
    return isinstance(record.get("amount"), (int, float)) and record["amount"] >= 0
