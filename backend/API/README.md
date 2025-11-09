## Setup

```bash
uv sync
uv run uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

## CORS Configuration

The API is configured with secure CORS settings by default. 

### Development
By default, the API allows requests from common development origins:
- `http://localhost:5173` (Vite default)
- `http://localhost:3000` (React default)
- `http://localhost:5174` (Vite alternate)
- `http://127.0.0.1:5173`
- `http://127.0.0.1:3000`
- `http://127.0.0.1:5174`

### Production
For production, set the `CORS_ALLOWED_ORIGINS` environment variable with comma-separated origins:

```bash
# Example .env file
CORS_ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
```

The API will only accept requests from the specified origins, making it secure against unauthorized cross-origin requests.