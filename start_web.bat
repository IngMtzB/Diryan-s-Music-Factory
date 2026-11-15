@echo off
title Diryan's Music Factory Web Studio
echo ======================================================
echo    Diryan's Music Factory - Web Studio
echo ======================================================
echo Iniciando servidor FastAPI y abriendo la aplicacion web...

if exist ".venv\Scripts\python.exe" (
    ".venv\Scripts\python.exe" run_web.py
) else (
    python run_web.py
)

pause

