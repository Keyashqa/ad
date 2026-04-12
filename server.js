const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const jwt = require("jsonwebtoken");
const cors = require("cors");
const fs = require("fs");

const app = express();
app.use(cors());
app.use(express.json());

const SECRET = "boss_secret";
const db = new sqlite3.Database("./users.db");

// Database Setup: Users and Order History
db.serialize(() => {
    db.run("CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, user TEXT UNIQUE, pass TEXT)");
    db.run("CREATE TABLE IF NOT EXISTS orders (id INTEGER PRIMARY KEY, user TEXT, item_name TEXT, price INTEGER, date TEXT)");
});

app.get("/items", (req, res) => {
    res.json(JSON.parse(fs.readFileSync("./items.json")));
});

// Fetch order history for a specific user
app.get("/history/:user", (req, res) => {
    db.all("SELECT * FROM orders WHERE user = ? ORDER BY id DESC", [req.params.user], (err, rows) => {
        res.json(rows || []);
    });
});

app.post("/signup", (req, res) => {
    const { user, pass } = req.body;
    db.run("INSERT INTO users (user, pass) VALUES (?, ?)", [user, pass], (err) => {
        err ? res.status(400).send("Fail") : res.status(201).send("OK");
    });
});

app.post("/login", (req, res) => {
    const { user, pass } = req.body;
    db.get("SELECT * FROM users WHERE user = ? AND pass = ?", [user, pass], (err, row) => {
        if (row) {
            const token = jwt.sign({ user }, SECRET, { expiresIn: "1h" });
            res.json({ token, user });
        } else res.status(401).send("Fail");
    });
});

app.post("/checkout", (req, res) => {
    const { cart, user } = req.body;
    let inventory = JSON.parse(fs.readFileSync("./items.json"));
    let summary = [];
    const date = new Date().toLocaleString();

    cart.forEach(cartItem => {
        const item = inventory.find(i => i.id === cartItem.id);
        if (item && item.qty > 0) {
            item.qty -= 1;
            summary.push({ Item: item.name, Status: "Purchased", Price: item.price });
            // Save to SQLite Order History
            db.run("INSERT INTO orders (user, item_name, price, date) VALUES (?, ?, ?, ?)", [user, item.name, item.price, date]);
        }
    });

    fs.writeFileSync("./items.json", JSON.stringify(inventory, null, 2));
    console.log(`\n--- ORDER FOR ${user} ---`);
    console.table(summary);
    res.json({ inventory });
});

app.listen(3000, () => console.log("Server active at 3000"));