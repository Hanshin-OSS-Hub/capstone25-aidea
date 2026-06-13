import asyncio
import logging
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)

from crawler.spiders.notice_crawler import run_crawl_job

if __name__ == "__main__":
    asyncio.run(run_crawl_job())
