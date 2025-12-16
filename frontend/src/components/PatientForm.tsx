import { useState } from "react";
import axios from "axios";

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

export interface LabVitalsPoint {
  timestamp: string;
  creatinine?: number;
  albumin?: number;
  systolic_bp?: number;
  heart_rate?: number;
}

export interface PredictionResponse {
  risk_level: string;
  probability: number; // 0..1
  top_features: string[];
  recommendations: string[];
}

interface Props {
  onResult: (result: PredictionResponse) => void;
  onLoading?: (loading: boolean) => void;
}

function nowIso(): string {
  return new Date().toISOString();
}

export default function PatientForm({ onResult, onLoading }: Props) {
  const [age, setAge] = useState<number | "">("");
  const [gender, setGender] = useState<Gender>("Male");
  const [comorbidities, setComorbidities] = useState<Comorbidities>({
    diabetes_mellitus: false,
    hypertension: false,
    anemia: false,
  });
  const [labVitals, setLabVitals] = useState<LabVitalsPoint[]>([
    { timestamp: nowIso(), creatinine: undefined, albumin: undefined, systolic_bp: undefined, heart_rate: undefined },
    { timestamp: nowIso(), creatinine: undefined, albumin: undefined, systolic_bp: undefined, heart_rate: undefined },
  ]);
  const [error, setError] = useState<string | null>(null);

  function updateComorbidity(key: keyof Comorbidities, value: boolean) {
    setComorbidities((prev) => ({ ...prev, [key]: value }));
  }

  function updateLabVitals(index: number, field: keyof LabVitalsPoint, value: string) {
    setLabVitals((prev) => {
      const next = [...prev];
      const current = { ...next[index] };
      if (field === "timestamp") {
        current.timestamp = value;
      } else {
        // parse to number or undefined
        const num = value === "" ? undefined : Number(value);
        current[field] = isNaN(num as number) ? undefined : (num as number);
      }
      next[index] = current;
      return next;
    });
  }

  function addTimePoint() {
    if (labVitals.length >= 3) return;
    setLabVitals((prev) => [...prev, { timestamp: nowIso() }]);
  }

  function removeTimePoint(index: number) {
    if (labVitals.length <= 1) return;
    setLabVitals((prev) => prev.filter((_, i) => i !== index));
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

      const payload = {
        demographics: {
          age: parsedAge,
          gender,
        },
        comorbidities,
        lab_vitals: labVitals.map((p) => ({
          timestamp: p.timestamp,
          creatinine: p.creatinine,
          albumin: p.albumin,
          systolic_bp: p.systolic_bp,
          heart_rate: p.heart_rate,
        })),
      };

      const res = await axios.post<PredictionResponse>(
        "http://127.0.0.1:8000/api/v1/predict",
        payload,
        { headers: { "Content-Type": "application/json" } }
      );
      onResult(res.data);
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? "Request failed. Ensure backend is running.");
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
            <label className="block text-sm font-medium text-gray-700">Age</label>
            <input
              type="number"
              min={0}
              max={120}
              value={age}
              onChange={(e) => setAge(e.target.value === "" ? "" : Number(e.target.value))}
              className="mt-1 w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              placeholder="e.g. 68"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Gender</label>
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
              onChange={(e) => updateComorbidity("diabetes_mellitus", e.target.checked)}
              className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            <span className="text-sm">Diabetes</span>
          </label>
          <label className="inline-flex items-center space-x-2">
            <input
              type="checkbox"
              checked={comorbidities.hypertension}
              onChange={(e) => updateComorbidity("hypertension", e.target.checked)}
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

      <div>
        <h2 className="text-lg font-semibold">Minimal Lab/Vitals Time Points</h2>
        <p className="text-sm text-gray-600">Provide 2–3 recent time points.</p>
        <div className="mt-3 space-y-4">
          {labVitals.map((row, idx) => (
            <div key={idx} className="rounded-md border border-gray-200 p-3">
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-gray-800">Time point {idx + 1}</h3>
                <button
                  type="button"
                  onClick={() => removeTimePoint(idx)}
                  className="text-xs text-red-600 hover:underline disabled:text-gray-400"
                  disabled={labVitals.length <= 1}
                >
                  Remove
                </button>
              </div>
              <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Timestamp (ISO)</label>
                  <input
                    type="text"
                    value={row.timestamp}
                    onChange={(e) => updateLabVitals(idx, "timestamp", e.target.value)}
                    className="mt-1 w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                    placeholder="2024-01-01T08:00:00Z"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Creatinine (mg/dL)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={row.creatinine ?? ""}
                    onChange={(e) => updateLabVitals(idx, "creatinine", e.target.value)}
                    className="mt-1 w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Albumin (g/dL)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={row.albumin ?? ""}
                    onChange={(e) => updateLabVitals(idx, "albumin", e.target.value)}
                    className="mt-1 w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Systolic BP (mmHg)</label>
                  <input
                    type="number"
                    step="1"
                    value={row.systolic_bp ?? ""}
                    onChange={(e) => updateLabVitals(idx, "systolic_bp", e.target.value)}
                    className="mt-1 w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Heart Rate (bpm)</label>
                  <input
                    type="number"
                    step="1"
                    value={row.heart_rate ?? ""}
                    onChange={(e) => updateLabVitals(idx, "heart_rate", e.target.value)}
                    className="mt-1 w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3">
          <button
            type="button"
            onClick={addTimePoint}
            disabled={labVitals.length >= 3}
            className="rounded-md bg-gray-100 px-3 py-2 text-sm font-medium text-gray-800 hover:bg-gray-200 disabled:opacity-50"
          >
            + Add time point
          </button>
        </div>
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


