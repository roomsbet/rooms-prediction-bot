#!/usr/bin/env python3
"""
ROOMS Bot Health Checker
Trusted by Helius • Powered by Turnkey
"""

import os
import sys
import requests
import psycopg2
from datetime import datetime

def check_database():
    """Check database connectivity"""
    try:
        conn = psycopg2.connect(os.getenv('DATABASE_URL'))
        cursor = conn.cursor()
        cursor.execute('SELECT 1')
        conn.close()
        return True
    except Exception as e:
        print(f"Database check failed: {e}")
        return False

def check_solana_rpc():
    """Check Solana RPC endpoint"""
    rpc_url = os.getenv('SOLANA_RPC_URL')
    if not rpc_url:
        return False
    
    try:
        response = requests.post(
            rpc_url,
            json={"jsonrpc": "2.0", "id": 1, "method": "getHealth"},
            timeout=5
        )
        return response.status_code == 200
    except Exception as e:
        print(f"RPC check failed: {e}")
        return False

def check_telegram_bot():
    """Check Telegram bot token"""
    token = os.getenv('TG_BOT_TOKEN')
    if not token:
        return False
    
    try:
        response = requests.get(
            f'https://api.telegram.org/bot{token}/getMe',
            timeout=5
        )
        return response.status_code == 200
    except Exception as e:
        print(f"Telegram check failed: {e}")
        return False

def main():
    print(f"[{datetime.now()}] Running health checks...")
    
    checks = {
        'Database': check_database(),
        'Solana RPC': check_solana_rpc(),
        'Telegram Bot': check_telegram_bot()
    }
    
    all_passed = all(checks.values())
    
    for service, status in checks.items():
        status_icon = "✅" if status else "❌"
        print(f"{status_icon} {service}: {'OK' if status else 'FAILED'}")
    
    sys.exit(0 if all_passed else 1)

if __name__ == '__main__':
    main()

