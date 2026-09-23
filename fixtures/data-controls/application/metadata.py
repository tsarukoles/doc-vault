"""Load validation_rules metadata using the example CSV schema."""

import csv


def load_validation_rules(catalog_path):
    with open(catalog_path, newline="", encoding="utf-8") as source:
        return [
            row["rule_id"]
            for row in csv.DictReader(source)
            if row.get("enabled", "false").lower() == "true"
        ]
