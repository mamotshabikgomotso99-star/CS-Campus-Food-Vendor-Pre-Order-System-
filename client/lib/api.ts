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

import { vendorMenuById } from "@/lib/dashboard-data";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

function createMockCollectionSlots(vendorId?: string): CollectionSlot[] {
  const vendorKey = vendorId ?? "fresh-bites";
  const now = new Date();
  return Array.from({ length: 4 }, (_, index) => {
    const slotDate = new Date(now.getTime() + (index + 1) * 60 * 60 * 1000);
    slotDate.setMinutes(0, 0, 0);
    return {
      id: `${vendorKey}-slot-${index + 1}`,
      startsAt: slotDate.toISOString(),
      remaining: 8 - index,
    };
  });
}

function getMockFallback<T>(endpoint: string, options: { method?: "GET" | "POST" | "PATCH" | "DELETE"; payload?: Record<string, unknown> } = {}): T | null {
  if (endpoint.split("?")[0] === "/api/menu") {
    const params = new URLSearchParams(endpoint.split("?")[1] ?? "");
    const vendorId = params.get("vendorId");
    const items: MenuApiItem[] = Object.values(vendorMenuById)
      .flat()
      .filter((item) => !vendorId || item.vendorId === vendorId)
      .map((item) => ({
        id: item.id,
        name: item.name,
        vendorId: item.vendorId,
        vendor: item.vendor,
        priceCents: Math.round(item.price * 100),
        category: item.category,
        description: item.description,
        available: item.available,
      }));
    return { success: true, items } as T;
  }

  if (endpoint.startsWith("/api/collection-slots")) {
    const params = new URLSearchParams(endpoint.split("?")[1] ?? "");
    const vendorId = params.get("vendorId") ?? "fresh-bites";
    return { success: true, slots: createMockCollectionSlots(vendorId) } as T;
  }

  if (endpoint === "/api/student/orders") {
    if (options.method === "POST") {
      const payload = options.payload ?? {};
      const items = Array.isArray(payload.items) ? payload.items : [];
      const amount = Math.max(0, items.reduce((total, item) => total + (Number((item as { quantity?: number })?.quantity ?? 0) * 4500), 0));
      return {
        success: true,
        order: {
          id: "CE-1001",
          orderId: "mock-order-1",
          vendorId: "fresh-bites",
          vendor: "Fresh Bites",
          student: "Demo Student",
          items: `${items.length} mock items`,
          itemLines: items.map((item) => ({
            name: "Mock item",
            unitPriceCents: 4500,
            quantity: Number((item as { quantity?: number })?.quantity ?? 0),
            lineTotalCents: 4500 * Number((item as { quantity?: number })?.quantity ?? 0),
          })),
          subtotalCents: amount,
          discountCents: 0,
          serviceFeeCents: 500,
          totalCents: amount + 500,
          status: "Pending",
          collectionAt: new Date(Date.now() + 3600000).toISOString(),
          createdAt: new Date().toISOString(),
        },
      } as T;
    }

    return {
      success: true,
      orders: [],
      firstOrderDiscountEligible: true,
    } as T;
  }

  if (endpoint === "/api/auth/me") {
    return { success: true, message: "Prototype mode active.", user: { email: "student@example.com", fullName: "Demo Student", role: "student" } } as T;
  }

  return null;
}

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
      throw new Error(message);
    }

    return data as T;
  } catch (error) {
    const fallback = getMockFallback<T>(endpoint, options);
    if (fallback) {
      return fallback;
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
