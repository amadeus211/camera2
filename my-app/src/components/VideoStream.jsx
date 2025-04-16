import React, { useEffect } from "react";
import JSMpeg from "@cycjimmy/jsmpeg-player";
import axios from "axios";
import PythonStream from "./PythonStream";


const VideoStream = ({ rtspUrl, cameraConnected }) => {
  useEffect(() => {
    if (cameraConnected && rtspUrl) {
      axios.get(`http://127.0.0.1:3003/stream?rtsp=${encodeURIComponent(rtspUrl)}`);
      setTimeout(() => {
        new JSMpeg.Player("ws://127.0.0.1:9999", { canvas: document.getElementById("video-canvas") });
      }, 1000);
    }
  }, [cameraConnected, rtspUrl]);

  return (
    <div>
        <canvas id="video-canvas"></canvas>;
        <PythonStream></PythonStream>
    </div>
  )
  
  

};

export default VideoStream;
