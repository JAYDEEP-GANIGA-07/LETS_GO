// ─── Cloudinary + Multer storage configuration ────────────────────────────────
// cloudinary: the official SDK used for direct Cloudinary API calls
//             (e.g., deleting images via cloudinary.uploader.destroy(filename))
// storage: multer-storage-cloudinary adapter — pipes file uploads from multer
//          directly into Cloudinary instead of saving to local disk
const cloudinary         = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");

cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key:    process.env.CLOUD_API_KEY,
  api_secret: process.env.CLOUD_API_SECRET,
});

const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder:         "wanderlust_DEV",   // Cloudinary folder name
    allowed_formats: ["png", "jpg", "jpeg", "webp"],
  },
});

module.exports = { cloudinary, storage };
