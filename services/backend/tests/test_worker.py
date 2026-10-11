import time

from conftest import object_keys

from freerec.janitor import sweep
from freerec.jobs import InputFile, Job, JobStatus
from freerec.ops import NoOptions, Op, OpError
from freerec.worker import process_job


def queued_job(runtime, upload, body: bytes, name="a.pdf", tool="echo", expires_in=3600) -> Job:
    now = time.time()
    job = Job(
        id=f"job{now}",
        tool=tool,
        status=JobStatus.QUEUED,
        inputs=[InputFile(name=name, size=len(body), key=f"jobs/job{now}/in/0")],
        created_at=now,
        expires_at=now + expires_in,
    )
    runtime.jobs.create(job)
    upload(job.inputs[0].key, body)
    return job


def test_rejects_content_that_does_not_match_the_tool(runtime, upload):
    job = queued_job(runtime, upload, b"\x00\x01binary", name="fake.pdf")
    process_job(runtime, job.id)
    result = runtime.jobs.get(job.id)
    assert result.status == JobStatus.FAILED
    assert result.error == "fake.pdf is not a supported file for this tool."


def test_reports_op_errors_and_hides_unexpected_ones(runtime, upload):
    def friendly(*_):
        raise OpError("Encrypted PDFs are not supported.")

    def crash(*_):
        raise RuntimeError("secret internal detail")

    for slug, run, expected in [
        ("friendly", friendly, "Encrypted PDFs are not supported."),
        ("crash", crash, "Processing failed. The file may be damaged."),
    ]:
        runtime.ops[slug] = Op(slug=slug, accepts=frozenset({"pdf"}), run=run, options=NoOptions)
        job = queued_job(runtime, upload, b"%PDF-1.7", tool=slug)
        process_job(runtime, job.id)
        assert runtime.jobs.get(job.id).error == expected


def test_ignores_jobs_that_are_not_queued(runtime, upload):
    job = queued_job(runtime, upload, b"%PDF-1.7")
    job.status = JobStatus.CREATED
    runtime.jobs.save(job)
    process_job(runtime, job.id)
    assert runtime.jobs.get(job.id).status == JobStatus.CREATED


def test_job_updates_do_not_extend_its_lifetime(runtime, upload):
    job = queued_job(runtime, upload, b"%PDF-1.7", expires_in=100)
    process_job(runtime, job.id)
    assert 0 < runtime.redis.ttl(f"job:{job.id}") <= 100


def test_janitor_deletes_only_expired_jobs(runtime, upload):
    expired = queued_job(runtime, upload, b"%PDF-1.7", expires_in=1)
    live = queued_job(runtime, upload, b"%PDF-1.7")
    process_job(runtime, expired.id)

    assert sweep(runtime, now=time.time() + 10) == 1
    assert object_keys(runtime, expired.prefix) == []
    assert runtime.jobs.get(expired.id) is None
    assert object_keys(runtime, live.prefix) == [live.inputs[0].key]
    assert runtime.jobs.get(live.id) is not None


def test_setup_storage_is_idempotent(runtime):
    from freerec.setup_storage import setup_storage

    settings = runtime.settings.model_copy(update={"s3_bucket": "fresh-bucket"})
    setup_storage(settings)
    setup_storage(settings)
    client = runtime.storage.client
    client.head_bucket(Bucket="fresh-bucket")
    [rule] = client.get_bucket_lifecycle_configuration(Bucket="fresh-bucket")["Rules"]
    assert rule["Expiration"] == {"Days": 1}
    [cors] = client.get_bucket_cors(Bucket="fresh-bucket")["CORSRules"]
    assert cors["AllowedOrigins"] == ["http://localhost:3000"]
