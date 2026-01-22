import mongoose from "mongoose";
import "dotenv/config";
import Role from "../models/Role";

const roles = [
  {
    name: "customer",
    displayName: "Customer",
    description: "Default role for customers",
    permissions: ["view_own_profile", "update_own_profile", "view_own_appointments"],
    isSystemRole: true
  },
  {
    name: "admin",
    displayName: "Admin",
    description: "Full system access for administrators",
    permissions: ["*"],
    isSystemRole: true
  },
  {
    name: "staff",
    displayName: "Staff",
    description: "Staff access for managing appointments and customers",
    permissions: ["view_customers", "manage_appointments", "view_services"],
    isSystemRole: true
  }
];

const seedRoles = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI as string);

    for (const role of roles) {
      await Role.findOneAndUpdate(
        { name: role.name },
        {
          $set: {
            displayName: role.displayName,
            description: role.description,
            permissions: role.permissions,
            isSystemRole: role.isSystemRole,
            isActive: true
          }
        },
        { upsert: true, new: true }
      );
    }

    console.log("Roles seeded successfully");
  } catch (error) {
    console.error("Error seeding roles:", error);
  } finally {
    await mongoose.disconnect();
  }
};

seedRoles();
