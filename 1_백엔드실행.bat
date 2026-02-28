@echo off
chcp 65001 > nul
echo ========================================
echo  AIdea 백엔드 서버 실행
echo ========================================
echo.

REM 프로젝트 루트로 이동
cd /d "%~dp0"

REM 가상환경 존재 확인
if not exist "venv\Scripts\activate.bat" (
    echo [오류] 가상환경이 없습니다. venv를 먼저 생성해주세요.
    echo.
    echo 해결 방법:
    echo   python -m venv venv
    echo.
    pause
    exit /b 1
)

echo [INFO] 가상환경 활성화 중...
call venv\Scripts\activate.bat

REM 활성화 확인
if "%VIRTUAL_ENV%"=="" (
    echo [오류] 가상환경 활성화 실패
    pause
    exit /b 1
)

echo [INFO] 가상환경 활성화 완료: %VIRTUAL_ENV%
echo.

REM 필수 패키지 설치 확인 (없으면 자동 설치)
echo [INFO] 필수 패키지 확인 중...
python -c "import fastapi" 2>nul
if %errorlevel% neq 0 (
    echo [경고] FastAPI가 설치되어 있지 않습니다.
    echo [INFO] 패키지를 설치합니다... (1~2분 소요)
    echo.
    pip install -r requirements.txt
    if %errorlevel% neq 0 (
        echo [오류] 패키지 설치 실패
        pause
        exit /b 1
    )
    echo.
    echo [완료] 패키지 설치 완료!
    echo.
)

echo [INFO] 백엔드 서버를 시작합니다...
echo [INFO] 서버 주소: http://localhost:8000
echo [INFO] API 문서: http://localhost:8000/docs
echo.
echo [주의] 이 창을 닫으면 서버가 종료됩니다!
echo.

REM backend 폴더로 이동하여 서버 실행
cd backend
python main.py

pause
