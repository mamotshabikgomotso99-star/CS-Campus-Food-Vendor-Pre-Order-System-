"use client";

import Image from "next/image";
import { Camera, Store, Trash2, User2 } from "lucide-react";
import { useEffect, useState } from "react";
import type { ChangeEvent } from "react";
import { readAuthIdentity } from "@/lib/auth-session";

type ProfileRole = "student" | "vendor";

const PHOTO_KEY_PREFIX: Record<ProfileRole, string> = {
  student: "campus-eats-profile-picture:",
  vendor: "campus-eats-vendor-profile-picture:",
};
const MAX_PHOTO_SIZE = 2 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function isValidPhotoData(value: string | null): value is string {
  return Boolean(
    value &&
      value.length <= 3_000_000 &&
      /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(value),
  );
}

function readPhotoAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("Unable to read this image."));
      }
    });
    reader.addEventListener("error", () => reject(new Error("Unable to read this image.")));
    reader.readAsDataURL(file);
  });
}

export function ProfilePhoto({ role }: { role: ProfileRole }) {
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const inputId = `${role}-profile-picture`;
  const helpId = `${role}-profile-picture-help`;
  const feedbackId = `${role}-profile-picture-feedback`;
  const FallbackIcon = role === "vendor" ? Store : User2;
  const photoAlt = role === "vendor" ? "Vendor profile picture" : "Student profile picture";

  useEffect(() => {
    const email = readAuthIdentity()?.email.trim().toLowerCase();
    if (!email) {
      return;
    }

    const key = `${PHOTO_KEY_PREFIX[role]}${email}`;
    let animationFrame = 0;

    try {
      const savedPhoto = window.localStorage.getItem(key);
      if (isValidPhotoData(savedPhoto)) {
        animationFrame = window.requestAnimationFrame(() => setPhotoUrl(savedPhoto));
      } else if (savedPhoto) {
        window.localStorage.removeItem(key);
      }
    } catch {
      animationFrame = window.requestAnimationFrame(() => {
        setError("Could not load your saved photo from this browser.");
      });
    }

    return () => window.cancelAnimationFrame(animationFrame);
  }, [role]);

  const handlePhotoChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    input.value = "";
    setError("");
    setMessage("");

    if (!file) {
      return;
    }
    const email = readAuthIdentity()?.email.trim().toLowerCase();
    if (!email) {
      setError("Sign in to save a profile photo.");
      return;
    }
    if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
      setError("Choose a JPEG, PNG, or WebP image.");
      return;
    }
    if (file.size > MAX_PHOTO_SIZE) {
      setError("Choose an image smaller than 2 MB.");
      return;
    }

    try {
      const imageData = await readPhotoAsDataUrl(file);
      if (!isValidPhotoData(imageData)) {
        setError("This image could not be used. Choose another file.");
        return;
      }
      window.localStorage.setItem(`${PHOTO_KEY_PREFIX[role]}${email}`, imageData);
      setPhotoUrl(imageData);
      setMessage("Photo saved in this browser.");
    } catch {
      setError("Could not save the photo in this browser. Check available storage and try again.");
    }
  };

  const handleRemovePhoto = () => {
    setError("");
    setMessage("");
    try {
      const email = readAuthIdentity()?.email.trim().toLowerCase();
      if (email) {
        window.localStorage.removeItem(`${PHOTO_KEY_PREFIX[role]}${email}`);
      }
      setPhotoUrl(null);
      setMessage("Photo removed.");
    } catch {
      setError("Could not remove the saved photo from this browser.");
    }
  };

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
      <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-violet-100 text-violet-700">
        {photoUrl ? (
          <Image
            src={photoUrl}
            alt={photoAlt}
            width={80}
            height={80}
            unoptimized
            className="h-full w-full object-cover"
          />
        ) : (
          <FallbackIcon className="h-10 w-10" aria-hidden="true" />
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          id={inputId}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handlePhotoChange}
          className="peer sr-only"
          aria-describedby={`${helpId} ${feedbackId}`}
        />
        <label
          htmlFor={inputId}
          className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-violet-700 px-3 py-2 text-sm font-medium text-white transition hover:bg-violet-800 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-violet-700"
        >
          <Camera className="h-4 w-4" aria-hidden="true" />
          {photoUrl ? "Change photo" : "Add photo"}
        </label>
        {photoUrl ? (
          <button
            type="button"
            onClick={handleRemovePhoto}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            Remove photo
          </button>
        ) : null}
        <p id={helpId} className="w-full text-xs text-slate-500">
          JPEG, PNG, or WebP up to 2 MB. Saved in this browser only.
        </p>
        <p
          id={feedbackId}
          role={error ? "alert" : "status"}
          aria-live={error ? "assertive" : "polite"}
          className={error ? "w-full text-sm text-red-700" : "w-full text-sm text-emerald-700"}
        >
          {error || message}
        </p>
      </div>
    </div>
  );
}