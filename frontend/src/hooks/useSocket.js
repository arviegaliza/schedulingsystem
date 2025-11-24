import { useEffect } from "react";
import { io } from "socket.io-client";

export default function useSocket(onStatusUpdate) {
  useEffect(() => {
    const socket = io("https://schedulingsystem-1.onrender.com", {
      transports: ["websocket", "polling"]
    });

    socket.on("connect", () => {
      console.log("Connected to Socket.IO server:", socket.id);
    });

    socket.on("statusUpdated", () => {
      if (onStatusUpdate) onStatusUpdate();
    });

    socket.on("disconnect", () => {
      console.log("Disconnected from Socket.IO server");
    });

    return () => {
      socket.disconnect();
    };
  }, [onStatusUpdate]);
}
