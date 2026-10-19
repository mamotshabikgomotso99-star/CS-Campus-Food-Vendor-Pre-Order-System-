"use client";

import { divIcon, LatLngBounds } from "leaflet";
import Link from "next/link";
import { MapContainer, Marker, Polygon, Popup, TileLayer, useMapEvents } from "react-leaflet";
import {
  TUT_SOSHANGUVE_SOUTH_BOUNDS,
  TUT_SOSHANGUVE_SOUTH_BOUNDARY,
  TUT_SOSHANGUVE_SOUTH_CENTER,
} from "@/lib/campus-map";
import type { CampusMapPoint, CampusVendorPin } from "./CampusVendorMap";

type LeafletCampusMapProps = {
  vendors: CampusVendorPin[];
  editable?: boolean;
  selectedVendorId?: string;
  draftLocation?: CampusMapPoint | null;
  onSelectVendor?: (vendorId: string) => void;
  onPickLocation?: (location: CampusMapPoint) => void;
};

const campusBounds = new LatLngBounds(
  TUT_SOSHANGUVE_SOUTH_BOUNDS[0],
  TUT_SOSHANGUVE_SOUTH_BOUNDS[1],
);

function createPinIcon(selected: boolean) {
  return divIcon({
    className: "campus-vendor-marker",
    html: `<span class="campus-vendor-marker__dot${selected ? " campus-vendor-marker__dot--selected" : ""}"></span>`,
    iconSize: [28, 36],
    iconAnchor: [14, 34],
  });
}

function MapClickHandler({
  enabled,
  onPickLocation,
}: {
  enabled: boolean;
  onPickLocation?: (location: CampusMapPoint) => void;
}) {
  useMapEvents({
    click(event) {
      if (enabled) {
        onPickLocation?.({ latitude: event.latlng.lat, longitude: event.latlng.lng });
      }
    },
  });
  return null;
}

export function LeafletCampusMap({
  vendors,
  editable = false,
  selectedVendorId,
  draftLocation,
  onSelectVendor,
  onPickLocation,
}: LeafletCampusMapProps) {
  const visibleVendors = vendors.filter((vendor) => {
    if (editable && vendor.id === selectedVendorId && draftLocation) return true;
    return vendor.latitude !== null && vendor.longitude !== null;
  });

  return (
    <MapContainer
      center={TUT_SOSHANGUVE_SOUTH_CENTER}
      zoom={16}
      minZoom={15}
      maxZoom={20}
      maxBounds={campusBounds}
      maxBoundsViscosity={1}
      className="h-full min-h-[360px] w-full"
      aria-label="Map of TUT Soshanguve South campus vendor collection points"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url={process.env.NEXT_PUBLIC_MAP_TILE_URL ?? "https://tile.openstreetmap.org/{z}/{x}/{y}.png"}
      />
      <Polygon
        positions={TUT_SOSHANGUVE_SOUTH_BOUNDARY}
        interactive={false}
        pathOptions={{ color: "#0f766e", weight: 2, fill: false, dashArray: "5 5" }}
      />
      <MapClickHandler enabled={editable} onPickLocation={onPickLocation} />
      {visibleVendors.map((vendor) => {
        const isSelected = vendor.id === selectedVendorId;
        const position: [number, number] = isSelected && draftLocation
          ? [draftLocation.latitude, draftLocation.longitude]
          : [vendor.latitude as number, vendor.longitude as number];

        return (
          <Marker
            key={vendor.id}
            position={position}
            icon={createPinIcon(isSelected)}
            draggable={editable && isSelected}
            eventHandlers={{
              click: () => onSelectVendor?.(vendor.id),
              dragend: (event) => {
                const markerLocation = event.target.getLatLng();
                onPickLocation?.({ latitude: markerLocation.lat, longitude: markerLocation.lng });
              },
            }}
          >
            <Popup>
              <div className="min-w-40 space-y-1">
                <p className="font-semibold text-slate-900">{vendor.name}</p>
                <p className="text-sm text-slate-600">{vendor.collectionLocation || "Collection point not provided"}</p>
                {editable ? (
                  <p className="text-xs text-slate-500">Click the map or drag the pin to set this location.</p>
                ) : vendor.href ? (
                  <div className="flex gap-3 pt-1 text-sm font-medium">
                    <Link href={vendor.href} className="text-violet-700">View menu</Link>
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${position[0]},${position[1]}&travelmode=walking`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-emerald-700"
                    >
                      Walking directions
                    </a>
                  </div>
                ) : null}
              </div>
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}