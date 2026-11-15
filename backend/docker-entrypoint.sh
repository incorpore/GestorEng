#!/bin/sh
set -e
case "$1" in
  api)
    echo "Aplicando migrações..."
    alembic upgrade head
    python -m app.seed
    exec gunicorn app.main:app -k uvicorn.workers.UvicornWorker -b 0.0.0.0:8000 \
      --workers "${WEB_CONCURRENCY:-3}" --timeout 180 --graceful-timeout 30 \
      --forwarded-allow-ips="*" --access-logfile - --error-logfile -
    ;;
  worker)
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
