import * as ImagePicker from "expo-image-picker";

/**
 * The only file that OPENS the picker. (The sheet imports the library too, for
 * its `useMediaLibraryPermissions` hook — that one has to live in a component.)
 * It sits beside
 * `token-store.ts` and `socket.ts` — this folder's other platform wrappers —
 * rather than in `api/`, because nothing here talks to the server: it opens the
 * OS picker, validates what comes back, and hands the caller a ready FormData.
 *
 * It returns a REASON CODE, never a message. Translation belongs to the sheet
 * that shows it; keeping the rules here keeps them next to the picker options
 * they depend on.
 */

/**
 * Mirrors AVATAR_MIME_TO_EXTENSION in backend/src/users/users.service.ts. The
 * server also re-checks the MAGIC BYTES against the declared type, so a
 * mislabelled file is a 400 even when the type in this list — hence the picker
 * options below, which are what make the bytes and the label agree.
 */
export const ACCEPTED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

type AcceptedMime = (typeof ACCEPTED_MIME_TYPES)[number];

/** 5 MB — mirrors MAX_AVATAR_BYTES in backend/src/users/users.controller.ts:39. */
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

const EXTENSION_BY_MIME: Record<AcceptedMime, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

/**
 * Fallback for when the picker could not determine a MIME type — `mimeType` is
 * optional on `ImagePickerAsset`, and a part with no declared type is one the
 * server cannot accept.
 */
const MIME_BY_EXTENSION: Record<string, AcceptedMime> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

export type PickAvatarResult =
  /** `uri` is the same local file the form carries — the caller shows it as an optimistic preview. */
  | { ok: true; form: FormData; uri: string }
  | { ok: false; reason: "canceled" | "invalidType" | "tooLarge" };

function isAccepted(value: string): value is AcceptedMime {
  return (ACCEPTED_MIME_TYPES as readonly string[]).includes(value);
}

/** The declared type of the picked file, or null when it is not one we can send. */
function resolveMime(asset: ImagePicker.ImagePickerAsset): AcceptedMime | null {
  const declared = asset.mimeType?.toLowerCase();
  if (declared && isAccepted(declared)) return declared;

  // No usable MIME type from the OS: fall back to the file extension of the
  // local uri the picker just wrote.
  const path = asset.uri.split("?")[0] ?? "";
  const dot = path.lastIndexOf(".");
  if (dot < 0) return null;
  return MIME_BY_EXTENSION[path.slice(dot + 1).toLowerCase()] ?? null;
}

/**
 * Open the photo library and return an avatar ready to POST.
 *
 * `allowsEditing: true` is the FORMAT GUARANTEE, not a UX preference, and must
 * not be removed. It is what decides which native picker runs:
 *  - iOS: it routes to UIImagePickerController, whose default branch re-encodes
 *    the chosen image with `jpegData(compressionQuality:)` and reports the type
 *    from the bytes it just wrote. Without it the PHPicker path can hand back
 *    `image/heic`, or — worse — copy the ORIGINAL HEIC bytes into a file named
 *    `.jpg` and call them `image/jpeg`, which is exactly the mismatch the
 *    backend's magic-byte check rejects.
 *  - Android: it runs the crop step, which decodes and re-compresses to PNG or
 *    JPEG and derives the reported MIME type from the cropped file's own
 *    extension, so the bytes and the label are produced together.
 * A square crop is what an avatar wants anyway, so this costs nothing.
 *
 * Deliberately NOT set: `preferredAssetRepresentationMode` (Current is what
 * enables the copy-the-original fast path above) and `allowsMultipleSelection`
 * (mutually exclusive with allowsEditing, and silently wins over it).
 *
 * `quality: 0.8` rides on the re-encode that allowsEditing already forces, so a
 * 12MP phone photo lands in the low hundreds of KB and the size check below
 * almost never fires. It is not a substitute for that check: iOS ignores it for
 * PNG, and re-compressing an already-compressed image can grow it.
 */
export async function pickAvatar(): Promise<PickAvatarResult> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsEditing: true,
    // Android-only; iOS's crop rect is already square.
    aspect: [1, 1],
    quality: 0.8,
  });

  // `assets` is typed `null` in the cancelled arm of the union, so this is what
  // narrows it to a real array below.
  if (result.canceled) return { ok: false, reason: "canceled" };
  const asset = result.assets[0];
  if (!asset) return { ok: false, reason: "canceled" };

  // The allowlist stays even with the guarantee above: the iOS legacy path
  // still returns `image/gif` for an animated GIF, and `mimeType` can be
  // undefined. Rejecting here means the user is told what is wrong without a
  // round trip.
  const mimeType = resolveMime(asset);
  if (!mimeType) return { ok: false, reason: "invalidType" };

  // With allowsEditing both platforms measure the POST-CROP file — the exact
  // bytes about to be uploaded. It can still be undefined if the file-attribute
  // read failed, in which case we upload and let the server's own limit answer
  // (its 413 maps to the same message).
  if (asset.fileSize !== undefined && asset.fileSize > MAX_PHOTO_BYTES) {
    return { ok: false, reason: "tooLarge" };
  }

  const form = new FormData();
  // React Native's FormData takes a `{ uri, name, type }` file descriptor, but
  // the DOM lib expo's tsconfig pulls in types `append` as `string | Blob` and
  // knows nothing about that form — hence the cast. A name must always be
  // present or some multipart parsers drop the part, and its extension has to
  // agree with the type we declare. The field name is exactly "file", matching
  // FileInterceptor('file', …) in users.controller.ts.
  form.append("file", {
    uri: asset.uri,
    name: asset.fileName ?? `avatar${EXTENSION_BY_MIME[mimeType]}`,
    type: mimeType,
  } as unknown as Blob);

  return { ok: true, form, uri: asset.uri };
}
