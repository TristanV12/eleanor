var express          = require('express'),
	https            = require("https"),
	easyrtc          = require("easyrtc"),
	serveStatic      = require('serve-static'),
	socketIo         = require("socket.io"),
	fs               = require("fs"),
    path             = require("path"),
    bodyParser       = require('body-parser'),
    mongoose         = require('mongoose'),
    User             = require('./userAuth');

mongoose.connect('mongodb://localhost/eleanor');

// Set process name
process.title = "Eleanor Rigby";

// Setup and configure Express http server. Expect a subfolder called "static" to be the web root.
var httpApp = express();
httpApp.use(serveStatic('static', {'index': ['index.html'], 'chat': ['video.html']}));

httpApp.use(bodyParser.json()); // support json encoded bodies
httpApp.use(bodyParser.urlencoded({ extended: true })); // support encoded bodies

// Start Express https server on port 8443
var webServer = https.createServer(
{
    key:  fs.readFileSync("./SSL/34098713-www.example.com.key"),
    cert: fs.readFileSync("./SSL/34098713-www.example.com.crt")
},
httpApp).listen(8080);

// Start Socket.io so it attaches itself to Express server
var socketServer = socketIo.listen(webServer, {"log level":1});

//easyrtc.setOption("logLevel", "debug");

httpApp.post('/chat', function(req, res){
    User.findOne({ username: req.body.usr }, function(err, user) {
        if (err){
            res.redirect('/');
        }

        user.comparePassword(req.body.password, function(err, isMatch) {
            if (err) throw err;
            console.log('Password123:', isMatch); // -&gt; Password123: true
        });
    });
    console.log(req.body.usr);
    console.log(req.body.gender);
    console.log(req.body.seeking);
    console.log(req.body.seeking.length);
    res.sendFile(path.join(__dirname + '/static/video.html'));
});

httpApp.get('/chat', function(req, res){
    res.redirect('/');
});

// Overriding the default easyrtcAuth listener, only so we can directly access its callback
easyrtc.events.on("easyrtcAuth", function(socket, easyrtcid, msg, socketCallback, callback) {
    easyrtc.events.defaultListeners.easyrtcAuth(socket, easyrtcid, msg, socketCallback, function(err, connectionObj){
        if (err || !msg.msgData || !msg.msgData.credential || !connectionObj) {
            callback(err, connectionObj);
            return;
        }

        connectionObj.setField("credential", msg.msgData.credential, {"isShared":false});

        console.log("["+easyrtcid+"] Credential saved!", connectionObj.getFieldValueSync("credential"));

        callback(err, connectionObj);
    });
});

// To test, let's print the credential to the console for every room join!
easyrtc.events.on("roomJoin", function(connectionObj, roomName, roomParameter, callback) {
    console.log("["+connectionObj.getEasyrtcid()+"] Credential retrieved!", connectionObj.getFieldValueSync("credential"));
    easyrtc.events.defaultListeners.roomJoin(connectionObj, roomName, roomParameter, callback);
});

// Start EasyRTC server
var rtc = easyrtc.listen(httpApp, socketServer, null, function(err, rtcRef) {
    console.log("Initiated");

    rtcRef.events.on("roomCreate", function(appObj, creatorConnectionObj, roomName, roomOptions, callback) {
        console.log("roomCreate fired! Trying to create: " + roomName);

        appObj.events.defaultListeners.roomCreate(appObj, creatorConnectionObj, roomName, roomOptions, callback);
    });
});