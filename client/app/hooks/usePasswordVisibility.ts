"use client";

import { useState } from "react";

export function usePasswordVisibility() {
  const [showPassword, setShowPassword] = useState(false);

  const togglePasswordVisibility = () => {
    setShowPassword((prev) => !prev);
  };

  return {
    showPassword,
    togglePasswordVisibility,
    passwordInputType: showPassword ? "text" : "password",
  };
}
