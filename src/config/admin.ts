/**
 * Admin Configuration
 * Define admin user IDs and permissions
 */

// Get admin IDs from environment variable or use hardcoded defaults
const envAdminIds = process.env.ADMIN_TG_IDS
  ? process.env.ADMIN_TG_IDS.split(',').map(id => parseInt(id.trim(), 10)).filter(id => !isNaN(id))
  : [];

// Add your Telegram user ID here
// To get your ID, message @userinfobot on Telegram
export const ADMIN_IDS: number[] = [
  1418799289,  // Main admin
  ...envAdminIds,  // Also include IDs from environment variable
];

export function isAdmin(userId: number): boolean {
  return ADMIN_IDS.includes(userId);
}

export function requireAdmin(userId: number): void {
  if (!isAdmin(userId)) {
    throw new Error('Unauthorized: Admin access required');
  }
}

