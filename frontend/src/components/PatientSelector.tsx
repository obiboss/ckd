import { useEffect, useState } from "react";
import axios from "axios";

export interface Patient {
  patient_id: string;
  full_name: string;
  age: number;
  gender: "Male" | "Female" | "Other";
}

interface Props {
  token?: string | null;
  onSelected: (p: Patient) => void;
}

export default function PatientSelector({ token, onSelected }: Props) {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [fullName, setFullName] = useState("");
  const [age, setAge] = useState<number | "">("");
  const [gender, setGender] = useState<"Male" | "Female" | "Other">("Male");

  async function fetchPatients() {
    setError(null);
    setLoading(true);
    try {
      const API_URL = import.meta.env.VITE_API_URL;
      const res = await axios.get<Patient[]>(`${API_URL}/api/v1/patients`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      setPatients(res.data);
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? "Failed to load patients");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchPatients();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const parsedAge = typeof age === "string" ? Number(age) : age;
      if (parsedAge === null || parsedAge === undefined || isNaN(parsedAge)) {
        setError("Age is required.");
        return;
      }
      const API_URL = import.meta.env.VITE_API_URL;
      const res = await axios.post<Patient>(
        `${API_URL}/api/v1/patients`,
        { full_name: fullName, age: parsedAge, gender },
        {
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        }
      );
      setPatients((prev) => [...prev, res.data].sort((a, b) => a.full_name.localeCompare(b.full_name)));
      setFullName("");
      setAge("");
      setGender("Male");
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? "Failed to create patient");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Select or Create Patient</h2>
        <button
          onClick={fetchPatients}
          className="text-sm text-indigo-600 hover:underline"
        >
          Refresh
        </button>
      </div>

      {loading ? (
        <p className="text-gray-600">Loading patients…</p>
      ) : error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : (
        <ul className="divide-y divide-gray-200 rounded-md border">
          {patients.map((p) => (
            <li key={p.patient_id} className="p-3 flex items-center justify-between">
              <div className="text-sm">
                <div className="font-medium">{p.full_name}</div>
                <div className="text-gray-600">{p.age} yrs, {p.gender}</div>
              </div>
              <button
                onClick={() => onSelected(p)}
                className="text-sm rounded-md bg-gray-100 px-3 py-1.5 hover:bg-gray-200"
              >
                Select
              </button>
            </li>
          ))}
          {patients.length === 0 && <li className="p-3 text-sm text-gray-600">No patients yet.</li>}
        </ul>
      )}

      <div className="rounded-md border p-4">
        <h3 className="font-medium">Create new patient</h3>
        <form onSubmit={handleCreate} className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <input
            type="text"
            placeholder="Full name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            required
          />
          <input
            type="number"
            min={0}
            max={120}
            placeholder="Age"
            value={age}
            onChange={(e) => setAge(e.target.value === "" ? "" : Number(e.target.value))}
            className="rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            required
          />
          <select
            value={gender}
            onChange={(e) => setGender(e.target.value as any)}
            className="rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
          >
            <option value="Male">Male</option>
            <option value="Female">Female</option>
            <option value="Other">Other</option>
          </select>
          <div className="sm:col-span-3">
            <button
              type="submit"
              className="rounded-md bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700"
            >
              Create patient
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}


