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
NODE_BIN="$(command -v node || true)"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
LOG_DIR="$PROJECT_DIR/.workbuddy/logs"
OUT_LOG="$LOG_DIR/feishu-ws.log"
ERR_LOG="$LOG_DIR/feishu-ws.err.log"

if [[ -z "$NODE_BIN" ]]; then
  echo "未找到 node，请先安装 Node.js 20+"; exit 1
fi

case "${1:-install}" in
  status)
    launchctl list | grep "$LABEL" || echo "未安装或未运行"
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

    launchctl unload -w "$PLIST" 2>/dev/null || true
    launchctl load -w "$PLIST"
    sleep 3
    echo "已安装并启动：$LABEL"
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
