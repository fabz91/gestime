@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 goto nonode
echo Etape 1 sur 2 : installation des composants, quelques minutes...
call npm install
if errorlevel 1 goto erreur
echo Etape 2 sur 2 : creation de l'installateur...
call npm run build
if errorlevel 1 goto erreur
echo.
echo Termine. L'installateur est dans le dossier dist.
start "" "%~dp0dist"
pause
exit /b 0
:nonode
echo Node.js n'est pas installe. Installez la version LTS depuis https://nodejs.org puis relancez ce fichier.
pause
exit /b 1
:erreur
echo Une erreur est survenue. Notez le message ci-dessus et envoyez-le moi.
pause
exit /b 1
