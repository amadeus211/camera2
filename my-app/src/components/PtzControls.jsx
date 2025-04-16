import React, { useRef, useState } from "react";
import "../ptzControls.css";

const PtzControls = ({ ws, selectedDevice }) => {
  const [ptzSpeed, setPtzSpeed] = useState(2.5);
  const intervalRef = useRef(null);

  const sendRequest = (method, params = {}) => {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      console.error("WebSocket is not open.");
      return;
    }
    ws.send(JSON.stringify({ method, params }));
  };

  const ptzControlStart = (direction) => {
    const getSpeed = () => {
      let speed = { x: 0, y: 0, z: 0 };
      if (direction === "up") speed.y = ptzSpeed;
      if (direction === "down") speed.y = -ptzSpeed;
      if (direction === "left") speed.x = -ptzSpeed;
      if (direction === "right") speed.x = ptzSpeed;
      return speed;
    };

    sendRequest("ptzMove", {
      address: selectedDevice,
      speed: getSpeed(),
    });

    intervalRef.current = setInterval(() => {
      sendRequest("ptzMove", {
        address: selectedDevice,
        speed: getSpeed(),
      });
    }, 200);
  };

  const ptzControlStop = () => {
    clearInterval(intervalRef.current);
    sendRequest("ptzStop", { address: selectedDevice });
  };

  const handleEvents = (direction) => ({
    onMouseDown: () => ptzControlStart(direction),
    onMouseUp: ptzControlStop,
    onMouseLeave: ptzControlStop,
    onTouchStart: () => ptzControlStart(direction),
    onTouchEnd: ptzControlStop,
  });

  return (
    <div className="ptz-ctl-box">
      <div className="ptz-grid">
        <button className="ptz-btn empty"></button>
        <button className="ptz-btn up" {...handleEvents("up")}>↑</button>
        <button className="ptz-btn empty"></button>

        <button className="ptz-btn left" {...handleEvents("left")}>←</button>
        <button className="ptz-btn empty"></button>
        <button className="ptz-btn right" {...handleEvents("right")}>→</button>

        <button className="ptz-btn empty"></button>
        <button className="ptz-btn down" {...handleEvents("down")}>↓</button>
        <button className="ptz-btn empty"></button>
      </div>

      <div className="ptz-speed-box">
        <label className="ptz-label" htmlFor="ptzSpeed">Швидкість: {ptzSpeed.toFixed(1)}</label>
        <input
          type="range"
          id="ptzSpeed"
          min="0.1"
          max="5"
          step="0.1"
          value={ptzSpeed}
          onChange={(e) => setPtzSpeed(parseFloat(e.target.value))}
        />
      </div>
    </div>
  );
};

export default PtzControls;
