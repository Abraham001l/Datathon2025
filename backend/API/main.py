import logging
import asyncio
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from routes.view import router as view_router
from routes.parse import router as parse_router
from routes.top_agent import router as top_agent_router
from services.database import verify_connection, close_database
from dotenv import load_dotenv

load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)


async def verify_connection_async():
    """Verify MongoDB connection in background without blocking."""
    try:
        # Run the blocking verify_connection in a thread pool (non-blocking)
        loop = asyncio.get_running_loop()
        await loop.run_in_executor(None, verify_connection)
        logger.info("Background MongoDB connection verification: Success")
    except Exception as e:
        logger.warning(f"Background MongoDB connection verification failed: {str(e)}")
        logger.warning("Database operations will attempt connection on first use")

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager for startup and shutdown events."""
    # Startup
    logger.info("Application startup: Document Upload API is starting")
    
    # Start MongoDB verification in background (non-blocking)
    asyncio.create_task(verify_connection_async())
    logger.info("Startup complete: API ready (MongoDB connection verifying in background)")
    
    yield
    
    # Shutdown
    logger.info("Application shutdown: Document Upload API is shutting down")
    close_database()
    logger.info("Database connections closed")


app = FastAPI(
    title="Document Upload API",
    description="API for uploading and managing documents",
    version="1.0.0",
    lifespan=lifespan
)

# Configure CORS - secure by default
# Get allowed origins from environment variable, with safe defaults for development
ALLOWED_ORIGINS_ENV = os.getenv("CORS_ALLOWED_ORIGINS", "")

if ALLOWED_ORIGINS_ENV:
    # Parse comma-separated origins from environment variable
    allowed_origins = [origin.strip() for origin in ALLOWED_ORIGINS_ENV.split(",") if origin.strip()]
else:
    # Default to common development origins (safe for local development)
    allowed_origins = [
        "http://localhost:5173",  # Vite default port
        "http://localhost:3000",  # React default port
        "http://localhost:5174",  # Vite alternate port
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5174",
    ]
    
    # Also check for frontend origin from environment (useful for hosted deployments)
    FRONTEND_ORIGIN = os.getenv("FRONTEND_ORIGIN", "")
    if FRONTEND_ORIGIN:
        frontend_origin = FRONTEND_ORIGIN.strip()
        if frontend_origin and frontend_origin not in allowed_origins:
            allowed_origins.append(frontend_origin)
            logger.info(f"Added frontend origin from environment: {frontend_origin}")

logger.info(f"CORS configured with allowed origins: {allowed_origins}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,  # Specific origins only - secure!
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],  # Explicit methods
    allow_headers=["*"],  # Allow all headers (can be restricted further if needed)
    expose_headers=["*"],  # Expose all headers in response
)

# Include routers
app.include_router(view_router)
app.include_router(parse_router)
app.include_router(top_agent_router)


@app.middleware("http")
async def log_requests(request: Request, call_next):
    """Middleware to log all requests."""
    logger.info(f"Request: {request.method} {request.url.path} - Client: {request.client.host if request.client else 'unknown'}")
    response = await call_next(request)
    logger.info(f"Response: {request.method} {request.url.path} - Status: {response.status_code}")
    return response


@app.get("/")
async def root():
    """Root endpoint."""
    logger.info("Root endpoint accessed")
    return {"message": "Document Upload API", "version": "1.0.0"}


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    logger.info("Health check endpoint accessed")
    return {"status": "healthy"}

