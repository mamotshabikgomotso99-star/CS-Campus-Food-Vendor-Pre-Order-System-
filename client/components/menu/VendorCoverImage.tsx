"use client";

import { useState } from "react";
import { getVendorCoverImage } from "@/lib/vendor-images";

export function VendorCoverImage({
  vendorId,
  vendorName,
  imageUrl,
  className,
}: {
  vendorId: string;
  vendorName: string;
  imageUrl: string | null;
  className: string;
}) {
  const fallbackImage = getVendorCoverImage(vendorId);
  const [imageSource, setImageSource] = useState<string | null>(imageUrl ?? fallbackImage);

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {imageSource ? (
        <img
          src={imageSource}
          alt={`${vendorName} featured food`}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover"
          onError={() => {
            setImageSource((current) => {
              if (fallbackImage && current !== fallbackImage) return fallbackImage;
              return null;
            });
          }}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-violet-100 via-violet-50 to-slate-100 px-3 text-center text-lg font-semibold text-violet-700">
          {vendorName}
        </div>
      )}
    </div>
  );
}