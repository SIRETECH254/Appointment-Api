import type { Request, Response, NextFunction } from "express";
import { errorHandler } from "../middleware/errorHandler";
import Contact from "../models/Contact";

export const submitContact = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { name, email, phone, subject, message } = req.body;

    const trimmedName = typeof name === "string" ? name.trim() : "";
    const trimmedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
    const trimmedSubject = typeof subject === "string" ? subject.trim() : "";
    const trimmedMessage = typeof message === "string" ? message.trim() : "";

    if (!trimmedName || !trimmedEmail || !trimmedSubject || !trimmedMessage) {
      return next(errorHandler(400, "name, email, subject and message are required"));
    }

    if (trimmedEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      return next(errorHandler(400, "Valid email is required"));
    }

    if (trimmedName.length > 120) {
      return next(errorHandler(400, "Name must be at most 120 characters"));
    }
    if (trimmedSubject.length > 200) {
      return next(errorHandler(400, "Subject must be at most 200 characters"));
    }
    if (trimmedMessage.length > 2000) {
      return next(errorHandler(400, "Message must be at most 2000 characters"));
    }

    const userId = req.user?._id ?? null;
    const trimmedPhone = typeof phone === "string" ? phone.trim() || null : null;
    if (trimmedPhone && trimmedPhone.length > 30) {
      return next(errorHandler(400, "Phone must be at most 30 characters"));
    }

    const contact = new Contact({
      name: trimmedName,
      email: trimmedEmail,
      phone: trimmedPhone || undefined,
      subject: trimmedSubject,
      message: trimmedMessage,
      userId: userId || undefined,
      status: "NEW"
    });

    await contact.save();

    res.status(201).json({
      success: true,
      message: "Contact submitted successfully",
      data: { contact }
    });
  } catch (error: any) {
    console.error("Submit contact error:", error);
    next(errorHandler(500, "Server error while submitting contact"));
  }
};

export const getContacts = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { status, search, sort } = req.query;
    const query: any = {};

    if (status === "NEW" || status === "READ" || status === "REPLIED" || status === "ARCHIVED") {
      query.status = status;
    }

    if (search && typeof search === "string" && search.trim().length > 0) {
      const term = search.trim();
      query.$or = [
        { name: { $regex: term, $options: "i" } },
        { email: { $regex: term, $options: "i" } },
        { subject: { $regex: term, $options: "i" } }
      ];
    }

    let sortOptions: Record<string, 1 | -1> = { createdAt: -1 };
    if (typeof sort === "string" && sort.length > 0) {
      const [field, order] = sort.split(":");
      if (field === "createdAt" && (order === "asc" || order === "desc")) {
        sortOptions = { createdAt: order === "asc" ? 1 : -1 };
      }
    }

    const contacts = await Contact.find(query).sort(sortOptions).limit(100);

    res.status(200).json({
      success: true,
      data: { contacts }
    });
  } catch (error: any) {
    console.error("Get contacts error:", error);
    next(errorHandler(500, "Server error while fetching contacts"));
  }
};

export const getContact = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { contactId } = req.params;
    const contact = await Contact.findById(contactId);

    if (!contact) {
      return next(errorHandler(404, "Contact not found"));
    }

    res.status(200).json({
      success: true,
      data: { contact }
    });
  } catch (error: any) {
    console.error("Get contact error:", error);
    next(errorHandler(500, "Server error while fetching contact"));
  }
};

export const updateContactStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { contactId } = req.params;
    const { status } = req.body;

    const allowed: ("READ" | "REPLIED" | "ARCHIVED")[] = ["READ", "REPLIED", "ARCHIVED"];
    if (!status || typeof status !== "string" || !allowed.includes(status as "READ" | "REPLIED" | "ARCHIVED")) {
      return next(errorHandler(400, "status must be one of: READ, REPLIED, ARCHIVED"));
    }

    const contact = await Contact.findById(contactId);
    if (!contact) {
      return next(errorHandler(404, "Contact not found"));
    }

    contact.status = status as "READ" | "REPLIED" | "ARCHIVED";
    await contact.save();

    res.status(200).json({
      success: true,
      message: "Contact status updated successfully",
      data: { contact }
    });
  } catch (error: any) {
    console.error("Update contact status error:", error);
    next(errorHandler(500, "Server error while updating contact status"));
  }
};
