import type { Request, Response, NextFunction } from "express";
import { errorHandler } from "../middleware/errorHandler";
import Newsletter from "../models/Newsletter";
import User from "../models/User";
import { sendGenericEmail } from "../services/external/emailService";
import crypto from "crypto";

export const subscribeNewsletter = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email } = req.body;
    
    const trimmedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
    
    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      return next(errorHandler(400, "Valid email is required"));
    }

    const userId = req.user?._id ?? null;
    
    // Check if already subscribed
    let subscriber = await Newsletter.findOne({ email: trimmedEmail });
    
    if (subscriber) {
      if (subscriber.status === "SUBSCRIBED") {
        return next(errorHandler(400, "Email is already subscribed"));
      }
      // Re-subscribe if previously unsubscribed
      subscriber.status = "SUBSCRIBED";
      subscriber.subscribedAt = new Date();
      subscriber.set("unsubscribedAt", undefined);
      subscriber.unsubscribeToken = crypto.randomBytes(32).toString("hex");
      if (userId) subscriber.userId = userId;
      await subscriber.save();
    } else {
      // Create new subscription
      subscriber = new Newsletter({
        email: trimmedEmail,
        userId: userId || undefined,
        status: "SUBSCRIBED",
        unsubscribeToken: crypto.randomBytes(32).toString("hex"),
        source: userId ? "API" : "WEBSITE"
      });
      await subscriber.save();
    }

    res.status(201).json({
      success: true,
      message: "Successfully subscribed to newsletter",
      data: { subscriber }
    });
  } catch (error: any) {
    if (error.code === 11000) {
      return next(errorHandler(400, "Email is already subscribed"));
    }
    console.error("Subscribe newsletter error:", error);
    next(errorHandler(500, "Server error while subscribing to newsletter"));
  }
};

export const unsubscribeNewsletter = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { token, email } = req.query;
    
    let subscriber;
    
    if (token && typeof token === "string") {
      subscriber = await Newsletter.findOne({ unsubscribeToken: token });
    } else if (email && typeof email === "string") {
      subscriber = await Newsletter.findOne({ email: email.trim().toLowerCase() });
    } else {
      return next(errorHandler(400, "Token or email is required"));
    }

    if (!subscriber) {
      return next(errorHandler(404, "Subscriber not found"));
    }

    if (subscriber.status === "UNSUBSCRIBED") {
      res.status(200).json({
        success: true,
        message: "Already unsubscribed"
      });
      return;
    }

    subscriber.status = "UNSUBSCRIBED";
    subscriber.unsubscribedAt = new Date();
    await subscriber.save();

    res.status(200).json({
      success: true,
      message: "Successfully unsubscribed from newsletter"
    });
  } catch (error: any) {
    console.error("Unsubscribe newsletter error:", error);
    next(errorHandler(500, "Server error while unsubscribing"));
  }
};

export const getSubscribers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { status, search, page = 1, limit = 10, sort = "subscribedAt:desc" } = req.query;
    const query: any = {};

    if (status === "SUBSCRIBED" || status === "UNSUBSCRIBED" || status === "BOUNCED") {
      query.status = status;
    }

    if (search && typeof search === "string" && search.trim().length > 0) {
      const term = search.trim();
      query.$or = [
        { email: { $regex: term, $options: "i" } }
      ];
    }

    let sortOptions: Record<string, 1 | -1> = { subscribedAt: -1 };
    if (typeof sort === "string") {
      const [field, order] = sort.split(":");
      if (field && (order === "asc" || order === "desc")) {
        sortOptions = { [field]: order === "asc" ? 1 : -1 };
      }
    }

    const options = {
      page: parseInt(page as string, 10),
      limit: parseInt(limit as string, 10)
    };

    const subscribers = await Newsletter.find(query)
      .sort(sortOptions)
      .limit(options.limit)
      .skip((options.page - 1) * options.limit)
      .populate("userId", "firstName lastName email");

    const total = await Newsletter.countDocuments(query);

    res.status(200).json({
      success: true,
      data: {
        subscribers,
        pagination: {
          currentPage: options.page,
          totalPages: Math.ceil(total / options.limit),
          totalSubscribers: total,
          hasNextPage: options.page < Math.ceil(total / options.limit),
          hasPrevPage: options.page > 1
        }
      }
    });
  } catch (error: any) {
    console.error("Get subscribers error:", error);
    next(errorHandler(500, "Server error while fetching subscribers"));
  }
};

export const getSubscriber = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { subscriberId } = req.params;
    const subscriber = await Newsletter.findById(subscriberId).populate("userId", "firstName lastName email");

    if (!subscriber) {
      return next(errorHandler(404, "Subscriber not found"));
    }

    res.status(200).json({
      success: true,
      data: { subscriber }
    });
  } catch (error: any) {
    console.error("Get subscriber error:", error);
    next(errorHandler(500, "Server error while fetching subscriber"));
  }
};

export const updateSubscriberStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { subscriberId } = req.params;
    const { status } = req.body;

    const allowed: ("SUBSCRIBED" | "UNSUBSCRIBED" | "BOUNCED")[] = ["SUBSCRIBED", "UNSUBSCRIBED", "BOUNCED"];
    if (!status || typeof status !== "string" || !allowed.includes(status as any)) {
      return next(errorHandler(400, "status must be one of: SUBSCRIBED, UNSUBSCRIBED, BOUNCED"));
    }

    const subscriber = await Newsletter.findById(subscriberId);
    if (!subscriber) {
      return next(errorHandler(404, "Subscriber not found"));
    }

    subscriber.status = status as "SUBSCRIBED" | "UNSUBSCRIBED" | "BOUNCED";
    if (status === "UNSUBSCRIBED" && !subscriber.unsubscribedAt) {
      subscriber.unsubscribedAt = new Date();
    } else if (status === "SUBSCRIBED") {
      subscriber.subscribedAt = new Date();
      subscriber.set("unsubscribedAt", undefined);
    }

    await subscriber.save();

    res.status(200).json({
      success: true,
      message: "Subscriber status updated successfully",
      data: { subscriber }
    });
  } catch (error: any) {
    console.error("Update subscriber status error:", error);
    next(errorHandler(500, "Server error while updating subscriber status"));
  }
};

export const deleteSubscriber = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { subscriberId } = req.params;
    const subscriber = await Newsletter.findById(subscriberId);

    if (!subscriber) {
      return next(errorHandler(404, "Subscriber not found"));
    }

    await Newsletter.findByIdAndDelete(subscriberId);

    res.status(200).json({
      success: true,
      message: "Subscriber deleted successfully"
    });
  } catch (error: any) {
    console.error("Delete subscriber error:", error);
    next(errorHandler(500, "Server error while deleting subscriber"));
  }
};

export const sendNewsletter = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { subject, message, status = "SUBSCRIBED" } = req.body;

    const trimmedSubject = typeof subject === "string" ? subject.trim() : "";
    const trimmedMessage = typeof message === "string" ? message.trim() : "";

    if (!trimmedSubject || !trimmedMessage) {
      return next(errorHandler(400, "Subject and message are required"));
    }

    const subscribers = await Newsletter.find({ status });
    
    if (subscribers.length === 0) {
      return next(errorHandler(400, "No subscribers found with the specified status"));
    }

    // Send emails (in production, consider using a queue system)
    const emailPromises = subscribers.map(subscriber => 
      sendGenericEmail(subscriber.email, trimmedSubject, trimmedMessage)
        .catch(err => {
          console.error(`Failed to send email to ${subscriber.email}:`, err);
          // Optionally mark as BOUNCED
          return null;
        })
    );

    await Promise.allSettled(emailPromises);

    res.status(200).json({
      success: true,
      message: `Newsletter sent to ${subscribers.length} subscribers`,
      data: { sentCount: subscribers.length }
    });
  } catch (error: any) {
    console.error("Send newsletter error:", error);
    next(errorHandler(500, "Server error while sending newsletter"));
  }
};

export const getSubscriptionStats = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const total = await Newsletter.countDocuments();
    const subscribed = await Newsletter.countDocuments({ status: "SUBSCRIBED" });
    const unsubscribed = await Newsletter.countDocuments({ status: "UNSUBSCRIBED" });
    const bounced = await Newsletter.countDocuments({ status: "BOUNCED" });

    // Recent subscriptions (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentSubscriptions = await Newsletter.countDocuments({
      status: "SUBSCRIBED",
      subscribedAt: { $gte: thirtyDaysAgo }
    });

    res.status(200).json({
      success: true,
      data: {
        total,
        subscribed,
        unsubscribed,
        bounced,
        recentSubscriptions
      }
    });
  } catch (error: any) {
    console.error("Get subscription stats error:", error);
    next(errorHandler(500, "Server error while fetching subscription stats"));
  }
};
