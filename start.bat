@echo off
title Comparateur RH - 4YOU vs S7
cd /d "%~dp0"

echo.
echo  ============================================
echo   Comparateur RH - 4YOU vs S7/HRa
echo  ============================================
echo.

:: Verifier que Node.js est installe
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERREUR] Node.js n'est pas installe ou introuvable.
    echo Telechargez-le sur https://nodejs.org
    pause
    exit /b 1
)

:: Installer les dependances si node_modules absent
if not exist "node_modules\" (
    echo [INFO] Installation des dependances npm...
    npm install
    echo.
)

echo [INFO] Demarrage du serveur...
echo [INFO] Le navigateur va s'ouvrir automatiquement sur http://localhost:3000
echo.
echo  Pour arreter le serveur : fermer cette fenetre ou appuyer sur Ctrl+C
echo.

node server.js

pause
