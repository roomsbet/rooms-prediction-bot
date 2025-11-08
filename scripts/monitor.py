#!/usr/bin/env python3
"""
ROOMS Bot Comprehensive Monitoring System
Trusted by Helius • Powered by Turnkey

This script provides comprehensive monitoring and alerting for the ROOMS bot infrastructure.
It checks database health, RPC connectivity, bot status, and system resources.
"""

import os
import sys
import json
import time
import psycopg2
import requests
import subprocess
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass
from enum import Enum

class HealthStatus(Enum):
    HEALTHY = "healthy"
    DEGRADED = "degraded"
    DOWN = "down"
    UNKNOWN = "unknown"

@dataclass
class HealthCheck:
    name: str
    status: HealthStatus
    message: str
    response_time_ms: Optional[float] = None
    timestamp: datetime = None
    
    def __post_init__(self):
        if self.timestamp is None:
            self.timestamp = datetime.now()

class HealthMonitor:
    def __init__(self):
        self.db_url = os.getenv('DATABASE_URL')
        self.rpc_url = os.getenv('SOLANA_RPC_URL')
        self.telegram_token = os.getenv('TG_BOT_TOKEN')
        self.checks: List[HealthCheck] = []
        
    def check_database_connectivity(self) -> HealthCheck:
        """Check PostgreSQL database connectivity and performance"""
        start_time = time.time()
        try:
            conn = psycopg2.connect(self.db_url, connect_timeout=5)
            cursor = conn.cursor()
            
            # Test basic query
            cursor.execute('SELECT 1')
            cursor.fetchone()
            
            # Check connection pool
            cursor.execute("""
                SELECT count(*) FROM pg_stat_activity 
                WHERE datname = current_database()
            """)
            active_connections = cursor.fetchone()[0]
            
            # Check database size
            cursor.execute("""
                SELECT pg_size_pretty(pg_database_size(current_database()))
            """)
            db_size = cursor.fetchone()[0]
            
            # Check table counts
            cursor.execute("""
                SELECT 
                    (SELECT count(*) FROM "User") as users,
                    (SELECT count(*) FROM "Room") as rooms,
                    (SELECT count(*) FROM "Bet") as bets
            """)
            counts = cursor.fetchone()
            
            conn.close()
            response_time = (time.time() - start_time) * 1000
            
            return HealthCheck(
                name="Database Connectivity",
                status=HealthStatus.HEALTHY,
                message=f"Connected. Active connections: {active_connections}, DB size: {db_size}, Users: {counts[0]}, Rooms: {counts[1]}, Bets: {counts[2]}",
                response_time_ms=response_time
            )
        except psycopg2.OperationalError as e:
            return HealthCheck(
                name="Database Connectivity",
                status=HealthStatus.DOWN,
                message=f"Connection failed: {str(e)}",
                response_time_ms=(time.time() - start_time) * 1000
            )
        except Exception as e:
            return HealthCheck(
                name="Database Connectivity",
                status=HealthStatus.DEGRADED,
                message=f"Error: {str(e)}",
                response_time_ms=(time.time() - start_time) * 1000
            )
    
    def check_database_performance(self) -> HealthCheck:
        """Check database query performance"""
        start_time = time.time()
        try:
            conn = psycopg2.connect(self.db_url, connect_timeout=5)
            cursor = conn.cursor()
            
            # Run performance test queries
            cursor.execute("""
                SELECT 
                    COUNT(*) as total_bets,
                    AVG(amount) as avg_bet,
                    SUM(amount) as total_volume
                FROM "Bet"
                WHERE "createdAt" > NOW() - INTERVAL '24 hours'
            """)
            result = cursor.fetchone()
            
            conn.close()
            response_time = (time.time() - start_time) * 1000
            
            if response_time > 1000:
                status = HealthStatus.DEGRADED
                message = f"Slow query performance: {response_time:.2f}ms"
            else:
                status = HealthStatus.HEALTHY
                message = f"Performance OK: {response_time:.2f}ms. 24h stats: {result[0]} bets, {result[2]} volume"
            
            return HealthCheck(
                name="Database Performance",
                status=status,
                message=message,
                response_time_ms=response_time
            )
        except Exception as e:
            return HealthCheck(
                name="Database Performance",
                status=HealthStatus.DEGRADED,
                message=f"Performance check failed: {str(e)}",
                response_time_ms=(time.time() - start_time) * 1000
            )
    
    def check_solana_rpc(self) -> HealthCheck:
        """Check Solana RPC endpoint health and latency"""
        if not self.rpc_url:
            return HealthCheck(
                name="Solana RPC",
                status=HealthStatus.UNKNOWN,
                message="RPC URL not configured"
            )
        
        start_time = time.time()
        try:
            # Health check
            health_response = requests.post(
                self.rpc_url,
                json={"jsonrpc": "2.0", "id": 1, "method": "getHealth"},
                timeout=5
            )
            
            if health_response.status_code != 200:
                return HealthCheck(
                    name="Solana RPC",
                    status=HealthStatus.DOWN,
                    message=f"Health check failed: HTTP {health_response.status_code}",
                    response_time_ms=(time.time() - start_time) * 1000
                )
            
            # Get slot info for latency test
            slot_response = requests.post(
                self.rpc_url,
                json={"jsonrpc": "2.0", "id": 2, "method": "getSlot"},
                timeout=5
            )
            
            response_time = (time.time() - start_time) * 1000
            
            if response_time > 500:
                status = HealthStatus.DEGRADED
                message = f"High latency: {response_time:.2f}ms"
            else:
                status = HealthStatus.HEALTHY
                slot_data = slot_response.json() if slot_response.status_code == 200 else {}
                message = f"RPC healthy. Latency: {response_time:.2f}ms. Slot: {slot_data.get('result', 'N/A')}"
            
            return HealthCheck(
                name="Solana RPC (Helius)",
                status=status,
                message=message,
                response_time_ms=response_time
            )
        except requests.exceptions.Timeout:
            return HealthCheck(
                name="Solana RPC (Helius)",
                status=HealthStatus.DOWN,
                message="Request timeout",
                response_time_ms=(time.time() - start_time) * 1000
            )
        except Exception as e:
            return HealthCheck(
                name="Solana RPC (Helius)",
                status=HealthStatus.DEGRADED,
                message=f"Error: {str(e)}",
                response_time_ms=(time.time() - start_time) * 1000
            )
    
    def check_telegram_api(self) -> HealthCheck:
        """Check Telegram Bot API connectivity"""
        if not self.telegram_token:
            return HealthCheck(
                name="Telegram API",
                status=HealthStatus.UNKNOWN,
                message="Bot token not configured"
            )
        
        start_time = time.time()
        try:
            response = requests.get(
                f'https://api.telegram.org/bot{self.telegram_token}/getMe',
                timeout=5
            )
            response_time = (time.time() - start_time) * 1000
            
            if response.status_code == 200:
                bot_info = response.json()
                return HealthCheck(
                    name="Telegram API",
                    status=HealthStatus.HEALTHY,
                    message=f"Bot @{bot_info['result']['username']} is active. Latency: {response_time:.2f}ms",
                    response_time_ms=response_time
                )
            else:
                return HealthCheck(
                    name="Telegram API",
                    status=HealthStatus.DOWN,
                    message=f"API error: HTTP {response.status_code}",
                    response_time_ms=response_time
                )
        except Exception as e:
            return HealthCheck(
                name="Telegram API",
                status=HealthStatus.DEGRADED,
                message=f"Error: {str(e)}",
                response_time_ms=(time.time() - start_time) * 1000
            )
    
    def check_bot_process(self) -> HealthCheck:
        """Check if bot process is running"""
        try:
            result = subprocess.run(
                ['pgrep', '-f', 'node.*dist/index.js'],
                capture_output=True,
                text=True,
                timeout=2
            )
            
            if result.returncode == 0:
                pids = result.stdout.strip().split('\n')
                return HealthCheck(
                    name="Bot Process",
                    status=HealthStatus.HEALTHY,
                    message=f"Bot process running (PIDs: {', '.join(pids)})"
                )
            else:
                return HealthCheck(
                    name="Bot Process",
                    status=HealthStatus.DOWN,
                    message="Bot process not found"
                )
        except Exception as e:
            return HealthCheck(
                name="Bot Process",
                status=HealthStatus.UNKNOWN,
                message=f"Could not check process: {str(e)}"
            )
    
    def check_system_resources(self) -> HealthCheck:
        """Check system CPU and memory usage"""
        try:
            # Check memory usage
            mem_result = subprocess.run(
                ['free', '-m'],
                capture_output=True,
                text=True,
                timeout=2
            )
            
            # Check disk usage
            disk_result = subprocess.run(
                ['df', '-h', '/'],
                capture_output=True,
                text=True,
                timeout=2
            )
            
            mem_lines = mem_result.stdout.split('\n')
            disk_lines = disk_result.stdout.split('\n')
            
            return HealthCheck(
                name="System Resources",
                status=HealthStatus.HEALTHY,
                message=f"Resources OK. Memory: {mem_lines[1] if len(mem_lines) > 1 else 'N/A'}, Disk: {disk_lines[1] if len(disk_lines) > 1 else 'N/A'}"
            )
        except Exception as e:
            return HealthCheck(
                name="System Resources",
                status=HealthStatus.UNKNOWN,
                message=f"Could not check resources: {str(e)}"
            )
    
    def run_all_checks(self) -> List[HealthCheck]:
        """Run all health checks"""
        self.checks = [
            self.check_database_connectivity(),
            self.check_database_performance(),
            self.check_solana_rpc(),
            self.check_telegram_api(),
            self.check_bot_process(),
            self.check_system_resources()
        ]
        return self.checks
    
    def get_summary(self) -> Dict:
        """Get health check summary"""
        healthy = sum(1 for c in self.checks if c.status == HealthStatus.HEALTHY)
        degraded = sum(1 for c in self.checks if c.status == HealthStatus.DEGRADED)
        down = sum(1 for c in self.checks if c.status == HealthStatus.DOWN)
        
        overall_status = HealthStatus.HEALTHY
        if down > 0:
            overall_status = HealthStatus.DOWN
        elif degraded > 0:
            overall_status = HealthStatus.DEGRADED
        
        return {
            "overall_status": overall_status.value,
            "timestamp": datetime.now().isoformat(),
            "checks": {
                "healthy": healthy,
                "degraded": degraded,
                "down": down,
                "total": len(self.checks)
            },
            "details": [
                {
                    "name": c.name,
                    "status": c.status.value,
                    "message": c.message,
                    "response_time_ms": c.response_time_ms,
                    "timestamp": c.timestamp.isoformat()
                }
                for c in self.checks
            ]
        }
    
    def print_report(self):
        """Print formatted health check report"""
        summary = self.get_summary()
        
        print("=" * 60)
        print("ROOMS Bot Health Check Report")
        print(f"Trusted by Helius • Powered by Turnkey")
        print("=" * 60)
        print(f"Overall Status: {summary['overall_status'].upper()}")
        print(f"Timestamp: {summary['timestamp']}")
        print(f"\nChecks: {summary['checks']['healthy']} healthy, "
              f"{summary['checks']['degraded']} degraded, "
              f"{summary['checks']['down']} down")
        print("\n" + "-" * 60)
        
        for check in summary['details']:
            status_icon = {
                'healthy': '✅',
                'degraded': '⚠️',
                'down': '❌',
                'unknown': '❓'
            }.get(check['status'], '❓')
            
            print(f"{status_icon} {check['name']}")
            print(f"   Status: {check['status'].upper()}")
            print(f"   Message: {check['message']}")
            if check['response_time_ms']:
                print(f"   Response Time: {check['response_time_ms']:.2f}ms")
            print()

def main():
    monitor = HealthMonitor()
    monitor.run_all_checks()
    monitor.print_report()
    
    summary = monitor.get_summary()
    
    # Exit with error code if any checks are down
    if summary['overall_status'] == 'down':
        sys.exit(1)
    elif summary['overall_status'] == 'degraded':
        sys.exit(2)
    else:
        sys.exit(0)

if __name__ == '__main__':
    main()

