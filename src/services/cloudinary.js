// Cloudinary unsigned browser upload. Needs a cloud name and an *unsigned*
// upload preset (Cloudinary dashboard → Settings → Upload → Upload presets).
// The API secret is never used in the browser.
const CLOUD = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

export const isCloudinaryConfigured = Boolean(CLOUD && PRESET);

// Uploads a File/Blob and resolves to the hosted https URL to store in Firestore.
export async function uploadImage(file) {
  if (!isCloudinaryConfigured) throw new Error("Cloudinary is not configured");
  const form = new FormData();
  form.append("file", file);
  form.append("upload_preset", PRESET);
  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD}/image/upload`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) throw new Error("Cloudinary upload failed");
  const data = await res.json();
  return data.secure_url;
}
