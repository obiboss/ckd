from datetime import datetime, timedelta
from typing import List, Optional, Literal, Union
import logging
import os
import sqlite3
import uuid

import jwt
from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, ConfigDict


# ------------------------------------------------------------
# Logging configuration
# ------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s - %(message)s",
)
logger = logging.getLogger("ckd-api")


# ------------------------------------------------------------
# Constants (demo only)
# ------------------------------------------------------------
DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
DB_PATH = os.path.join(DATA_DIR, "app.db")
JWT_SECRET = "ckd-demo-secret"  # demo only
JWT_ALG = "HS256"


def get_db() -> sqlite3.Connection:
    os.makedirs(DATA_DIR, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    conn = get_db()
    cur = conn.cursor()
    # Users table (demo: plain text password)
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS users (
            username TEXT PRIMARY KEY,
            password TEXT NOT NULL,
            role TEXT NOT NULL CHECK (role IN ('doctor','nurse'))
        )
        """
    )
    # Patients table
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS patients (
            patient_id TEXT PRIMARY KEY,
            full_name TEXT NOT NULL,
            age INTEGER NOT NULL,
            gender TEXT NOT NULL
        )
        """
    )
    # Predictions table
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS predictions (
            prediction_id INTEGER PRIMARY KEY AUTOINCREMENT,
            patient_id TEXT NOT NULL,
            risk_level TEXT NOT NULL,
            probability REAL NOT NULL,
            timestamp TEXT NOT NULL,
            FOREIGN KEY(patient_id) REFERENCES patients(patient_id)
        )
        """
    )
    # Seed demo users if empty
    cur.execute("SELECT COUNT(*) AS n FROM users")
    n = cur.fetchone()["n"]
    if n == 0:
        cur.executemany(
            "INSERT INTO users (username, password, role) VALUES (?, ?, ?)",
            [
                ("dr_smith", "password", "doctor"),
                ("nurse_ade", "password", "nurse"),
            ],
        )
        logger.info("Seeded demo users into SQLite database")
    conn.commit()
    conn.close()


# Initialize DB on import
init_db()


# ------------------------------------------------------------
# Pydantic Schemas
# ------------------------------------------------------------
Gender = Literal["Male", "Female", "Other"]


class Demographics(BaseModel):
    model_config = ConfigDict(extra="forbid")
    age: int = Field(ge=0, le=120)
    gender: Gender


class Comorbidities(BaseModel):
    model_config = ConfigDict(extra="forbid")
    diabetes_mellitus: bool
    hypertension: bool
    anemia: bool


# Backward-compatible legacy time-series structure (optional)
class LabVitalsPoint(BaseModel):
    model_config = ConfigDict(extra="forbid")
    timestamp: str
    creatinine: Optional[float] = None
    albumin: Optional[float] = None
    systolic_bp: Optional[float] = None
    heart_rate: Optional[float] = None


# New medical input groupings
class VitalsInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    systolic_bp: Optional[float] = None
    diastolic_bp: Optional[float] = None
    heart_rate: Optional[float] = None


class UrineInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    urine_protein_pct: Optional[float] = None
    urine_bacteria_pct: Optional[float] = None


class KFTInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    creatinine: Optional[float] = None
    urea: Optional[float] = None
    albumin: Optional[float] = None
    sodium: Optional[float] = None
    potassium: Optional[float] = None
    bicarbonate: Optional[float] = None


class PredictRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    patient_id: str
    demographics: Demographics
    comorbidities: Comorbidities
    # New grouping (preferred)
    vitals: Optional[Union[VitalsInput, List[VitalsInput]]] = None
    urine: Optional[Union[UrineInput, List[UrineInput]]] = None
    kft: Optional[Union[KFTInput, List[KFTInput]]] = None
    # Legacy (optional fallback)
    lab_vitals: Optional[List[LabVitalsPoint]] = None


class PredictResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")
    risk_level: str
    probability: float
    top_features: List[str]
    recommendations: List[str]


class LoginRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    username: str
    password: str


class LoginResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")
    token: str
    role: Literal["doctor", "nurse"]


class PatientCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    full_name: str
    age: int = Field(ge=0, le=120)
    gender: Gender


class PatientResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")
    patient_id: str
    full_name: str
    age: int
    gender: Gender


# ------------------------------------------------------------
# App initialization with CORS
# ------------------------------------------------------------
app = FastAPI(title="CKD Risk Prediction API", version="0.1.0")

origins = [
    "https://ckd-thesis.netlify.app",
    "http://127.0.0.1:8000",
    "http://localhost:5173",
    "http://localhost:5174",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)




# ------------------------------------------------------------
# In-memory storage (demo)
# ------------------------------------------------------------
PREDICTIONS_STORE: List[dict] = []


# ------------------------------------------------------------
# Helpers
# ------------------------------------------------------------
def _safe_mean(values: List[Optional[float]]) -> Optional[float]:
    present = [v for v in values if v is not None]
    if not present:
        return None
    return sum(present) / len(present)


def _normalize_latest(item, name: str):
    """
    Accepts either a Pydantic model instance or a list of model instances.
    - If list: returns the last element, or raises 422 if empty.
    - If single: returns as-is.
    - If None: returns None.
    """
    if item is None:
        return None
    if isinstance(item, list):
        if len(item) == 0:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=f"{name} array cannot be empty")
        return item[-1]
    return item


def _extract_feature_values(req: PredictRequest):
    # Prefer new inputs if provided, else fallback to legacy list
    if req.kft or req.vitals:
        kft_one = _normalize_latest(req.kft, "kft")
        vitals_one = _normalize_latest(req.vitals, "vitals")
        creatinine = kft_one.creatinine if kft_one else None
        albumin = kft_one.albumin if kft_one else None
        systolic_bp = vitals_one.systolic_bp if vitals_one else None
        heart_rate = vitals_one.heart_rate if vitals_one else None
        return creatinine, albumin, systolic_bp, heart_rate
    # Legacy fallback
    if req.lab_vitals:
        creatinine_values = [p.creatinine for p in req.lab_vitals]
        albumin_values = [p.albumin for p in req.lab_vitals]
        sbp_values = [p.systolic_bp for p in req.lab_vitals]
        hr_values = [p.heart_rate for p in req.lab_vitals]
        return _safe_mean(creatinine_values), _safe_mean(albumin_values), _safe_mean(sbp_values), _safe_mean(hr_values)
    return None, None, None, None


def _create_token(username: str, role: str) -> str:
    payload = {
        "sub": username,
        "role": role,
        "exp": datetime.utcnow() + timedelta(hours=24),
        "iat": datetime.utcnow(),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)


# ------------------------------------------------------------
# Simple dummy inference logic (unchanged core)
# ------------------------------------------------------------
def _risk_from_request(req: PredictRequest) -> PredictResponse:
    # Aggregate minimal features
    mean_creatinine, mean_albumin, mean_sbp, mean_hr = _extract_feature_values(req)

    # Heuristic scoring with per-feature contributions
    contributions = {}
    probability = 0.10  # base
    contributions["baseline"] = 0.10

    # Age contribution
    age = req.demographics.age
    age_contrib = max(0.0, min(0.20, ((age - 50) / 50.0) * 0.20)) if age is not None else 0.0
    if age_contrib > 0:
        contributions["age"] = age_contrib
        probability += age_contrib

    # Comorbidities
    if req.comorbidities.diabetes_mellitus:
        contributions["diabetes_mellitus"] = 0.20
        probability += 0.20
    if req.comorbidities.hypertension:
        contributions["hypertension"] = 0.20
        probability += 0.20
    if req.comorbidities.anemia:
        contributions["anemia"] = 0.10
        probability += 0.10

    # Creatinine
    if mean_creatinine is not None:
        # Scale above a nominal 1.2 mg/dL up to +0.30
        cr_over = max(0.0, mean_creatinine - 1.2)
        cr_contrib = max(0.0, min(0.30, (cr_over / 1.0) * 0.30))
        if cr_contrib > 0:
            contributions["creatinine"] = cr_contrib
            probability += cr_contrib

    # Albumin (low albumin increases risk)
    if mean_albumin is not None and mean_albumin < 3.5:
        alb_contrib = 0.10
        contributions["albumin_low"] = alb_contrib
        probability += alb_contrib

    # SBP
    if mean_sbp is not None:
        if mean_sbp > 160:
            sbp_contrib = 0.20
        elif mean_sbp > 140:
            sbp_contrib = 0.10
        else:
            sbp_contrib = 0.0
        if sbp_contrib > 0:
            contributions["systolic_bp"] = sbp_contrib
            probability += sbp_contrib

    # Heart rate (minor signal)
    if mean_hr is not None and (mean_hr > 100 or mean_hr < 55):
        hr_contrib = 0.05
        contributions["heart_rate"] = hr_contrib
        probability += hr_contrib

    # Clamp probability to [0, 0.99]
    probability = max(0.0, min(0.99, probability))

    # Risk level from probability
    if probability >= 0.70:
        risk_level = "High Risk"
    elif probability >= 0.40:
        risk_level = "Moderate Risk"
    else:
        risk_level = "Low Risk"

    # Top 3 features excluding baseline
    items = [(k, v) for k, v in contributions.items() if k != "baseline"]
    items.sort(key=lambda kv: kv[1], reverse=True)
    top_features = [k for k, _ in items[:3]] or ["creatinine", "age", "diabetes_mellitus"]
    # Normalize names
    name_map = {
        "albumin_low": "albumin",
        "systolic_bp": "systolic_bp",
        "heart_rate": "heart_rate",
        "diabetes_mellitus": "diabetes_mellitus",
        "hypertension": "hypertension",
        "anemia": "anemia",
        "age": "age",
        "creatinine": "creatinine",
    }
    top_features = [name_map.get(n, n) for n in top_features]

    # Recommendations (basic)
    recommendations: List[str] = []
    if "creatinine" in top_features:
        recommendations.append("Monitor creatinine levels")
    if "hypertension" in top_features or (mean_sbp is not None and mean_sbp > 140):
        recommendations.append("Check blood pressure daily")
    if risk_level == "High Risk":
        recommendations.append("Schedule nephrology consultation")
    if "diabetes_mellitus" in top_features:
        recommendations.append("Optimize glycemic control")
    if "albumin" in top_features:
        recommendations.append("Assess nutrition and albumin levels")
    if not recommendations:
        recommendations = [
            "Maintain healthy lifestyle",
            "Follow up with primary care",
            "Repeat labs in 3 months",
        ]
    # Ensure only top 3-4 recommendations, keep it simple
    recommendations = recommendations[:4]

    return PredictResponse(
        risk_level=risk_level,
        probability=round(probability, 2),
        top_features=top_features,
        recommendations=recommendations,
    )


# ------------------------------------------------------------
# Routes
# ------------------------------------------------------------
@app.get("/healthz")
def healthz():
    return {"status": "ok"}


@app.post("/api/v1/login", response_model=LoginResponse)
def login(payload: LoginRequest) -> LoginResponse:
    print("LOGIN ATTEMPT:", payload.username),
    print("RAW username:", repr(payload.username)),
    print("RAW password:", repr(payload.password))

    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT username, password, role FROM users WHERE username = ?", (payload.username,))
    row = cur.fetchone()
    conn.close()
    if not row or row["password"] != payload.password:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    token = _create_token(row["username"], row["role"])
    return LoginResponse(token=token, role=row["role"])  # role echoed for convenience


@app.get("/api/v1/patients", response_model=List[PatientResponse])
def list_patients() -> List[PatientResponse]:
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT patient_id, full_name, age, gender FROM patients ORDER BY full_name ASC")
    rows = cur.fetchall()
    conn.close()
    return [PatientResponse(**dict(r)) for r in rows]


@app.post("/api/v1/patients", response_model=PatientResponse, status_code=status.HTTP_201_CREATED)
def create_patient(payload: PatientCreateRequest) -> PatientResponse:
    pid = str(uuid.uuid4())
    conn = get_db()
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO patients (patient_id, full_name, age, gender) VALUES (?, ?, ?, ?)",
        (pid, payload.full_name, payload.age, payload.gender),
    )
    conn.commit()
    conn.close()
    return PatientResponse(patient_id=pid, full_name=payload.full_name, age=payload.age, gender=payload.gender)


@app.post("/api/v1/predict", response_model=PredictResponse)
def predict(payload: PredictRequest) -> PredictResponse:
    logger.info("Received prediction request")
    # Ensure patient exists
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT 1 FROM patients WHERE patient_id = ?", (payload.patient_id,))
    if not cur.fetchone():
        conn.close()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid patient_id")

    response = _risk_from_request(payload)

    # Store minimal audit trail in memory
    try:
        PREDICTIONS_STORE.append(
            {
                "timestamp": datetime.utcnow().isoformat() + "Z",
                "risk_level": response.risk_level,
                "probability": response.probability,
                "patient_id": payload.patient_id,
            }
        )
    except Exception as e:
        logger.warning(f"Failed to write to in-memory store: {e}")

    # Persist to SQLite
    try:
        cur.execute(
            "INSERT INTO predictions (patient_id, risk_level, probability, timestamp) VALUES (?, ?, ?, ?)",
            (payload.patient_id, response.risk_level, response.probability, datetime.utcnow().isoformat() + "Z"),
        )
        conn.commit()
    finally:
        conn.close()

    logger.info(
        "Responding with risk_level=%s probability=%.2f",
        response.risk_level,
        response.probability,
    )
    return response



