#!/usr/bin/env python3
"""
Script simples para normalizar registros JSON (campo TX_INSUMO) usando os mapeamentos em mappings.json.

Uso:
  python backend/etl_normalize.py --input data.json --output normalized.json

O script aplica os padrões na ordem de `priority` (menor primeiro). Usa regex case-insensitive.
"""
import argparse
import json
import re
from pathlib import Path


def load_mappings(path: Path):
    with path.open("r", encoding="utf-8") as f:
        data = json.load(f)
    # ordenar por priority
    return sorted(data, key=lambda x: x.get("priority", 100))


def normalize_record(rec, mappings):
    tx = rec.get("TX_INSUMO") or rec.get("tx_insumo") or ""
    if not tx:
        rec["tx_insumo_norm"] = None
        return rec
    # tentativa direta por patterns
    for m in mappings:
        pattern = m.get("pattern")
        try:
            if re.search(pattern, tx, flags=re.IGNORECASE):
                rec["tx_insumo_norm"] = m.get("vacina_normalizada")
                return rec
        except re.error:
            if pattern.lower() in tx.lower():
                rec["tx_insumo_norm"] = m.get("vacina_normalizada")
                return rec

    # tratamento especial para DILUENTES: tentar extrair o nome da vacina e re-match
    tx_upper = tx.upper()
    if "DILUENTE" in tx_upper:
        # remover prefixos conhecidos e tentar extrair parte que indica a vacina
        # exemplos: "DILUENTE P/VACINA BCG", "DILUENTE PARA VACINA CONTRA VARICELA"
        # regex para capturar o que vem após 'VACINA' ou 'P/VACINA' ou 'PARA VACINA'
        m = re.search(r"VACINA(?:\s*(?:P/|PARA|CONTRA)\s*)?(.*)$", tx_upper, flags=re.IGNORECASE)
        candidate = None
        if m:
            candidate = m.group(1).strip()
        else:
            # fallback: remove 'DILUENTE' e use o resto
            candidate = re.sub(r".*DILUENTE.*?","", tx_upper, flags=re.IGNORECASE).strip()

        if candidate:
            # limpar palavras extras
            candidate = re.sub(r"[\-\(\)\,\d]","", candidate).strip()
            # tentar matching com os mappings usando candidate
            for m2 in mappings:
                pat = m2.get("pattern")
                try:
                    if re.search(pat, candidate, flags=re.IGNORECASE):
                        rec["tx_insumo_norm"] = m2.get("vacina_normalizada")
                        return rec
                except re.error:
                    if pat.lower() in candidate.lower():
                        rec["tx_insumo_norm"] = m2.get("vacina_normalizada")
                        return rec

    # fallback adicional: mapear SARS-COV2 variantes para Covid-19 se aparecer como 'SARS-COV2 - XXX'
    if re.search(r"SARS[- ]?COV2|COVID[- ]?19", tx, flags=re.IGNORECASE):
        rec["tx_insumo_norm"] = "Covid-19"
        return rec

    rec["tx_insumo_norm"] = None
    return rec


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--mappings", default="backend/mappings.json")
    p.add_argument("--input", required=True)
    p.add_argument("--output", required=True)
    args = p.parse_args()

    mappings = load_mappings(Path(args.mappings))

    with open(args.input, "r", encoding="utf-8") as f:
        data = json.load(f)

    out = [normalize_record(dict(rec), mappings) for rec in data]

    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)

    print(f"Wrote {len(out)} records to {args.output}")


if __name__ == "__main__":
    main()
