const vendorCoverImages: Record<string, string> = {
  "fresh-bites": "/vendor-covers/fresh-bites.jpg",
  "mamas-corner": "/vendor-covers/mamas-corner.jpg",
  "student-cafe": "/vendor-covers/student-cafe.jpg",
  "sunset-snacks": "/vendor-covers/sunset-snacks.jpg",
};

export function getVendorCoverImage(vendorId: string) {
  return vendorCoverImages[vendorId] ?? null;
}