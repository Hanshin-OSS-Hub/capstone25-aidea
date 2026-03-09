@echo off
chcp 65001 > nul
echo ========================================
echo  AIdea 프론트엔드 서버 실행
echo ========================================
echo.

REM Node.js 설치 확인
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [오류] Node.js가 설치되어 있지 않습니다!
    echo.
    echo Node.js 설치 방법:
    echo 1. https://nodejs.org/ 접속
    echo 2. LTS 버전 다운로드
    echo 3. 설치 후 이 스크립트 다시 실행
    echo.
    pause
    exit /b 1
)

REM npm 설치 확인
where npm >nul 2>nul
if %errorlevel% neq 0 (
    echo [오류] npm이 설치되어 있지 않습니다!
    echo Node.js와 함께 설치되어야 합니다.
    echo.
    pause
    exit /b 1
)

echo [INFO] Node.js와 npm이 설치되어 있습니다.
echo.

REM frontend 폴더로 이동
cd frontend

REM package.json 확인
if not exist package.json (
    echo [오류] package.json 파일을 찾을 수 없습니다.
    pause
    exit /b 1
)

REM node_modules 폴더가 없으면 npm install 실행
if not exist node_modules (
    echo [INFO] 의존성 패키지를 설치합니다... (최초 1회만 실행)
    echo [INFO] 시간이 걸릴 수 있습니다. 잠시만 기다려주세요...
    echo.
    call npm install
    if %errorlevel% neq 0 (
        echo [오류] 패키지 설치 중 오류가 발생했습니다.
        pause
        exit /b 1
    )
    echo.
    echo [완료] 패키지 설치가 완료되었습니다!
    echo.
)

echo [INFO] 프론트엔드 개발 서버를 시작합니다...
echo [INFO] 브라우저가 자동으로 열립니다.
echo [INFO] 서버 주소: http://localhost:5173
echo.
echo [주의] 이 창을 닫으면 서버가 종료됩니다!
echo.

REM 개발 서버 실행
call npm run dev

pause
