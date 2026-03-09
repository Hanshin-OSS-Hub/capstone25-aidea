@echo off
chcp 65001 >nul
echo ========================================
echo 벡터 DB 재생성
echo ========================================

cd /d %~dp0

REM 가상환경 활성화
call venv\Scripts\activate

echo.
echo PDF 파일들을 읽어서 벡터 DB를 재생성합니다...
echo 이 작업은 시간이 걸릴 수 있습니다.
echo.

python rebuild_vector_db.py

echo.
pause
