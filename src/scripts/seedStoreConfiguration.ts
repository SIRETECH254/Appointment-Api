import mongoose from "mongoose";
import "dotenv/config";
import StoreConfiguration from "../models/StoreConfiguration";

const defaultStoreConfiguration = {
  appointmentFeeType: "FIXED",
  appointmentFeeValue: 200,
  currency: "KES",
  minBookingNotice: 60,
  lateGracePeriod: 10,
  allowWalkIns: true,
  notificationSettings: {
    sendSMS: true,
    sendEmail: true,
    sendPush: false,
    reminderTimes: [1440, 120, 30]
  },
  businessHoursTimezone: "Africa/Nairobi"
};

const seedStoreConfiguration = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI as string);

    await StoreConfiguration.findOneAndUpdate(
      {},
      { $set: defaultStoreConfiguration },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    console.log("Store configuration seeded successfully");
  } catch (error) {
    console.error("Error seeding store configuration:", error);
  } finally {
    await mongoose.disconnect();
  }
};

seedStoreConfiguration();
