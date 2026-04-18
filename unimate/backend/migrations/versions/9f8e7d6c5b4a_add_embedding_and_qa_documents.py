"""add embedding column and qa_documents table

Revision ID: 9f8e7d6c5b4a
Revises: 718a15a2e387
Create Date: 2026-04-05 12:00:00.000000
"""
from typing import Sequence, Union

from alembic import op

revision: str = "9f8e7d6c5b4a"
down_revision: Union[str, None] = "718a15a2e387"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE notices ADD COLUMN IF NOT EXISTS embedding vector(1536)"
    )
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_notices_embedding
        ON notices USING ivfflat (embedding vector_cosine_ops)
        WITH (lists = 100)
    """)

    op.execute("""
        CREATE TABLE IF NOT EXISTS qa_documents (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            title VARCHAR(500) NOT NULL,
            content TEXT NOT NULL,
            category VARCHAR(50),
            source_url VARCHAR(1000),
            embedding vector(1536),
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_qa_documents_category ON qa_documents (category)"
    )
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_qa_documents_embedding
        ON qa_documents USING ivfflat (embedding vector_cosine_ops)
        WITH (lists = 100)
    """)


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_qa_documents_embedding")
    op.execute("DROP INDEX IF EXISTS ix_qa_documents_category")
    op.execute("DROP TABLE IF EXISTS qa_documents")
    op.execute("DROP INDEX IF EXISTS ix_notices_embedding")
    op.execute("ALTER TABLE notices DROP COLUMN IF EXISTS embedding")
