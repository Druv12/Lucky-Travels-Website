const express = require("express");
const webapp = express();
const path = require("path");
const mysql = require("mysql2"); 
const nodemailer = require("nodemailer"); 
let port = 3003;

webapp.use(express.urlencoded({extended: true})); 
webapp.set("view engine", "ejs");
webapp.set("views",path.join(__dirname,"views"));
webapp.use(express.static(path.join(__dirname, 'Public')));

// --- NODEMAILER CONFIGURATION ---
// You will need to replace the placeholders below with actual sender credentials.
// For Gmail, you must use an App Password, not your regular password.
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'your_email@gmail.com', // ⚠️ REPLACE WITH SENDER EMAIL
        pass: 'your_app_password'     // ⚠️ REPLACE WITH APP PASSWORD
    }
});

// Function to send the email
const sendBookingNotification = (bookingData) => {
    const mailOptions = {
        from: 'your_email@gmail.com', // Must match the user above
        to: 'owner@luckytravels.com', // ⚠️ REPLACE WITH OWNER'S RECEIVING EMAIL
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
        if (error) {
            console.error('Nodemailer Error:', error);
        } else {
            console.log('Email sent: ' + info.response);
        }
    });
};
// ---------------------------------

// FIX: Correct connection to 'luckytravels' database
const connection = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'onlinecourse@2023',
    database: 'luckytravels' // Correct Database Name
});

connection.connect((err) => {
    if (err) {
        console.error('Error connecting to the database:', err);
        return;
    }
    console.log('Connected to the MySQL database.');
});

// Define UPI ID globally for use in confirmation page rendering and payment link generation
// ⚠️ IMPORTANT: I am using 'yourvpa@oksbi' from the image, but you MUST replace this with your ACTUAL UPI VPA
const UPI_ID = 'yourvpa@oksbi'; 

// Route to handle booking submission 
webapp.post("/submitBooking", (req, res) => {
    const { name, email, phone, stays, requirements, arrivaldate, departuredate } = req.body;
    
    // Server-side date validation check to prevent MySQL errors
    const datePattern = /^\d{4}-\d{2}-\d{2}$/;
    if (!datePattern.test(arrivaldate) || !datePattern.test(departuredate)) {
        return res.status(400).send("<h1>Error: Invalid date format detected. Please use YYYY-MM-DD.</h1>");
    }

    // FIX: Using the correct table name 'bookingdetail' as per schema
    const sql = 'INSERT INTO bookingdetail (name, email, phone, stays, requirements, arrivaldate, departuredate) VALUES (?, ?, ?, ?, ?, ?, ?)';
    
    connection.query(sql, [name, email, phone, stays, requirements, arrivaldate, departuredate], (err, results) => {
        if (err) {
            console.error('Error inserting booking:', err);
            // Check for specific date format error and provide a better message
            if (err.code === 'ER_TRUNCATED_WRONG_VALUE') {
                return res.status(500).send(`<h1>Database Error: Incorrect date format detected. Please check your dates and ensure the year is 4 digits.</h1><p>SQL Error: ${err.sqlMessage}</p>`);
            }
            return res.status(500).send("<h1>Error submitting booking enquiry. Please try again.</h1>");
        }
        
        const bookingId = results.insertId;

        // --- AUTOMATIC EMAIL NOTIFICATION ---
        const bookingData = { 
            bookingId, name, email, phone, stays, requirements, arrivaldate, departuredate 
        };
        sendBookingNotification(bookingData);
        // ------------------------------------

        // Send the user to the new confirmation page, passing the booking ID and UPI ID
        res.render('booking_confirmed', { 
            bookingId: bookingId,
            upiId: UPI_ID // Pass the UPI ID to the EJS template
        });
    });
});

// =========================================================================
// ROUTE: GENERATE DYNAMIC UPI PAYMENT LINK
// This route calculates the amount and redirects to the QR code page.
webapp.get("/generatePaymentLink", (req, res) => {
    const { packageType } = req.query; // Removed bookingId as it's not needed for initial package link
    
    let amount = 0;

    // --- Price Logic (Update these amounts) ---
    switch (packageType) {
        case 'honeymoon':
            amount = 35000; // Honeymoon Package Price
            break;
        case 'family':
            amount = 25000; // Family Package Price
            break;
        case 'group':
            amount = 10000; // Group Package Price (Deposit or full price, adjust as needed)
            break;
        default:
            amount = 5000; // Default deposit amount
            break;
    }
    // -----------------------------------------------------------------

    // ✅ SOLUTION: Instead of redirecting to the UPI deep link (which fails on desktop),
    // we now render the QR code view, passing the required payment amount.
    res.render('payment_qr', { 
        amount: amount 
    });
});
// =========================================================================


// Existing GET routes...
webapp.get("/home",(req, res)=>{
    console.log("Home Page");
    res.render("Home");
});

webapp.get('/GeneralInformation', (req, res) => {
    console.log("Genral Information page");
    res.render("GeneralInformation"); 
});

webapp.get("/Placeofintrest",(req, res)=>{
    console.log("Place of intrest page");
    res.render("Placeofintrest")
});

webapp.get("/HowtoReach",(req, res)=>{
    console.log("How to reach page");
    res.render("HowtoReach");
});

webapp.get("/Andamanpackage",(req, res)=>{
    console.log("Tour Package Page");
    res.render("Andamanpackage");
});

webapp.get("/Traveltools",(req, res)=>{
    console.log("Traveltools page");
    res.render("Traveltools");
});

webapp.get("/clicktobook",(req, res)=>{
    console.log("Click to book page");
    res.render("clicktobook");
});

webapp.get("/groupclick",(req, res)=>{
    console.log("Group click page");
    res.render("groupclick");
});

webapp.get('/bookings', (req, res) => {
    const sql = 'SELECT * FROM bookingdetail ORDER BY id DESC'; // Fetching from the correct table
    connection.query(sql, (err, results) => {
        if (err) {
            console.error('Error fetching bookings:', err);
            return res.status(500).send('Error fetching booking records.');
        }
        // Renders bookings.ejs and passes the data
        res.render('bookings', { bookings: results });
    });
});

webapp.listen(port, (err) => {
    if (err) {
        console.log("Error running server:", err);
    } else {
        console.log(`Server is running at http://localhost:${port}/Home`);
    }
});
