import { PredictionResponse } from "./PatientForm";

interface Props {
  result: PredictionResponse | null;
  loading?: boolean;
}

export default function PredictionResult({ result, loading }: Props) {
  if (loading) {
    return <p className="text-gray-600">Predicting risk…</p>;
  }
  if (!result) {
    return <p className="text-gray-600">Submit the form to see results.</p>;
  }

  const probabilityPct = Math.round(result.probability * 100);

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Prediction Result</h2>
      <div className="rounded-md border border-gray-200 p-4 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">CKD Risk Level</span>
          <span className="font-medium">{result.risk_level}</span>
        </div>
        <div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Probability</span>
            <span className="font-medium">{result.probability.toFixed(2)}</span>
          </div>
          <div className="mt-2 h-2 w-full rounded bg-gray-100">
            <div
              className={`h-2 rounded ${probabilityPct >= 70 ? "bg-red-500" : probabilityPct >= 40 ? "bg-yellow-500" : "bg-green-500"}`}
              style={{ width: `${probabilityPct}%` }}
            />
          </div>
        </div>
      </div>

      <div className="rounded-md border border-gray-200 p-4">
        <h3 className="font-medium">Top Features</h3>
        <ul className="mt-2 space-y-2">
          {result.top_features.map((f, idx) => (
            <li key={idx} className="text-sm text-gray-800">
              <div className="flex items-center justify-between">
                <span className="capitalize">{f.replace(/_/g, " ")}</span>
                <span className="text-gray-500">rank {idx + 1}</span>
              </div>
              <div className="mt-1 h-1.5 w-full rounded bg-gray-100">
                <div className="h-1.5 rounded bg-indigo-500" style={{ width: `${100 - idx * 20}%` }} />
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-md border border-gray-200 p-4">
        <h3 className="font-medium">Recommendations</h3>
        <ul className="mt-2 list-disc pl-6 text-sm text-gray-800 space-y-1">
          {result.recommendations.map((r, idx) => (
            <li key={idx}>{r}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}


