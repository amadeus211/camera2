import React, { useState, useEffect } from "react";

const PythonStream = () => {
  const [streamUrl, setStreamUrl] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Перевірка доступності трекінг-серверу
    fetch("http://localhost:3004")
      .then(response => {
        if (response.ok) {
          setStreamUrl("http://localhost:3004/video_feed");
          setIsConnected(true);
        } else {
          // Якщо трекінг-сервер недоступний, використовуємо проксі через Node.js сервер
          setStreamUrl("http://localhost:3003/tracking_feed");
          setIsConnected(true);
        }
      })
      .catch(err => {
        console.log("Трекінг-сервер недоступний, використовуємо проксі");
        setStreamUrl("http://localhost:3003/tracking_feed");
        setIsConnected(true);
      });
  }, []);

  return (
    <div className="video-container">
      {error && <div className="error-message">{error}</div>}
      {!isConnected && <div className="loading">З'єднання з сервером...</div>}
      {streamUrl && (
        <img
          src={streamUrl}
          alt="Відеопотік з трекінгом"
          style={{ 
            width: "100%", 
            height: "auto",
            display: isConnected ? "block" : "none" 
          }}
          onError={(e) => {
            console.error("Помилка завантаження відео");
            setError("Помилка завантаження відеопотоку");
          }}
        />
      )}
    </div>
  );
};

export default PythonStream;