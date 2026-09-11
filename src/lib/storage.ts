/**
 * Supabase Storage bucket names and the shared limits for user-uploaded
 * images (progress photos, exercise images). Safe to import from client
 * components — these are plain constants, not a server module.
 */
export const BODY_PHOTOS_BUCKET = "body-photos";
export const EXERCISE_IMAGES_BUCKET = "exercise-images";

export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
