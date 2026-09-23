from .registry import CONTROLS


def validate(records, enabled_controls):
    findings = []
    for record in records:
        for name in enabled_controls:
            if not CONTROLS[name](record):
                findings.append({"record_id": record.get("id"), "control": name})
    return findings
