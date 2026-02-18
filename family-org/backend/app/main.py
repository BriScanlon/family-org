from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional
import time
from .routers import auth, chores, rewards, dashboard, settings
from .database import init_db

app = FastAPI()

# Create tables on startup with retry logic
for i in range(5):
    try:
        init_db()
        break
    except Exception as e:
        print(f"Database not ready, retrying ({i+1}/5)... {e}")
        time.sleep(5)
else:
    print("Could not connect to database after 5 retries.")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5180", 
        "http://127.0.0.1:5180",
        "https://family.brian-scanlon.uk"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(chores.router)
app.include_router(rewards.router)
app.include_router(dashboard.router)
app.include_router(settings.router)

@app.get("/")
def read_root():
    return {"Hello": "World", "Phase": "1 - Family Organization"}

@app.get("/health")
def health_check():
    return {"status": "ok"}
