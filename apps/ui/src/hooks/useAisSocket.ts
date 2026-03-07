import { useEffect, useRef, useState } from 'react';
import {
  createAisSocketClient,
  type AisSocketConnectionStatus,
  type AisStreamStatus,
  type VesselUpdate
} from '../services/aisSocket';

type UseAisSocketOptions = {
  url?: string;
  onVesselUpdate?: (update: VesselUpdate) => void;
  onConnectionStatus?: (status: AisSocketConnectionStatus) => void;
  onStreamStatus?: (status: AisStreamStatus) => void;
};

export const useAisSocket = (options: UseAisSocketOptions = {}) => {
  const [connectionStatus, setConnectionStatus] = useState<AisSocketConnectionStatus>('idle');
  const [streamStatus, setStreamStatus] = useState<AisStreamStatus>('disconnected');
  const handlersRef = useRef(options);

  useEffect(() => {
    handlersRef.current = options;
  }, [options]);

  useEffect(() => {
    const client = createAisSocketClient({
      url: options.url,
      onVesselUpdate: (update) => handlersRef.current.onVesselUpdate?.(update),
      onConnectionStatus: (status) => {
        setConnectionStatus(status);
        handlersRef.current.onConnectionStatus?.(status);
      },
      onStreamStatus: (status) => {
        setStreamStatus(status);
        handlersRef.current.onStreamStatus?.(status);
      }
    });

    client.connect();
    return () => client.close();
  }, [options.url]);

  return {
    connectionStatus,
    streamStatus
  };
};