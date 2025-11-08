# PDFTron WebViewer Setup

## Environment Variables

1. Create a `.env` file in the `frontend` directory (if it doesn't exist)
2. Add your PDFTron license key:

```
VITE_PDFTRON_LICENSE_KEY=your_actual_license_key_here
```

Replace `your_actual_license_key_here` with your actual PDFTron license key.

## WebViewer Files

The PDFTron WebViewer UI files are automatically copied to `public/webviewer/lib` when you run:
- `npm install` (via postinstall script)
- `npm run copy-webviewer` (manually)

## Usage

1. Start the development server: `npm run dev`
2. Navigate to `/pdftest` route
3. Enter a document ID in the text box
4. Click "Load Document" to view the PDF in PDFTron WebViewer

The component fetches documents from the FastAPI endpoint: `/view/document/{file_id}`

