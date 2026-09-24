from shared_runtime import process_once


def handler(event, context):
    return process_once(event)
