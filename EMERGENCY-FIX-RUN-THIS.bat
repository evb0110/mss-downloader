@echo off
REM EMERGENCY FIX FOR MSS-DOWNLOADER v1.4.151
REM Run this file to force-start the application
REM Ткаченко - запустите этот файл для принудительного запуска

echo ===============================================
echo     EMERGENCY MSS-DOWNLOADER LAUNCHER
echo             Аварийный запуск
echo ===============================================
echo.

echo [1/5] Killing ALL old processes / Убиваю ВСЕ старые процессы...
echo -----------------------------------------------
taskkill /F /IM "Abba Ababus (MSS Downloader).exe" /T 2>nul
taskkill /F /IM "MSS-Downloader.exe" /T 2>nul
taskkill /F /IM "mss-downloader.exe" /T 2>nul
taskkill /F /IM "Abba Ababus.exe" /T 2>nul
taskkill /F /IM electron.exe /FI "WINDOWTITLE eq Abba*" 2>nul
wmic process where "name like '%%MSS%%'" delete 2>nul
wmic process where "name like '%%Abba%%'" delete 2>nul

echo Done / Готово
echo.

echo [2/5] Waiting for processes to die / Жду завершения процессов...
ping 127.0.0.1 -n 4 > nul
echo Done / Готово
echo.

echo [3/5] Cleaning up locks / Очищаю блокировки...
echo -----------------------------------------------
del "%APPDATA%\abba-ababus-mss-downloader\app.lock" 2>nul
del "%APPDATA%\abba-ababus-mss-downloader\app.pid" 2>nul
del "%APPDATA%\abba-ababus-mss-downloader\Singleton*" 2>nul
rmdir /S /Q "%APPDATA%\abba-ababus-mss-downloader\Singleton*" 2>nul

echo Done / Готово
echo.

echo [4/5] Looking for MSS-Downloader / Ищу программу...
echo -----------------------------------------------

set "APP_PATH="

REM Check common installation paths
if exist "%LOCALAPPDATA%\Programs\abba-ababus-mss-downloader\Abba Ababus (MSS Downloader).exe" (
    set "APP_PATH=%LOCALAPPDATA%\Programs\abba-ababus-mss-downloader\Abba Ababus (MSS Downloader).exe"
    echo Found at / Найдено: LocalAppData
    goto found
)

if exist "%PROGRAMFILES%\abba-ababus-mss-downloader\Abba Ababus (MSS Downloader).exe" (
    set "APP_PATH=%PROGRAMFILES%\abba-ababus-mss-downloader\Abba Ababus (MSS Downloader).exe"
    echo Found at / Найдено: Program Files
    goto found
)

if exist "%PROGRAMFILES(x86)%\abba-ababus-mss-downloader\Abba Ababus (MSS Downloader).exe" (
    set "APP_PATH=%PROGRAMFILES(x86)%\abba-ababus-mss-downloader\Abba Ababus (MSS Downloader).exe"
    echo Found at / Найдено: Program Files x86
    goto found
)

if exist "C:\Users\%USERNAME%\AppData\Local\Programs\abba-ababus-mss-downloader\Abba Ababus (MSS Downloader).exe" (
    set "APP_PATH=C:\Users\%USERNAME%\AppData\Local\Programs\abba-ababus-mss-downloader\Abba Ababus (MSS Downloader).exe"
    echo Found at / Найдено: User AppData
    goto found
)

REM Check Desktop
if exist "%USERPROFILE%\Desktop\Abba Ababus (MSS Downloader).exe" (
    set "APP_PATH=%USERPROFILE%\Desktop\Abba Ababus (MSS Downloader).exe"
    echo Found at / Найдено: Desktop
    goto found
)

REM Not found
echo.
echo ERROR: MSS-Downloader not found! / ОШИБКА: Программа не найдена!
echo.
echo Please enter the full path to "Abba Ababus (MSS Downloader).exe"
echo Введите полный путь к файлу "Abba Ababus (MSS Downloader).exe"
echo.
echo Example / Пример:
echo C:\Users\YourName\AppData\Local\Programs\abba-ababus-mss-downloader\Abba Ababus (MSS Downloader).exe
echo.
set /p "APP_PATH=Path / Путь: "

:found
echo.
echo [5/5] Starting MSS-Downloader / Запускаю программу...
echo -----------------------------------------------
echo Path / Путь: "%APP_PATH%"
echo.

if not exist "%APP_PATH%" (
    echo ERROR: File not found! / ОШИБКА: Файл не найден!
    echo Check the path and try again / Проверьте путь и попробуйте снова
    pause
    exit /b 1
)

echo Starting with logging enabled / Запуск с логированием...
echo.

REM Start with console visible to see errors
start "MSS-Downloader" /WAIT "%APP_PATH%" --no-sandbox --disable-gpu-sandbox --log-level=verbose

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ===============================================
    echo ERROR: App crashed with code %ERRORLEVEL%
    echo ОШИБКА: Программа упала с кодом %ERRORLEVEL%
    echo ===============================================
    echo.
    echo Trying compatibility mode / Пробую режим совместимости...
    start "MSS-Downloader" "%APP_PATH%" --no-sandbox --disable-gpu --disable-software-rasterizer
)

echo.
echo ===============================================
echo If the app still doesn't start, try:
echo Если программа не запустилась, попробуйте:
echo.
echo 1. Right-click the .exe file / ПКМ на .exe файле
echo 2. Properties / Свойства
echo 3. Compatibility / Совместимость
echo 4. Run as Windows 8 / Запускать в режиме Windows 8
echo 5. Run as Administrator / Запускать от администратора
echo ===============================================
echo.
pause