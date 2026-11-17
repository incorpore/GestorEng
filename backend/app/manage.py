"""Comandos de manutenção (executar dentro do container struvia-api).

  python -m app.manage criar-admin  <email> <nome>        cria um administrador (pede a senha)
  python -m app.manage senha        <email>               redefine a senha (pede a nova)
  python -m app.manage desbloquear  <email>               remove bloqueio por tentativas
  python -m app.manage remover-2fa  <email>               desativa a verificação em duas etapas
  python -m app.manage sair-todos   <email>               encerra todas as sessões do usuário
  python -m app.manage usuarios                           lista usuários
  python -m app.manage verificar                          testa banco, Redis, pasta de arquivos e pg_dump
  python -m app.manage gerar-chave                        gera um valor para SECRET_KEY/ENCRYPTION_KEY
"""
import getpass
import os
import secrets
import shutil
import subprocess  # noqa: S404
import sys

from sqlalchemy import select, text, update

from app.core.config import get_settings
from app.core.database import SessionLocal
from app.core.security import hash_password, validate_password_strength
from app.modules import load_modules


def _senha() -> str:
    while True:
        s1 = getpass.getpass("Nova senha: ")
        if err := validate_password_strength(s1):
            print(f"  ✗ {err}")
            continue
        if getpass.getpass("Confirme: ") != s1:
            print("  ✗ As senhas não conferem")
            continue
        return s1


def _usuario(db, email: str):
    from app.modules.auth.models import Usuario

    u = db.scalar(select(Usuario).where(Usuario.email == email.lower()))
    if not u:
        sys.exit(f"Usuário {email} não encontrado")
    return u


def main(argv: list[str]) -> None:
    if not argv or argv[0] in ("-h", "--help", "ajuda"):
        print(__doc__)
        return
    cmd, args = argv[0], argv[1:]
    if cmd == "gerar-chave":
        print(secrets.token_urlsafe(48))
        return
    load_modules()
    from app.modules.auth.models import RefreshToken, Usuario

    with SessionLocal() as db:
        if cmd == "criar-admin" and len(args) >= 2:
            if db.scalar(select(Usuario).where(Usuario.email == args[0].lower())):
                sys.exit("E-mail já cadastrado — use o comando 'senha'")
            db.add(Usuario(email=args[0].lower(), nome=" ".join(args[1:]), password_hash=hash_password(_senha()),
                           superusuario=True, trocar_senha=False))
            db.commit()
            print(f"✓ Administrador {args[0]} criado")
        elif cmd == "senha" and args:
            u = _usuario(db, args[0])
            u.password_hash, u.trocar_senha, u.bloqueado_ate, u.tentativas_falhas = hash_password(_senha()), False, None, 0
            u.token_version += 1
            db.commit()
            print("✓ Senha redefinida e sessões encerradas")
        elif cmd == "desbloquear" and args:
            u = _usuario(db, args[0])
            u.bloqueado_ate, u.tentativas_falhas, u.ativo = None, 0, True
            db.commit()
            print("✓ Usuário desbloqueado e ativo")
        elif cmd == "remover-2fa" and args:
            u = _usuario(db, args[0])
            u.totp_ativo, u.totp_secret = False, None
            db.commit()
            print("✓ Verificação em duas etapas removida")
        elif cmd == "sair-todos" and args:
            u = _usuario(db, args[0])
            u.token_version += 1
            db.execute(update(RefreshToken).where(RefreshToken.usuario_id == u.id).values(revogado_em=text("now()")))
            db.commit()
            print("✓ Sessões encerradas")
        elif cmd == "usuarios":
            for u in db.scalars(select(Usuario).order_by(Usuario.nome)):
                flags = ", ".join(x for x, ok in (("admin", u.superusuario), ("inativo", not u.ativo),
                                                   ("bloqueado", bool(u.bloqueado_ate)), ("2FA", u.totp_ativo)) if ok)
                print(f"{u.id:4}  {u.email:40} {u.nome}  {flags}")
        elif cmd == "verificar":
            _verificar(db)
        else:
            print(__doc__)
            sys.exit(1)


def _verificar(db) -> None:
    s = get_settings()
    ok = True
    try:
        v = db.execute(text("SHOW server_version")).scalar()
        print(f"✓ PostgreSQL conectado (versão {v})")
    except Exception as e:  # noqa: BLE001
        ok = False
        print(f"✗ PostgreSQL: {e}")
    if s.redis_url:
        from app.core import ratelimit

        try:
            ratelimit._redis.ping()
            print(f"✓ Redis conectado (prefixo '{ratelimit.PREFIX}')")
        except Exception as e:  # noqa: BLE001
            ok = False
            print(f"✗ Redis: {e}")
    else:
        print("• Redis não configurado (opcional)")
    try:
        os.makedirs(s.storage_dir, exist_ok=True)
        p = os.path.join(s.storage_dir, ".teste-escrita")
        with open(p, "w") as f:
            f.write("ok")
        os.remove(p)
        print(f"✓ Pasta de arquivos gravável ({s.storage_dir})")
    except OSError as e:
        ok = False
        print(f"✗ Pasta de arquivos sem permissão de escrita: {e}  → rode no ZimaOS: sudo chown -R 10001:10001 <pasta>")
    if shutil.which("pg_dump"):
        out = subprocess.run(["pg_dump", "--version"], capture_output=True, text=True).stdout.strip()  # noqa: S603,S607
        print(f"✓ {out} (backup)")
    print(f"• Cookie seguro (HTTPS): {s.cookie_secure}   • Origens CORS: {', '.join(s.cors_origins)}")
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main(sys.argv[1:])
