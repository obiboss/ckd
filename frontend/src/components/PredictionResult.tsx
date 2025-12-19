import { PredictionResponse, ReportInputs } from "./PatientForm";

interface Props {
  result: PredictionResponse | null;
  loading?: boolean;
  patientName?: string;
  report?: ReportInputs | null;
}

export default function PredictionResult({ result, loading, patientName, report }: Props) {
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
      {patientName && <p className="text-sm text-gray-700">Patient: <span className="font-medium">{patientName}</span></p>}
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

      <div className="rounded-md border border-gray-200 p-4 overflow-x-auto">
        <h3 className="font-medium">Laboratory Report</h3>
        <table className="mt-3 w-full text-sm">
          <thead>
            <tr className="text-left text-gray-600">
              <th className="py-1 pr-4">TEST NAME</th>
              <th className="py-1 pr-4">RESULT</th>
              <th className="py-1 pr-4">UNIT</th>
              <th className="py-1 pr-4">REFERENCE RANGE</th>
            </tr>
          </thead>
          <tbody>
            {report && (
              <>
                <ReportRow name="Systolic Blood Pressure" value={report.vitals.systolic_bp} unit="mmHg" refRange="90 – 140" />
                <ReportRow name="Diastolic Blood Pressure" value={report.vitals.diastolic_bp} unit="mmHg" refRange="60 – 90" />
                <ReportRow name="Heart Rate" value={report.vitals.heart_rate} unit="beats/min" refRange="60 – 100" />
                <ReportRow name="Urine Protein (approx.)" value={report.urine.urine_protein_pct} unit="%" refRange="0 – 1" />
                <ReportRow name="Urine Bacteria (approx.)" value={report.urine.urine_bacteria_pct} unit="%" refRange="0 – 1" />
                <ReportRow name="Creatinine" value={report.kft.creatinine} unit="mg/dL" refRange="0.5 – 1.3" />
                <ReportRow name="Urea" value={report.kft.urea} unit="mg/dL" refRange="10 – 50" />
                <ReportRow name="Albumin" value={report.kft.albumin} unit="g/dL" refRange="3.5 – 5.0" />
                <ReportRow name="Sodium" value={report.kft.sodium} unit="mmol/L" refRange="135 – 145" />
                <ReportRow name="Potassium" value={report.kft.potassium} unit="mmol/L" refRange="3.5 – 5.1" />
                <ReportRow name="Bicarbonate" value={report.kft.bicarbonate} unit="mEq/L" refRange="22 – 28" />
              </>
            )}
          </tbody>
        </table>
        <p className="mt-2 text-xs text-gray-500">
          Numeric approximation used for academic demonstration purposes.
        </p>
      </div>

      <div className="rounded-md border border-gray-200 p-4">
        <h3 className="font-medium">Clinical Comment</h3>
        <p className="mt-2 text-sm text-gray-800">
          Findings suggest {result.risk_level.toLowerCase()}. Further evaluation including eGFR and ACR is recommended.
        </p>
        <h4 className="mt-4 font-medium">Recommendations</h4>
        <ul className="mt-1 list-disc pl-6 text-sm text-gray-800 space-y-1">
          {result.recommendations.map((r, idx) => <li key={idx}>{r}</li>)}
        </ul>
      </div>
    </div>
  );
}

function ReportRow({ name, value, unit, refRange }: { name: string; value?: number; unit: string; refRange: string }) {
  return (
    <tr className="border-t border-gray-100">
      <td className="py-1 pr-4">{name}</td>
      <td className="py-1 pr-4">{value ?? "-"}</td>
      <td className="py-1 pr-4">{unit}</td>
      <td className="py-1 pr-4">{refRange}</td>
    </tr>
  );
}



