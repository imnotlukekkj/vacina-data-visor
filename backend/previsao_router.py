from fastapi import APIRouter, Query
from fastapi.responses import JSONResponse
from fastapi import HTTPException
from typing import Optional, Any, Dict, List
import os
import httpx
import re
from backend.env_utils import ensure_loaded_backend_env
from backend.normalizer import get_default_normalizer

try:
    from supabase import create_client
except Exception:  # pragma: no cover - graceful fallback if supabase client lib not installed
    create_client = None  # type: ignore

router = APIRouter()


def _get_supabase_client():
    """Return a supabase client if the SDK is installed and env vars are set.
    Reads environment variables at call time so you can export them without restarting the server.
    This function requires SUPABASE_SERVICE_ROLE_KEY to be present: the RPC needs elevated permissions.
    """
    ensure_loaded_backend_env()
    if not create_client:
        return None
    SUPABASE_URL = os.getenv("SUPABASE_URL")
    SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        return None
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)


async def _http_rpc_call(rpc_url: str, headers: dict, body: dict):
    try:
        async with httpx.AsyncClient(timeout=30.0) as httpcli:
            resp = await httpcli.post(rpc_url, json=body, headers=headers)
        try:
            parsed = resp.json()
        except Exception:
            parsed = resp.text
        return resp.status_code, parsed
    except Exception as e:
        return 502, str(e)


def _normalize_row(item: Any) -> Optional[Dict[str, Any]]:
    """Normalize a single RPC row into {"ano": int, "quantidade": float, "tipo_dado": str}.
    The RPC may return objects (dicts) or tuples/lists; try multiple heuristics.
    """
    if item is None:
        return None

    # If it's already a dict with helpful keys
    if isinstance(item, dict):
        # common key names
        ano_keys = ("ano", "year", "f0", "0", "ano_val")
        qty_keys = ("quantidade", "quant", "qtde", "f1", "1", "quantidade_val")
        tipo_keys = ("tipo_dado", "tipo", "f2", "2")

        def _pick(keys):
            for k in keys:
                if k in item and item.get(k) is not None:
                    return item.get(k)
            return None

        ano = _pick(ano_keys)
        quantidade = _pick(qty_keys)
        tipo = _pick(tipo_keys)

        # If keys not found, try to infer by value order
        if ano is None or quantidade is None:
            vals = list(item.values())
            if len(vals) >= 2:
                if ano is None:
                    ano = vals[0]
                if quantidade is None and len(vals) >= 2:
                    quantidade = vals[1]
                if tipo is None and len(vals) >= 3:
                    tipo = vals[2]

    elif isinstance(item, (list, tuple)):
        if len(item) >= 2:
            ano = item[0]
            quantidade = item[1]
            tipo = item[2] if len(item) > 2 else None
        else:
            return None
    else:
        # unknown item type
        return None

    # coerce types
    try:
        ano_int = int(ano) if ano is not None else None
    except Exception:
        try:
            ano_int = int(float(ano)) # type: ignore
        except Exception:
            ano_int = None
    try:
        quantidade_num = float(quantidade) if quantidade is not None else None
    except Exception:
        quantidade_num = None
    tipo_str = str(tipo) if tipo is not None else None

    if ano_int is None and quantidade_num is None and tipo_str is None:
        return None

    return {"ano": ano_int, "quantidade": quantidade_num, "tipo_dado": tipo_str}


def _extract_number_from_rpc_result(data: Any) -> Optional[float]:
    """Tenta extrair um número (float) do resultado de uma RPC que pode
    retornar um número direto, uma lista com um objeto {sum: ...}, ou um
    dicionário com chaves comuns.
    Retorna None se não for possível extrair um número.
    """
    if data is None:
        return None

    # direct number
    if isinstance(data, (int, float)):
        return float(data)

    # helper: keys we commonly see in RPC responses
    keys = ("sum", "soma", "quantidade", "total", "value", "qtde", "quant")

    # list / array responses
    if isinstance(data, list):
        if len(data) == 0:
            return None
        # If the first item is a dict, try to extract a numeric field
        first = data[0]
        if isinstance(first, dict):
            for key in keys:
                if key in first and first.get(key) is not None:
                    v = first.get(key)
                    try:
                        return float(v)
                    except Exception:
                        # continue trying other keys
                        continue
            # fallback: try first value in the dict
            try:
                v = next(iter(first.values()))
                if v is None:
                    return None
                try:
                    return float(v)
                except Exception:
                    # give up on this element and try other list elements
                    pass
            except Exception:
                pass
        # if not a dict (e.g., list of numbers or strings), try to coerce the first element
        try:
            if isinstance(first, (int, float)):
                return float(first)
            if isinstance(first, str):
                return float(first)
        except Exception:
            pass
        # as a last resort, scan list for a dict that contains one of the keys
        for elem in data:
            if isinstance(elem, dict):
                for key in keys:
                    if key in elem and elem.get(key) is not None:
                        try:
                            return float(elem.get(key))
                        except Exception:
                            continue
        return None

    # dict responses
    if isinstance(data, dict):
        for key in keys:
            if key in data and data.get(key) is not None:
                try:
                    return float(data.get(key))
                except Exception:
                    continue
        # fallback: try first value, possibly nested
        try:
            v = next(iter(data.values()))
            if v is None:
                return None
            # if it's a primitive, try to coerce
            if isinstance(v, (int, float)):
                return float(v)
            if isinstance(v, str):
                try:
                    return float(v)
                except Exception:
                    pass
            # if it's a list or dict, recurse
            return _extract_number_from_rpc_result(v)
        except Exception:
            return None

    return None


def _find_insumo_pattern(normalizer, insumo_norm: Optional[str], original: str) -> Optional[str]:
    """Tenta localizar um pattern regex nos mappings a partir do nome normalizado
    ou, como fallback, checando cada pattern contra o texto original do insumo.
    Retorna a string do pattern ou None se não encontrar.
    """
    if not normalizer:
        return None

    # 1) tentar por vacina_normalizada exata
    if insumo_norm:
        for m in normalizer.mappings:
            vn = m.get("vacina_normalizada")
            pat = m.get("pattern")
            if vn and pat and vn.lower() == str(insumo_norm).lower():
                return pat

    # 2) fallback: testar cada pattern contra o texto original
    for m in normalizer.mappings:
        pat = m.get("pattern")
        if not pat:
            continue
        try:
            if re.search(pat, original, flags=re.IGNORECASE):
                return pat
        except re.error:
            # fallback simples: substring
            if pat.lower() in original.lower():
                return pat

    return None


@router.get("/previsao")
async def previsao(
    insumo_nome: Optional[str] = Query(None),
    uf: Optional[str] = Query(None),
    mes: Optional[int] = Query(None),
    debug: Optional[bool] = Query(False),
) -> Any:
    """
    Chama a função RPC `public.obter_historico_e_previsao_vacinacao` e retorna uma lista de objetos JSON
    com a série histórica + previsão (ano, quantidade, tipo_dado).

    Requisitos:
    - `insumo_nome` é obrigatório (string).
    - `uf` e `mes` são opcionais.
    - Usa SUPABASE_SERVICE_ROLE_KEY obrigatoriamente (retorna 500 se ausente).
    """
    # Validação crítica: insumo_nome
    if not insumo_nome:
        return JSONResponse(status_code=400, content={"erro": "É obrigatório informar o nome da vacina (insumo_nome) para plotar o gráfico de previsão."})

    # ensure env loaded and required vars present
    ensure_loaded_backend_env()
    SUPABASE_URL = os.getenv("SUPABASE_URL")
    SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        return JSONResponse(status_code=500, content={"erro": "Supabase não está configurado no servidor (verifique SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY)."})

    # prepare params
    insumo_nome_trim = str(insumo_nome).strip()
    uf_trim = str(uf).strip() if uf else None
    params_plain: Dict[str, Any] = {"insumo_nome": insumo_nome_trim}
    params_underscored: Dict[str, Any] = {"_insumo_nome": insumo_nome_trim}
    if uf_trim:
        params_plain["uf"] = uf_trim
        params_underscored["_uf"] = uf_trim
    if mes is not None:
        try:
            mes_int = int(mes)
        except Exception:
            return JSONResponse(status_code=400, content={"erro": "Parâmetro 'mes' inválido. Deve ser um número inteiro (1-12)."})
        params_plain["mes"] = mes_int
        params_underscored["_mes"] = mes_int

    # Try SDK client first
    client = _get_supabase_client()
    data = None
    rpc_name = "obter_historico_e_previsao_vacinacao"

    if client is not None:
        try:
            resp = client.rpc(rpc_name, params_underscored).execute()
        except Exception:
            try:
                resp = client.rpc(rpc_name, params_plain).execute()
            except Exception:
                resp = None

        if resp is not None:
            # supabase-py response shapes may vary between versions
            if hasattr(resp, "data"):
                data = getattr(resp, "data")
            elif isinstance(resp, dict):
                data = resp.get("data") or resp.get("result") or resp.get("body")
            else:
                data = resp

    # If SDK not available or returned no data, use HTTP PostgREST RPC
    if data is None:
        rpc_url = f"{SUPABASE_URL.rstrip('/')}/rest/v1/rpc/{rpc_name}"
        headers = {
            "apikey": SUPABASE_SERVICE_ROLE_KEY,
            "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
            "Accept": "application/json",
            "Content-Type": "application/json",
        }
        # try plain then underscored
        status, parsed = await _http_rpc_call(rpc_url, headers, params_plain)
        if status in (200, 201):
            data = parsed
        else:
            # retry with underscored params
            alt = {}
            if params_plain.get("insumo_nome") is not None:
                alt["_insumo_nome"] = params_plain.get("insumo_nome")
            if params_plain.get("mes") is not None:
                alt["_mes"] = params_plain.get("mes")
            if params_plain.get("uf") is not None:
                alt["_uf"] = params_plain.get("uf")
            if alt:
                status2, parsed2 = await _http_rpc_call(rpc_url, headers, alt)
                if status2 in (200, 201):
                    data = parsed2
                else:
                    return JSONResponse(status_code=502, content={"erro": "Falha ao chamar RPC via HTTP no Supabase.", "status_code": status2, "details": parsed2})
            else:
                return JSONResponse(status_code=502, content={"erro": "Falha ao chamar RPC via HTTP no Supabase.", "status_code": status, "details": parsed})

    # The RPC `obter_historico_e_previsao_vacinacao` is expected to return
    # a list of objects. Per spec we must return that list exactly as
    # received from Supabase (plain array). Preserve raw payload when
    # possible and only try to unwrap common PostgREST wrappers.

    # If the RPC already returned a list, return it as-is.
    if isinstance(data, list):
        # Heuristic: if RPC returned only a single forecast row with quantidade == 0
        # and no historical rows, treat it as "no data" so the frontend doesn't
        # plot a solitary zero-valued 2025 point. When debug=true, preserve rpc_raw
        # for inspection.
        try:
            if len(data) == 1:
                nr = _normalize_row(data[0])
                if nr and nr.get("tipo_dado") == "previsao":
                    q = nr.get("quantidade")
                    if q is None or (isinstance(q, (int, float)) and float(q) == 0):
                        # No historical data found by the RPC — treat as empty result.
                        if debug:
                            return JSONResponse(status_code=404, content={"rpc_raw": data, "erro": "Nenhum dado encontrado para os filtros fornecidos."})
                        return JSONResponse(status_code=404, content={"erro": "Nenhum dado encontrado para os filtros fornecidos."})
        except Exception:
            # non-fatal: fall through to return raw data below
            pass

        # If the RPC returned an empty list, return 404 (no data)
        if len(data) == 0:
            if debug:
                return JSONResponse(status_code=404, content={"rpc_raw": data, "erro": "Nenhum dado encontrado para os filtros fornecidos."})
            return JSONResponse(status_code=404, content={"erro": "Nenhum dado encontrado para os filtros fornecidos."})

        if debug:
            return JSONResponse(status_code=200, content={"rpc_raw": data})
        return JSONResponse(status_code=200, content=data)

    # If PostgREST wrapped the list in a dict under common keys, unwrap it.
    if isinstance(data, dict):
        candidate = data.get("data") or data.get("result") or data.get("rows")
        if isinstance(candidate, list):
            # Apply the same single-zero-forecast heuristic to wrapped responses.
            try:
                if len(candidate) == 1:
                    nr = _normalize_row(candidate[0])
                    if nr and nr.get("tipo_dado") == "previsao":
                        q = nr.get("quantidade")
                        if q is None or (isinstance(q, (int, float)) and float(q) == 0):
                            # No historical data found by the RPC — treat as empty result.
                            if debug:
                                return JSONResponse(status_code=404, content={"rpc_raw": data, "erro": "Nenhum dado encontrado para os filtros fornecidos."})
                            return JSONResponse(status_code=404, content={"erro": "Nenhum dado encontrado para os filtros fornecidos."})
            except Exception:
                pass

            if len(candidate) == 0:
                if debug:
                    return JSONResponse(status_code=404, content={"rpc_raw": data, "erro": "Nenhum dado encontrado para os filtros fornecidos."})
                return JSONResponse(status_code=404, content={"erro": "Nenhum dado encontrado para os filtros fornecidos."})

            if debug:
                return JSONResponse(status_code=200, content={"rpc_raw": data, "result": candidate})
            return JSONResponse(status_code=200, content=candidate)

    # Fallback: return empty list (and include rpc_raw if debug requested).
    if debug:
        return JSONResponse(status_code=404, content={"rpc_raw": data, "erro": "Nenhum dado encontrado para os filtros fornecidos."})
    return JSONResponse(status_code=404, content={"erro": "Nenhum dado encontrado para os filtros fornecidos."})



@router.get("/previsao/comparacao")
async def previsao_comparacao(
    insumo_nome: Optional[str] = Query(None),
    uf: Optional[str] = Query(None),
    mes: Optional[int] = Query(None),
    ano: Optional[int] = Query(None),
    debug: Optional[bool] = Query(False),
) -> Any:
    """Retorna um objeto com a comparação entre o total de doses de 2024
    e a projeção para 2025.

    Regras estritas:
    - `insumo_nome` é obrigatório.
    - `ano` deve ser informado e igual a 2024, caso contrário retorna 400 com
      a mensagem: "Para gerar a comparação de previsão, o ano base precisa ser 2024."

    Implementação:
    - Chama `public.obter_soma_por_ano` com `_ano=2024` e filtros para obter o total de 2024.
    - Chama `public.obter_historico_e_previsao_vacinacao` e extrai a linha com ano=2025 para obter a projeção.
    """
    # Validações iniciais
    if not insumo_nome:
        return JSONResponse(status_code=400, content={"erro": "É obrigatório informar o nome da vacina (insumo_nome) para gerar a comparação."})

    if ano is None or int(ano) != 2024:
        return JSONResponse(status_code=400, content={"erro": "Para gerar a comparação de previsão, o ano base precisa ser 2024."})

    # ensure env loaded and required vars present
    ensure_loaded_backend_env()
    SUPABASE_URL = os.getenv("SUPABASE_URL")
    SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        return JSONResponse(status_code=500, content={"erro": "Supabase não está configurado no servidor (verifique SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY)."})

    insumo_nome_trim = str(insumo_nome).strip()
    uf_trim = str(uf).strip() if uf else None

    # Try to obtain a normalized fabricante label from local mappings
    normalizer = get_default_normalizer()
    fabricante_norm = normalizer.normalize_insumo(insumo_nome_trim)

    # Prepare params for obter_soma_por_ano: per spec pass _ano=2024
    soma_rpc = "obter_soma_por_ano"
    params_plain_soma: Dict[str, Any] = {"ano": 2024, "insumo_nome": insumo_nome_trim}
    # Determine a regex pattern to use for RPC calls (prefer mapping pattern)
    insumo_pattern = _find_insumo_pattern(normalizer, fabricante_norm, insumo_nome_trim)
    params_underscored_soma: Dict[str, Any] = {"_ano": 2024, "_insumo_nome": insumo_pattern or (fabricante_norm or insumo_nome_trim)}
    if uf_trim:
        params_plain_soma["uf"] = uf_trim
        params_underscored_soma["_uf"] = uf_trim
    if mes is not None:
        try:
            mes_int = int(mes)
        except Exception:
            return JSONResponse(status_code=400, content={"erro": "Parâmetro 'mes' inválido. Deve ser um número inteiro (1-12)."})
        params_plain_soma["mes"] = mes_int
        params_underscored_soma["_mes"] = mes_int

    # Prepare params for obter_historico_e_previsao_vacinacao
    previsao_rpc = "obter_historico_e_previsao_vacinacao"
    params_plain_prev: Dict[str, Any] = {"insumo_nome": insumo_nome_trim}
    params_underscored_prev: Dict[str, Any] = {"_insumo_nome": insumo_pattern or (fabricante_norm or insumo_nome_trim)}
    if uf_trim:
        params_plain_prev["uf"] = uf_trim
        params_underscored_prev["_uf"] = uf_trim
    if mes is not None:
        params_plain_prev["mes"] = mes_int
        params_underscored_prev["_mes"] = mes_int

    client = _get_supabase_client()

    # raw rpc payloads (for debugging when requested)
    soma_rpc_raw: Any = None
    previsao_rpc_raw: Any = None

    # --- Call 1: obter_soma_por_ano (historico 2024)
    soma_value: Optional[float] = None
    if client is not None:
        try:
            resp = client.rpc(soma_rpc, params_underscored_soma).execute()
        except Exception:
            try:
                resp = client.rpc(soma_rpc, params_plain_soma).execute()
            except Exception:
                resp = None

        if resp is not None:
            soma_rpc_raw = resp
            if hasattr(resp, "data"):
                soma_value = _extract_number_from_rpc_result(getattr(resp, "data"))
            elif isinstance(resp, dict):
                soma_value = _extract_number_from_rpc_result(resp.get("data") or resp.get("result") or resp)
            else:
                soma_value = _extract_number_from_rpc_result(resp)

    if soma_value is None:
        # fallback to HTTP PostgREST RPC
        rpc_url = f"{SUPABASE_URL.rstrip('/')}/rest/v1/rpc/{soma_rpc}"
        headers = {
            "apikey": SUPABASE_SERVICE_ROLE_KEY,
            "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
            "Accept": "application/json",
            "Content-Type": "application/json",
        }
        status, parsed = await _http_rpc_call(rpc_url, headers, params_plain_soma)
        if status in (200, 201):
            soma_rpc_raw = parsed
            soma_value = _extract_number_from_rpc_result(parsed)
        else:
            # retry with underscored params
            status2, parsed2 = await _http_rpc_call(rpc_url, headers, params_underscored_soma)
            if status2 in (200, 201):
                soma_rpc_raw = parsed2
                soma_value = _extract_number_from_rpc_result(parsed2)
            else:
                return JSONResponse(status_code=502, content={"erro": "Falha ao chamar RPC obter_soma_por_ano no Supabase.", "status_code": status2, "details": parsed2})

    # --- Call 2: obter_historico_e_previsao_vacinacao (extrair 2025)
    proj_value: Optional[float] = None
    if client is not None:
        try:
            resp = client.rpc(previsao_rpc, params_underscored_prev).execute()
        except Exception:
            try:
                resp = client.rpc(previsao_rpc, params_plain_prev).execute()
            except Exception:
                resp = None

        if resp is not None:
            previsao_rpc_raw = resp
            if hasattr(resp, "data"):
                rpc_data = getattr(resp, "data")
            elif isinstance(resp, dict):
                rpc_data = resp.get("data") or resp.get("result") or resp
            else:
                rpc_data = resp
            # rpc_data expected to be an array of rows
            if isinstance(rpc_data, list):
                for item in rpc_data:
                    nr = _normalize_row(item)
                    if nr and nr.get("ano") == 2025:
                        proj_value = nr.get("quantidade")
                        break

    if proj_value is None:
        # HTTP fallback
        rpc_url = f"{SUPABASE_URL.rstrip('/')}/rest/v1/rpc/{previsao_rpc}"
        headers = {
            "apikey": SUPABASE_SERVICE_ROLE_KEY,
            "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
            "Accept": "application/json",
            "Content-Type": "application/json",
        }
        status, parsed = await _http_rpc_call(rpc_url, headers, params_plain_prev)
        if status in (200, 201) and isinstance(parsed, list):
            previsao_rpc_raw = parsed
            for item in parsed:
                nr = _normalize_row(item)
                if nr and nr.get("ano") == 2025:
                    proj_value = nr.get("quantidade")
                    break
        else:
            # retry underscored
            status2, parsed2 = await _http_rpc_call(rpc_url, headers, params_underscored_prev)
            if status2 in (200, 201) and isinstance(parsed2, list):
                previsao_rpc_raw = parsed2
                for item in parsed2:
                    nr = _normalize_row(item)
                    if nr and nr.get("ano") == 2025:
                        proj_value = nr.get("quantidade")
                        break
            else:
                # If both RPC calls failed at HTTP level, return error
                if proj_value is None and (status not in (200,201) and status2 not in (200,201)):
                    return JSONResponse(status_code=502, content={"erro": "Falha ao chamar RPC obter_historico_e_previsao_vacinacao no Supabase.", "status_code": status2 if 'status2' in locals() else status, "details": parsed2 if 'parsed2' in locals() else parsed})

    # Build response payload. Use None for quantidade when absent so the frontend
    # can distinguish 'no data' from zero. Always return HTTP 200; the
    # frontend should render an appropriate message when quantities are null.
    resp_payload = {
        "insumo": insumo_nome_trim,
        "dados_comparacao": [
            {"ano": 2024, "quantidade": (soma_value if soma_value is not None and float(soma_value) != 0.0 else None), "tipo": "historico"},
            {"ano": 2025, "quantidade": (proj_value if proj_value is not None and float(proj_value) != 0.0 else None), "tipo": "projeção"},
        ],
    }

    if debug:
        # include raw RPC payloads to help debugging why values are null/zero
        resp_payload_debug = dict(resp_payload)
        resp_payload_debug["rpc_raw_soma"] = soma_rpc_raw
        resp_payload_debug["rpc_raw_previsao"] = previsao_rpc_raw
        return JSONResponse(status_code=200, content=resp_payload_debug)

    return JSONResponse(status_code=200, content=resp_payload)
