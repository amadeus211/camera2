# tracking.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
import cv2
import uvicorn
import numpy as np
import time
import threading
import queue
import sys
import os

# Перевірка аргументів командного рядка
if len(sys.argv) < 2:
    print("Використання: python tracking.py <rtsp_url>")
    sys.exit(1)

rtsp_url = sys.argv[1]
print(f"Отримано RTSP URL: {rtsp_url}")

app = FastAPI()

# Додати CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Глобальний фрейм-буфер для відеопотоку
frame_buffer = queue.Queue(maxsize=10)
last_frame = None
stop_capture = False

# Функція для захоплення кадрів у окремому потоці
def capture_frames():
    global last_frame, stop_capture
    
    # Додаткові параметри для OpenCV
    os.environ["OPENCV_FFMPEG_CAPTURE_OPTIONS"] = "rtsp_transport;tcp|reorder_queue_size;0|buffer_size;1024000|max_delay;500000"
    
    # Спроба встановити з'єднання
    print(f"Підключення до RTSP потоку: {rtsp_url}")
    cap = cv2.VideoCapture(rtsp_url, cv2.CAP_FFMPEG)
    
    # Налаштування буферів і таймаутів
    cap.set(cv2.CAP_PROP_BUFFERSIZE, 3)
    
    # Параметри для зниження розширення
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
    
    # Якщо з'єднання невдале, спробуємо додати tcp явно
    if not cap.isOpened():
        tcp_url = rtsp_url
        if "?" not in tcp_url:
            tcp_url += "?tcp"
        print(f"Повторне підключення з TCP: {tcp_url}")
        cap = cv2.VideoCapture(tcp_url, cv2.CAP_FFMPEG)
    
    if not cap.isOpened():
        print(f"Помилка: Не вдалося відкрити RTSP потік: {rtsp_url}")
        return
    
    print("З'єднання з камерою встановлено")
    
    # Завантаження класифікатора для виявлення облич
    try:
        face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
        if face_cascade.empty():
            print("Помилка: Не вдалося завантажити каскад для детекції облич")
            face_cascade = None
    except Exception as e:
        print(f"Помилка завантаження каскаду: {e}")
        face_cascade = None
    
    # Ініціалізація трекера
    tracker = cv2.TrackerKCF_create() if hasattr(cv2, 'TrackerKCF_create') else None
    if tracker is None:
        print("Увага: Трекер KCF недоступний, використовуємо тільки детекцію облич")
    
    tracking_initialized = False
    frame_count = 0
    detection_interval = 30  # Виявляти обличчя кожні 30 кадрів
    
    while not stop_capture:
        try:
            # Читання кадру
            ret, frame = cap.read()
            
            if not ret:
                print("Не вдалося отримати кадр. Повторне підключення...")
                time.sleep(1)
                cap.release()
                cap = cv2.VideoCapture(rtsp_url, cv2.CAP_FFMPEG)
                continue
            
            # Зменшення розміру для покращення продуктивності
            frame = cv2.resize(frame, (640, 480))
            
            # Зберігаємо копію кадру
            processed_frame = frame.copy()
            
            # Виявлення облич кожні N кадрів або якщо трекінг не ініціалізований
            if face_cascade is not None and (frame_count % detection_interval == 0 or not tracking_initialized):
                # Конвертація в сірий колір для виявлення облич
                gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
                
                # Виявлення облич
                faces = face_cascade.detectMultiScale(gray, 1.3, 5)
                
                if len(faces) > 0:
                    # Беремо лише найбільше обличчя
                    max_area = 0
                    max_face = None
                    for (x, y, w, h) in faces:
                        if w * h > max_area:
                            max_area = w * h
                            max_face = (x, y, w, h)
                    
                    if max_face and tracker is not None:
                        x, y, w, h = max_face
                        # Створюємо новий трекер і ініціалізуємо його
                        tracker = cv2.TrackerKCF_create()
                        tracker.init(frame, (x, y, w, h))
                        tracking_initialized = True
                    elif max_face:
                        # Якщо трекер недоступний, просто малюємо рамку
                        x, y, w, h = max_face
                        cv2.rectangle(processed_frame, (x, y), (x + w, y + h), (0, 255, 0), 2)
            
            # Оновлення трекера, якщо він ініціалізований
            if tracker is not None and tracking_initialized:
                success, bbox = tracker.update(frame)
                if success:
                    # Малюємо рамку навколо обличчя
                    x, y, w, h = [int(v) for v in bbox]
                    cv2.rectangle(processed_frame, (x, y), (x + w, y + h), (0, 255, 0), 2)
                else:
                    # Якщо трекінг втрачено, скидаємо ініціалізацію
                    tracking_initialized = False
            
            # Додаємо інформаційний текст
        
            
            # Додаємо кадр у буфер, видаляючи старі кадри, якщо буфер заповнений
            if frame_buffer.full():
                try:
                    frame_buffer.get_nowait()
                except queue.Empty:
                    pass
            
            frame_buffer.put(processed_frame)
            last_frame = processed_frame  # Зберігаємо останній кадр
            
            frame_count += 1
            
        except Exception as e:
            print(f"Помилка в циклі захоплення: {e}")
            time.sleep(0.1)
    
    cap.release()
    print("Захоплення відео зупинено")

# Функція для генерації MJPEG потоку
def generate_frames():
    global last_frame
    
    while True:
        # Спробуємо отримати кадр з буфера
        try:
            frame = frame_buffer.get(timeout=0.5)
        except queue.Empty:
            # Якщо буфер порожній, але у нас є останній кадр
            if last_frame is not None:
                frame = last_frame
            else:
                # Створюємо порожній кадр з повідомленням
                frame = np.zeros((480, 640, 3), dtype=np.uint8)
                cv2.putText(frame, "Очікування відео...", (50, 240), 
                          cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 255, 255), 2)
        
        # Кодування в JPEG
        ret, buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 80])
        frame_bytes = buffer.tobytes()
        
        yield (b'--frame\r\n'
               b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')
        
        # Невелика затримка для контролю частоти кадрів
        time.sleep(0.03)  # ~30 fps

@app.get("/video_feed")
async def video_feed():
    return StreamingResponse(
        generate_frames(),
        media_type="multipart/x-mixed-replace; boundary=frame"
    )

@app.get("/")
def read_root():
    return {"message": "Video tracking server is running"}

# Запуск потоку захоплення відео при старті програми
@app.on_event("startup")
def startup_event():
    global stop_capture
    stop_capture = False
    capture_thread = threading.Thread(target=capture_frames, daemon=True)
    capture_thread.start()

@app.on_event("shutdown")
def shutdown_event():
    global stop_capture
    stop_capture = True

if __name__ == "__main__":
    # Запускаємо FastAPI на порту 3004
    uvicorn.run(app, host="0.0.0.0", port=3004)