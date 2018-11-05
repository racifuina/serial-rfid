const HTTP_PORT = 8080;
let SERIAL_PORT = '';
const opn = require('opn');
const SerialPort = require("serialport");
const express = require("express");
const app = express();
const http = require("http").Server(app);
const io = require("socket.io")(http);
const moment = require('moment-timezone');
const fs = require('fs');
const ejs = require('ejs');
const bodyParser = require('body-parser');
const mongoose = require("mongoose");

const Student = require("./models/Student");
const Record = require("./models/Record");


mongoose.connect("mongodb://localhost:27017/rfid", {
    autoReconnect: true,
    useNewUrlParser: true,
    useCreateIndex: true
});

mongoose.connection.once('open', function () {
    console.log(" - Connected to MongoDB :) ");
});

mongoose.connection.once('error', function (e) {
    console.log(" - DB Error: " + e);
    mongoose.disconnect();
});

mongoose.connection.on('reconnected', function () {
    console.log('MongoDB reconnected!');
});

mongoose.connection.on('disconnected', function () {
    console.log('MongoDB disconnected!');
});

app.use(express.static('public'));
app.set('views', __dirname + '/views/');
app.engine('html', ejs.renderFile);
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({
    extended: true,
}));

let port;
let jsonData = "";

function portOnOpen() {
    console.log("open Serial Port")
}

function portOnClose() {
    console.log("closed Serial Port");
    port = undefined;
    SERIAL_PORT = "";
    io.emit("serialDisconnected")
}

function portOnError(error) {
    console.log("error Serial Port", error);
    port = undefined;
}

function portOnData(data) {
    jsonData += data.toString();
    if (data.toString().includes("\n")) {

        let parsed = JSON.parse(jsonData.trim());
        console.log(parsed);
        Student.findOne({
            card: parsed.card
        }).then(student => {
            if (student) {
                new Record({
                    card: parsed.card,
                    class: parsed.class,
                    firstName: student.firstName,
                    lastName: student.lastName,
                }).save().then(record => {

                    let initial = student.firstName.charAt(0);
                    let lastName = student.lastName;
                    let message = "1" +  initial + ". " + lastName;
                    port.write(message);
                }, err => {
                    console.log(err)
                    port.write("0Fallo Servidor");
                })
            } else {
                port.write("0No Encontrado");
            }
        });

        jsonData = "";
    }
}

io.on("connection", socket => {
    socket.on('connectSerial', (data, result) => {
        jsonData = "";
        SERIAL_PORT = "";
        if (port) {
            try {
                port.close();
            } catch (e) {
                console.log(e)
            }
        }
        port = new SerialPort(data.port, function (err) {
            if (err) {

                result({
                    error: err.message
                });

            } else {

                SERIAL_PORT = data.port;

                io.emit("serialConnected", {
                    port: SERIAL_PORT
                });

                port.on('data', portOnData);
                port.on('open', portOnOpen);
                port.on('close', portOnClose);
                port.on('error', portOnError);

                result({
                    error: false
                });
            }
        });
    });

    socket.on('getStudents', result => {

        Student.find().sort({
            card: 1
        }).then(students => {
            result(students);
        }, err => {
            result({
                error: true,
            });
        });

    });

    socket.on('getRecords', result => {

        Record.find().sort({
            createdAt: 1
        }).then(records => {
            result(records);
        }, err => {
            result({
                error: true,
            });
        });

    });

    socket.on('newStudent', (data, result) => {
        new Student(data).save().then(student => {
            result({
                error: false,
                student: student
            });
        }, err => {
            result({
                error: true,
            });
        });
    });

    socket.on('deleteStudent', (student, result) => {
        Student.findOneAndDelete({
            _id: student
        }).then(student => {
            return student.remove()
        }).then(deleted => {
            result({
                error: false,
            });
        }, err => {
            result({
                error: true,
            });
        });
    });

});

app.get('/', (req, res) => {
    SerialPort.list((err, ports) => {
        res.render(__dirname + '/views/home.html', {
            serialPort: SERIAL_PORT,
            ports: ports
        });
    });
});

app.get('/estudiantes', (req, res) => {
    res.render(__dirname + '/views/estudiantes.html', {});
});

app.get('/asistencia', (req, res) => {
    res.render(__dirname + '/views/asistencia.html', {});
});

http.listen(HTTP_PORT, function () {
    console.log(" - Web Server Started :)");
});

process.on("uncaughtException", function (err) {
    console.log("uncaughtException", err);
});

process.on('unhandledRejection', function (err) {
    console.log("unhandledRejection", err);
});
