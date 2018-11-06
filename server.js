const HTTP_PORT = 8080; //PUERTO para conexiones HTTP
let SERIAL_PORT = ''; //Nombre del puerto serial que se está usando
const SerialPort = require("serialport"); //Librería encargada de la comunicación por puerto Serial
const express = require("express"); //Librería para manejar el servidor web
const app = express(); //inicialización del servidor web
const http = require("http").Server(app); //incialización del servicio http con el servidor web
const io = require("socket.io")(http); //incialización del servicio de WebSocket(comunicación en tiempo real cliente-servidor)
const moment = require('moment-timezone'); //librería para manejar fechas y horas con zona horaria
const fs = require('fs'); //file system Libreria para el uso de sistema de directorios.
const ejs = require('ejs'); //librería para usar renderizar los templates http
const mongoose = require("mongoose"); //libreria/driver para comunicarse con mongodb

const Student = require("./models/Student"); //Inicialización y referencia de la colección de Estudiantes
const Record = require("./models/Record"); //Inicialización y referencia de la colección de Registros de asistencia
const Class = require("./models/Class"); //Inicialización y referencia de la colección de cursos

mongoose.connect("mongodb://localhost:27017/rfid", { //Conexión con Base de datos de mongo db corriendo en el puerto 27017
    autoReconnect: true,
    useNewUrlParser: true,
    useCreateIndex: true
});

mongoose.connection.once('open', function () { //evento que se ejecuta al abrir la conexión con base de datos
    console.log(" - Connected to MongoDB :) ");
});

mongoose.connection.once('error', function (e) { //evento que se ejecuta cuando ocurre un error
    console.log(" - DB Error: " + e);
    mongoose.disconnect();
});

mongoose.connection.on('reconnected', function () { //evento que se ejecuta cuando se reconecta a base de datos
    console.log('MongoDB reconnected!');
});

mongoose.connection.on('disconnected', function () { //evento que se ejecuta al desconectarse de la base de datos
    console.log('MongoDB disconnected!');
});

app.set('views', __dirname + '/views/'); //indicar que las vistas(views) están dentro de la carpeta "views"
app.engine('html', ejs.renderFile); //indica que se usarán plantillas html para el front end
app.set('view engine', 'ejs'); //usar la librería ejs para renderizar las vistas

let port; //variable donde se guardará la conexión serial activa
let jsonData = ""; //variable donde se guardarán los datos que vayan entrando por el puerto serial

function portOnOpen() { //evento que se ejecuta al conectarse al puerto serial del arduino
    console.log("open Serial Port")
}

function portOnClose() { //evento que se ejecuta al cerrarse el puerto serial del arduino
    console.log("closed Serial Port");
    port = undefined;
    SERIAL_PORT = "";
    io.emit("serialDisconnected") //envio del evento serialDisconnected a todos los clientes conectados por websocket
}

function portOnError(error) { //evento que se ejecuta al ocurrir un error en el puerto serial
    console.log("error Serial Port", error);
    port = undefined;
}

function portOnData(data) { //evento que se ejecuta al recibir datos por el puerto serial
    jsonData += data.toString(); //conversión del buffer de bytes recibidos a String(Texto)
    if (data.toString().includes("\n")) { //revisa si la cadena de datos recibida incluye un ENTER '/n'

        let parsed = JSON.parse(jsonData.trim()); //conversión de la cadena de datos a JSON
        console.log(parsed); //imprimir los datos JSON en la consola
        Student.findOne({ //buscar un Estudiante que tenga el numero de tarjeta recibido
            card: parsed.card
        }).then(student => {
            if (student) { //si se encuentra el estudiante
                let classStart = moment(new Date()).tz('America/Guatemala').format("HH:00"); //hora de inicio del curso
                Class.findOne({ //buscar un curso que inicie a la hora de inicio del curso (siempre a las en punto)
                    time: classStart
                }).then(course => {
                    if (course) { //si se encontró el curso
                        if (course.grade == student.grade) { //si el curso es del mismo ciclo que el ciclo del estudiante
                            new Record({ //guardar un nuevo registro de asistencia con la información de la tarjeta, el estudiante y el curso.
                                card: parsed.card,
                                class: course.name,
                                room: parsed.class,
                                firstName: student.firstName,
                                lastName: student.lastName,
                            }).save().then(record => { //al guardar el nuevo registro exitosamente se envía la respuesta '1' al arduino y la información del estudiante
                                let initial = student.firstName.charAt(0);
                                let lastName = student.lastName;
                                let message = "1" + initial + ". " + lastName;
                                port.write(message); //envío de datos al arduino
                            }, err => {
                                port.write("0Fallo Servidor"); //envíar mensaje de error por base de datos
                            });
                        } else { //envíar mensaje de error si el curso y el estudiante no son del mismo ciclo
                            console.log('no asignado')
                            port.write("0No Asignado");
                        }
                    } else { //envíar mensaje de error si no existe ningun curso a esa hora
                        port.write("0No hay curso");
                    }
                }, err => {
                    port.write("0Fallo Servidor"); //envíar mensaje de error por base de datos
                });
            } else {
                port.write("0No Encontrado"); //envíar mensaje de error si la tarjeta leída no pertenece a ningun estudiante
            }
        });

        jsonData = ""; //vaciar la cadena de datos para escanear una nueva tarjeta
    }
}

io.on("connection", socket => { //manejo de conexiones por web socket (cliente-servidor en tiempo real)

    socket.on('connectSerial', (data, result) => { //evento para conectar a un puerto serial, se recibe el nombre del puerto a conectar  y retorna si hubo exito o no.
        jsonData = ""; //vaciar la cadena de datos
        SERIAL_PORT = ""; //vaciar la cadena de datos
        if (port) { //si hay algún puerto conectado anteriormente, se desconecta de ese puerto antes de intentar conecarse a uno nuevo
            try {
                port.close();
            } catch (e) {
                console.log(e)
            }
        }
        port = new SerialPort(data.port, function (err) { //conexión al nuevo puerto con la información recibida
            if (err) { //si hay error retorna el mensaje de error recibido
                result({
                    error: err.message
                });
            } else {
                //sin errores,
                SERIAL_PORT = data.port;

                io.emit("serialConnected", { // envia la información de la nueva conexión por websocket
                    port: SERIAL_PORT
                });

                port.on('data', portOnData); //suscipción a los eventos de la nueva conexión de puerto serial
                port.on('open', portOnOpen); //suscipción a los eventos de la nueva conexión de puerto serial
                port.on('close', portOnClose); //suscipción a los eventos de la nueva conexión de puerto serial
                port.on('error', portOnError); //suscipción a los eventos de la nueva conexión de puerto serial

                result({ // retorna que no hubo error
                    error: false
                });
            }
        });

    });

    socket.on('getRecords', result => { //evento para obtener los registros de asistencia
        Record.find().sort({ //buscar los registros y ordenarlos por fecha de creación.
            createdAt: 1
        }).then(records => {
            records = records.map(record => { //aplicar formato de fecha y hora de Guatemala a todos los registros
                record = record.toObject();
                record.createdAt = moment(record.createdAt).tz('America/Guatemala').format("DD-MM-YYYY HH:mm");
                return record;
            });

            result(records); //retornar los registros encontrados
        }, err => {
            result({
                error: true, // retornar error de base de datos
            });
        });

    });

    socket.on('getStudents', result => { //evento para obtener el listado de estudiantes guardados en base de datos

        Student.find().sort({ //buscar todos los estudiantes y ordenarlos por numero de tarjeta
            card: 1
        }).then(students => {
            result(students); //retornar listado de estudiantes encontrados.
        }, err => {
            result({
                error: true, //retornar error de base de datos
            });
        });

    });
    socket.on('newStudent', (data, result) => { //evento para guardar un nuevo estudiante
        new Student(data).save().then(student => { //crea un nuevo Estudiante con los datos recibidos del formulario
            result({ //retorna el exito al guardar
                error: false,
                student: student
            });
        }, err => {
            result({
                error: true,//retornar error de base de datos
            });
        });
    });

    socket.on('deleteStudent', (student, result) => { //evento para borrar un estudiante
        Student.findOne({ //busca al estudiante con el id recibido
            _id: student
        }).then(student => {
            return student.remove()  //eliminar el estudiante
        }).then(deleted => {
            result({
                error: false,  //retornar el exito al eliminar
            });
        }, err => {
            result({
                error: true, //retornar error de base de datos
            });
        });
    });

    socket.on('getClasses', result => { //obtener el listado de cursos
        Class.find().sort({ //buscar todos los cursos y ordenarlos por la hora de inicio
            time: 1
        }).then(classes => {
            result(classes); //retornar el listado de cursos
        }, err => {
            result({
                error: true,//retornar error de base de datos
            });
        });
    });

    socket.on('newClass', (data, result) => {
        new Class(data).save().then(clase => {
            result({ //retornar el exito al guardar el nuevo curso
                error: false,
                class: clase
            });
        }, err => {
            if (err.code == 11000) {
                result({
                    error: true, //retornar Error que ya existe un curso en ese horario
                    message: 'Horario no disponible'
                });
            } else {
                result({
                    error: true,
                    message: 'Error al guardar la información' //retornar error de base de datos
                });
            }
        });
    });

    socket.on('deleteClass', (clase, result) => {
        Class.findOne({
            _id: clase //buscar el curso con el id recibido
        }).then(subject => {
            return subject.remove(); //elminar el curso
        }).then(deleted => {
            result({
                error: false, //retornar el exito al eliminar
            });
        }, err => {
            result({
                error: true,//retornar error de base de datos
            });
        });
    });
});

app.get('/', (req, res) => {
    SerialPort.list((err, ports) => {
        res.render(__dirname + '/views/home.html', { //enviar la vista de inicio con la información del puerto serial
            serialPort: SERIAL_PORT,
            ports: ports
        });
    });
});

app.get('/estudiantes', (req, res) => {
    res.render(__dirname + '/views/estudiantes.html', {}); //enviar la vista de estudiantes
});

app.get('/asistencia', (req, res) => {
    res.render(__dirname + '/views/asistencia.html', {}); //enviar la vista de asistencias
});

app.get('/cursos', (req, res) => {
    res.render(__dirname + '/views/cursos.html', {}); //enviar la vista de cursos
});

http.listen(HTTP_PORT, function () { //inicio del servicio http con las direcciones del app de express
    console.log(" - Web Server Started :)");
});

process.on("uncaughtException", function (err) { //manejo de errores de proceso
    console.log("uncaughtException", err);
});

process.on('unhandledRejection', function (err) { //manejo de errores de proceso
    console.log("unhandledRejection", err);
});
