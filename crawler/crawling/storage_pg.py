# storage_pg.py
import os

import psycopg2
from typing import List, Dict

def get_conn():
    return psycopg2.connect(
        host=os.getenv("PG_HOST"),
        port=os.getenv("PG_PORT"),
        dbname=os.getenv("PG_DB"),
        user=os.getenv("PG_USER"),
        password=os.getenv("PG_PASSWORD"),
    )

def save_notices(notices: List[Dict]) -> Dict[str, int]:
    inserted = 0
    skipped = 0

    sql = """
    INSERT INTO notices (
        source, title, url, posted_date, category,
        content_text, content_hash,
        attachments, images, crawled_at
    )
    VALUES (
        %(source)s, %(title)s, %(url)s, %(posted_date)s, %(category)s,
        %(content_text)s, %(content_hash)s,
        '[]'::jsonb, '[]'::jsonb, %(crawled_at)s
    )
    ON CONFLICT (url) DO NOTHING;
    """

    with get_conn() as conn:
        with conn.cursor() as cur:
            for n in notices:
                cur.execute(sql, n)
                if cur.rowcount == 1:
                    inserted += 1
                else:
                    skipped += 1
        conn.commit()

    return {"inserted": inserted, "skipped": skipped}
