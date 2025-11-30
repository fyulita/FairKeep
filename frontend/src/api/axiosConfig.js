import axios from "axios";

const apiBase = import.meta.env.VITE_API_BASE_URL || "https://localhost:8000/api/";

const api = axios.create({
  baseURL: apiBase,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

// Add a request interceptor to include the CSRF token
api.interceptors.request.use((config) => {
  const csrftoken = document.cookie
    .split("; ")
    .find((row) => row.startsWith("csrftoken="))
    ?.split("=")[1];
  if (csrftoken) {
    config.headers["X-CSRFToken"] = csrftoken;
  }
  return config;
});

export default api;
