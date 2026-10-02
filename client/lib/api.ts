export type AuthRole = "student" | "vendor";

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
  role: AuthRole;
  studentNumber?: string;
  vendorName?: string;
};

export type AuthSuccessResponse = {
  success: true;
  message: string;
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
    throw new Error(message);
  }

  return data as T;
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
  imageUrl?: string | null;
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
  collectionAt: string;
  createdAt: string;
};

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

export async function requestPasswordReset(email: string): Promise<AuthSuccessResponse> {
  return request<AuthSuccessResponse>("/api/auth/forgot-password", { payload: { email } });
}

export async function verifyEmail(email: string): Promise<AuthSuccessResponse> {
  return request<AuthSuccessResponse>("/api/auth/verify-email", { payload: { email } });
}

export async function resetPassword(payload: {
  email: string;
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

export async function createStudentOrder(payload: {
  items: Array<{ menuItemId: string; quantity: number }>;
  collectionSlotId: string;
  idempotencyKey: string;
}) {
  return request<{ success: true; order: ApiOrder }>("/api/student/orders", { payload });
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
