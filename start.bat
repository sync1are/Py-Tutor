@echo off
echo.
echo  PyTutor — Installing dependencies...
echo.
call npm install
echo.
echo  Launching PyTutor...
echo  (Make sure copilot-api start is running in another terminal)
echo.
call npm start
