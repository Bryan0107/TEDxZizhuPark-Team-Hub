#!/usr/bin/env bash
# 把飞书长连接客户端安装为 macOS 开机自启的后台服务（launchd）。
#
# 用法：
#   bash scripts/install-feishu-ws.sh          # 安装并启动
#   bash scripts/install-feishu-ws.sh status   # 查看状态
#   bash scripts/install-feishu-ws.sh logs     # 跟踪日志
#   bash scripts/install-feishu-ws.sh remove   # 卸载
set -euo pipefail

LABEL="com.tedxzizhupark.teamhub.feishu-ws"
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# 优先用系统级 Node（launchd 不依赖 WorkBuddy 的临时 binaries 目录）
if [[ -x /opt/homebrew/bin/node ]]; then
  NODE_BIN=/opt/homebrew/bin/node
elif [[ -x /usr/local/bin/node ]]; then
  NODE_BIN=/usr/local/bin/node
else
  NODE_BIN="$(command -v node || true)"
fi
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
LOG_DIR="$PROJECT_DIR/.workbuddy/logs"
OUT_LOG="$LOG_DIR/feishu-ws.log"
ERR_LOG="$LOG_DIR/feishu-ws.err.log"

if [[ -z "$NODE_BIN" ]]; then
  echo "未找到 node，请先安装 Node.js 20+"; exit 1
fi

case "${1:-install}" in
  status)
    if launchctl list 2>/dev/null | grep -q "$LABEL"; then
      launchctl list | grep "$LABEL"
    else
      echo "launchd 未登记该服务"
    fi
    pgrep -fl "feishu-ws-client" || echo "进程未运行（可用 npm run feishu:ws 临时启动）"
    echo "--- 最近日志 ---"
    tail -n 15 "$OUT_LOG" 2>/dev/null || echo "暂无日志"
    ;;
  logs)
    tail -f "$OUT_LOG"
    ;;
  remove)
    launchctl unload -w "$PLIST" 2>/dev/null || true
    rm -f "$PLIST"
    echo "已卸载 $LABEL"
    ;;
  install)
    mkdir -p "$LOG_DIR" "$HOME/Library/LaunchAgents"
    if [[ ! -f "$PROJECT_DIR/.env.local" ]]; then
      echo "缺少 .env.local（需要 FEISHU_APP_ID / FEISHU_APP_SECRET / APPWRITE_KEY 等）"; exit 1
    fi

    cat > "$PLIST" <<PLIST_EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>$NODE_BIN</string>
    <string>--env-file=$PROJECT_DIR/.env.local</string>
    <string>$PROJECT_DIR/scripts/feishu-ws-client.mjs</string>
  </array>
  <key>WorkingDirectory</key><string>$PROJECT_DIR</string>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>ThrottleInterval</key><integer>10</integer>
  <key>StandardOutPath</key><string>$OUT_LOG</string>
  <key>StandardErrorPath</key><string>$ERR_LOG</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>TZ</key><string>Asia/Shanghai</string>
  </dict>
</dict>
</plist>
PLIST_EOF

    launchctl bootout "gui/$(id -u)" "$PLIST" 2>/dev/null || true
    if launchctl bootstrap "gui/$(id -u)" "$PLIST" 2>/dev/null; then
      echo "已通过 bootstrap 加载服务"
    elif launchctl load -w "$PLIST" 2>/dev/null; then
      echo "已通过 load 加载服务"
    else
      echo "⚠️  自动加载失败（当前环境可能不允许管理后台服务）。"
      echo "   请在你自己的终端里执行一次："
      echo "     bash $PROJECT_DIR/scripts/install-feishu-ws.sh"
      echo "   或手动加载："
      echo "     launchctl bootstrap gui/\$(id -u) \"$PLIST\""
    fi
    sleep 3
    echo "已安装：$LABEL"
    echo "plist: $PLIST"
    echo "日志:  $OUT_LOG"
    echo
    launchctl list | grep "$LABEL" || true
    tail -n 8 "$OUT_LOG" 2>/dev/null || true
    ;;
  *)
    echo "用法: bash scripts/install-feishu-ws.sh [install|status|logs|remove]"; exit 1
    ;;
esac
