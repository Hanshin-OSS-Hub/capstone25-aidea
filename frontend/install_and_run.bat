@echo off
chcp 65001 > nul
echo ========================================
echo  프론트엔드 설치 및 실행
echo ========================================
echo.

echo [1/3] 패키지 설치 중... (최초 1회, 5~10분 소요)
call npm install

if %errorlevel% neq 0 (
    echo.
    echo [오류] 패키지 설치 실패
    pause
    exit /b 1
)

echo.
echo [2/3] 패키지 설치 완료!
echo.
echo [3/3] 개발 서버 시작 중...
echo.
echo 브라우저에서 http://localhost:5173 으로 접속하세요!
echo 이 창을 닫으면 서버가 종료됩니다.
echo.

call npm run dev

pause
