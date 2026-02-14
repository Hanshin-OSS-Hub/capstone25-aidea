# crawler_app/logging/logger.py
from __future__ import annotations

import logging
import os
from logging.handlers import RotatingFileHandler
from pathlib import Path
from datetime import datetime

DEFAULT_LOG_DIR = Path("logs")


def setup_logging(
    log_dir: Path | str = DEFAULT_LOG_DIR,
    level: int = logging.INFO,
    run_name: str | None = None,
) -> logging.Logger:
    """
    - Console + File 로깅을 설정
    - run_name 없으면 timestamp로 생성
    - 파일은 RotatingFileHandler로 관리
    """
    log_dir = Path(log_dir)
    log_dir.mkdir(parents=True, exist_ok=True)

    if run_name is None:
        run_name = datetime.now().strftime("%Y%m%d_%H%M%S")

    logfile = log_dir / f"crawler_{run_name}.log"

    root = logging.getLogger()  # root logger
    root.setLevel(level)

    # 이미 핸들러가 붙어있으면 중복 방지
    if root.handlers:
        return root

    fmt = logging.Formatter(
        fmt="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    # 1) Console
    ch = logging.StreamHandler()
    ch.setLevel(level)
    ch.setFormatter(fmt)

    # 2) File (max 5MB, 5 backups)
    fh = RotatingFileHandler(
        filename=str(logfile),
        maxBytes=5 * 1024 * 1024,
        backupCount=5,
        encoding="utf-8",
    )
    fh.setLevel(level)
    fh.setFormatter(fmt)

    root.addHandler(ch)
    root.addHandler(fh)

    root.info(f"Logging initialized. file={logfile.resolve()}")
    return root


def get_logger(name: str) -> logging.Logger:
    return logging.getLogger(name)
