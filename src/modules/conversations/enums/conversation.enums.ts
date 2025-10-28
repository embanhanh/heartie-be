export enum ConversationType {
  UNIFIED = 'UNIFIED', // Unified conversation: user <-> assistant + admin
  USER_ASSISTANT = 'USER_ASSISTANT', // Legacy: user <-> assistant only
  USER_ADMIN = 'USER_ADMIN', // Legacy: user <-> admin only
  GROUP = 'GROUP', // Group chat (future)
}

export enum ParticipantRole {
  USER = 'USER',
  ADMIN = 'ADMIN',
  ASSISTANT = 'ASSISTANT', // bot
}
