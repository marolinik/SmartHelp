@echo off
echo ========================================
echo Push Smart Help Desk PIO to GitHub
echo ========================================
echo.

echo Please enter your GitHub username:
set /p GITHUB_USER=

echo.
echo Adding GitHub remote...
git remote add origin https://github.com/%GITHUB_USER%/smart-help-desk-pio.git

echo.
echo Pushing to GitHub...
git branch -M main
git push -u origin main

echo.
echo ========================================
echo ✅ Successfully pushed to GitHub!
echo ========================================
echo.
echo Your repository: https://github.com/%GITHUB_USER%/smart-help-desk-pio
echo.
echo Next steps:
echo 1. Go to your repository on GitHub
echo 2. Click "Code" → "Codespaces" → "Create codespace on main"
echo 3. Claude Code will be automatically installed!
echo.
pause 