import axios from "axios";

const api = axios.create({
  baseURL: "https://localhost:8000/api/", // Your Django API base URL
  withCredentials: true,                // Enable sending cookies
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