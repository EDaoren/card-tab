@echo off
echo 初始化Quick Nav Tab GitHub仓库...

:: 初始化git仓库
echo 初始化Git仓库...
git init

:: 添加所有文件
echo 添加文件到Git...
git add .

:: 初始提交
echo 创建初始提交...
git commit -m "Initial commit: Quick Nav Tab chrome extension"

echo.
echo ===============================================
echo 现在您需要在GitHub上创建一个新的仓库，然后运行:
echo git remote add origin https://github.com/你的用户名/quick-nav-tab.git
echo git push -u origin main
echo ===============================================
echo.

pause 