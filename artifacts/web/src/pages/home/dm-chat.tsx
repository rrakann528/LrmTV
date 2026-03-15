import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Send } from 'lucide-react';
import { Avatar } from '@/components/avatar';
import { useAuth, apiFetch } from '@/hooks/use-auth';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { io, Socket } from 'socket.io-client';

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

interface DmMessage {
  id: number;
  senderId: number;
  receiverId: number;
  content: string;
  createdAt: string;
}

interface Friend {
  id: number;
  username: string;
  displayName: string | null;
  avatarColor: string;
  avatarUrl: string | null;
}

interface Props {
  friend: Friend;
  onBack: () => void;
}

export function DmChat({ friend, onBack }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [messages, setMessages] = useState<DmMessage[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const seenIds = useRef<Set<number>>(new Set());

  const { data: history = [], isLoading } = useQuery<DmMessage[]>({
    queryKey: ['dm', friend.id],
    queryFn: () => apiFetch(`/dm/${friend.id}`).then(r => r.json()),
  });

  useEffect(() => {
    setMessages(history);
    history.forEach(m => seenIds.current.add(m.id));
  }, [history]);

  // Mark as read when DM opens and when messages arrive
  useEffect(() => {
    apiFetch(`/dm/${friend.id}/read`, { method: 'POST' }).then(() => {
      qc.invalidateQueries({ queryKey: ['friends-conversations'] });
      qc.invalidateQueries({ queryKey: ['friends-badge'] });
    }).catch(() => {});
  }, [friend.id, messages.length]);

  // Socket for real-time messages — authenticated with JWT
  useEffect(() => {
    const token = localStorage.getItem('lrmtv_auth_token') || '';

    const socket = io(BASE || '/', {
      path: '/api/socket.io',
      transports: ['websocket', 'polling'],
      auth: { token },
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('join-user-room', { userId: user?.id });
    });

    socket.on('dm:receive', (msg: DmMessage) => {
      const inConversation =
        (msg.senderId === friend.id && msg.receiverId === user?.id) ||
        (msg.senderId === user?.id && msg.receiverId === friend.id);

      if (!inConversation) return;
      if (seenIds.current.has(msg.id)) return;

      seenIds.current.add(msg.id);
      setMessages(prev => [...prev, msg]);

      // Mark as read immediately since chat is open
      apiFetch(`/dm/${friend.id}/read`, { method: 'POST' }).then(() => {
        qc.invalidateQueries({ queryKey: ['friends-conversations'] });
        qc.invalidateQueries({ queryKey: ['friends-badge'] });
      }).catch(() => {});
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [friend.id, user?.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = async () => {
    const t = text.trim();
    if (!t || sending || !user) return;
    setSending(true);
    setText('');

    // Optimistic: show message immediately
    const tempId = -Date.now();
    const optimistic: DmMessage = {
      id: tempId,
      senderId: user.id,
      receiverId: friend.id,
      content: t,
      createdAt: new Date().toISOString(),
    };
    seenIds.current.add(tempId);
    setMessages(prev => [...prev, optimistic]);

    try {
      const res = await apiFetch(`/dm/${friend.id}`, {
        method: 'POST',
        body: JSON.stringify({ content: t }),
      });
      if (res.ok) {
        const saved: DmMessage = await res.json();
        // Replace optimistic with real message
        seenIds.current.add(saved.id);
        setMessages(prev => prev.map(m => m.id === tempId ? saved : m));
      } else {
        // Remove optimistic on error
        setMessages(prev => prev.filter(m => m.id !== tempId));
        setText(t);
      }
    } catch {
      setMessages(prev => prev.filter(m => m.id !== tempId));
      setText(t);
    } finally {
      setSending(false);
    }
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
  };

  const displayName = friend.displayName || friend.username;

  return (
    <motion.div
      className="absolute inset-0 bg-background z-40 flex flex-col"
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 30, stiffness: 400 }}
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card">
        <button onClick={onBack} className="p-2 rounded-xl hover:bg-muted/50 active:scale-95 transition-transform">
          <ArrowRight className="w-5 h-5" />
        </button>
        <Avatar name={displayName} color={friend.avatarColor} url={friend.avatarUrl} size={38} />
        <div>
          <p className="font-semibold text-foreground text-sm">{displayName}</p>
          <p className="text-xs text-muted-foreground">@{friend.username}</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {isLoading ? (
          <div className="flex justify-center py-10">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
            <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center">
              <Avatar name={displayName} color={friend.avatarColor} url={friend.avatarUrl} size={48} />
            </div>
            <p className="text-sm font-medium">{displayName}</p>
            <p className="text-xs text-muted-foreground/60">ابدأ المحادثة</p>
          </div>
        ) : (
          messages.map(msg => {
            const isMe = msg.senderId === user?.id;
            const isOptimistic = msg.id < 0;
            return (
              <div key={msg.id} className={`flex ${isMe ? 'justify-start' : 'justify-end'}`}>
                <div className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm ${
                  isMe
                    ? `bg-primary text-primary-foreground rounded-tr-sm ${isOptimistic ? 'opacity-70' : ''}`
                    : 'bg-muted text-foreground rounded-tl-sm'
                }`}>
                  <p style={{ direction: 'rtl' }}>{msg.content}</p>
                  <p className={`text-[10px] mt-1 ${isMe ? 'text-primary-foreground/60' : 'text-muted-foreground'}`}>
                    {isOptimistic ? '...' : formatTime(msg.createdAt)}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-border bg-card">
        <div className="flex items-center gap-2">
          <input
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
            placeholder="اكتب رسالة..."
            className="flex-1 bg-muted/50 border border-border rounded-2xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            dir="rtl"
          />
          <button
            onClick={send}
            disabled={!text.trim() || sending}
            className="w-10 h-10 bg-primary rounded-full flex items-center justify-center disabled:opacity-40 flex-shrink-0 active:scale-95 transition-transform"
          >
            <Send className="w-4 h-4 text-primary-foreground" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
