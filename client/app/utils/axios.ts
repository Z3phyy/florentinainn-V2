import axios from "axios";

const axiosInstance = axios.create({
  baseURL: process.env.NEXT_PUBLIC_BACKEND_URL_LIVE
});

export const AUTH_NOTICE_KEY = "auth_notice";

axiosInstance.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    const data = error?.response?.data;
    const code = data && typeof data === "object" ? data.code : undefined;
    const requestUrl: string = error?.config?.url || "";
    const isLoginRequest = requestUrl.startsWith("/account/login");
    const isSessionEnded =
      !isLoginRequest &&
      (status === 401 || (status === 403 && code === "ACCOUNT_DISABLED"));

    if (isSessionEnded && typeof window !== "undefined") {
      const hadToken = Boolean(localStorage.getItem("token"));
      if (hadToken) {
        localStorage.removeItem("token");
        localStorage.removeItem("user-storage");
        sessionStorage.clear();
        const message =
          data && typeof data === "object" && typeof data.message === "string"
            ? data.message
            : "Your session has ended. Please sign in again.";
        try {
          sessionStorage.setItem(AUTH_NOTICE_KEY, message);
        } catch {}
        if (!window.location.pathname.startsWith("/guest/login")) {
          window.location.href = "/guest/login";
        }
      }
    }
    return Promise.reject(error);
  }
);

export default axiosInstance;
