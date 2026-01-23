import jwt from "jsonwebtoken";
import type { IUser } from "../types/index";

const OTP_LENGTH = 6;

export const generateOTP = (): string => {
  const digits = "0123456789";
  let otp = "";
  for (let i = 0; i < OTP_LENGTH; i += 1) {
    otp += digits[Math.floor(Math.random() * digits.length)];
  }
  return otp;
};

export const generateTokens = (user: IUser): { accessToken: string; refreshToken: string } => {
  const roleIds = Array.isArray(user.roles)
    ? user.roles.map((role: any) => (role?._id ? role._id.toString() : role.toString()))
    : [];

  const payload = {
    userId: user._id.toString(),
    roleIds,
    userType: "user"
  };

  const accessExpiresIn = (process.env.JWT_EXPIRES_IN || "15m") as jwt.SignOptions["expiresIn"];
  const refreshExpiresIn = (process.env.JWT_REFRESH_EXPIRES_IN || "7d") as jwt.SignOptions["expiresIn"];
  const jwtSecret = process.env.JWT_SECRET as string;
  const refreshSecret = (process.env.JWT_REFRESH_SECRET || jwtSecret) as string;

  const accessOptions = { expiresIn: accessExpiresIn } as jwt.SignOptions;
  const refreshOptions = { expiresIn: refreshExpiresIn } as jwt.SignOptions;

  const accessToken = jwt.sign(payload, jwtSecret, accessOptions);
  const refreshToken = jwt.sign(payload, refreshSecret, refreshOptions);

  return { accessToken, refreshToken };
};
