const express = require("express");
const app = express();
const port = 3000;
const path = require("path");
const methodOverride = require('method-override');
const mysql = require('mysql2');
const session = require('express-session');

const connection = mysql.createConnection({
    host: '127.0.0.1', // Force use of IPv4
    user: 'root',
    database: 'CozyStay',
    password: 'pass5678'
});

app.use(express.urlencoded({ extended: true }));
app.use(methodOverride('_method'));
app.use(session({
    secret: 'secret_key',
    resave: false,
    saveUninitialized: true
}));
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.static(path.join(__dirname, "public")));

// Middleware to check if user is logged in
const isLoggedIn = (req, res, next) => {
    if (req.session.loggedIn) {
        next();
    } else {
        res.redirect('/');
    }
};

// Home Page
app.get("/", (req, res) => {
    const successMessage = req.session.successMessage;
    delete req.session.successMessage;
    res.render("index", { successMessage });
});



// Register Page
app.get("/register", (req, res) => {
    res.render("register", { error: null });
});

// Handle Registration
app.post('/register', (req, res) => {
    const { userName, firstName, lastName, email, phoneNumber, address, dob, password } = req.body;

    // Check if username already exists
    const checkUsernameSql = 'SELECT * FROM Guests WHERE username = ?';
    connection.query(checkUsernameSql, [userName], (err, results) => {
        if (err) throw err;

        if (results.length > 0) {
            // Username already exists
            res.render('register', { error: 'Username already registered.' });
        } else {
            // Check if email already exists
            const checkEmailSql = 'SELECT * FROM Guests WHERE Email = ?';
            connection.query(checkEmailSql, [email], (err, results) => {
                if (err) throw err;

                if (results.length > 0) {
                    // Email already exists
                    res.render('register', { error: 'Email already registered.' });
                } else {
                    // Check if phone number already exists
                    const checkPhoneSql = 'SELECT * FROM Guests WHERE Phone_no = ?';
                    connection.query(checkPhoneSql, [phoneNumber], (err, results) => {
                        if (err) throw err;

                        if (results.length > 0) {
                            // Phone number already exists
                            res.render('register', { error: 'Phone number already registered.' });
                        } else {
                            // Insert the new guest record
                            const insertSql = 'INSERT INTO Guests (username, First_name, Last_name, Email, Phone_no, Address, DOB, password) VALUES (?, ?, ?, ?, ?, ?, ?, ?)';
                            connection.query(insertSql, [userName, firstName, lastName, email, phoneNumber, address, dob, password], (err, result) => {
                                if (err) throw err;
                                console.log('Guest registered');
                                req.session.successMessage = 'Registration successful. Please log in.';
                                res.redirect('/');
                            });
                        }
                    });
                }
            });
        }
    });
});



// Handle Login
app.post('/login', (req, res) => {
    const { username, password } = req.body;

    const checkLoginSql = 'SELECT * FROM Guests WHERE username = ? AND password = ?';
    connection.query(checkLoginSql, [username, password], (err, results) => {
        if (err) throw err;

        if (results.length > 0) {
            // Login successful, set session
            req.session.loggedIn = true;
            req.session.username = username; // Store username in session
            res.redirect('/dashboard');
        } else {
            // Login failed
            res.send('Invalid username or password');
        }
    });
});

// Dashboard Page (after login)
app.get('/dashboard', isLoggedIn, (req, res) => {
    const username = req.session.username;
    const today = new Date().toISOString().slice(0, 10);
    const nextDay = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

    res.render('dashboard', { username, today, nextDay });
});



// Rooms Page
app.get('/dashboard/rooms', isLoggedIn, (req, res) => {
    const today = new Date().toISOString().slice(0, 10);
    const nextDay = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

    connection.query('SELECT * FROM Rooms', (err, results) => {
        if (err) throw err;
        res.render('rooms', { rooms: results, today, nextDay });
    });
});

// Book a Room Page
app.get('/dashboard/book_room', isLoggedIn, (req, res) => {
    const today = new Date().toISOString().slice(0, 10);
    const nextDay = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

    res.render('book_room', { error: null, today, nextDay });
});

// Handle Room Booking
app.post('/dashboard/book_room', isLoggedIn, (req, res) => {
    const { room_id, check_in_date, check_out_date, amount, payment_method } = req.body;
    const guest_username = req.session.username;

    // Insert into Bookings table
    const insertBookingSql = 'INSERT INTO Bookings (Guest_username, Room_id, Check_in_date, Check_out_date, Amount, Payment_status) VALUES (?, ?, ?, ?, ?, ?)';
    connection.query(insertBookingSql, [guest_username, room_id, check_in_date, check_out_date, amount, 'Pending'], (err, result) => {
        if (err) {
            res.render('book_room', { error: 'Error booking the room. Please try again.', today: check_in_date, nextDay: check_out_date });
        } else {
            const booking_id = result.insertId;

            // Insert into Payments table
            const insertPaymentSql = 'INSERT INTO Payments (Booking_id, Amount, Payment_method) VALUES (?, ?, ?)';
            connection.query(insertPaymentSql, [booking_id, amount, payment_method], (err, result) => {
                if (err) {
                    res.render('book_room', { error: 'Error processing payment. Please try again.', today: check_in_date, nextDay: check_out_date });
                } else {
                    console.log('Booking and Payment successful');
                    res.redirect('/dashboard');  // Redirect to dashboard after successful booking
                }
            });
        }
    });
});



// My Bookings Page
app.get('/dashboard/bookings', isLoggedIn, (req, res) => {
    const username = req.session.username;
    const fetchBookingsSql = 'SELECT * FROM Bookings WHERE Guest_username = ?';
    connection.query(fetchBookingsSql, [username], (err, results) => {
        if (err) throw err;
        res.render('bookings', { bookings: results });
    });
});

// My Payments Page
app.get('/dashboard/payments', isLoggedIn, (req, res) => {
    const username = req.session.username;
    const fetchPaymentsSql = 'SELECT Payments.*, Bookings.Guest_username FROM Payments INNER JOIN Bookings ON Payments.Booking_id = Bookings.Booking_id WHERE Bookings.Guest_username = ?';
    connection.query(fetchPaymentsSql, [username], (err, results) => {
        if (err) throw err;
        res.render('payments', { payments: results });
    });
});

// Logout
app.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) throw err;
        res.redirect('/');
    });
});



app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
