import logging

import httpx

from core.config import settings

logger = logging.getLogger(__name__)


async def send_email(to: str, subject: str, html: str) -> bool:
    """
    Resend API로 이메일 발송.
    실패 시 예외를 던지지 않고 False 반환 + 로그만 기록.
    """
    if not settings.RESEND_API_KEY:
        logger.warning("RESEND_API_KEY가 설정되지 않았습니다. 이메일 발송을 건너뜁니다.")
        return False

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                "https://api.resend.com/emails",
                headers={"Authorization": f"Bearer {settings.RESEND_API_KEY}"},
                json={
                    "from": settings.RESEND_FROM_EMAIL,
                    "to": to,
                    "subject": subject,
                    "html": html,
                },
            )
        if response.status_code not in (200, 201):
            logger.error(f"Resend 발송 실패 [{response.status_code}]: {response.text}")
            return False
        return True
    except Exception as exc:
        logger.error(f"이메일 발송 예외: {exc}")
        return False


async def send_verification_email(to: str, code: str) -> bool:
    return await send_email(
        to=to,
        subject="[UniMate] 이메일 인증번호",
        html=f"""
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
          <h2 style="color: #4F46E5;">UniMate 이메일 인증</h2>
          <p>아래 인증번호를 입력해주세요.</p>
          <div style="font-size: 32px; font-weight: bold; letter-spacing: 8px;
                      color: #111827; padding: 16px; background: #F3F4F6;
                      border-radius: 8px; text-align: center;">
            {code}
          </div>
          <p style="color: #6B7280; font-size: 14px; margin-top: 16px;">
            5분 이내에 입력해주세요.<br>
            본인이 요청하지 않았다면 이 메일을 무시하세요.
          </p>
        </div>
        """,
    )


async def send_welcome_email(to: str, name: str) -> bool:
    return await send_email(
        to=to,
        subject="[UniMate] 가입을 환영합니다",
        html=f"""
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
          <h2 style="color: #4F46E5;">UniMate에 오신 것을 환영합니다!</h2>
          <p><strong>{name}</strong>님, 한신대학교 AI 도우미 UniMate 회원이 되셨습니다.</p>
          <p style="color: #6B7280; font-size: 14px;">
            앱에서 공지, 일정, 과제를 한눈에 확인하고<br>
            AI 도우미에게 뭐든 물어보세요!
          </p>
        </div>
        """,
    )
