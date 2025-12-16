from datetime import datetime
from typing import List, Optional, Literal
import logging

from fastapi import FastAPI
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


class LabVitalsPoint(BaseModel):
    model_config = ConfigDict(extra="forbid")
    timestamp: str
    creatinine: Optional[float] = None
    albumin: Optional[float] = None
    systolic_bp: Optional[float] = None
    heart_rate: Optional[float] = None


class PredictRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    demographics: Demographics
    comorbidities: Comorbidities
    lab_vitals: List[LabVitalsPoint]


class PredictResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")
    risk_level: str
    probability: float
    top_features: List[str]
    recommendations: List[str]


# ------------------------------------------------------------
# App initialization with CORS
# ------------------------------------------------------------
app = FastAPI(title="CKD Risk Prediction API", version="0.1.0")

origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
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
# Simple dummy inference logic
# ------------------------------------------------------------
def _safe_mean(values: List[Optional[float]]) -> Optional[float]:
    present = [v for v in values if v is not None]
    if not present:
        return None
    return sum(present) / len(present)


def _risk_from_request(req: PredictRequest) -> PredictResponse:
    # Aggregate minimal time-series features
    creatinine_values = [p.creatinine for p in req.lab_vitals]
    albumin_values = [p.albumin for p in req.lab_vitals]
    sbp_values = [p.systolic_bp for p in req.lab_vitals]
    hr_values = [p.heart_rate for p in req.lab_vitals]

    mean_creatinine = _safe_mean(creatinine_values)
    mean_albumin = _safe_mean(albumin_values)
    mean_sbp = _safe_mean(sbp_values)
    mean_hr = _safe_mean(hr_values)

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


@app.post("/api/v1/predict", response_model=PredictResponse)
def predict(payload: PredictRequest) -> PredictResponse:
    logger.info("Received prediction request")
    response = _risk_from_request(payload)

    # Store minimal audit trail in memory
    try:
        PREDICTIONS_STORE.append(
            {
                "timestamp": datetime.utcnow().isoformat() + "Z",
                "risk_level": response.risk_level,
                "probability": response.probability,
            }
        )
    except Exception as e:
        logger.warning(f"Failed to write to in-memory store: {e}")

    logger.info(
        "Responding with risk_level=%s probability=%.2f",
        response.risk_level,
        response.probability,
    )
    return response


