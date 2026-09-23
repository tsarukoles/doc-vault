from .runner import validate
from .metadata import load_validation_rules


def handle(event, context=None):
    records = event.get("records", [])
    enabled = event.get("controls", ["identifier_present", "amount_nonnegative"])
    if event.get("catalog_path"):
        enabled = load_validation_rules(event["catalog_path"])
    return {"findings": validate(records, enabled)}
