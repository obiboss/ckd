import { useEffect, useState } from "react";
import PatientForm, { PredictionResponse, ReportInputs } from "./components/PatientForm";
import PredictionResult from "./components/PredictionResult";
import Login from "./components/Login";
import PatientSelector, { Patient } from "./components/PatientSelector";
import ModelInfo from "./components/ModelInfo";

export default function App() {
  const [result, setResult] = useState<PredictionResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<ReportInputs | null>(null);
  const [patient, setPatient] = useState<Patient | null>(null);

  const [token, setToken] = useState<string | null>(null);
  const [role, setRole] = useState<"doctor" | "nurse" | null>(null);
  const [showInfo, setShowInfo] = useState(false);

  useEffect(() => {
    const t = localStorage.getItem("ckd_token");
    const r = localStorage.getItem("ckd_role") as any;
    if (t) setToken(t);
    if (r) setRole(r);
  }, []);

  return (
    <div className="min-h-screen">
      <header className="bg-white shadow-sm">
        <div className="mx-auto max-w-5xl px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold">CKD Risk Prediction (MVP)</h1>
              <p className="text-sm text-gray-600">
                Demo for thesis: minimal inputs → risk, probability, features, and recommendations
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowInfo(true)}
                className="rounded-md bg-gray-100 px-3 py-1.5 text-sm hover:bg-gray-200"
              >
                About
              </button>
              {token ? (
                <button
                  onClick={() => {
                    localStorage.removeItem("ckd_token");
                    localStorage.removeItem("ckd_role");
                    setToken(null);
                    setRole(null);
                    setPatient(null);
                    setResult(null);
                    setReport(null);
                  }}
                  className="rounded-md bg-gray-100 px-3 py-1.5 text-sm hover:bg-gray-200"
                >
                  Logout
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </header>

      {!token ? (
        <main className="mx-auto max-w-md px-4 py-6">
          <section className="bg-white rounded-lg shadow p-4 md:p-6">
            <Login
              onLoggedIn={(t, r) => {
                setToken(t);
                setRole(r);
              }}
            />
          </section>
        </main>
      ) : (
        <main className="mx-auto max-w-5xl px-4 py-6 grid gap-6 md:grid-cols-2">
          <section className="bg-white rounded-lg shadow p-4 md:p-6">
            {!patient ? (
              <PatientSelector token={token} onSelected={setPatient} />
            ) : (
              <PatientForm
                patient={patient}
                onResult={(r, ctx) => {
                  setResult(r);
                  setReport(ctx);
                }}
                onLoading={(l) => setLoading(l)}
              />
            )}
          </section>

          <section className="bg-white rounded-lg shadow p-4 md:p-6">
            <PredictionResult
              result={result}
              loading={loading}
              patientName={patient?.full_name ?? undefined}
              report={report}
            />
          </section>
        </main>
      )}

      <footer className="border-t bg-white">
        <div className="mx-auto max-w-5xl px-4 py-4 text-sm text-gray-700">
          Developed by: [Student Name] · Matric Number: [XXXXXXX]
        </div>
      </footer>

      <ModelInfo open={showInfo} onClose={() => setShowInfo(false)} />
    </div>
  );
}



