const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");
const mongoose = require("mongoose");
const multer = require("multer");
const { v4: uuidv4 } = require("uuid");

const feedRoutes = require("./routes/feed");
const authRoutes = require("./routes/auth");

const app = express();

app.use(bodyParser.json());

app.use("/images", express.static(path.join(__dirname, "images")));

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "images");
  },
  filename: function (req, file, cb) {
    cb(null, uuidv4() + "-" + file.originalname);
  },
});

const fileFilter = (req, file, cb) => {
  if (
    file.mimetype === "image/png" ||
    file.mimetype === "image/jpg" ||
    file.mimetype === "image/jpeg"
  ) {
    cb(null, true);
  } else {
    cb(null, false);
  }
};

app.use(multer({ storage: storage, fileFilter: fileFilter }).single("image"));

// CORS middleware
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, PATCH, DELETE"
  );
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  next();
});

app.use("/feed", feedRoutes);
app.use("/auth", authRoutes);

// This middleware will be executed when an error is thrown or forwarded with next
app.use((error, req, res, next) => {
  console.log(error);
  const status = error.statusCode || 500;
  const message = error.message;
  const data = error.data;
  res.status(status).json({ message: message, data: data }); // data in auth controller
});

mongoose
  .connect("mongodb://localhost:27017")
  .then((result) => {
    const server = app.listen(8080); // listen method returns us a new node server. This server uses http
    const io = require("./socket").init(server); // set up socket.io, we used that http server to establish our web socket connection

    // Connect with client
    io.on("connection", (socket) => {
      console.log("Client connected !!!");
    });
  })
  .catch((err) => console.log(err));
