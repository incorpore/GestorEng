#!/bin/sh
set -e
aguardar_banco() {
  python - <<'PY'
import sys, time
from sqlalchemy import create_engine, text
from app.core.config import get_settings
url = get_settings().database_url
for i in range(60):
    try:
        with create_engine(url).connect() as c:
            c.execute(text("SELECT 1"))
        sys.exit(0)
    except Exception as e:
        print(f"Aguardando o banco de dados ({i + 1}/60): {e.__class__.__name__}", flush=True)
        time.sleep(3)
print("Banco de dados indisponível após 3 minutos", flush=True)
sys.exit(1)
PY
}

case "$1" in
  api)
    aguardar_banco
    echo "Aplicando migrações..."
    alembic upgrade head
    python -m app.seed
    exec gunicorn app.main:app -k uvicorn.workers.UvicornWorker -b 0.0.0.0:8000 \
      --workers "${WEB_CONCURRENCY:-3}" --timeout 180 --graceful-timeout 30 \
      --forwarded-allow-ips="*" --access-logfile - --error-logfile -
    ;;
  worker)
    aguardar_banco
    # aguarda a API aplicar as migrações
    until alembic current 2>/dev/null | grep -q "(head)"; do echo "Aguardando migrações..."; sleep 5; done
    exec python -m app.worker
    ;;
  backup)
    shift; exec python -m app.modules.backup.cli "$@"
    ;;
  *)
    exec "$@"
    ;;
esac
