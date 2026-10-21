@echo off
rem 一件代发 Web 本地服务保活 —— 双击即起（dev 5173 + preview 4173），崩溃自动重启。
rem 由 dev-keepalive.cjs 负责拉起与保活，本文件仅用绝对路径调用，规避 PATH 中缺 node 的问题。
start "" /min "C:\Users\Administrator\.workbuddy\binaries\node\versions\22.22.2-6\node.exe" "D:\Workbuddy\2026-10-10-17-18-35\dropshipping-ops\scripts\dev-keepalive.cjs"
exit
