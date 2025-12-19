## CKD Risk Prediction MVP — Step-by-Step Usage Guide

This guide walks you from first run to generating a CKD risk prediction.

### 1) Prerequisites
- Node.js 18+ and npm
- Python 3.10+
- Windows PowerShell (commands below are Windows-friendly)

### 2) Backend Setup (FastAPI)
1. Open a terminal in the project root.
2. Create and activate a virtual environment, then install dependencies:

```powershell
cd C:\Users\HP\Documents\ik-project-work\ckd
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

3. Start the API:
```powershell
uvicorn main:app --reload
```

What happens on first run:
- A SQLite database is created at `data\app.db`.
- Demo users are seeded:
  - Username: `dr_smith`, Password: `password`, Role: `doctor`
  - Username: `nurse_ade`, Password: `password`, Role: `nurse`

Health check:
```powershell
curl http://127.0.0.1:8000/healthz
```

### 3) Frontend Setup (React + Vite + Tailwind)
1. In a new terminal, create a frontend environment file and install dependencies:

```powershell
cd C:\Users\HP\Documents\ik-project-work\ckd\frontend
echo VITE_API_URL=http://127.0.0.1:8000 > .env
npm install
npm start
```

2. Open the app at `http://127.0.0.1:5173`.

Note about CORS: The backend currently allows `https://ckd-thesis.netlify.app`. For local development from `http://127.0.0.1:5173`, you may need to add your local origin to the `origins` list in `main.py` (CORS section) or run your frontend from the allowed origin.

### 4) Login (Doctors & Nurses)
1. On the login screen, use a demo account:
   - `dr_smith` / `password` (doctor)
   - `nurse_ade` / `password` (nurse)
2. On success, a JWT is stored in localStorage and you are taken to the main page.
3. You can log out via the header “Logout” button.

### 5) Patient Management (Required before prediction)
1. Select an existing patient or create a new one:
   - Click “Create patient”
   - Enter Full name, Age (0–120), Gender (Male/Female/Other)
   - Submit to create; then click “Select” on that patient
2. Once selected, the patient’s age and gender will prefill the form.

### 6) Enter Medical Inputs (Use standard sections and units)
Fill each section with available values (you can leave unknown fields empty):

- VITAL SIGNS (BLOOD PRESSURE RESULTS)
  - Systolic Blood Pressure (mmHg)
  - Diastolic Blood Pressure (mmHg)
  - Heart Rate (beats/min)

- URINE ANALYSIS (NUMERIC APPROXIMATION)
  - Urine Protein (%)
  - Urine Bacteria (%)
  - Note: Numeric approximation used for academic demonstration purposes.

- KIDNEY FUNCTION TEST (KFT) — BLOOD TEST
  - Creatinine (mg/dL)
  - Urea (mg/dL)
  - Albumin (g/dL)
  - Sodium (mmol/L)
  - Potassium (mmol/L)
  - Bicarbonate (mEq/L)

Optional comorbidities:
- Diabetes, Hypertension, Anemia (checkboxes)

Validation:
- Age must be between 0 and 120.

### 7) Submit for Prediction
1. Click “Submit for Prediction”.
2. The app calls `POST /api/v1/predict` with the `patient_id` and entered inputs.
3. The backend returns:
   - Risk Level (High/Moderate/Low)
   - Probability (0–1)
   - Top features
   - Recommendations
4. The prediction is stored in the database and linked to the selected patient.

### 8) View Results (Medical Report Style)
- A lab-style table is shown with TEST NAME, RESULT, UNIT, and REFERENCE RANGE.
- A concise clinical-style comment is displayed below the table.
- The patient’s name is shown above the results.

### 9) Model/Dataset Background
- Click “About” in the header to see a short modal describing:
  - The rule-based/heuristic logic used (demo)
  - Medical features included
  - Academic demonstration disclaimer

### 10) Troubleshooting
- CORS errors when calling the API from `http://127.0.0.1:5173`:
  - Add your local origin to the `origins` array in `main.py` (CORS middleware), or run the frontend from an allowed origin.
- “Login failed”:
  - Ensure backend is running at `http://127.0.0.1:8000` and `VITE_API_URL` is set correctly in `frontend/.env`.
- Resetting the database:
  - Stop the backend, delete `data\app.db`, and restart the backend to recreate and reseed demo users.

### 11) Sample Values to Try
- Patient:
  - Full name: John Doe
  - Age: 68, Gender: Male
- Vitals:
  - SBP: 130 mmHg, DBP: 85 mmHg, HR: 76 beats/min
- Urine (approx.):
  - Protein: 0.5 %, Bacteria: 0.2 %
- KFT:
  - Creatinine: 1.4 mg/dL, Urea: 38 mg/dL, Albumin: 3.4 g/dL
  - Sodium: 139 mmol/L, Potassium: 4.5 mmol/L, Bicarbonate: 24 mEq/L

### 12) Credentials (Demo)
- Doctor: `dr_smith` / `password`
- Nurse: `nurse_ade` / `password`


