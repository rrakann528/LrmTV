import Hls from 'hls.js';

let _dc: RTCDataChannel | null = null;

type PendingEntry = {
  onSuccess: (data: ArrayBuffer) => void;
  onError: (status: number) => void;
};
const _pending = new Map<string, PendingEntry>();

function handleDcMessage(e: MessageEvent) {
  if (typeof e.data === 'string') {
    try {
      const msg = JSON.parse(e.data) as { requestId: string; error?: number };
      const entry = _pending.get(msg.requestId);
      if (entry) {
        _pending.delete(msg.requestId);
        entry.onError(msg.error ?? 502);
      }
    } catch {}
  } else if (e.data instanceof ArrayBuffer && e.data.byteLength > 36) {
    const view = new Uint8Array(e.data);
    const requestId = new TextDecoder().decode(view.slice(0, 36));
    const data = e.data.slice(36);
    const entry = _pending.get(requestId);
    if (entry) {
      _pending.delete(requestId);
      entry.onSuccess(data);
    }
  }
}

export function setPeerChannel(dc: RTCDataChannel | null) {
  if (_dc) {
    _dc.onmessage = null;
    _dc.onclose = null;
  }
  _dc = dc;
  if (!dc) return;
  dc.binaryType = 'arraybuffer';
  dc.onmessage = handleDcMessage;
  dc.onclose = () => { _dc = null; _pending.clear(); };
  dc.onerror = () => { _dc = null; _pending.clear(); };
}

export function hasPeerChannel(): boolean {
  return !!_dc && _dc.readyState === 'open';
}

function genId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-xxxx-xxxx`.slice(0, 36).padEnd(36, '0');
}

export function createP2PLoader() {
  if (!hasPeerChannel()) return null;

  const DefaultLoader = Hls.DefaultConfig.loader as new (...a: unknown[]) => unknown;

  return class P2PLoader extends (DefaultLoader as new (...a: unknown[]) => {
    load(ctx: unknown, cfg: unknown, cbs: unknown): void;
    abort(): void;
    destroy(): void;
  }) {
    private _aborted = false;
    private _requestId: string | null = null;
    private _timer: ReturnType<typeof setTimeout> | null = null;

    private _cancel() {
      if (this._requestId) { _pending.delete(this._requestId); this._requestId = null; }
      if (this._timer) { clearTimeout(this._timer); this._timer = null; }
    }

    abort()   { this._aborted = true; this._cancel(); super.abort(); }
    destroy() { this._aborted = true; this._cancel(); super.destroy(); }

    load(
      context: Record<string, unknown>,
      config: unknown,
      callbacks: Record<string, (...args: unknown[]) => void>,
    ) {
      const dc = _dc;
      if (!dc || dc.readyState !== 'open') {
        super.load(context, config, callbacks);
        return;
      }

      const url = context.url as string;
      const onErr = callbacks.onError as (e: { code: number; text: string }, ctx: unknown, r: unknown, s: unknown) => void;
      const stats = {
        trequest: performance.now(), tfirst: 0, tload: 0,
        loaded: 0, total: 0, retry: 0, chunkCount: 0, bwEstimate: 0,
        loading: { start: 0, first: 0, end: 0 },
        parsing: { start: 0, end: 0 },
        buffering: { start: 0, first: 0, end: 0 },
      };

      const requestId = genId();
      this._requestId = requestId;

      this._timer = setTimeout(() => {
        if (this._aborted) return;
        _pending.delete(requestId);
        this._requestId = null;
        onErr({ code: 0, text: 'P2P timeout' }, context, null, stats);
      }, 14_000);

      _pending.set(requestId, {
        onSuccess: (data: ArrayBuffer) => {
          this._cancel();
          if (this._aborted) return;
          stats.tfirst = stats.tload = performance.now();
          stats.loaded = stats.total = data.byteLength;
          try {
            (callbacks.onSuccess as (r: unknown, s: unknown, c: unknown, n: null) => void)(
              { url, data }, stats, context, null,
            );
          } catch {
            onErr({ code: 0, text: 'P2P parse error' }, context, null, stats);
          }
        },
        onError: (status: number) => {
          this._cancel();
          if (this._aborted) return;
          onErr({ code: status, text: `P2P error ${status}` }, context, null, stats);
        },
      });

      try {
        dc.send(JSON.stringify({ requestId, url }));
      } catch {
        this._cancel();
        super.load(context, config, callbacks);
      }
    }
  };
}
