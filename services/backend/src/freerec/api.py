"""HTTP API for server-processed tools. Run with: uvicorn freerec.api:app"""

import time
from typing import Annotated, Any

from fastapi import Depends, FastAPI, HTTPException, Request, Response, status
from pydantic import BaseModel, Field, ValidationError

from freerec.jobs import InputFile, Job, JobStatus, new_job_id
from freerec.runtime import Runtime, build_runtime


class FileSpec(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    size: int = Field(gt=0)


class CreateJobRequest(BaseModel):
    tool: str
    files: list[FileSpec] = Field(min_length=1)
    options: dict[str, Any] = Field(default_factory=dict)


class PresignedUpload(BaseModel):
    url: str
    fields: dict[str, str]


class CreatedJob(BaseModel):
    id: str
    status: JobStatus
    uploads: list[PresignedUpload]
    expires_at: str


class JobOutputView(BaseModel):
    name: str
    size: int
    url: str


class JobView(BaseModel):
    id: str
    tool: str
    status: JobStatus
    error: str | None
    outputs: list[JobOutputView]
    expires_at: str


def create_app(runtime: Runtime | None = None) -> FastAPI:
    app = FastAPI(title="Freerec jobs API", version="0.1.0")
    app.state.runtime = runtime

    def get_runtime(request: Request) -> Runtime:
        if request.app.state.runtime is None:
            request.app.state.runtime = build_runtime()
        return request.app.state.runtime

    Rt = Annotated[Runtime, Depends(get_runtime)]

    def load_job(rt: Runtime, job_id: str) -> Job:
        job = rt.jobs.get(job_id)
        if job is None or job.expires_at <= time.time():
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Job not found or expired.")
        return job

    def view(rt: Runtime, job: Job) -> JobView:
        return JobView(
            id=job.id,
            tool=job.tool,
            status=job.status,
            error=job.error,
            outputs=[
                JobOutputView(name=o.name, size=o.size, url=rt.storage.presigned_get(o.key, o.name))
                for o in job.outputs
            ]
            if job.status == JobStatus.DONE
            else [],
            expires_at=job.expires_at_iso(),
        )

    @app.get("/healthz")
    def healthz(rt: Rt) -> dict[str, str]:
        rt.redis.ping()
        return {"status": "ok"}

    @app.post("/v1/jobs", status_code=status.HTTP_201_CREATED)
    def create_job(body: CreateJobRequest, rt: Rt) -> CreatedJob:
        op = rt.ops.get(body.tool)
        if op is None:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Unknown tool.")
        max_files = min(op.max_files, rt.settings.max_files)
        if len(body.files) > max_files:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST, f"This tool accepts at most {max_files} file(s)."
            )
        for spec in body.files:
            if spec.size > rt.settings.max_file_bytes:
                raise HTTPException(status.HTTP_413_CONTENT_TOO_LARGE, f"{spec.name} is too large.")
        try:
            options = op.options.model_validate(body.options).model_dump()
        except ValidationError as error:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST, "Invalid options for this tool."
            ) from error

        now = time.time()
        job_id = new_job_id()
        prefix = f"jobs/{job_id}/"
        job = Job(
            id=job_id,
            tool=op.slug,
            status=JobStatus.CREATED,
            options=options,
            # Keys never contain user-supplied names.
            inputs=[
                InputFile(name=spec.name, size=spec.size, key=f"{prefix}in/{i}")
                for i, spec in enumerate(body.files)
            ],
            created_at=now,
            expires_at=now + rt.settings.retention_seconds,
        )
        rt.jobs.create(job)
        uploads = [
            PresignedUpload(**rt.storage.presigned_post(item.key, rt.settings.max_file_bytes))
            for item in job.inputs
        ]
        return CreatedJob(
            id=job.id, status=job.status, uploads=uploads, expires_at=job.expires_at_iso()
        )

    @app.post("/v1/jobs/{job_id}/submit", status_code=status.HTTP_202_ACCEPTED)
    def submit_job(job_id: str, rt: Rt) -> JobView:
        job = load_job(rt, job_id)
        if job.status != JobStatus.CREATED:
            raise HTTPException(status.HTTP_409_CONFLICT, "Job was already submitted.")
        for item in job.inputs:
            size = rt.storage.size(item.key)
            if size is None:
                raise HTTPException(status.HTTP_409_CONFLICT, f"{item.name} has not been uploaded.")
            if size > rt.settings.max_file_bytes:
                raise HTTPException(status.HTTP_413_CONTENT_TOO_LARGE, f"{item.name} is too large.")
            item.size = size
        job.status = JobStatus.QUEUED
        rt.jobs.save(job)
        rt.enqueue(job.id)
        # Re-read: a synchronous queue may already have finished the job.
        return view(rt, rt.jobs.get(job.id) or job)

    @app.get("/v1/jobs/{job_id}")
    def get_job(job_id: str, rt: Rt) -> JobView:
        return view(rt, load_job(rt, job_id))

    @app.delete("/v1/jobs/{job_id}", status_code=status.HTTP_204_NO_CONTENT)
    def delete_job(job_id: str, rt: Rt) -> Response:
        job = load_job(rt, job_id)
        rt.storage.delete_prefix(job.prefix)
        rt.jobs.delete(job.id)
        return Response(status_code=status.HTTP_204_NO_CONTENT)

    return app


app = create_app()
