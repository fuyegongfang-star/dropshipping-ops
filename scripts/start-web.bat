@echo off
rem 一件代发 Web 本地服务保活 —— 双击即起（dev 5173 + preview 4173），崩溃自动重启。
rem 可移植写法：不写死任何本机绝对路径，node 从 PATH 解析。
rem 需要 Node.js 20+ 已加入 PATH；未安装时给出明确提示而不是静默失败。
setlocal
cd /d "%~dp0.."

where node >nul 2>nul
if errorlevel 1 (
  echo [start-web] 未找到 node，请先安装 Node.js 20+ 并加入 PATH。
  echo           也可直接在项目根目录执行: npm run dev --workspace web
  pause
  exit /b 1
)

start "" /min node scripts/dev-keepalive.cjs
exit /b 0
