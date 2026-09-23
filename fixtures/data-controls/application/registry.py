from .rules import has_identifier, has_nonnegative_amount

CONTROLS = {
    "identifier_present": has_identifier,
    "amount_nonnegative": has_nonnegative_amount,
}
