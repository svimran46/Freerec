# Base image for the API, the janitor and the generic worker. Phase 2/3 add
# heavier worker images (LibreOffice, Ghostscript, Real-ESRGAN) on top of this.
FROM python:3.13-slim

COPY --from=astral/uv:0.11 /uv /usr/local/bin/uv

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    PATH="/app/.venv/bin:$PATH"

WORKDIR /app
COPY pyproject.toml uv.lock ./
RUN uv sync --locked --no-dev --no-install-project
COPY src ./src
RUN uv sync --locked --no-dev

RUN useradd --create-home --uid 10001 app
USER app

EXPOSE 8000
CMD ["uvicorn", "freerec.api:app", "--host", "0.0.0.0", "--port", "8000"]
