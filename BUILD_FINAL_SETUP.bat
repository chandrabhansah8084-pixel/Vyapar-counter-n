@echo off
setlocal
cd /d "%~dp0"
title Vyapar Counter - Final Setup Builder
color 0A
cls
echo ================================================
echo       VYAPAR COUNTER - FINAL SETUP BUILDER
echo ================================================
echo.
echo Pehli baar setup banane ke liye Internet ON rakhein.
echo Is build mein Node ke native database module ki zarurat NAHI hai.
echo.
if not exist "%ProgramFiles%\nodejs\node.exe" if not exist "%AppData%\npm\npm.cmd" goto NONODE
where npm >nul 2>nul
if errorlevel 1 goto NONODE
call npm install
if errorlevel 1 goto FAIL
call npx electron-builder --win nsis
if errorlevel 1 goto FAIL
echo.
echo ================================================
echo SETUP TAIYAAR HAI.
echo dist folder mein Vyapar Counter Setup 2.0.0.exe milega.
echo ================================================
explorer "%~dp0dist"
pause
exit /b 0
:NONODE
echo Node.js/npm is PC par install nahi hai.
echo Target PC par Node.js ki zarurat nahi hogi, lekin setup BANANE wale PC par Node.js chahiye.
echo Agar aapke paas Node nahi hai to mujhe batayein; main next package ko build-machine independent banane ka tarika dunga.
pause
exit /b 1
:FAIL
echo Setup banate samay error aaya. Upar ka message dekhein.
pause
exit /b 1
