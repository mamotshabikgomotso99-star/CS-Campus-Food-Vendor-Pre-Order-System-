"use client";

import dynamic from "next/dynamic";

export type CampusVendorPin = {
  id: string;
  name: string;
  collectionLocation: string | null;
  latitude: number | null;
  longitude: number | null;
  href?: string;
};

export type CampusMapPoint = {
  latitude: number;
  longitude: number;
};

type CampusVendorMapProps = {
  vendors: CampusVendorPin[];
  editable?: boolean;
  selectedVendorId?: string;
  draftLocation?: CampusMapPoint | null;
  onSelectVendor?: (vendorId: string) => void;
  onPickLocation?: (location: CampusMapPoint) => void;
};

const LeafletCampusMap = dynamic(
  () => import("./LeafletCampusMap").then((module) => module.LeafletCampusMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full min-h-[360px] items-center justify-center bg-slate-100 text-sm text-slate-600" role="status">
        Loading campus map...
      </div>
    ),
  },
);

export function CampusVendorMap(props: CampusVendorMapProps) {
  return (
    <div className="h-[min(68vh,700px)] min-h-[360px] w-full overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
      <LeafletCampusMap {...props} />
    </div>
  );
}