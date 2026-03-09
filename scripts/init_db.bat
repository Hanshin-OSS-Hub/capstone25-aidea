@echo off
chcp 65001 >nul
echo ========================================
echo 데이터베이스 초기화
echo ========================================

cd /d %~dp0\..

REM 가상환경 활성화
call venv\Scripts\activate

echo.
echo 필요한 패키지 설치 중...
pip install -q psycopg2-binary sqlalchemy alembic

echo.
echo 데이터베이스 테이블을 생성합니다...
echo.

python scripts\init_db.py

echo.
pause
