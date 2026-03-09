# crawler_app/pipelines/stats.py
from __future__ import annotations
from dataclasses import dataclass, field


@dataclass
class RunStats:
    # 크롤링 전체 흐름
    crawled_total_count: int = 0         # 상세 처리 시도한 공지 수
    detail_success_count: int = 0
    detail_fail_count: int = 0

    # 이미지
    notice_with_image_count: int = 0
    image_found_count: int = 0

    # OCR
    ocr_attempt_count: int = 0
    ocr_success_count: int = 0
    ocr_fail_count: int = 0

    # 첨부(인식만)
    notice_with_attachment_count: int = 0
    attachment_found_count: int = 0

    # 본문
    empty_content_count: int = 0

    # 중복/저장
    dedup_removed_count: int = 0
    saved_unique_count: int = 0

    # 디버그/확인용 샘플
    sample_issues: list[str] = field(default_factory=list)

    def add_issue(self, msg: str, limit: int = 20) -> None:
        if len(self.sample_issues) < limit:
            self.sample_issues.append(msg)

    def summary_lines(self) -> list[str]:
        return [
            "========== CRAWLER RUN SUMMARY ==========",
            f"crawled_total_count        : {self.crawled_total_count}",
            f"detail_success_count       : {self.detail_success_count}",
            f"detail_fail_count          : {self.detail_fail_count}",
            f"notice_with_image_count    : {self.notice_with_image_count}",
            f"image_found_count          : {self.image_found_count}",
            f"ocr_attempt_count          : {self.ocr_attempt_count}",
            f"ocr_success_count          : {self.ocr_success_count}",
            f"ocr_fail_count             : {self.ocr_fail_count}",
            f"notice_with_attachment_cnt : {self.notice_with_attachment_count}",
            f"attachment_found_count     : {self.attachment_found_count}",
            f"empty_content_count        : {self.empty_content_count}",
            f"dedup_removed_count        : {self.dedup_removed_count}",
            f"saved_unique_count         : {self.saved_unique_count}",
            "========================================",
        ]
