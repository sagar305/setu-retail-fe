import React, { createContext, useCallback, useEffect, useRef, useState } from 'react';

export const SSEContext = createContext();

export const SSEProvider = ({ children }) => {
  const [events, setEvents] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState(null);
  const eventSourceRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);

  const connect = useCallback(() => {
    try {
      const token = localStorage.getItem('token');

      const eventSource = new EventSource('/api/sse/subscribe/tenant', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      eventSource.onopen = () => {
        setIsConnected(true);
        setError(null);
      };

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (!data.data) return;
          setEvents((prevEvents) => [data, ...prevEvents].slice(0, 100));
        } catch (parseError) {
          console.error('Error parsing SSE event:', parseError);
        }
      };

      eventSource.onerror = () => {
        setIsConnected(false);
        setError('SSE connection lost');
        eventSource.close();

        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, 5000);
      };

      eventSourceRef.current = eventSource;
    } catch (err) {
      setError(err.message);
      setIsConnected(false);
    }
  }, []);

  useEffect(() => {
    connect();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [connect]);

  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }
    setIsConnected(false);
  }, []);

  const getRecentEvents = useCallback(
    (eventType, limit = 10) => {
      let filtered = events;
      if (eventType) {
        filtered = events.filter((e) => e.type === eventType);
      }
      return filtered.slice(0, limit);
    },
    [events]
  );

  const getEventsByType = useCallback(
    (eventType) => {
      return events.filter((e) => e.type === eventType);
    },
    [events]
  );

  return (
    <SSEContext.Provider
      value={{
        events,
        isConnected,
        error,
        connect,
        disconnect,
        getRecentEvents,
        getEventsByType,
      }}
    >
      {children}
    </SSEContext.Provider>
  );
};
