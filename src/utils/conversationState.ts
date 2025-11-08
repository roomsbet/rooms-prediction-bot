/**
 * Conversation State Manager
 * Tracks user conversation states for multi-step flows
 */

interface ConversationState {
  action: 'withdraw_address' | 'withdraw_amount' | 'bet_amount' | 'user_room_title' | 'user_room_target' | 'user_room_token_ca' | 'user_room_token_symbol' | 'user_room_custom_time' | 'user_room_coin_symbol';
  data?: any;
}

const userStates = new Map<number, ConversationState>();

export function setUserState(userId: number, action: ConversationState['action'], data?: any) {
  userStates.set(userId, { action, data });
}

export function getUserState(userId: number): ConversationState | undefined {
  return userStates.get(userId);
}

export function clearUserState(userId: number) {
  userStates.delete(userId);
}

