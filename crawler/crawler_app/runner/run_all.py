# # scheduler.py (TEST MODE ONLY)
# """
# [TEST MODE]
# - 오전 02:00 ~ 02:59
# - 5분 간격 크롤링
# - DB 저장 없이 크롤러 동작 검증 목적
# """

# from datetime import datetime
# from dotenv import load_dotenv
# from apscheduler.schedulers.blocking import BlockingScheduler
# from apscheduler.triggers.cron import CronTrigger

# import crawler  # 같은 폴더에 crawler.py 있어야 함

# # ===============================
# # 환경 변수 로딩
# # ===============================
# load_dotenv()

# TZ = "Asia/Seoul"

# # ===============================
# # Scheduler 인스턴스
# # ===============================
# scheduler = BlockingScheduler(timezone=TZ)


# # ===============================
# # 공통 실행 래퍼
# # ===============================
# def job_wrapper():
#     """
#     실제 크롤링 작업 실행
#     - 예외 발생 시 scheduler 전체 중단 방지
#     """
#     start = datetime.now()
#     print(f"\n[SCHED][TEST] job start: {start.strftime('%Y-%m-%d %H:%M:%S')}")

#     try:
#         crawler.run_job()
#         end = datetime.now()
#         print(f"[SCHED][TEST] job done : {end.strftime('%Y-%m-%d %H:%M:%S')}")
#     except Exception as e:
#         print(f"[SCHED][TEST][ERROR] crawl failed: {e}")


# # ===============================
# # 테스트 스케줄 등록
# # ===============================
# def add_test_schedule():
#     """
#     - 02:00 ~ 02:59
#     - 5분 간격 실행
#     """
#     trigger = CronTrigger(hour=2, minute="0/5")

#     scheduler.add_job(
#         job_wrapper,
#         trigger=trigger,
#         id="crawl_test_every_5min_1am",
#         replace_existing=True,
#         max_instances=1,      # 중복 실행 방지
#         coalesce=True,        # 밀린 작업 합치기
#         misfire_grace_time=120,
#     )

#     print("[SCHED][TEST] Added schedule")
#     print("[SCHED][TEST] - Every 5 minutes during 02:00 ~ 02:59")


# # ===============================
# # Entry Point
# # ===============================
# if __name__ == "__main__":
#     add_test_schedule()

#     # 🔽 기다리기 싫으면 테스트 시작 시 즉시 1회 실행 (선택)
#     # print("[SCHED][TEST] Run once immediately")
#     # job_wrapper()

#     print("[SCHED][TEST] Scheduler started (Asia/Seoul)")
#     print("[SCHED][TEST] Press Ctrl+C to exit\n")

#     scheduler.start()



# scheduler.py (PROD MODE ONLY)
"""
[PROD MODE]
- 하루 6회 정시 크롤링
- 07:00, 09:00, 12:00, 14:00, 16:00, 18:00
- 실제 운영용 자동 수집 스케줄
"""

from datetime import datetime
from dotenv import load_dotenv
from apscheduler.schedulers.blocking import BlockingScheduler
from apscheduler.triggers.cron import CronTrigger

import crawler  # 같은 폴더에 crawler.py 있어야 함

# ===============================
# 환경 변수 로딩
# ===============================
load_dotenv()

TZ = "Asia/Seoul"

# ===============================
# Scheduler 인스턴스
# ===============================
scheduler = BlockingScheduler(timezone=TZ)


# ===============================
# 공통 실행 래퍼
# ===============================
def job_wrapper():
    """
    실제 크롤링 작업 실행
    - 예외 발생 시 scheduler 전체 중단 방지
    """
    start = datetime.now()
    print(f"\n[SCHED][PROD] job start: {start.strftime('%Y-%m-%d %H:%M:%S')}")

    try:
        crawler.run_job()
        end = datetime.now()
        print(f"[SCHED][PROD] job done : {end.strftime('%Y-%m-%d %H:%M:%S')}")
    except Exception as e:
        print(f"[SCHED][PROD][ERROR] crawl failed: {e}")


# ===============================
# 운영 스케줄 등록
# ===============================
def add_prod_schedule():
    """
    운영용 스케줄
    - 하루 6회 정시 실행
    """
    run_times = [
        (7, 0),
        (9, 0),
        (12, 0),
        (14, 0),
        (16, 0),
        (18, 0),
    ]

    for h, m in run_times:
        scheduler.add_job(
            job_wrapper,
            trigger=CronTrigger(hour=h, minute=m),
            id=f"crawl_{h:02d}{m:02d}",
            replace_existing=True,
            max_instances=1,      # 중복 실행 방지
            coalesce=True,        # 밀린 작업 합치기
            misfire_grace_time=600,  # 10분
        )

    print("[SCHED][PROD] Added schedule")
    print("[SCHED][PROD] Run times:",
          ", ".join([f"{h:02d}:{m:02d}" for h, m in run_times]))


# ===============================
# Entry Point
# ===============================
if __name__ == "__main__":
    add_prod_schedule()

    print("[SCHED][PROD] Scheduler started (Asia/Seoul)")
    print("[SCHED][PROD] Press Ctrl+C to exit\n")

    scheduler.start()
