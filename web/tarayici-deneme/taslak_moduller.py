# Mikro Denetim tarayıcı denemesi: sunucu paketlerinin (fastapi, pydantic, sqlite3, playwright) yerine geçen boş modüller.
import sys, types
def _dek(*a, **k):
    return lambda f: f
class _App:
    def __init__(self, *a, **k): pass
    get = post = put = delete = middleware = on_event = staticmethod(_dek)
    def include_router(self, *a, **k): pass
fa = types.ModuleType("fastapi"); fa.FastAPI = _App; fa.APIRouter = _App
fa.File = fa.Form = lambda *a, **k: None
class HTTPException(Exception):
    def __init__(self, status_code=400, detail=""): super().__init__(detail)
fa.HTTPException = HTTPException; fa.UploadFile = object; fa.Request = object
r = types.ModuleType("fastapi.responses")
for ad in ("FileResponse", "HTMLResponse", "JSONResponse", "RedirectResponse", "Response"):
    setattr(r, ad, type(ad, (), {"__init__": lambda self, *a, **k: None}))
fa.responses = r
pd = types.ModuleType("pydantic"); pd.BaseModel = object
class _Con:
    def execute(self, *a, **k): return self
    def fetchall(self): return []
    def fetchone(self): return None
    def commit(self): pass
    def close(self): pass
    def __enter__(self): return self
    def __exit__(self, *a): pass
sq = types.ModuleType("sqlite3"); sq.connect = lambda *a, **k: _Con(); sq.Row = object
sys.modules.update({"fastapi": fa, "fastapi.responses": r, "pydantic": pd, "sqlite3": sq})
pw = types.ModuleType("playwright"); pws = types.ModuleType("playwright.sync_api")
pws.Error = pws.TimeoutError = Exception; pws.sync_playwright = None; pws.Page = pws.BrowserContext = object
sys.modules.update({"playwright": pw, "playwright.sync_api": pws})
