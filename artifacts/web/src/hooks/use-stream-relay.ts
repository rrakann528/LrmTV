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

  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const capturedStreamRef = useRef<MediaStream | null>(null);

  const closePeer = (id: string) => {
    const pc = peersRef.current.get(id);
    if (pc) { pc.close(); peersRef.current.delete(id); }
  };

  // HOST: Start broadcasting the video element stream to the room
  const startRelay = useCallback((videoEl: HTMLVideoElement) => {
    if (!socket) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const stream: MediaStream | undefined = (videoEl as any).captureStream?.() ?? (videoEl as any).mozCaptureStream?.();
    if (!stream) { console.warn('[Relay] captureStream not supported'); return; }
    capturedStreamRef.current = stream;
    setIsRelaying(true);
    socket.emit('relay:advertise');
  }, [socket]);

  // HOST: Stop the relay
  const stopRelay = useCallback(() => {
    if (!socket) return;
    setIsRelaying(false);
    capturedStreamRef.current = null;
    peersRef.current.forEach(pc => pc.close());
    peersRef.current.clear();
    socket.emit('relay:stop');
  }, [socket]);

  // VIEWER: Join the relay from the host
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

    // HOST receives: a viewer wants to watch the relay
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

    // VIEWER receives: relay is now available
    const onRelayAdvertise = ({ hostSocketId }: { hostSocketId: string }) => {
      setRelayHostSocketId(hostSocketId);
    };

    // Relay ended
    const onRelayStop = ({ hostSocketId }: { hostSocketId: string }) => {
      if (capturedStreamRef.current) return; // we are the host, ignore
      setRelayHostSocketId(prev => prev === hostSocketId ? null : prev);
      setRelayStream(null);
      peersRef.current.forEach(pc => pc.close());
      peersRef.current.clear();
    };

    // WebRTC signaling — only handles relay-* types, ignores call types
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
        // VIEWER receives offer from host — set up receiving peer
        closePeer(fromSocketId);
        const pc = new RTCPeerConnection(ICE_SERVERS);
        peersRef.current.set(fromSocketId, pc);

        pc.ontrack = (e) => {
          if (e.streams[0]) setRelayStream(e.streams[0]);
        };

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
        // HOST receives answer from viewer
        const pc = peersRef.current.get(fromSocketId);
        if (pc) {
          try { await pc.setRemoteDescription(new RTCSessionDescription(signal)); }
          catch (err) { console.error('[Relay] setRemoteDescription(answer) error', err); }
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
  }, [socket]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      peersRef.current.forEach(pc => pc.close());
      peersRef.current.clear();
    };
  }, []);

  return { isRelaying, relayHostSocketId, relayStream, startRelay, stopRelay, joinRelay, leaveRelay };
}
