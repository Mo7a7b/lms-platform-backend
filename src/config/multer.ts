import multer from "multer";
// Use memory storage for direct Cloudinary upload
const storage = multer.memoryStorage();

export const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith("image"))
      return cb(new Error("Only images allowed"));
    cb(null, true);
  },
});
