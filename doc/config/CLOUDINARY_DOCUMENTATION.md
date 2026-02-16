# 🖼️ Appointment API - Cloudinary Documentation

## 📋 Table of Contents
- [Cloudinary Overview](#cloudinary-overview)
- [Configuration](#configuration)
- [Usage in Controllers](#usage-in-controllers)
- [Usage in Services/Helpers](#usage-in-serviceshelpers)
- [Security Considerations](#security-considerations)
- [Error Handling](#error-handling)
- [API Examples](#api-examples)

---

## Cloudinary Overview

Cloudinary is a cloud-based service that provides an end-to-end solution for all your image and video needs, from upload to storage, administration, manipulation, and delivery. In this project, Cloudinary is primarily used for:
-   Storing user avatar images.
-   Handling image uploads via API endpoints.
-   Providing optimized and secure delivery of media assets.

---

## Configuration

Cloudinary integration details and credentials are configured in `src/config/cloudinary.ts`. This file initializes the Cloudinary SDK with your account's cloud name, API key, and API secret.

**File: \`src/config/cloudinary.ts\`**

\`\`\`typescript
import { v2 as cloudinary } from "cloudinary";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import multer, { FileFilterCallback } from "multer";
import type { Request } from "express";
import { errorHandler } from "../middleware/errorHandler";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME as string,
  api_key: process.env.CLOUDINARY_API_KEY as string,
  api_secret: process.env.CLOUDINARY_API_SECRET as string
});

const createStorage = (
  folder: string,
  allowedFormats: string[] = ["jpg", "jpeg", "png", "gif", "webp"]
): CloudinaryStorage => {
  return new CloudinaryStorage({
    cloudinary,
    params: {
      folder,
      allowed_formats: allowedFormats,
      transformation: [
        { width: 1000, height: 1000, crop: "limit" },
        { quality: "auto" },
        { fetch_format: "auto" }
      ]
    } as any
  });
};

export const userAvatarStorage = createStorage("appointment/avatars");

export const uploadUserAvatar = multer({
  storage: userAvatarStorage,
  limits: {
    fileSize: 2 * 1024 * 1024
  },
  fileFilter: (_req: Request, file: any, cb: FileFilterCallback) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(null, false);
    }
  }
});

export const uploadToCloudinary = async (
  file: any,
  folder: string = "appointment/general"
): Promise<{
  url: string;
  public_id: string;
  format: string;
  size: number;
}> => {
  try {
    const uploadOptions = {
      folder,
      resource_type: "auto" as const,
      transformation: [
        { width: 1000, height: 1000, crop: "limit" },
        { quality: "auto" },
        { fetch_format: "auto" }
      ]
    };

    let result;
    if (file.path) {
      result = await cloudinary.uploader.upload(file.path, uploadOptions);
    } else if (file.buffer) {
      result = await new Promise<any>((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(uploadOptions, (error, uploadResult) => {
          if (error) reject(error);
          else resolve(uploadResult);
        });
        uploadStream.end(file.buffer);
      });
    } else if (typeof file === "string") {
      result = await cloudinary.uploader.upload(file, uploadOptions);
    } else {
      throw errorHandler(400, "Invalid file format. Expected file path, buffer, or string.");
    }

    return {
      url: result.secure_url,
      public_id: result.public_id,
      format: result.format,
      size: result.bytes
    };
  } catch (error: any) {
    throw errorHandler(500, \`Upload failed: \${error.message}\`);
  }
};

export const deleteFromCloudinary = async (publicId: string): Promise<any> => {
  try {
    return await cloudinary.uploader.destroy(publicId);
  } catch (error: any) {
    throw errorHandler(500, \`Delete failed: \${error.message}\`);
  }
};

export default cloudinary;
\`\`\`

---

## Usage in Controllers

Cloudinary is integrated into various controllers for handling image uploads and deletions, particularly for user avatars.

**Example: \`userController.ts\` - Uploading/Updating Avatar**

The \`updateUserProfile\` function in \`userController.ts\` demonstrates how files uploaded via \`multer\` (which uses Cloudinary storage) are handled, including conditional deletion of old avatars.

\`\`\`typescript
    // Handle avatar upload via multipart/form-data
    if (req.file) {
      const uploadResult = await uploadToCloudinary(req.file, "appointment/avatars");

      if (user.avatarPublicId) {
        try {
          await deleteFromCloudinary(user.avatarPublicId);
        } catch (deleteError) {
          console.error("Failed to delete previous avatar:", deleteError);
        }
      }

      user.avatar = uploadResult.url;
      user.avatarPublicId = uploadResult.public_id;
    } else if (avatar === null || (typeof avatar === "string" && avatar.trim().length === 0)) {
      if (user.avatarPublicId) {
        try {
          await deleteFromCloudinary(user.avatarPublicId);
        } catch (deleteError) {
          console.error("Failed to delete previous avatar:", deleteError);
        }
      }

      user.avatar = null;
      user.avatarPublicId = null;
    } else if (typeof avatar === "string" && avatar.trim().length > 0) {
      if (user.avatarPublicId) {
        try {
          await deleteFromCloudinary(user.avatarPublicId);
        } catch (deleteError) {
          console.error("Failed to delete previous avatar:", deleteError);
        }
      }

      user.avatar = avatar.trim();
      user.avatarPublicId = null;
    }
\`\`\`

---

## Usage in Services/Helpers

The core logic for interacting with the Cloudinary API (uploading and deleting resources) is encapsulated in helper functions within \`src/config/cloudinary.ts\` (the same file that handles configuration and Multer storage setup). These functions provide a clean interface for controllers to use Cloudinary features.

**\`uploadToCloudinary\` Function**

This asynchronous function handles uploading a file (either from a file path, buffer, or base64 string) to Cloudinary.

\`\`\`typescript
export const uploadToCloudinary = async (
  file: any,
  folder: string = "appointment/general"
): Promise<{
  url: string;
  public_id: string;
  format: string;
  size: number;
}> => {
  try {
    const uploadOptions = {
      folder,
      resource_type: "auto" as const,
      transformation: [
        { width: 1000, height: 1000, crop: "limit" },
        { quality: "auto" },
        { fetch_format: "auto" }
      ]
    };

    let result;
    if (file.path) {
      result = await cloudinary.uploader.upload(file.path, uploadOptions);
    } else if (file.buffer) {
      result = await new Promise<any>((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(uploadOptions, (error, uploadResult) => {
          if (error) reject(error);
          else resolve(uploadResult);
        });
        uploadStream.end(file.buffer);
      });
    } else if (typeof file === "string") {
      result = await cloudinary.uploader.upload(file, uploadOptions);
    } else {
      throw errorHandler(400, "Invalid file format. Expected file path, buffer, or string.");
    }

    return {
      url: result.secure_url,
      public_id: result.public_id,
      format: result.format,
      size: result.bytes
    };
  } catch (error: any) {
    throw errorHandler(500, \`Upload failed: \${error.message}\`);
  }
};
\`\`\`

**\`deleteFromCloudinary\` Function**

This function deletes an asset from Cloudinary using its public ID.

\`\`\`typescript
export const deleteFromCloudinary = async (publicId: string): Promise<any> => {
  try {
    return await cloudinary.uploader.destroy(publicId);
  } catch (error: any) {
    throw errorHandler(500, \`Delete failed: \${error.message}\`);
  }
};
\`\`\`

---

## Security Considerations

-   **API Keys & Secrets**: Ensure \`CLOUDINARY_API_SECRET\` is kept confidential and is not exposed in client-side code or committed to version control directly. It should be managed via environment variables.
-   **Signed Uploads**: For production, consider implementing signed uploads to prevent unauthorized users from uploading content directly to your Cloudinary account.
-   **Access Control**: Control which users can upload or delete assets based on their roles and permissions within the application.
-   **Deletion**: Handle public IDs securely to prevent unauthorized deletion of assets.

---

## Error Handling

Appropriate error handling is implemented to catch and respond to issues during Cloudinary operations (e.g., upload failures, deletion errors).

---

## API Examples

This section would typically include \`curl\` examples for interacting with endpoints that involve Cloudinary operations.

---

**Last Updated:** February 2026
**Version:** 1.0.0
**Maintainer:** Appointment API Development Team
