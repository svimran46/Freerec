import base64
import json

from conftest import object_keys

PDF = b"%PDF-1.7\n%test\n"


def create(client, files=None, tool="echo", options=None):
    return client.post(
        "/v1/jobs",
        json={
            "tool": tool,
            "files": files or [{"name": "a.pdf", "size": len(PDF)}],
            "options": options or {},
        },
    )


def test_full_job_lifecycle(client, runtime, upload):
    created = create(client)
    assert created.status_code == 201
    body = created.json()
    assert body["status"] == "created"
    [presigned] = body["uploads"]
    key = presigned["fields"]["key"]
    assert key == f"jobs/{body['id']}/in/0"

    policy = json.loads(base64.b64decode(presigned["fields"]["policy"]))
    assert ["content-length-range", 1, 1024] in policy["conditions"]

    upload(key, PDF)
    submitted = client.post(f"/v1/jobs/{body['id']}/submit")
    assert submitted.status_code == 202
    assert submitted.json()["status"] == "done"

    job = client.get(f"/v1/jobs/{body['id']}").json()
    assert job["error"] is None
    [output] = job["outputs"]
    assert output["name"] == "echo-1.pdf"
    assert output["size"] == len(PDF)
    assert "X-Amz-Signature" in output["url"]
    assert "attachment" in output["url"]

    assert client.delete(f"/v1/jobs/{body['id']}").status_code == 204
    assert object_keys(runtime, f"jobs/{body['id']}/") == []
    assert client.get(f"/v1/jobs/{body['id']}").status_code == 404


def test_rejects_unknown_tool(client):
    response = create(client, tool="nope")
    assert response.status_code == 400
    assert response.json()["detail"] == "Unknown tool."


def test_debug_ops_are_hidden_unless_enabled(runtime):
    from fastapi.testclient import TestClient

    from freerec.api import create_app
    from freerec.ops import enabled_ops

    runtime.ops = enabled_ops(runtime.settings.model_copy(update={"enable_debug_ops": False}))
    assert create(TestClient(create_app(runtime))).status_code == 400


def test_rejects_too_many_files(client):
    files = [{"name": f"{i}.pdf", "size": 10} for i in range(6)]
    response = create(client, files=files)
    assert response.status_code == 400
    assert "at most 5" in response.json()["detail"]


def test_rejects_oversize_files(client):
    response = create(client, files=[{"name": "big.pdf", "size": 1025}])
    assert response.status_code == 413


def test_rejects_invalid_options(client):
    assert create(client, options={"quality": 50}).status_code == 400


def test_validates_request_shape(client):
    assert client.post("/v1/jobs", json={"tool": "echo", "files": []}).status_code == 422
    files = [{"name": "", "size": 1}]
    assert client.post("/v1/jobs", json={"tool": "echo", "files": files}).status_code == 422


def test_submit_requires_uploaded_files(client):
    job_id = create(client).json()["id"]
    response = client.post(f"/v1/jobs/{job_id}/submit")
    assert response.status_code == 409
    assert response.json()["detail"] == "a.pdf has not been uploaded."


def test_submit_rejects_objects_over_the_limit(client, upload):
    created = create(client).json()
    upload(created["uploads"][0]["fields"]["key"], b"%PDF" + b"x" * 2000)
    assert client.post(f"/v1/jobs/{created['id']}/submit").status_code == 413


def test_submit_only_once(client, upload):
    created = create(client).json()
    upload(created["uploads"][0]["fields"]["key"], PDF)
    assert client.post(f"/v1/jobs/{created['id']}/submit").status_code == 202
    assert client.post(f"/v1/jobs/{created['id']}/submit").status_code == 409


def test_unknown_job_is_404(client):
    assert client.get("/v1/jobs/does-not-exist").status_code == 404
    assert client.post("/v1/jobs/does-not-exist/submit").status_code == 404
    assert client.delete("/v1/jobs/does-not-exist").status_code == 404


def test_healthz(client):
    assert client.get("/healthz").json() == {"status": "ok"}
