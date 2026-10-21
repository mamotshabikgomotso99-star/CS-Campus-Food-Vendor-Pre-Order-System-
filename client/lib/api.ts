export type AuthRole = "student" | "vendor" | "admin";

export type LoginPayload = {
  email: string;
  password: string;
  remember?: boolean;
};

export type RegisterPayload = {
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
  role: "student";
  studentNumber?: string;
  staffNumber?: string;
  vendorName?: string;
};

export type AuthSuccessResponse = {
  success: true;
  message: string;
  verificationSent?: boolean;
  verificationRequired?: boolean;
  role?: AuthRole;
  user?: {
    email: string;
    fullName?: string;
    role?: AuthRole;
  };
};

export type AuthErrorResponse = {
  success: false;
  message: string;
  code?: string;
};

export class ApiError extends Error {
  constructor(message: string, public readonly status: number, public readonly code?: string) {
    super(message);
    this.name = "ApiError";
  }
}

export type VendorRequest = {
  id: string;
  fullName: string;
  email: string;
  vendorName: string;
  category: string;
  collectionLocation: string | null;
  openingTime: string | null;
  closingTime: string | null;
  preparationTimeMinutes: number | null;
  createdAt: string;
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

function getApiBaseUrl() {
  if (!API_BASE_URL.trim()) {
    throw new Error(
      "Authentication backend is not configured yet. Set NEXT_PUBLIC_API_URL in your environment.",
    );
  }

  const configuredUrl = new URL(API_BASE_URL);
  const localHosts = new Set(["localhost", "127.0.0.1"]);
  if (
    typeof window !== "undefined" &&
    !localHosts.has(window.location.hostname) &&
    localHosts.has(configuredUrl.hostname)
  ) {
    throw new Error(
      "This deployed site is configured with a local API URL. Set NEXT_PUBLIC_API_URL to your deployed API origin in Vercel, then redeploy.",
    );
  }

  if (
    typeof window !== "undefined" &&
    localHosts.has(configuredUrl.hostname) &&
    localHosts.has(window.location.hostname)
  ) {
    configuredUrl.hostname = window.location.hostname;
  }
  return configuredUrl.toString().replace(/\/$/, "");
}

async function request<T>(
  endpoint: string,
  options: {
    method?: "GET" | "POST" | "PATCH" | "DELETE";
    payload?: Record<string, unknown>;
    formData?: FormData;
  } = {},
): Promise<T> {
  const headers: HeadersInit = {};
  if (options.payload && !options.formData) {
    headers["Content-Type"] = "application/json";
  }

  try {
    const response = await fetch(`${getApiBaseUrl()}${endpoint}`, {
      method: options.method ?? (options.payload || options.formData ? "POST" : "GET"),
      credentials: "include",
      headers,
      body: options.formData ?? (options.payload ? JSON.stringify(options.payload) : undefined),
    });

    const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;

    if (!response.ok) {
      const message =
        typeof data.message === "string"
          ? data.message
          : "Unable to process your request right now.";
      throw new ApiError(message, response.status, typeof data.code === "string" ? data.code : undefined);
    }

    return data as T;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    const message = error instanceof Error ? error.message : "Unable to reach the Campus Eats API.";
    throw new Error(message);
  }
}

export function resolveApiUrl(path: string) {
  return `${getApiBaseUrl()}${path.startsWith("/") ? path : `/${path}`}`;
}

export type MenuApiItem = {
  id: string;
  name: string;
  vendorId: string;
  vendor: string;
  priceCents: number;
  category: string;
  description: string;
  available: boolean;
  collectionLocation?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  imageUrl?: string | null;
};

export type VendorMapLocation = {
  id: string;
  name: string;
  collectionLocation: string | null;
  latitude: number | null;
  longitude: number | null;
};

export type CollectionSlot = {
  id: string;
  startsAt: string;
  remaining: number;
};

export type OrderItemLine = {
  name: string;
  unitPriceCents: number;
  quantity: number;
  lineTotalCents: number;
};

export type ApiOrder = {
  id: string;
  orderId: string;
  paymentId: string | null;
  vendorId: string;
  vendor: string;
  student: string;
  items: string;
  itemLines: OrderItemLine[];
  subtotalCents: number;
  discountCents: number;
  serviceFeeCents: number;
  totalCents: number;
  status: "Pending" | "Confirmed" | "Preparing" | "Ready for Collection" | "Collected" | "Cancelled";
  paymentStatus: "pending" | "paid" | "expired" | "failed" | "unverified";
  collectionAt: string;
  createdAt: string;
};

export type StudentPaymentStatus = "pending" | "paid" | "expired" | "failed" | "unverified";

export type StudentOrdersResponse = {
  success: true;
  orders: ApiOrder[];
  firstOrderDiscountEligible: boolean;
};

export type VendorOrdersResponse = {
  success: true;
  orders: ApiOrder[];
};

export async function loginUser(payload: LoginPayload): Promise<AuthSuccessResponse> {
  return request<AuthSuccessResponse>("/api/auth/login", { payload });
}

export async function registerUser(payload: RegisterPayload): Promise<AuthSuccessResponse> {
  return request<AuthSuccessResponse>("/api/auth/register", { payload });
}

export async function submitVendorRequest(payload: {
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
  vendorName: string;
  category: string;
  collectionLocation: string;
  openingTime: string;
  closingTime: string;
  preparationTimeMinutes: number;
}): Promise<AuthSuccessResponse> {
  return request<AuthSuccessResponse>("/api/vendor-requests", { payload });
}

export async function getVendorRequests() {
  return request<{ success: true; requests: VendorRequest[] }>("/api/admin/vendor-requests");
}

export async function getAdminVendorLocations() {
  return request<{ success: true; vendors: VendorMapLocation[] }>("/api/admin/vendors/locations");
}

export async function updateAdminVendorLocation(
  vendorId: string,
  location: { latitude: number; longitude: number },
) {
  return request<{ success: true; vendor: VendorMapLocation }>(
    `/api/admin/vendors/${encodeURIComponent(vendorId)}/location`,
    { method: "PATCH", payload: location },
  );
}

export async function reviewVendorRequest(requestId: string, status: "approved" | "rejected") {
  return request<{ success: true; message: string; status: "approved" | "rejected" }>(
    `/api/admin/vendor-requests/${encodeURIComponent(requestId)}`,
    { method: "PATCH", payload: { status } },
  );
}

export async function requestPasswordReset(email: string): Promise<AuthSuccessResponse> {
  return request<AuthSuccessResponse>("/api/auth/forgot-password", { payload: { email } });
}

export async function verifyEmail(email: string): Promise<AuthSuccessResponse> {
  return request<AuthSuccessResponse>("/api/auth/verify-email", { payload: { email } });
}

export async function confirmEmail(token: string): Promise<AuthSuccessResponse> {
  return request<AuthSuccessResponse>("/api/auth/confirm-email", { payload: { token } });
}

export async function resetPassword(payload: {
  token: string;
  password: string;
  confirmPassword: string;
}): Promise<AuthSuccessResponse> {
  return request<AuthSuccessResponse>("/api/auth/reset-password", { payload });
}

export async function logoutUser() {
  return request<AuthSuccessResponse>("/api/auth/logout", { payload: {} });
}

export async function getCurrentUser() {
  return request<AuthSuccessResponse>("/api/auth/me");
}

export async function getMenuItems(vendorId?: string) {
  const query = vendorId ? `?vendorId=${encodeURIComponent(vendorId)}` : "";
  return request<{ success: true; items: MenuApiItem[] }>(`/api/menu${query}`);
}

export async function getVendorMenuItems() {
  return request<{ success: true; items: MenuApiItem[] }>("/api/vendor/menu");
}

function buildMenuItemFormData(
  payload: {
    name: string;
    category: string;
    description: string;
    priceCents: number;
    available: boolean;
  },
  image?: File | null,
  removeImage = false,
) {
  const formData = new FormData();
  formData.set("name", payload.name);
  formData.set("category", payload.category);
  formData.set("description", payload.description);
  formData.set("priceCents", String(payload.priceCents));
  formData.set("available", String(payload.available));
  if (image) formData.set("image", image);
  if (removeImage) formData.set("removeImage", "true");
  return formData;
}

export async function createVendorMenuItem(payload: {
  name: string;
  category: string;
  description: string;
  priceCents: number;
  available: boolean;
}, image?: File | null) {
  return request<{ success: true; item: MenuApiItem }>("/api/vendor/menu", {
    formData: buildMenuItemFormData(payload, image),
  });
}

export async function updateVendorMenuItem(
  itemId: string,
  payload: {
    name: string;
    category: string;
    description: string;
    priceCents: number;
    available: boolean;
  },
  image?: File | null,
  removeImage = false,
) {
  return request<{ success: true; item: MenuApiItem }>(
    `/api/vendor/menu/${encodeURIComponent(itemId)}`,
    { method: "PATCH", formData: buildMenuItemFormData(payload, image, removeImage) },
  );
}

export async function removeVendorMenuItem(itemId: string) {
  return request<{ success: true; retired: boolean; message: string }>(
    `/api/vendor/menu/${encodeURIComponent(itemId)}`,
    { method: "DELETE" },
  );
}

export async function getCollectionSlots(vendorId: string) {
  return request<{ success: true; slots: CollectionSlot[] }>(
    `/api/collection-slots?vendorId=${encodeURIComponent(vendorId)}`,
  );
}

export async function getStudentOrders() {
  return request<StudentOrdersResponse>("/api/student/orders");
}

export async function createStudentCheckout(payload: {
  items: Array<{ menuItemId: string; quantity: number }>;
  collectionSlotId: string;
  idempotencyKey: string;
}) {
  return request<{
    success: true;
    paymentId: string;
    orderId: string;
    paymentStatus: StudentPaymentStatus;
    checkoutUrl: string | null;
  }>("/api/payments/create-checkout-session", { payload });
}

export async function getStudentPayment(paymentId: string) {
  return request<{
    success: true;
    paymentId: string;
    paymentStatus: StudentPaymentStatus;
    checkoutUrl: string | null;
    order: ApiOrder;
  }>(`/api/student/payments/${encodeURIComponent(paymentId)}`);
}

export async function getVendorOrders() {
  return request<VendorOrdersResponse>("/api/vendor/orders");
}

export async function updateVendorOrderStatus(orderId: string, status: ApiOrder["status"]) {
  return request<{ success: true; order: ApiOrder }>(
    `/api/vendor/orders/${encodeURIComponent(orderId)}/status`,
    { method: "PATCH", payload: { status } },
  );
}
