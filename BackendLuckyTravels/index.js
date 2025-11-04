require("dotenv").config();
const express = require("express");
const webapp = express();
const path = require("path");
const { Pool } = require("pg");  // ✅ PostgreSQL instead of MySQL
const nodemailer = require("nodemailer");

const PORT = process.env.PORT || 3003;

// ------------------ EXPRESS CONFIG ------------------
webapp.use(express.urlencoded({ extended: true }));
webapp.set("view engine", "ejs");
webapp.set("views", path.join(__dirname, "views"));
webapp.use(express.static(path.join(__dirname, "Public")));

// ------------------ NODEMAILER CONFIG ------------------
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER, // ✅ Loaded from .env
    pass: process.env.EMAIL_PASS  // ✅ Loaded from .env
  }
});

const sendBookingNotification = (bookingData) => {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: "owner@luckytravels.com", // ⚠️ Replace with the real destination email
    subject: `[NEW BOOKING] Enquiry from ${bookingData.name} (ID: ${bookingData.bookingId})`,
    html: `
      <h1>New Booking Enquiry Received!</h1>
      <p><strong>Booking ID:</strong> ${bookingData.bookingId}</p>
      <p><strong>User Name:</strong> ${bookingData.name}</p>
      <p><strong>Email:</strong> ${bookingData.email}</p>
      <p><strong>Phone:</strong> ${bookingData.phone}</p>
      <hr>
      <p><strong>Arrival Date:</strong> ${bookingData.arrivaldate}</p>
      <p><strong>Departure Date:</strong> ${bookingData.departuredate}</p>
      <p><strong>Stays:</strong> ${bookingData.stays} days</p>
      <p><strong>Requirements:</strong> ${bookingData.requirements}</p>
    `
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) console.error("Nodemailer Error:", error);
    else console.log("Email sent: " + info.response);
  });
};

// ------------------ POSTGRESQL CONNECTION ------------------
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

(async () => {
  try {
    const result = await pool.query("SELECT NOW()");
    console.log("✅ Connected to PostgreSQL:", result.rows[0].now);
  } catch (err) {
    console.error("❌ Database connection error:", err);
  }
})();

// ------------------ GLOBAL SETTINGS ------------------
const UPI_ID = "yourvpa@oksbi"; // ⚠️ Replace with your actual UPI VPA

// ------------------ BOOKING SUBMISSION ------------------
webapp.post("/submitBooking", async (req, res) => {
  const { name, email, phone, stays, requirements, arrivaldate, departuredate } = req.body;

  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  if (!datePattern.test(arrivaldate) || !datePattern.test(departuredate)) {
    return res.status(400).send("<h1>Error: Invalid date format detected. Please use YYYY-MM-DD.</h1>");
  }

  try {
    const sql = `
      INSERT INTO bookingdetail (name, email, phone, stays, requirements, arrivaldate, departuredate)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id;
    `;
    const result = await pool.query(sql, [name, email, phone, stays, requirements, arrivaldate, departuredate]);
    const bookingId = result.rows[0].id;

    const bookingData = { bookingId, name, email, phone, stays, requirements, arrivaldate, departuredate };
    sendBookingNotification(bookingData);

    res.render("booking_confirmed", { bookingId: bookingId, upiId: UPI_ID });
  } catch (err) {
    console.error("Error inserting booking:", err);
    res.status(500).send("<h1>Error submitting booking enquiry. Please try again.</h1>");
  }
});

// ------------------ PAYMENT LINK GENERATOR ------------------
webapp.get("/generatePaymentLink", (req, res) => {
  const { packageType } = req.query;
  let amount = 0;

  switch (packageType) {
    case "honeymoon":
      amount = 35000;
      break;
    case "family":
      amount = 25000;
      break;
    case "group":
      amount = 10000;
      break;
    default:
      amount = 5000;
      break;
  }

  res.render("payment_qr", { amount });
});

// ------------------ STATIC ROUTES ------------------
webapp.get("/Home", (req, res) => res.render("Home"));
webapp.get("/GeneralInformation", (req, res) => res.render("GeneralInformation"));
webapp.get("/Placeofintrest", (req, res) => res.render("Placeofintrest"));
webapp.get("/HowtoReach", (req, res) => res.render("HowtoReach"));
webapp.get("/Andamanpackage", (req, res) => res.render("Andamanpackage"));
webapp.get("/Traveltools", (req, res) => res.render("Traveltools"));
webapp.get("/clicktobook", (req, res) => res.render("clicktobook"));
webapp.get("/groupclick", (req, res) => res.render("groupclick"));

// ------------------ BOOKINGS LIST ------------------
webapp.get("/bookings", async (req, res) => {
  try {
    const sql = "SELECT * FROM bookingdetail ORDER BY id DESC";
    const result = await pool.query(sql);
    res.render("bookings", { bookings: result.rows });
  } catch (err) {
    console.error("Error fetching bookings:", err);
    res.status(500).send("Error fetching booking records.");
  }
});

// ------------------ SERVER START ------------------
webapp.listen(PORT, (err) => {
  if (err) console.log("Error running server:", err);
  else console.log(`🚀 Server is running at http://localhost:${PORT}/home`);
});
