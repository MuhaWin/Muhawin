import sys, pathlib; sys.path.insert(0, str(pathlib.Path(__file__).parent))

import pytest


@pytest.fixture(autouse=True)
def _bildirim_kapali(monkeypatch):
    """Testler gerçek kayıt bildirimi (e-posta) göndermesin."""
    monkeypatch.setenv("FK_BILDIRIM_URL", "")
