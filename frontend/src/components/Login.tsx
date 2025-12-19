import { useState } from "react";
import axios from "axios";

interface Props {
  onLoggedIn: (token: string, role: "doctor" | "nurse") => void;
}

export default function Login({ onLoggedIn }: Props) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    // 🔍 ADD THIS LOG
    console.log("Submitting login payload:", {
      username,
      password,
    });
    try {
      const API_URL = import.meta.env.VITE_API_URL;
      const res = await axios.post<{ token: string; role: "doctor" | "nurse" }>(
        `${API_URL}/api/v1/login`,
        { username, password },
        { headers: { "Content-Type": "application/json" } }
      );
      localStorage.setItem("ckd_token", res.data.token);
      localStorage.setItem("ckd_role", res.data.role);
      onLoggedIn(res.data.token, res.data.role);
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h2 className="text-xl font-semibold">Login</h2>
      <p className="text-sm text-gray-600">Doctors and nurses only (demo).</p>
      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Username
          </label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="mt-1 w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            placeholder="dr_smith"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Password
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            placeholder="password"
            required
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center rounded-md bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700"
        >
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </div>
  );
}
