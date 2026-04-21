from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from routers import parse, analyze, generate

load_dotenv()

app = FastAPI(title="FlashResume API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",          # local dev (Next.js default)
        "http://127.0.0.1:3000",          # local dev (alternative)
        "https://your-app.vercel.app"     # production frontend (update later)
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

# Register routers
app.include_router(parse.router, prefix="/api")
app.include_router(analyze.router, prefix="/api")
app.include_router(generate.router, prefix="/api")

@app.get("/")
def root():
    return {"message": "FlashResume API is running", "version": "1.0.0"}

@app.get("/health")
def health():
    return {"status": "ok"}
