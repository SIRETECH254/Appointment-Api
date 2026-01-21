
import express from "express";
import "dotenv/config";

const app = express();
const port = process.env.PORT || 4500;

app.use(express.json());

app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

app.listen(port, () => {
  console.log(`Appointment API listening on port ${port}`);
});
