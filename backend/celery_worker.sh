#!/bin/bash
# Celery Worker 실행 스크립트
cd "$(dirname "$0")"
source venv/bin/activate

# Celery Worker 실행
celery -A app.core.celery_app worker --loglevel=info --concurrency=4

