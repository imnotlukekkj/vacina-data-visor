"""Compatibility shim: export ensure_loaded_backend_env from backend.utils.env_utils

This file used to contain the implementation; it now delegates to
`backend.utils.env_utils.ensure_loaded_backend_env` to keep imports working
for modules that still import `backend.env_utils`.
"""

from backend.utils.env_utils import ensure_loaded_backend_env

__all__ = ["ensure_loaded_backend_env"]
