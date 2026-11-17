"""Regras do diário: numeração, cópia do diário anterior e avanço dos serviços do cronograma."""
import uuid
from datetime import date

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .models import DiarioObra


def proximo_numero(db: Session, obra_id: int) -> int:
    return (db.scalar(select(func.max(DiarioObra.numero)).where(DiarioObra.obra_id == obra_id)) or 0) + 1


def normalizar(data: dict, dia: date | None) -> None:
    """Identifica pendências, data de resolução e sincroniza a condição resumida de manhã/tarde."""
    for p in data.get("pendencias") or []:
        p["id"] = p.get("id") or uuid.uuid4().hex[:12]
        p["origem_data"] = p.get("origem_data") or (dia.isoformat() if dia else None)
        if p.get("resolvida") and not p.get("resolvida_em"):
            p["resolvida_em"] = dia.isoformat() if dia else None
        if not p.get("resolvida"):
            p["resolvida_em"] = None
    det = data.get("clima_detalhe")
    if isinstance(det, dict):
        for periodo in ("manha", "tarde", "noite"):
            cond = (det.get(periodo) or {}).get("condicao")
            if cond:
                data[f"clima_{periodo}"] = cond


def anterior(db: Session, obra_id: int, antes_de: date | None = None) -> DiarioObra | None:
    q = select(DiarioObra).where(DiarioObra.obra_id == obra_id)
    if antes_de:
        q = q.where(DiarioObra.data < antes_de)
    return db.scalar(q.order_by(DiarioObra.data.desc()).limit(1))


def modelo_do_anterior(db: Session, obra_id: int, dia: date | None) -> dict:
    """Dados para iniciar um novo diário a partir do anterior:
    equipe e máquinas; serviços ainda não concluídos; somente pendências não resolvidas."""
    from app.modules.obras.models import ServicoObra

    d = anterior(db, obra_id, dia)
    out: dict = {"efetivo": [], "equipamentos": [], "atividades": [], "pendencias": [], "origem": None}
    if d:
        out.update(
            origem={"id": d.id, "data": d.data.isoformat(), "numero": d.numero},
            efetivo=d.efetivo or [],
            equipamentos=d.equipamentos or [],
            atividades=[a for a in (d.atividades or []) if float(a.get("percentual") or 0) < 100
                        and a.get("situacao") != "concluida"],
            pendencias=[p for p in (d.pendencias or []) if not p.get("resolvida")],
        )
    # serviços do cronograma previstos para o dia que ainda não estão na lista
    dia = dia or date.today()
    ja = {a.get("servico_id") for a in out["atividades"] if a.get("servico_id")}
    for s in db.scalars(select(ServicoObra).where(ServicoObra.obra_id == obra_id, ServicoObra.inicio <= dia,
                                                  ServicoObra.fim >= dia).order_by(ServicoObra.ordem)):
        if s.id not in ja and float(s.percentual or 0) < 100:
            out["atividades"].append({"servico_id": s.id, "descricao": s.descricao, "local": s.local,
                                      "percentual": float(s.percentual or 0)})
    return out


def atualizar_servicos(db: Session, obra_id: int) -> None:
    """O avanço de cada serviço do cronograma é o percentual informado no diário mais recente que o cita."""
    from app.modules.obras.models import ServicoObra

    vistos: dict[int, float] = {}
    for d in db.scalars(select(DiarioObra).where(DiarioObra.obra_id == obra_id).order_by(DiarioObra.data.desc())):
        for a in d.atividades or []:
            sid = a.get("servico_id")
            if sid and sid not in vistos and a.get("percentual") is not None:
                vistos[sid] = float(a["percentual"])
    if not vistos:
        return
    for s in db.scalars(select(ServicoObra).where(ServicoObra.obra_id == obra_id, ServicoObra.id.in_(vistos))):
        s.percentual = vistos[s.id]
