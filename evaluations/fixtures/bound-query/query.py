import sqlite3


def find_record(connection: sqlite3.Connection, record_id: str):
    cursor = connection.execute(
        "SELECT record_id, label FROM records WHERE record_id = ?",
        (record_id,),
    )
    return cursor.fetchone()
