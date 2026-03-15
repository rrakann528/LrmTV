import { useEffect, useRef, useCallback, useState } from 'react';
import { Socket } from 'socket.io-client';

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' },
  ],
};

export function useStreamRelay(socket: Socket | null) {
  const [isRelaying, setIsRelaying] = useState(false);
  const [relayHostSocketId, setRelayHostSocketId] = useState<string | null>(null);
  const [relayStream, setRelayStream] = useState<MediaStream | null>(null);

  const peersRef        = useRef<Map<string, RTCPeerConnection>>(new Map());
  const capturedStreamRef = useRef<MediaStream | null>(null);
  const canvasRef       = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef    = useRef<number | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const audioCtxRef     = useRef<any>(null);

  const closePeer = useCallback((id: string) => {
    const pc = peersRef.current.get(id);
    if (pc) { pc.close(); peersRef.current.delete(id); }
  }, []);

  const stopCanvasCapture = useCallback(() => {
    if (animFrameRef.current) { cancelAnimationFrame(animFrameRef.current); animFrameRef.current = null; }
    if (audioCtxRef.current) { try { audioCtxRef.current.close(); } catch { /* */ } audioCtxRef.current = null; }
    canvasRef.current = null;
  }, []);

  /**
   * Build a MediaStream from a <video> element.
   * Strategy:
   *   1. Try native captureStream() / mozCaptureStream() — Chrome, Firefox
   *   2. Fall back to canvas.captureStream() — Safari iOS (captureStream on iOS 14.5+)
   *      + Web Audio API for audio track
   * Returns null if the video isn't ready yet (readyState < HAVE_CURRENT_DATA).
   */
  const buildStream = useCallback((videoEl: HTMLVideoElement): MediaStream | null => {
    if (videoEl.readyState < 2) return null; // not ready yet

    // ── Native captureStream (Chrome / Firefox) ────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const native = (videoEl as any).captureStream?.() ?? (videoEl as any).mozCaptureStream?.();
    if (native instanceof MediaStream) return native;

    // ── Canvas fallback (Safari) ───────────────────────────────────────────
    const w = videoEl.videoWidth  || 640;
    const h = videoEl.videoHeight || 360;

    const canvas = document.createElement('canvas');
    canvas.width  = w;
    canvas.height = h;
    canvasRef.current = canvas;

    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const draw = () => {
      if (!canvasRef.current) return;
      if (videoEl.videoWidth && videoEl.videoWidth !== canvas.width) {
        canvas.width  = videoEl.videoWidth;
        canvas.height = videoEl.videoHeight;
      }
      ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
      animFrameRef.current = requestAnimationFrame(draw);
    };
    animFrameRef.current = requestAnimationFrame(draw);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const canvasStream: MediaStream = (canvas as any).captureStream?.(30);
    if (!canvasStream) { stopCanvasCapture(); return null; }

    // Try to add audio via Web Audio API
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const AudioCtx = (window.AudioContext ?? (window as any).webkitAudioContext) as typeof AudioContext;
      const audioCtx = new AudioCtx();
      audioCtxRef.current = audioCtx;
      const src  = audioCtx.createMediaElementSource(videoEl);
      const dest = audioCtx.createMediaStreamDestination();
      src.connect(dest);
      src.connect(audioCtx.destination); // keep local audio
      dest.stream.getAudioTracks().forEach(t => canvasStream.addTrack(t));
    } catch (e) {
      console.warn('[Relay] Audio capture unavailable (cross-origin or unsupported):', e);
    }

    return canvasStream;
  }, [stopCanvasCapture]);

  // HOST: Start broadcasting — returns 'ok' | 'not-ready' | 'unsupported'
  const startRelay = useCallback((videoEl: HTMLVideoElement): 'ok' | 'not-ready' | 'unsupported' => {
    if (!socket) return 'unsupported';

    if (videoEl.readyState < 2) return 'not-ready';

    const stream = buildStream(videoEl);
    if (!stream) return 'unsupported';

    capturedStreamRef.current = stream;
    setIsRelaying(true);
    socket.emit('relay:advertise');
    return 'ok';
  }, [socket, buildStream]);

  // HOST: Stop relay
  const stopRelay = useCallback(() => {
    if (!socket) return;
    setIsRelaying(false);
    capturedStreamRef.current = null;
    stopCanvasCapture();
    peersRef.current.forEach(pc => pc.close());
    peersRef.current.clear();
    socket.emit('relay:stop');
  }, [socket, stopCanvasCapture]);

  // VIEWER: Request to receive relay
  const joinRelay = useCallback((hostSocketId: string) => {
    if (!socket) return;
    socket.emit('relay:request', { hostSocketId });
  }, [socket]);

  // VIEWER: Leave relay
  const leaveRelay = useCallback(() => {
    setRelayStream(null);
    setRelayHostSocketId(null);
    peersRef.current.forEach(pc => pc.close());
    peersRef.current.clear();
  }, []);

  useEffect(() => {
    if (!socket) return;

    // HOST: viewer wants to connect
    const onRelayRequest = async ({ viewerSocketId }: { viewerSocketId: string }) => {
      if (!capturedStreamRef.current) return;
      closePeer(viewerSocketId);

      const pc = new RTCPeerConnection(ICE_SERVERS);
      peersRef.current.set(viewerSocketId, pc);

      capturedStreamRef.current.getTracks().forEach(t =>
        pc.addTrack(t, capturedStreamRef.current!));

      pc.onicecandidate = (e) => {
        if (e.candidate) {
          socket.emit('webrtc-signal', {
            targetSocketId: viewerSocketId,
            signal: e.candidate,
            type: 'relay-ice',
          });
        }
      };

      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit('webrtc-signal', {
          targetSocketId: viewerSocketId,
          signal: pc.localDescription,
          type: 'relay-offer',
        });
      } catch (err) {
        console.error('[Relay] offer error', err);
      }
    };

    // VIEWER: relay advertised
    const onRelayAdvertise = ({ hostSocketId }: { hostSocketId: string }) => {
      setRelayHostSocketId(hostSocketId);
    };

    // Relay ended
    const onRelayStop = ({ hostSocketId }: { hostSocketId: string }) => {
      if (capturedStreamRef.current) return; // we are the host
      setRelayHostSocketId(prev => prev === hostSocketId ? null : prev);
      setRelayStream(null);
      peersRef.current.forEach(pc => pc.close());
      peersRef.current.clear();
    };

    // WebRTC signals — only handles relay-* types
    const onWebRTCSignal = async ({
      fromSocketId,
      signal,
      type,
    }: {
      fromSocketId: string;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      signal: any;
      type: string;
    }) => {
      if (type === 'relay-offer') {
        closePeer(fromSocketId);
        const pc = new RTCPeerConnection(ICE_SERVERS);
        peersRef.current.set(fromSocketId, pc);

        pc.ontrack = (e) => { if (e.streams[0]) setRelayStream(e.streams[0]); };

        pc.onicecandidate = (e) => {
          if (e.candidate) {
            socket.emit('webrtc-signal', {
              targetSocketId: fromSocketId,
              signal: e.candidate,
              type: 'relay-ice',
            });
          }
        };

        try {
          await pc.setRemoteDescription(new RTCSessionDescription(signal));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socket.emit('webrtc-signal', {
            targetSocketId: fromSocketId,
            signal: pc.localDescription,
            type: 'relay-answer',
          });
        } catch (err) {
          console.error('[Relay] answer error', err);
        }

      } else if (type === 'relay-answer') {
        const pc = peersRef.current.get(fromSocketId);
        if (pc) {
          try { await pc.setRemoteDescription(new RTCSessionDescription(signal)); }
          catch (err) { console.error('[Relay] setRemoteDescription(answer)', err); }
        }

      } else if (type === 'relay-ice') {
        const pc = peersRef.current.get(fromSocketId);
        if (pc) {
          try { await pc.addIceCandidate(new RTCIceCandidate(signal)); }
          catch { /* non-fatal */ }
        }
      }
    };

    socket.on('relay:advertise', onRelayAdvertise);
    socket.on('relay:stop',      onRelayStop);
    socket.on('relay:request',   onRelayRequest);
    socket.on('webrtc-signal',   onWebRTCSignal);

    return () => {
      socket.off('relay:advertise', onRelayAdvertise);
      socket.off('relay:stop',      onRelayStop);
      socket.off('relay:request',   onRelayRequest);
      socket.off('webrtc-signal',   onWebRTCSignal);
    };
  }, [socket, closePeer]);

  useEffect(() => {
    return () => {
      peersRef.current.forEach(pc => pc.close());
      peersRef.current.clear();
      stopCanvasCapture();
    };
  }, [stopCanvasCapture]);

  return {
    isRelaying,
    relayHostSocketId,
    relayStream,
    startRelay,
    stopRelay,
    joinRelay,
    leaveRelay,
  };
}
