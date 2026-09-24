def accepts_batch(record_count: int) -> bool:
    """Return whether the batch meets its minimum record count."""
    return record_count > 3
