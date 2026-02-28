@echo off
chcp 65001 >nul
echo ========================================
echo 새 PDF 파일을 벡터 DB에 추가
echo ========================================

cd /d %~dp0\..

REM 가상환경 활성화
call venv\Scripts\activate

echo.
echo PDF 폴더의 새 PDF 파일들을 벡터 DB에 추가합니다...
echo (기존 DB가 없으면 전체 재생성을 수행합니다)
echo.

python scripts\add_new_pdf.py

echo.
pause
