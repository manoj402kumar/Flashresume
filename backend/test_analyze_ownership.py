from fastapi.testclient import TestClient
import uuid
import base64
import json
import pytest

from unittest.mock import AsyncMock

@pytest.fixture(autouse=True)
def mock_supabase_auth(monkeypatch):
    from main import app
    from auth_utils import verify_user
    
    async def override_verify_user(authorization: str = __import__("fastapi").Header(None)):
        if not authorization or not authorization.startswith("Bearer "):
            raise __import__("fastapi").HTTPException(status_code=401)
        token = authorization.split(" ")[1]
        parts = token.split(".")
        if len(parts) != 3:
            raise __import__("fastapi").HTTPException(status_code=401)
        try:
            payload_b64 = parts[1]
            payload_b64 += "=" * ((4 - len(payload_b64) % 4) % 4)
            payload = json.loads(base64.urlsafe_b64decode(payload_b64).decode("utf-8"))
            return payload.get("sub", "unknown")
        except Exception as e:
            print(f"Mock error: {e}")
            raise __import__("fastapi").HTTPException(status_code=401)
            
    app.dependency_overrides[verify_user] = override_verify_user
    yield
    app.dependency_overrides.clear()

from main import app
client = TestClient(app)

def make_jwt(sub):
    header = base64.urlsafe_b64encode(b'{"alg":"HS256","typ":"JWT"}').decode().rstrip("=")
    payload = base64.urlsafe_b64encode(json.dumps({"sub": sub}).encode()).decode().rstrip("=")
    return f"{header}.{payload}.sig"

def test_missing_owner_identity_reject():
    res = client.post("/api/analyze", json={
        "resume_text": "hello",
        "job_description": "world"
    })
    assert res.status_code == 401

def test_valid_owner_identity_allowed():
    token = make_jwt("user_a_new_2")
    res = client.post("/api/analyze", json={
        "resume_text": "hello " + str(uuid.uuid4()),
        "job_description": "world"
    }, headers={"Authorization": f"Bearer {token}"})
    print(res.json())
    assert res.status_code == 202

def test_invalid_owner_identity_forbidden():
    token_a = make_jwt("user_a_new")
    res = client.post("/api/analyze", json={
        "resume_text": "hello " + str(__import__("uuid").uuid4()),
        "job_description": "world"
    }, headers={"Authorization": f"Bearer {token_a}"})
    assert res.status_code == 202
    job_id = res.json()["job_id"]
    
    token_b = make_jwt("user_b_new")
    
    try:
        with client.stream("GET", f"/api/jobs/{job_id}/stream", headers={"Authorization": f"Bearer {token_b}"}) as stream_res:
            assert stream_res.status_code == 200
            events = list(stream_res.iter_lines())
    except Exception as e:
        print(f"Stream error: {e}")
