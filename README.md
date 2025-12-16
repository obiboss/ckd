# CKD Risk Prediction MVP (Thesis Demo)

Minimal demo web app for CKD risk prediction. Frontend (React + TypeScript + Tailwind) sends basic patient data to a FastAPI backend, which returns a risk level, probability, top features, and recommendations.

## Project Structure

- `main.py` — FastAPI app with `/api/v1/predict`
- `requirements.txt` — backend Python dependencies
- `frontend/` — Vite + React + TypeScript + Tailwind app

## Prerequisites

- Node.js 18+ and npm
- Python 3.10+

## Run Backend (FastAPI)

From the project root:

```bash
python -m venv .venv
.\.venv\Scripts\Activate.ps1   # On Windows PowerShell
pip install -r requirements.txt
uvicorn main:app --reload
```

The API will run at `http://127.0.0.1:8000`.

Health check:

```bash
curl http://127.0.0.1:8000/healthz
```

## Run Frontend (React + Vite)

Open a new terminal and start the frontend:

```bash
cd frontend
npm install
npm start
```

The app will run at `http://127.0.0.1:5173`. CORS is enabled for common local ports.

## API

POST `http://127.0.0.1:8000/api/v1/predict`

Request body:

```json
{
  "demographics": { "age": 68, "gender": "Male" },
  "comorbidities": { "diabetes_mellitus": true, "hypertension": true, "anemia": false },
  "lab_vitals": [
    {"timestamp": "2024-01-01T08:00:00Z", "creatinine": 1.4, "albumin": 3.2, "systolic_bp": 130, "heart_rate": 75},
    {"timestamp": "2024-01-01T16:00:00Z", "creatinine": 1.5, "albumin": 3.1, "systolic_bp": 128, "heart_rate": 78}
  ]
}
```

Response body shape:

```json
{
  "risk_level": "High Risk",
  "probability": 0.78,
  "top_features": ["creatinine", "age", "diabetes_mellitus"],
  "recommendations": [
    "Monitor creatinine levels",
    "Schedule nephrology consultation",
    "Check blood pressure daily"
  ]
}
```

Notes:
- The model is a simple heuristic (dummy) for demo purposes.
- In-memory storage keeps a minimal list of predictions (no persistence).

## Troubleshooting

- If the frontend cannot reach the backend, ensure FastAPI is running at `127.0.0.1:8000` and that CORS allows your frontend port (5173/3000).
- If using a different frontend port, add it to the `origins` list in `main.py`.


