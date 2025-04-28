"use strict";
const express = require("express");
const Stream = require("node-rtsp-stream");
const { spawn } = require("child_process");
const path = require("path");

process.chdir(__dirname);

const app = express();
app.use(express.json());

const cors = require("cors");
let pythonProcess = null;

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "http://localhost:3000");
  res.header("Access-Control-Allow-Methods", "GET,HEAD,PUT,PATCH,POST,DELETE");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization"
  );
  res.header("Access-Control-Allow-Credentials", "true");

  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }

  next();
});

var onvif = null;
let stream = null;
let currentRtspStreamUrl = null;
app.get("/stream", (req, res) => {
  const newRtspStreamUrl = req.query.rtsp;
  console.log(`Received stream request: ${newRtspStreamUrl}`);

  if (newRtspStreamUrl === "stop" && stream) {
    stream.stop();
    stream = null;
    currentRtspStreamUrl = null;
    console.log("Stream stopped.");
  } else if (newRtspStreamUrl && currentRtspStreamUrl !== newRtspStreamUrl) {
    if (stream) {
      stream.stop();
    }
    stream = new Stream({
      name: "Camera Stream",
      streamUrl: newRtspStreamUrl,
      wsPort: 9999,
    });
    currentRtspStreamUrl = newRtspStreamUrl;
    console.log(`New RTSP stream started: ${newRtspStreamUrl}`);
  }

  res.status(200).json({ url: "ws://127.0.0.1:9999" });
});

app.post("/start-tracking", (req, res) => {
  const { rtspUrl } = req.body;
  console.log("Received RTSP URL:", rtspUrl); // Перевірте, чи отримуєте правильний URL

  startPythonTracking(rtspUrl);
  res.status(200).send("Tracking started");
});

app.post("/stop-tracking", (req, res) => {
  if (pythonProcess) {
    pythonProcess.kill("SIGINT"); 
    pythonProcess = null;
    console.log("Трекінг зупинено");
    res.status(200).send({ message: "Трекінг зупинено" });
  } else {
    res.status(400).send({ message: "Трекінг не запущено" });
  }
});
try {
  onvif = require("../../lib/node-onvif.js");
} catch (e) {
  onvif = require("node-onvif");
}
var WebSocketServer = require("websocket").server;
var http = require("http");
var fs = require("fs");
var port = 3003;

(function main() {
  var http_server = http.createServer(httpServerRequest);
  http_server.listen(port, function () {
    console.log("Listening on port " + port);
  });
  var wsserver = new WebSocketServer({
    httpServer: http_server,
  });
  wsserver.on("request", wsServerRequest);
})();

function httpServerRequest(req, res) {
  if (req.url.startsWith("/stream")) {
    return app(req, res); // Передаємо запит в Express
  }
  if (req.url.startsWith("/start-tracking")) {
    return app(req, res); // Передаємо запит в Express
  }
  if (req.url.startsWith("/stop-tracking")) {
    return app(req, res); // Передаємо запит в Express
  }
  // // Додаємо новий маршрут для доступу до відеопотоку з трекінгом
  // if (req.url.startsWith("/tracking_feed")) {
  //   res.writeHead(200, {
  //     "Content-Type": "multipart/x-mixed-replace; boundary=frame",
  //     "Cache-Control": "no-cache",
  //     Connection: "close",
  //     Pragma: "no-cache",
  //   });

  //   // Перенаправляємо запит на Python-сервер
  //   const http = require("http");
  //   const tracking_req = http.request(
  //     {
  //       hostname: "127.0.0.1",
  //       port: 3004,
  //       path: "/video_feed",
  //       method: "GET",
  //     },
  //     (tracking_res) => {
  //       tracking_res.pipe(res);
  //     }
  //   );

  //   tracking_req.on("error", (e) => {
  //     console.error(`Problem with tracking request: ${e.message}`);
  //     res.end();
  //   });

  //   tracking_req.end();
  //   return;
  // }

  // Оригінальний код для обробки інших запитів
  var path = req.url.replace(/\?.*$/, "");
  if (path.match(/\.{2,}/) || path.match(/[^a-zA-Z\d\_\-\.\/]/)) {
    httpServerResponse404(req.url, res);
    return;
  }
  if (path === "/") {
    path = "/index.html";
    console.log("html?");
  }
  var fpath = "./html" + path;
  fs.readFile(fpath, "utf-8", function (err, data) {
    if (err) {
      httpServerResponse404(req.url, res);
      return;
    } else {
      var ctype = getContentType(fpath);
      res.writeHead(200, { "Content-Type": ctype });
      res.write(data);
      res.end();
      console.log("HTTP : 200 OK : " + req.url);
    }
  });
}

function httpServerResponse404(url, res) {
  res.writeHead(404, { "Content-Type": "text/plain" });
  res.write("404 Not Found: " + url);
  res.end();
  console.log("HTTP : 404 Not Found : " + url);
}

function wsServerRequest(request) {
  var conn = request.accept(null, request.origin);

  if (Object.keys(devices).length === 0) {
    startDiscovery(conn);
  }

  conn.on("message", function (message) {
    if (message.type !== "utf8") {
      return;
    }
    var data = JSON.parse(message.utf8Data);
    var method = data["method"];
    console.log(`Received method: ${method}`);

    var params = data["params"];
    if (method === "startDiscovery") {
      startDiscovery(conn);
    } else if (method === "connect") {
      console.log("connect init");

      connect(conn, params);
    } else if (method === "ptzMove") {
      console.log("Move command received, initiating PTZ...");
      ptzMove(conn, params);
    } else if (method === "ptzStop") {
      ptzStop(conn, params);
    } else if (method === "ptzHome") {
      ptzHome(conn, params);
    }
  });

  conn.on("close", function (message) {});
  conn.on("error", function (error) {
    console.log(error);
  });
}

var devices = {};
function startDiscovery(conn) {
  devices = {};
  let names = {};
  onvif
    .startProbe()
    .then((device_list) => {
      device_list.forEach((device) => {
        let odevice = new onvif.OnvifDevice({
          xaddr: device.xaddrs[0],
        });
        let addr = odevice.address;
        devices[addr] = odevice;
        names[addr] = device.name;
      });
      var devs = {};
      for (var addr in devices) {
        devs[addr] = {
          name: names[addr],
          address: addr,
        };
      }
      let res = { id: "startDiscovery", result: devs };
      conn.send(JSON.stringify(res));
    })
    .catch((error) => {
      let res = { id: "connect", error: error.message };
      conn.send(JSON.stringify(res));
    });
  console.log("Found ONVIF devices:", devices);
}

function connect(conn, params) {
  // console.log("params:", params, "conn:", conn);

  var device = devices[params.address];
  console.log("device:", device);

  if (!device) {
    var res = {
      id: "connect",
      error: "The specified device is not found: " + params.address,
    };
    conn.send(JSON.stringify(res));
    return;
  }

  if (params.user) {
    device.setAuth(params.user, params.pass);
  }

  device.init((error, result) => {
    var res = { id: "connect" };
    if (error) {
      res["error"] = error.toString();
    } else {
      res["result"] = result;

      // Отримуємо RTSP URL з пристрою
      const rtspUrl = device.getUdpStreamUrl();
      console.log("RTSP URL:", rtspUrl);

      // Запускаємо Python-скрипт для трекінгу об'єктів
      // startPythonTracking(rtspUrl, params.user, params.pass);
    }

    console.log(JSON.stringify(res));
    console.log("JSON SEND");
    conn.send(JSON.stringify(res));
  });
}

// Функція для запуску Python-скрипта
function startPythonTracking(rtspUrl) {
  // Зупиняємо попередній процес, якщо він існує
  if (pythonProcess) {
    console.log("Stopping previous Python tracking process");
    pythonProcess.kill();
    pythonProcess = null;
  }

  // Формуємо повний RTSP URL з автентифікацією

  // Шлях до Python-скрипту
  const scriptPath = path.join(
    __dirname,
    "..",
    "yolo-rtsp-security-cam",
    "yolo-rtsp-security-cam.py"
  );
  console.log("path : " + scriptPath);
  const pythonScriptDir = path.join(__dirname, "..", "yolo-rtsp-security-cam");

  const yoloClasses = "person,dog,cat"; // Ти можеш змінювати це залежно від потреб
  const monitorFlag = "--monitor"; // Якщо потрібен моніторинг
  //python yolo-rtsp-security-cam.py --stream rtsp://admin:Sasha21012004@192.168.0.104:554/stream1 --yolo person,dog,cat --monitor

  console.log(`Starting Python tracking for ${rtspUrl}`);

  // Запускаємо Python-процес
  pythonProcess = spawn(
    "python",
    [
      // Або повний шлях до python.exe, якщо потрібно
      scriptPath,
      "--stream",
      rtspUrl,
      "--yolo",
      yoloClasses,
      monitorFlag,
    ],
    {
      cwd: pythonScriptDir, // Вказуємо робочу директорію для процесу Python
    }
  );
  console.log("python procces started");

  // Обробка вихідних даних
  pythonProcess.stdout.on("data", (data) => {
    console.log(`Python stdout: ${data}`);
  });

  pythonProcess.stderr.on("data", (data) => {
    console.error(`Python stderr: ${data}`);
  });

  pythonProcess.on("close", (code) => {
    console.log(`Python process exited with code ${code}`);
    pythonProcess = null;
  });

  process.on("exit", () => {
    if (pythonProcess) {
      pythonProcess.kill();
    }
  });
}

function ptzMove(conn, params) {
  console.log("Received PTZ Move params:", params);
  // console.log(devices);

  var device = devices[params.address];
  // console.log(device);

  if (!device) {
    var res = {
      id: "ptzMove",
      error: "The specified device is not found: " + params.address,
    };
    conn.send(JSON.stringify(res));
    console.log("Device not found: ", params.address);
    return;
  }

  device.ptzMove(params, (error) => {
    var res = { id: "ptzMove" };
    if (error) {
      res["error"] = error.toString();
    } else {
      res["result"] = "success";
    }
    conn.send(JSON.stringify(res));
  });
}

function ptzStop(conn, params) {
  var device = devices[params.address];
  if (!device) {
    var res = {
      id: "ptzStop",
      error: "The specified device is not found: " + params.address,
    };
    conn.send(JSON.stringify(res));
    return;
  }
  device.ptzStop((error) => {
    var res = { id: "ptzStop" };
    if (error) {
      res["error"] = error.toString();
    } else {
      res["result"] = true;
    }
    conn.send(JSON.stringify(res));
    console.log(JSON.stringify(res));
  });
}
