# 🚨 Appointment API - Error Handling Middleware Documentation

## 📋 Table of Contents
- [Error Handling Overview](#error-handling-overview)
- [Implementation Details](#implementation-details)
- [Usage in Controllers and Services](#usage-in-controllers-and-services)
- [Global Error Handling Middleware](#global-error-handling-middleware)
- [Error Response Structure](#error-response-structure)
- [Best Practices](#best-practices)
- [API Examples](#api-examples)

---

## Error Handling Overview

Robust error handling is crucial for any API to provide consistent and informative feedback to clients while preventing unexpected server crashes. In the Appointment API, a centralized error handling strategy is implemented using a custom error builder function and a global Express error middleware. This approach ensures:

-   **Standardized Error Responses:** All errors return a consistent JSON format.
-   **Categorized Errors:** Errors are assigned appropriate HTTP status codes.
-   **Developer-Friendly Debugging:** Detailed error information (stack traces) is available in development environments but hidden in production for security.

---

## Implementation Details

The core of the custom error handling is the `errorHandler` function defined in `src/middleware/errorHandler.ts`. This function creates and returns a standard JavaScript `Error` object, but it attaches a `statusCode` property, which is later used by the global error handler to set the HTTP response status.

**File: `src/middleware/errorHandler.ts`**

```typescript
export const errorHandler = (statusCode: number, message: string): Error => {
    const error = new Error(message);
    (error as any).statusCode = statusCode;
    return error;
}
```

---

## Usage in Controllers and Services

Controllers and external service functions use the `errorHandler` function to create and propagate errors. In Express routes, these errors are typically passed to the `next()` function, which then forwards them to the global error handling middleware.

**Example: Usage in `authController.ts`**
When validating user input during login, an invalid password would trigger an error:
```typescript
    // Validate password and account status
    const isPasswordValid = bcrypt.compareSync(password, user.password);
    if (!isPasswordValid) {
      return next(errorHandler(401, "Password is incorrect"));
    }
```

**Example: Usage in `smsService.ts`**
Service functions often throw errors using `errorHandler` when external dependencies (like Africa's Talking) are not configured or fail:
```typescript
    if (!sms) {
      throw errorHandler(500, "SMS service not initialized - check Africa's Talking credentials");
    }
```

---

## Global Error Handling Middleware

All errors passed to `next()` in Express routes, or unhandled exceptions in asynchronous operations, are eventually caught by a global error handling middleware defined in `src/index.ts`. This middleware is the last `app.use` call in the application's middleware chain.

**File: `src/index.ts` - Global Error Handler Snippet**

```typescript
// Global error handler
app.use(
  (err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error(err.stack); // Log the error stack for debugging

    const statusCode = err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(statusCode).json({
      success: false,
      message,
      ...(process.env.NODE_ENV === "development" && {
        error: err.message,
        stack: err.stack // Only include stack trace in development
      })
    });
  }
);
```

This middleware:
1.  Logs the error stack to the console (`console.error`).
2.  Determines the HTTP `statusCode` from the error object's `statusCode` property (if set), otherwise defaults to `500 Internal Server Error`.
3.  Extracts the `message` from the error object, or defaults to "Internal Server Error".
4.  Sends a JSON response with `success: false`, the error `message`.
5.  In `development` mode (`process.env.NODE_ENV === "development"`), it additionally includes the full `error` message and `stack` trace for easier debugging.

---

## Error Response Structure

All error responses from the API adhere to the following JSON structure:

```json
{
  "success": false,
  "message": "A human-readable error message",
  "error": "Detailed error message (only in development)",
  "stack": "Stack trace (only in development)"
}
```

---

## Best Practices

-   Always use `return next(errorHandler(statusCode, message));` in controllers to forward errors, ensuring the global handler catches them.
-   In service functions, `throw errorHandler(statusCode, message);` can be used, but ensure these are caught by `try-catch` blocks in the calling controller/service and passed to `next()`.
-   Avoid sending sensitive information in error messages, especially in production. The global error handler already strips stack traces.

---

## API Examples

**Example: Invalid Login Credentials**

Request (e.g., to `POST /api/auth/login` with incorrect password):
```bash
curl -X POST http://localhost:4500/api/auth/login 
  -H "Content-Type: application/json" 
  -d '{
    "email": "test@example.com",
    "password": "wrongpassword"
  }'
```

Response (HTTP Status: `401 Unauthorized`):
```json
{
  "success": false,
  "message": "Password is incorrect"
}
```
*(In development, this response would also include `error` and `stack` fields.)*

---

**Last Updated:** February 2026
**Version:** 1.0.0
**Maintainer:** Appointment API Development Team
