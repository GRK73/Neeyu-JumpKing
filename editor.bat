@echo off
cd /d "%~dp0"
start "" "http://localhost:3000/map_editor.html"
npx serve .
