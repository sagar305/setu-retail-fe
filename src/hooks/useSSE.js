import { useEffect, useState, useCallback, useRef } from 'react';

const useSSE = (subscriptionType = 'tenant', outletId = null) => {
  const [events, setEvents] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState(null);
  const eventSourceRef = useRef(null);

  const connect = useCallback(() => {
    try {
      let url = '/api/sse/subscribe/';
      if (subscriptionType === 'outlet' && outletId) {
        url += `outlet/${outletId}`;
      } else {
        url += 'tenant';
      }

      const token = localStorage.getItem('token');
      const eventSource = new EventSource(url, {
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
          setEvents((prevEvents) => [data, ...prevEvents].slice(0, 100));
        } catch (parseError) {
          console.error('Error parsing SSE event:', parseError);
        }
      };

      eventSource.onerror = (err) => {
        setIsConnected(false);
        setError('SSE connection failed');
        eventSource.close();
        setTimeout(connect, 5000);
      };

      eventSourceRef.current = eventSource;
    } catch (err) {
      setError(err.message);
      setIsConnected(false);
    }
  }, [subscriptionType, outletId]);

  useEffect(() => {
    connect();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, [connect]);

  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      setIsConnected(false);
    }
  }, []);

  const getRecentEvents = useCallback(
    (eventType) => {
      if (eventType) {
        return events.filter((e) => e.type === eventType);
      }
      return events;
    },
    [events]
  );

  return {
    events,
    isConnected,
    error,
    connect,
    disconnect,
    getRecentEvents,
  };
};

export default useSSE;
