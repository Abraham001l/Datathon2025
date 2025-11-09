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

### Hosted/Production Setup

**Important**: When hosting the frontend on a public IP, you need to:

**Option 1: Set explicit frontend origin** (Recommended - Most Secure)
```bash
FRONTEND_ORIGIN=http://144.202.16.27:5173
```

**Option 2: Set multiple allowed origins** (for multiple frontends):
```bash
CORS_ALLOWED_ORIGINS=http://144.202.16.27:5173,https://yourdomain.com,https://www.yourdomain.com
```

**Option 3: Use permissive CORS** (Less Secure - For Development/Hosting Only)
This allows any origin from localhost, 127.0.0.1, or IP addresses:
```bash
USE_PERMISSIVE_CORS=true
```
⚠️ **Warning**: Only use this for development or when frontend/backend are on the same server!

**Make sure the backend is accessible via public IP**, not just localhost:
   - The frontend will auto-detect the API URL based on its own origin
   - Run the backend with `--host 0.0.0.0` (already in the command above) so it accepts connections from any interface

### Production
For production, set the `CORS_ALLOWED_ORIGINS` environment variable with comma-separated origins:

```bash
# Example .env file
CORS_ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
```

The API will only accept requests from the specified origins, making it secure against unauthorized cross-origin requests.