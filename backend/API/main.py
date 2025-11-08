import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from routes.upload import router as upload_router
from routes.view import router as view_router
from routes.parse import router as parse_router
from database import verify_connection, close_database

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager for startup and shutdown events."""
    # Startup
    logger.info("Application startup: Document Upload API is starting")
    
    try:
        verify_connection()
        logger.info("Startup complete: All systems ready")
    except Exception as e:
        logger.critical(f"Startup failed: MongoDB connection verification failed - {str(e)}")
        logger.critical("Application will continue but database operations may fail")
        # Don't raise - allow the app to start but log the error
        # In production, you might want to raise here to prevent startup
    
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

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with specific origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(upload_router)
app.include_router(view_router)
app.include_router(parse_router)


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

