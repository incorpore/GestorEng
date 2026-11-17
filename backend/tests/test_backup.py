import io
import tarfile

import boto3
import pytest
from moto import mock_aws


@pytest.fixture()
def s3():
    with mock_aws():
        c = boto3.client("s3", region_name="us-east-1")
        c.create_bucket(Bucket="bkp")
        yield c


def test_backup_s3(admin, s3):
    r = admin.put("/api/backup/config", json={"ativo": True, "bucket": "bkp", "access_key": "AK", "secret_key": "SK",
                                              "prefixo": "velmont", "retencao_dias": 30})
    assert r.status_code == 200 and r.json()["secret_definido"] and r.json()["prefixo"] == "velmont/"
    assert "secret_key" not in r.json()
    assert admin.post("/api/backup/testar").json()["ok"]
    from app.core.database import SessionLocal
    from app.modules.backup import service

    # arquivo grande (> 8 MB) força upload em partes (multipart), onde checksums do boto3 quebravam o S3-compatível
    import os

    from app.core import storage

    grande = storage.root() / "ab" / "grande.bin"
    grande.parent.mkdir(parents=True, exist_ok=True)
    grande.write_bytes(os.urandom(12 * 1024 * 1024))
    with SessionLocal() as db:
        reg = service.executar(db, "manual")
    assert reg.status == "sucesso", reg.mensagem
    obj = s3.get_object(Bucket="bkp", Key=reg.chave)["Body"].read()
    names = tarfile.open(fileobj=io.BytesIO(obj), mode="r:gz").getnames()
    assert "database.dump" in names
    hist = admin.get("/api/backup/historico").json()
    assert hist[0]["status"] == "sucesso"
    assert any(o["chave"] == reg.chave for o in admin.get("/api/backup/remotos").json())


def test_backup_exige_admin(admin):
    from conftest import client_for, make_user

    make_user(admin, "naoadmin@teste.com", perms=["configuracoes.editar"])
    assert client_for("naoadmin@teste.com").get("/api/backup/config").status_code == 403
