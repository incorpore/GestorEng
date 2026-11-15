"""Uso:
  python -m app.modules.backup.cli executar
  python -m app.modules.backup.cli listar
  python -m app.modules.backup.cli restaurar <chave>   (pare a API antes)
"""
import sys

from app.core.database import SessionLocal
from app.modules import load_modules

from . import service


def main() -> None:
    load_modules()
    cmd = sys.argv[1] if len(sys.argv) > 1 else "listar"
    with SessionLocal() as db:
        if cmd == "executar":
            r = service.executar(db, "manual")
            print(r.status, r.chave or "", r.mensagem or "")
        elif cmd == "listar":
            for o in service.listar_remotos(db):
                print(o["data"], o["tamanho"], o["chave"])
        elif cmd == "restaurar" and len(sys.argv) > 2:
            if input(f"Restaurar {sys.argv[2]}? Isto SOBRESCREVE o banco atual. Digite RESTAURAR: ") != "RESTAURAR":
                return
            service.restaurar(db, sys.argv[2])
            print("Restauração concluída. Execute 'alembic upgrade head' e reinicie a API.")
        else:
            print(__doc__)


if __name__ == "__main__":
    main()
