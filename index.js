const tracer = require('dd-trace').init()

if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

// Import express
const express = require("express");
// Import Body parser
const bodyParser = require("body-parser");
// Import Mongoose
const mongoose = require("mongoose");
//
// Initialise the app
const app = express();

// Import routes
const webhook = require("./routes/webhook");

const verifyWebhook = require("./routes/verify-webhook");
const customer = require("./routes/customer");
const delivery = require("./routes/delivery");
const pickup = require("./routes/pickup");
const receipt = require("./routes/receipt");
const inventory = require("./routes/inventory");



// CORs
const cors = require('cors')

app.use(cors());

app.use(function (req, res, next) {

  next();
});
// Configure bodyparser to handle post requests
app.use(
  bodyParser.urlencoded({
    extended: true
  })
);
app.use(bodyParser.json());
app.use(express.static('public'));
// Connect to Mongoose and set connection variable
mongoose.connect(
  process.env.MONGOOSE_CONNECT, {
    useNewUrlParser: true
  }
);
var db = mongoose.connection;

// Added check for DB connection
if (!db) console.log("Error connecting db");
else console.log("Db connected successfully");

// Setup server port
var port = process.env.PORT || 3003;

// Send message for default URL
app.get("/", (req, res) =>
  res.send("Supermarket API- Routes are /api/{routename}")
);
app.use(express.json());

// Use Api routes in the App
app.use(webhook);
app.use(customer);
//app.use(products);
app.use(delivery);
app.use(pickup);
app.use(receipt);
app.use(inventory);



app.use(verifyWebhook);

// Launch app to listen to specified port
app.listen(port, function () {
  console.log("Running  on port " + port);
});