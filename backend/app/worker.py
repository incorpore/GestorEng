"""Processo de tarefas agendadas (container 'worker'): backup diário no S3.

Usa advisory lock do PostgreSQL para garantir uma única execução mesmo com várias réplicas.
"""
import logging
import signal
import time
from datetime import datetime, timedelta

from sqlalchemy import func, select, text

from app.core.database import SessionLocal
from app.modules import load_modules

log = logging.getLogger("worker")
LOCK_ID = 7_301_2026
running = True


def _stop(*_):
    global running
    running = False


def tick() -> None:
    from app.modules.backup import service
    from app.modules.backup.models import BackupLog

    with SessionLocal() as db:
        cfg, _ = service.config(db)
        if not cfg.get("ativo"):
            return
        agora = datetime.now()
        alvo = agora.replace(hour=int(cfg["hora"]), minute=int(cfg["minuto"]), second=0, microsecond=0)
        if agora < alvo or agora - alvo > timedelta(hours=6):
            return
        ultimo = db.scalar(select(func.max(BackupLog.iniciado_em)).where(BackupLog.origem == "agendado",
                                                                          BackupLog.status != "erro"))
        if ultimo and ultimo.astimezone().replace(tzinfo=None) >= alvo:
            return
        if not db.execute(text("SELECT pg_try_advisory_lock(:k)"), {"k": LOCK_ID}).scalar():
            return
        try:
            log.info("Iniciando backup agendado")
            r = service.executar(db, "agendado")
            log.info("Backup %s %s", r.status, r.chave or r.mensagem)
        finally:
            db.execute(text("SELECT pg_advisory_unlock(:k)"), {"k": LOCK_ID})
            db.commit()


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
    load_modules()
    signal.signal(signal.SIGTERM, _stop)
    signal.signal(signal.SIGINT, _stop)
    log.info("Worker iniciado")
    while running:
        try:
            tick()
        except Exception:  # noqa: BLE001
            log.exception("Falha no ciclo do worker")
        for _ in range(60):
            if not running:
                break
            time.sleep(1)


if __name__ == "__main__":
    main()
