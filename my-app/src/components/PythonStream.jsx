import React, { useState, useEffect, useRef } from "react";
import "./python-stream.css"; // імпорт стилів

const PYTHON_STREAM_URL = "http://192.168.0.103:5000/video_feed";
const UI_LOADING_DELAY = 7000; // 5 секунд

function PythonStream({ rtspUrl }) {
  const [status, setStatus] = useState("idle"); 
  const [videoUrl, setVideoUrl] = useState(""); 

  const connectionAttemptResultRef = useRef(null); 
  const uiLoadingTimerRef = useRef(null); 

  useEffect(() => {
    return () => {
      if (uiLoadingTimerRef.current) {
        clearTimeout(uiLoadingTimerRef.current);
      }
    };
  }, []); 

  const attemptConnection = async () => {
    try {
      console.log("Спроба підключення до бекенду..."); 
      const response = await fetch("http://localhost:3003/start-tracking", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          rtspUrl: rtspUrl, 
        }),
      });

      if (response.ok) {
        console.log("Підключення до бекенду успішне!");
        return true; 
      } else {
        console.log("Помилка при підключенні до бекенду (відповідь не OK).");
        return false; 
      }
    } catch (error) {
      console.error("Помилка при спробі підключення до бекенду:", error);
      return false; 
    } finally {
    }
  }; 

  const startTracking = async () => {
    if (uiLoadingTimerRef.current) {
      clearTimeout(uiLoadingTimerRef.current);
    } 

    setStatus("loading");
    setVideoUrl(""); 
    connectionAttemptResultRef.current = null; 

    let connectionSuccessful = false; 

    attemptConnection()
      .then((success) => {
        connectionSuccessful = success;
      })
      .catch(() => {
        connectionSuccessful = false;
      }); 

    uiLoadingTimerRef.current = setTimeout(() => {
      if (connectionSuccessful) {
        setStatus("connected");
        setVideoUrl(PYTHON_STREAM_URL);
        console.log(
          "Завантаження UI завершено, підключення успішне. Відображаємо відео та статус."
        );
      } else {
        setStatus("failed");
        console.log(
          "Завантаження UI завершено, підключення не вдалося. Відображаємо повідомлення про помилку."
        );
      }
    }, UI_LOADING_DELAY); 
  };

  const stopTracking = async () => {
    try {
      const response = await fetch("http://localhost:3003/stop-tracking", {
        method: "POST", 
      });
      if (response.ok) {
        console.log("Трекінг зупинено");
        setStatus("idle");
        setVideoUrl(""); 
      } else {
        console.error("Помилка при зупинці трекінгу на бекенді");
      }
    } catch (error) {
      console.error("Помилка при відправці запиту на зупинку:", error);
    }
  }; 
  const renderContent = () => {
    switch (status) {
      case "idle":
        return (
          <button
            className="start-button"
            onClick={startTracking} 
          >
           Запустити трекінг 
          </button>
        );
      case "loading":
        return (
          <div className="loading-indicator">
             <div className="spinner"></div>{" "}
            <p>Встановлення з'єднання...</p>
          </div>
        );
      case "connected":
        return (
          <>
            <p className="connection-status success">З'єднання встановлено</p> 
            
            <button className="stop-button" onClick={stopTracking}>
              Зупинити трекінг 
            </button>
          </>
        );
      case "failed":
        return (
          <>
            <p className="connection-status error">Не вдалося підключитись</p> 
            <button
              className="start-button" 
              onClick={startTracking}
            >
              Спробувати ще раз 
            </button>
          </>
        );
      default:
        return null; 
    }
  };

  return (
    <div className="tracking-container">
      <h2>Відеопотік з Python</h2>
    
      {status === "connected" && videoUrl && (
        <img
          key={videoUrl} 
          src={videoUrl}
          alt="Відеопотік з камери"
          className="video-stream"
        />
      )}
      {status !== "connected" && (
        <div className="video-placeholder">
          {status === "idle" && <p>Відеопотік не активний.</p>}
          {status === "loading" && <p>Очікування відеопотоку...</p>}
          {status === "failed" && (
            <p>Немає відеопотоку або не вдалося підключитись.</p>
          )}
        </div>
      )}
      <div className="controls">
         {renderContent()}
      </div>
    </div>
  );
}

export default PythonStream;
