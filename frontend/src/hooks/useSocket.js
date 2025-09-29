import { useEffect } from "react";
import { io } from "socket.io-client";

export default function useSocket(onStatusUpdate) {
  useEffect(() => {
  const socket = io("http://SDOINSchedulingSystem:8081"); // Use your backend port

    socket.on("connect", () => {
      console.log("Connected to Socket.IO server!");
    });

    socket.on("statusUpdated", () => {
      if (onStatusUpdate) onStatusUpdate();
    });

    return () => {
      socket.disconnect();
    };
  }, [onStatusUpdate]);
} 