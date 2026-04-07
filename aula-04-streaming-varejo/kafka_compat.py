from __future__ import annotations

import importlib.util
import sys
from pathlib import Path


def patch_kafka_vendor_six() -> None:
    """Register kafka.vendor.six.moves for runtimes where the vendored import hook fails."""
    if "kafka.vendor.six.moves" in sys.modules:
        return

    purelib = Path(sysconfig_path())
    six_path = purelib / "kafka" / "vendor" / "six.py"
    if not six_path.exists():
        return

    spec = importlib.util.spec_from_file_location("kafka.vendor.six", six_path)
    if spec is None or spec.loader is None:
        return

    module = sys.modules.get("kafka.vendor.six")
    if module is None:
        module = importlib.util.module_from_spec(spec)
        sys.modules["kafka.vendor.six"] = module
        spec.loader.exec_module(module)

    moves = getattr(module, "moves", None)
    if moves is not None:
        sys.modules["kafka.vendor.six.moves"] = moves


def sysconfig_path() -> str:
    import sysconfig

    return sysconfig.get_path("purelib")
