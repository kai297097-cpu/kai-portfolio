@echo off
echo ========================================
echo Git Push Script - Portfolio Landingpage
echo ========================================
echo.

REM Wechsle ins Verzeichnis
cd /d "%~dp0"

REM Git Status anzeigen
echo Checking git status...
git status
echo.

REM Alle Änderungen hinzufügen
echo Adding all changes...
git add .
echo.

REM Commit erstellen
echo Creating commit...
git commit -m "Update Portfolio: Formsubmit integration, Podcast Player, Design updates"
echo.

REM Zu GitHub pushen
echo Pushing to GitHub...
git push origin main
echo.

echo ========================================
echo Done! Check your GitHub Pages:
echo https://kai297097-cpu.github.io/kai-portfolio/
echo ========================================
pause

