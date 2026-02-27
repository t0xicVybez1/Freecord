import * as mediasoup from 'mediasoup'

export const config = {
  worker: {
    rtcMinPort: parseInt(process.env.VOICE_RTC_MIN_PORT || '40000', 10),
    rtcMaxPort: parseInt(process.env.VOICE_RTC_MAX_PORT || '49999', 10),
    logLevel: 'warn' as const,
    logTags: ['info', 'ice', 'dtls', 'rtp', 'srtp', 'rtcp'] as mediasoup.types.WorkerLogTag[],
  },
  router: {
    mediaCodecs: [
      {
        kind: 'audio' as const,
        mimeType: 'audio/opus',
        clockRate: 48000,
        channels: 2,
        parameters: {
          minptime: 10,
          useinbandfec: 1,
        },
      },
      {
        kind: 'video' as const,
        mimeType: 'video/VP8',
        clockRate: 90000,
        parameters: { 'x-google-start-bitrate': 1000 },
      },
      {
        kind: 'video' as const,
        mimeType: 'video/VP9',
        clockRate: 90000,
        parameters: { 'profile-id': 2, 'x-google-start-bitrate': 1000 },
      },
      {
        kind: 'video' as const,
        mimeType: 'video/h264',
        clockRate: 90000,
        parameters: {
          'packetization-mode': 1,
          'profile-level-id': '4d0032',
          'level-asymmetry-allowed': 1,
          'x-google-start-bitrate': 1000,
        },
      },
    ] as mediasoup.types.RtpCodecCapability[],
  },
  webRtcTransport: {
    listenIps: [
      {
        ip: process.env.VOICE_LISTEN_IP || '0.0.0.0',
        announcedIp: process.env.VOICE_ANNOUNCED_IP || '127.0.0.1',
      },
    ] as mediasoup.types.TransportListenInfo[],
    initialAvailableOutgoingBitrate: 1000000,
    minimumAvailableOutgoingBitrate: 600000,
    maxSctpMessageSize: 262144,
  },
}
