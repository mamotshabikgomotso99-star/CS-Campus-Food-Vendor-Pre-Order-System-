export type AccountRole = "student" | "vendor";

export const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmail(email: string) {
  if (!email.trim()) {
    return "Please enter your email address.";
  }

  if (!emailPattern.test(email.trim())) {
    return "Please enter a valid email address.";
  }

  return "";
}

export function validatePassword(password: string) {
  if (!password) {
    return "Please enter your password.";
  }

  if (password.length < 8) {
    return "Password must be at least 8 characters.";
  }

  return "";
}

export function validateName(name: string, fieldName: string) {
  if (!name.trim()) {
    return `Please enter your ${fieldName}.`;
  }

  return "";
}

export function validateStudentNumber(studentNumber: string) {
  if (!studentNumber.trim()) {
    return "Please enter your student number.";
  }

  return "";
}

export function validateVendorName(vendorName: string) {
  if (!vendorName.trim()) {
    return "Please enter your vendor name.";
  }

  return "";
}

export function validateRole(role?: string) {
  if (!role) {
    return "Please select an account type.";
  }

  return "";
}
