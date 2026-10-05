'use client';

// ============================================================
// MEDCORE HMS - REALTIME SOCKET.IO NOTIFICATION CLIENT
// ============================================================

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
} from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './auth-context';
import { api } from './api';
import type { Notification } from './types';

interface SocketContextType {
  isConnected: boolean;
  notifications: Notification[];
  unreadCount: number;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  refreshNotifications: () => Promise<void>;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

const SOCKET_URL =
  process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:5000';

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const { user, token } = useAuth();
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);

  const refreshNotifications = useCallback(async () => {
    if (!user) return;
    try {
      const [listRes, countRes] = await Promise.all([
        api.get<Notification[]>('/notifications', { params: { limit: 20 } }),
        api.get<{ count: number }>('/notifications/unread-count'),
      ]);
      setNotifications(Array.isArray(listRes) ? listRes : []);
      setUnreadCount(countRes?.count ?? 0);
    } catch {
      // Non-blocking notification fetch failure
    }
  }, [user]);

  // Initial fetch when authenticated
  useEffect(() => {
    if (!user || !token) {
      return;
    }

    let ignore = false;
    async function loadNotifications() {
      try {
        const [listRes, countRes] = await Promise.all([
          api.get<Notification[]>('/notifications', { params: { limit: 20 } }),
          api.get<{ count: number }>('/notifications/unread-count'),
        ]);
        if (!ignore) {
          setNotifications(Array.isArray(listRes) ? listRes : []);
          setUnreadCount(countRes?.count ?? 0);
        }
      } catch {
        // Non-blocking notification fetch failure
      }
    }

    loadNotifications();

    return () => {
      ignore = true;
      setNotifications([]);
      setUnreadCount(0);
    };
  }, [user, token]);

  // Establish single persistent socket connection
  useEffect(() => {
    if (!user || !token) {
      return;
    }

    const socketInstance = io(SOCKET_URL, {
      auth: {
        token,
      },
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    });

    socketInstance.on('connect', () => {
      setIsConnected(true);
    });

    socketInstance.on('disconnect', () => {
      setIsConnected(false);
    });

    // Realtime notification event
    socketInstance.on('notification', (newNotification: Notification) => {
      setNotifications((prev) => [newNotification, ...prev]);
      setUnreadCount((prev) => prev + 1);
    });

    socketRef.current = socketInstance;

    return () => {
      socketInstance.disconnect();
      socketRef.current = null;
      setIsConnected(false);
    };
  }, [user, token]);

  const markAsRead = async (id: string) => {
    try {
      await api.patch(`/notifications/${id}/read`);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {
      // fallback
    }
  };

  const markAllAsRead = async () => {
    try {
      await api.patch('/notifications/read-all');
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch {
      // fallback
    }
  };

  return (
    <SocketContext.Provider
      value={{
        isConnected,
        notifications,
        unreadCount,
        markAsRead,
        markAllAsRead,
        refreshNotifications,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
}
