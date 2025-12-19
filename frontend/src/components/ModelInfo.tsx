interface Props {
  open: boolean;
  onClose: () => void;
}

export default function ModelInfo({ open, onClose }: Props) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-lg rounded-lg bg-white p-5 shadow-lg">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Dataset / Model Background</h3>
          <button className="text-sm text-gray-600 hover:underline" onClick={onClose}>Close</button>
        </div>
        <div className="mt-3 space-y-2 text-sm text-gray-800">
          <p>
            This demo uses a simple rule-based heuristic to approximate CKD risk based on selected
            medical features (age, comorbidities, blood pressure, creatinine, albumin, heart rate).
          </p>
          <p>
            Values are processed with minimal normalization and combined into a probability and risk category.
            Feature importance is approximated by contribution weights.
          </p>
          <p className="text-gray-600">
            Results are for academic demonstration only and not intended for clinical decision-making.
          </p>
        </div>
      </div>
    </div>
  );
}


