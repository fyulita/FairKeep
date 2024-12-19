import axios from "axios";

const api = axios.create({
  baseURL: "http://127.0.0.1:8000/api", // Your Django API base URL
});

// Function to refresh the access token
const refreshAccessToken = async () => {
  try {
    const refreshToken = localStorage.getItem("refreshToken");
    if (!refreshToken) {
      throw new Error("No refresh token available");
    }

    const response = await axios.post(
      "http://127.0.0.1:8000/api/token/refresh/", // Full URL
      { refresh: refreshToken }
    );
    const { access } = response.data;

    // Store the new access token
    localStorage.setItem("accessToken", access);

    return access;
  } catch (error) {
    console.error("Error refreshing token:", error);
    return null;
  }
};

  
// Axios interceptor to handle token expiry
api.interceptors.response.use(
  (response) => response, // Pass through successful responses
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      console.warn("401 error: Attempting token refresh...");
      originalRequest._retry = true; // Prevent infinite retries

      const newAccessToken = await refreshAccessToken();
      if (newAccessToken) {
        console.info("Token refreshed successfully.");
        // Update the Authorization header and retry the request
        originalRequest.headers["Authorization"] = `Bearer ${newAccessToken}`;
        return api(originalRequest);
      } else {
        console.warn("Failed to refresh token. Logging out user...");
        localStorage.removeItem("accessToken");
        localStorage.removeItem("refreshToken");
      }
    }

    return Promise.reject(error);
  }
);

export default api;