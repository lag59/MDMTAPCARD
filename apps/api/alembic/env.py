import os
import sys
from logging.config import fileConfig
from sqlalchemy import engine_from_config, pool
from alembic import context

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.database import Base
from app.models import *  # noqa: F401,F403

config = context.config

# Prefer runtime DATABASE_URL (e.g., docker compose environment) over alembic.ini default.
database_url = os.getenv("DATABASE_URL")
if database_url:
    # Migrations run synchronously via psycopg (v3); coerce any provider URL to it.
    for prefix in ("postgresql+asyncpg://", "postgresql://", "postgres://"):
        if database_url.startswith(prefix):
            database_url = "postgresql+psycopg://" + database_url[len(prefix):]
            break
    config.set_main_option("sqlalchemy.url", database_url)

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def _ensure_alembic_version_column_capacity(connection) -> None:
    """Prevent migration failures when revision ids exceed legacy varchar(32)."""
    try:
        from sqlalchemy import text

        exists = connection.execute(
            text(
                """
                SELECT 1
                FROM information_schema.columns
                WHERE table_name = 'alembic_version'
                  AND column_name = 'version_num'
                LIMIT 1
                """
            )
        ).scalar_one_or_none()
        if not exists:
            return

        connection.execute(
            text("ALTER TABLE alembic_version ALTER COLUMN version_num TYPE VARCHAR(128)")
        )
    except Exception:
        # Best-effort safeguard; migration execution continues.
        if connection.in_transaction():
            connection.rollback()
    else:
        # The metadata query and optional ALTER open a transaction. Complete it
        # before Alembic opens the transaction that runs actual revisions.
        if connection.in_transaction():
            connection.commit()


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        _ensure_alembic_version_column_capacity(connection)
        context.configure(connection=connection, target_metadata=target_metadata)

        with context.begin_transaction():
            context.run_migrations()


run_migrations_online() if not context.is_offline_mode() else run_migrations_offline()
