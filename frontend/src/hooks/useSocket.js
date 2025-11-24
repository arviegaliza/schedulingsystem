import { useEffect } from "react";
import { io } from "socket.io-client";

export default function useSocket(onStatusUpdate) {
  useEffect(() => {
    // ⚠️ Change http:// → https:// (or wss:// for websockets)
    const socket = io("https://schedulingsystem-1.onrender.com", {
  transports: ["websocket", "polling"],
});


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
