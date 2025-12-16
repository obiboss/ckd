import { useState } from "react";
import PatientForm, { PredictionResponse } from "./components/PatientForm";
import PredictionResult from "./components/PredictionResult";

export default function App() {
  const [result, setResult] = useState<PredictionResponse | null>(null);
  const [loading, setLoading] = useState(false);

  return (
    <div className="min-h-screen">
      <header className="bg-white shadow-sm">
        <div className="mx-auto max-w-5xl px-4 py-4">
          <h1 className="text-2xl font-semibold">CKD Risk Prediction (MVP)</h1>
          <p className="text-sm text-gray-600">
            Demo for thesis: minimal inputs → risk, probability, features, and recommendations
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 grid gap-6 md:grid-cols-2">
        <section className="bg-white rounded-lg shadow p-4 md:p-6">
          <PatientForm
            onResult={(r) => setResult(r)}
            onLoading={(l) => setLoading(l)}
          />
        </section>

        <section className="bg-white rounded-lg shadow p-4 md:p-6">
          <PredictionResult result={result} loading={loading} />
        </section>
      </main>
    </div>
  );
}


