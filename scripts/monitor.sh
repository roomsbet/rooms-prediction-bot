#!/bin/bash

# ROOMS Bot Health Monitor
# Monitors bot health and restarts if needed

BOT_PID_FILE="/tmp/rooms-bot.pid"
LOG_FILE="/var/log/rooms-bot.log"

check_bot_health() {
    if [ -f "$BOT_PID_FILE" ]; then
        PID=$(cat "$BOT_PID_FILE")
        if ! ps -p "$PID" > /dev/null 2>&1; then
            echo "Bot process not running, restarting..."
            restart_bot
        fi
    else
        echo "No PID file found, starting bot..."
        start_bot
    fi
}

start_bot() {
    cd /app
    npm start >> "$LOG_FILE" 2>&1 &
    echo $! > "$BOT_PID_FILE"
}

restart_bot() {
    if [ -f "$BOT_PID_FILE" ]; then
        PID=$(cat "$BOT_PID_FILE")
        kill "$PID" 2>/dev/null || true
        rm "$BOT_PID_FILE"
    fi
    start_bot
}

check_bot_health

