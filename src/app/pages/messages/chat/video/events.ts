// ../pages/messages/chat/video/events.ts
export enum VideoEvents {
  STARTED  = 'video-call-started',
  ACCEPTED = 'video-call-accepted',
  DECLINED = 'video-call-declined',
  ENDED    = 'video-call-ended',
  FAILED   = 'video-call-failed',
  BUSY     = 'video-call-busy',

  // 🔔 cancel naming: server emits 'video-canceled', client can also send 'cancel-video'
  CANCELED = 'video-canceled',     // incoming from server
  CANCEL_REQ = 'cancel-video',     // you emit this to server (optional enum)

  // Missed/timeout variants (cover both spellings / channels)
  TIMEOUT  = 'video-call-timeout',
  MISSED   = 'missed-call',
}
