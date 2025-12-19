import { useEffect, useState } from "react";
import axios from "axios";
import type { Patient } from "./PatientSelector";

export type Gender = "Male" | "Female" | "Other";

export interface Demographics {
  age: number;
  gender: Gender;
}

export interface Comorbidities {
  diabetes_mellitus: boolean;
  hypertension: boolean;
  anemia: boolean;
}

export interface PredictionResponse {
  risk_level: string;
  probability: number; // 0..1
  top_features: string[];
  recommendations: string[];
}

export interface ReportInputs {
  vitals: {
    systolic_bp?: number;
    diastolic_bp?: number;
    heart_rate?: number;
  };
  urine: {
    urine_protein_pct?: number;
    urine_bacteria_pct?: number;
  };
  kft: {
    creatinine?: number;
    urea?: number;
    albumin?: number;
    sodium?: number;
    potassium?: number;
    bicarbonate?: number;
  };
  // series arrays to align with multi time-point support (keeps compatibility for existing consumers)
  vitals_series: Array<{
    systolic_bp?: number;
    diastolic_bp?: number;
    heart_rate?: number;
  }>;
  urine_series: Array<{
    urine_protein_pct?: number;
    urine_bacteria_pct?: number;
  }>;
  kft_series: Array<{
    creatinine?: number;
    urea?: number;
    albumin?: number;
    sodium?: number;
    potassium?: number;
    bicarbonate?: number;
  }>;
}

interface Props {
  patient: Patient;
  onResult: (result: PredictionResponse, report: ReportInputs) => void;
  onLoading?: (loading: boolean) => void;
}

export default function PatientForm({ patient, onResult, onLoading }: Props) {
  const [age, setAge] = useState<number | "">("");
  const [gender, setGender] = useState<Gender>("Male");
  const [comorbidities, setComorbidities] = useState<Comorbidities>({
    diabetes_mellitus: false,
    hypertension: false,
    anemia: false,
  });

  // Combined clinical readings (one time-point contains vitals, urine, kft)
  const [readings, setReadings] = useState<
    Array<{
      vitals: {
        systolic_bp?: number | "";
        diastolic_bp?: number | "";
        heart_rate?: number | "";
      };
      urine: {
        urine_protein_pct?: number | "";
        urine_bacteria_pct?: number | "";
      };
      kft: {
        creatinine?: number | "";
        urea?: number | "";
        albumin?: number | "";
        sodium?: number | "";
        potassium?: number | "";
        bicarbonate?: number | "";
      };
    }>
  >([
    {
      vitals: {},
      urine: {},
      kft: {},
    },
  ]);

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Prefill demographics from selected patient
    setAge(patient.age);
    setGender(patient.gender);
  }, [patient]);

  function updateComorbidity(key: keyof Comorbidities, value: boolean) {
    setComorbidities((prev) => ({ ...prev, [key]: value }));
  }

  function parseNum(v: number | "" | null | undefined): number | undefined {
    if (v === "" || v === null || v === undefined) return undefined;
    const n = Number(v);
    return isNaN(n) ? undefined : n;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    onLoading?.(true);
    try {
      const parsedAge = typeof age === "string" ? Number(age) : age;
      if (parsedAge === null || parsedAge === undefined || isNaN(parsedAge)) {
        setError("Age is required.");
        return;
      }
      if (parsedAge < 0 || parsedAge > 120) {
        setError("Age must be between 0 and 120.");
        return;
      }

      const vitalsSeries = readings.map((r) => ({
        systolic_bp: parseNum(r.vitals.systolic_bp ?? ""),
        diastolic_bp: parseNum(r.vitals.diastolic_bp ?? ""),
        heart_rate: parseNum(r.vitals.heart_rate ?? ""),
      }));
      const urineSeries = readings.map((r) => ({
        urine_protein_pct: parseNum(r.urine.urine_protein_pct ?? ""),
        urine_bacteria_pct: parseNum(r.urine.urine_bacteria_pct ?? ""),
      }));
      const kftSeries = readings.map((r) => ({
        creatinine: parseNum(r.kft.creatinine ?? ""),
        urea: parseNum(r.kft.urea ?? ""),
        albumin: parseNum(r.kft.albumin ?? ""),
        sodium: parseNum(r.kft.sodium ?? ""),
        potassium: parseNum(r.kft.potassium ?? ""),
        bicarbonate: parseNum(r.kft.bicarbonate ?? ""),
      }));

      const firstVitals = vitalsSeries[0] ?? {};
      const firstUrine = urineSeries[0] ?? {};
      const firstKft = kftSeries[0] ?? {};

      const reportInputs: ReportInputs = {
        vitals: {
          systolic_bp: firstVitals.systolic_bp,
          diastolic_bp: firstVitals.diastolic_bp,
          heart_rate: firstVitals.heart_rate,
        },
        urine: {
          urine_protein_pct: firstUrine.urine_protein_pct,
          urine_bacteria_pct: firstUrine.urine_bacteria_pct,
        },
        kft: {
          creatinine: firstKft.creatinine,
          urea: firstKft.urea,
          albumin: firstKft.albumin,
          sodium: firstKft.sodium,
          potassium: firstKft.potassium,
          bicarbonate: firstKft.bicarbonate,
        },
        vitals_series: vitalsSeries,
        urine_series: urineSeries,
        kft_series: kftSeries,
      };

      const payload = {
        patient_id: patient.patient_id,
        demographics: { age: parsedAge, gender },
        comorbidities,
        // send arrays for time points
        vitals: vitalsSeries,
        urine: urineSeries,
        kft: kftSeries,
      };

      const API_URL = import.meta.env.VITE_API_URL;
      const token = localStorage.getItem("ckd_token");

      const res = await axios.post<PredictionResponse>(
        `${API_URL}/api/v1/predict`,
        payload,
        {
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        }
      );

      onResult(res.data, reportInputs);
    } catch (err: any) {
      const detail = err?.response?.data?.detail;

      if (Array.isArray(detail)) {
        setError(detail.map((d) => d.msg).join(", "));
      } else if (typeof detail === "string") {
        setError(detail);
      } else {
        setError("Request failed. Please check the input values.");
      }
    } finally {
      onLoading?.(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Demographics & Comorbidities</h2>
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Age
            </label>
            <input
              type="number"
              min={0}
              max={120}
              value={age}
              onChange={(e) =>
                setAge(e.target.value === "" ? "" : Number(e.target.value))
              }
              className="mt-1 w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              placeholder="e.g. 68"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Gender
            </label>
            <select
              value={gender}
              onChange={(e) => setGender(e.target.value as Gender)}
              className="mt-1 w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            >
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
            </select>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <label className="inline-flex items-center space-x-2">
            <input
              type="checkbox"
              checked={comorbidities.diabetes_mellitus}
              onChange={(e) =>
                updateComorbidity("diabetes_mellitus", e.target.checked)
              }
              className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            <span className="text-sm">Diabetes</span>
          </label>
          <label className="inline-flex items-center space-x-2">
            <input
              type="checkbox"
              checked={comorbidities.hypertension}
              onChange={(e) =>
                updateComorbidity("hypertension", e.target.checked)
              }
              className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            <span className="text-sm">Hypertension</span>
          </label>
          <label className="inline-flex items-center space-x-2">
            <input
              type="checkbox"
              checked={comorbidities.anemia}
              onChange={(e) => updateComorbidity("anemia", e.target.checked)}
              className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            <span className="text-sm">Anemia</span>
          </label>
        </div>
      </div>

      {readings.map((r, idx) => (
        <div key={idx} className="space-y-4">
          <h3 className="text-md font-semibold">Reading {idx + 1}</h3>

          <div>
            <h2 className="text-lg font-semibold">
              VITAL SIGNS (BLOOD PRESSURE RESULTS)
            </h2>
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Systolic Blood Pressure (mmHg)
                </label>
                <input
                  type="number"
                  step="1"
                  value={r.vitals.systolic_bp ?? ""}
                  onChange={(e) => {
                    const next = [...readings];
                    next[idx] = {
                      ...next[idx],
                      vitals: {
                        ...next[idx].vitals,
                        systolic_bp:
                          e.target.value === "" ? "" : Number(e.target.value),
                      },
                    };
                    setReadings(next);
                  }}
                  className="mt-1 w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Diastolic Blood Pressure (mmHg)
                </label>
                <input
                  type="number"
                  step="1"
                  value={r.vitals.diastolic_bp ?? ""}
                  onChange={(e) => {
                    const next = [...readings];
                    next[idx] = {
                      ...next[idx],
                      vitals: {
                        ...next[idx].vitals,
                        diastolic_bp:
                          e.target.value === "" ? "" : Number(e.target.value),
                      },
                    };
                    setReadings(next);
                  }}
                  className="mt-1 w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Heart Rate (beats/min)
                </label>
                <input
                  type="number"
                  step="1"
                  value={r.vitals.heart_rate ?? ""}
                  onChange={(e) => {
                    const next = [...readings];
                    next[idx] = {
                      ...next[idx],
                      vitals: {
                        ...next[idx].vitals,
                        heart_rate:
                          e.target.value === "" ? "" : Number(e.target.value),
                      },
                    };
                    setReadings(next);
                  }}
                  className="mt-1 w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                />
              </div>
            </div>
          </div>

          <div>
            <h2 className="text-lg font-semibold">
              URINE ANALYSIS (NUMERIC APPROXIMATION)
            </h2>
            <p className="text-xs text-gray-600">
              Numeric approximation used for academic demonstration purposes.
            </p>
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Urine Protein (%)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={r.urine.urine_protein_pct ?? ""}
                  onChange={(e) => {
                    const next = [...readings];
                    next[idx] = {
                      ...next[idx],
                      urine: {
                        ...next[idx].urine,
                        urine_protein_pct:
                          e.target.value === "" ? "" : Number(e.target.value),
                      },
                    };
                    setReadings(next);
                  }}
                  className="mt-1 w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Urine Bacteria (%)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={r.urine.urine_bacteria_pct ?? ""}
                  onChange={(e) => {
                    const next = [...readings];
                    next[idx] = {
                      ...next[idx],
                      urine: {
                        ...next[idx].urine,
                        urine_bacteria_pct:
                          e.target.value === "" ? "" : Number(e.target.value),
                      },
                    };
                    setReadings(next);
                  }}
                  className="mt-1 w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                />
              </div>
            </div>
          </div>

          <div>
            <h2 className="text-lg font-semibold">
              KIDNEY FUNCTION TEST (KFT) — BLOOD TEST
            </h2>
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <ArrayNumberField
                label="Creatinine (mg/dL)"
                value={r.kft.creatinine ?? ""}
                onChange={(val) => {
                  const next = [...readings];
                  next[idx] = {
                    ...next[idx],
                    kft: { ...next[idx].kft, creatinine: val },
                  };
                  setReadings(next);
                }}
                step="0.01"
              />
              <ArrayNumberField
                label="Urea (mg/dL)"
                value={r.kft.urea ?? ""}
                onChange={(val) => {
                  const next = [...readings];
                  next[idx] = {
                    ...next[idx],
                    kft: { ...next[idx].kft, urea: val },
                  };
                  setReadings(next);
                }}
                step="0.1"
              />
              <ArrayNumberField
                label="Albumin (g/dL)"
                value={r.kft.albumin ?? ""}
                onChange={(val) => {
                  const next = [...readings];
                  next[idx] = {
                    ...next[idx],
                    kft: { ...next[idx].kft, albumin: val },
                  };
                  setReadings(next);
                }}
                step="0.01"
              />
              <ArrayNumberField
                label="Sodium (mmol/L)"
                value={r.kft.sodium ?? ""}
                onChange={(val) => {
                  const next = [...readings];
                  next[idx] = {
                    ...next[idx],
                    kft: { ...next[idx].kft, sodium: val },
                  };
                  setReadings(next);
                }}
                step="0.1"
              />
              <ArrayNumberField
                label="Potassium (mmol/L)"
                value={r.kft.potassium ?? ""}
                onChange={(val) => {
                  const next = [...readings];
                  next[idx] = {
                    ...next[idx],
                    kft: { ...next[idx].kft, potassium: val },
                  };
                  setReadings(next);
                }}
                step="0.1"
              />
              <ArrayNumberField
                label="Bicarbonate (mEq/L)"
                value={r.kft.bicarbonate ?? ""}
                onChange={(val) => {
                  const next = [...readings];
                  next[idx] = {
                    ...next[idx],
                    kft: { ...next[idx].kft, bicarbonate: val },
                  };
                  setReadings(next);
                }}
                step="0.1"
              />
            </div>
          </div>
        </div>
      ))}

      <div className="pt-2">
        <button
          type="button"
          className="rounded-md bg-gray-100 px-3 py-2 text-sm font-medium text-gray-800 hover:bg-gray-200"
          onClick={() =>
            setReadings((prev) => [...prev, { vitals: {}, urine: {}, kft: {} }])
          }
        >
          + Add another reading
        </button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="pt-2">
        <button
          type="submit"
          className="inline-flex items-center rounded-md bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          Submit for Prediction
        </button>
      </div>
    </form>
  );
}

function NumberField({
  label,
  value,
  setValue,
  step,
}: {
  label: string;
  value: number | "";
  setValue: (v: number | "") => void;
  step?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700">{label}</label>
      <input
        type="number"
        step={step ?? "1"}
        value={value}
        onChange={(e) =>
          setValue(e.target.value === "" ? "" : Number(e.target.value))
        }
        className="mt-1 w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
      />
    </div>
  );
}

function ArrayNumberField({
  label,
  value,
  onChange,
  step,
}: {
  label: string;
  value: number | "";
  onChange: (v: number | "") => void;
  step?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700">{label}</label>
      <input
        type="number"
        step={step ?? "1"}
        value={value}
        onChange={(e) =>
          onChange(e.target.value === "" ? "" : Number(e.target.value))
        }
        className="mt-1 w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
      />
    </div>
  );
}
