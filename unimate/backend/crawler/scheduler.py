# Celery Beat 설정은 crawler.worker에 정의됨
# 실행: celery -A crawler.worker beat --loglevel=info
from crawler.worker import app  # noqa: F401
