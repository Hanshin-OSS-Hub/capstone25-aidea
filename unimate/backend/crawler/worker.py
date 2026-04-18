import os
import sys
import asyncio

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from celery import Celery
from celery.schedules import crontab
from core.config import settings

app = Celery(
    "unimate",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
)

app.conf.beat_schedule = {
    f"crawl-{h:02d}{m:02d}": {
        "task": "crawler.worker.crawl_notices_task",
        "schedule": crontab(hour=h, minute=m),
    }
    for h, m in [(7, 0), (9, 0), (12, 0), (14, 0), (16, 0), (18, 0)]
}
app.conf.timezone = "Asia/Seoul"


@app.task(name="crawler.worker.crawl_notices_task")
def crawl_notices_task():
    from crawler.spiders.notice_crawler import run_crawl_job
    asyncio.run(run_crawl_job())
