#include <SPI.h> //Librería standard SPI de Arduino.
#include <MFRC522.h> //Librería RFID.
#include <UTFT.h>  //Librería de pantalla LCD.

/*
PINOUT:

RC522           MEGA
SDA             D49
SCK             D52
MOSI            D51
MISO            D50
IRQ             N/C
GND             GND
RST             D48
3.3V            3.3V

LCD             MEGA
 1 Vcc          5v
 2 Gnd          Gnd
 3 Gnd          N/C
 4 N/C          N/C
 5 N/C          N/C
 6 LED          5v
 7 CLK          D32
 8 SDI          D31
 9 RS           D23
10 RST          D22
11 CS           D33
*/

#define RST_PIN   48  //Pin 48 para el reset del RC522
#define SS_PIN    49 //Pin 49 para el SS (SDA) del RC522
MFRC522 mfrc522(SS_PIN, RST_PIN); // Creacion de la instancia del lector MFRC522.

extern uint8_t SmallFont[]; // Declaración de la fuente que se va a utliizar.

UTFT myGLCD(ITDB18SP,31,32,33,22,23); // Creacion de la instancia de la pantalla LCD.

int incomingByte = 2;  //Variable para almacenar el comando de acceso.

void setup() {
  Serial.begin(9600);   //Iniciamos la comunicación  serial
  SPI.begin();          //Iniciamos el Bus SPI
  mfrc522.PCD_Init();   // Iniciamos  el MFRC522
  myGLCD.InitLCD(PORTRAIT); //Configuración de orientación de pantalla LCD en Modo Retrato
  myGLCD.setFont(SmallFont); //Configuración de Fuente.
  myGLCD.clrScr(); //Limpiar pantalla.
  myGLCD.setContrast(0); //Ajuste de contraste.
  myGLCD.fillScr(0,0,255); //Llenar la pantalla de color azul.
  myGLCD.setColor(255,0,0); //Usar color rojo.
  myGLCD.fillRoundRect(2, 40, 125, 88); //Crear un rectangulo con las esquinas redondeadas.
  myGLCD.setColor(255,255,255); //Usar color blanco.
  myGLCD.setBackColor(255,0,0); //Color de fondo de letras rojo.
  myGLCD.print("ASISTENCIA RFID", CENTER, 46); //Imprimir texto dentro del rectangulo.
  myGLCD.print("INICIANDO", CENTER, 66); //Imprimir segundo texto dentro del rectangulo.
  myGLCD.setColor(0,0,0); //Usar color negro.
  myGLCD.setBackColor(0,0,255); //Usar color de fondo de letras azul.
  myGLCD.setContrast(64); //Ajuste de contraste.
  delay (1000); //Esperar 1 segundo 1000 milisegundos.
  myGLCD.clrScr(); //Limpiar pantalla.
  myGLCD.setColor(255, 255, 255); //Usar color blanco.
  myGLCD.setBackColor(255,40,0); //Usar color de fondo de letras naranja.
  myGLCD.print("ASISTENCIA RFID", CENTER, 5); //Imprimir texto al tope de pantalla.
}

void loop() {
  if ( mfrc522.PICC_IsNewCardPresent()) { // Revisamos si hay nuevas tarjetas  presentes
    if (mfrc522.PICC_ReadCardSerial()) { //Seleccionamos una tarjeta

      myGLCD.print("LEYENDO TARJETA", CENTER, 20); //Imprimir Texto en pantalla, indicando la lectura de la tarjeta.
      Serial.print("{\"card\":\""); //Empezar a enviar la cadena de datos por puerto serial.
      for (byte i = 0; i < mfrc522.uid.size; i++) { //bucle for para leer los bytes del identificador de la tarjeta leida.
        Serial.print(mfrc522.uid.uidByte[i], DEC);  //enviar el byte del identificador
      }
      Serial.print("\",\"class\":\"AULA 101\"}"); //Enviar el identificador del Aula en donde se está instalado.
      Serial.println(); //Finalización del envío de cadena de datos.
      mfrc522.PICC_HaltA(); // Finalización de lectura de tarjeta actual.
      myGLCD.setBackColor(0,0,255); //Usar color de fondo de letras azul.
      myGLCD.print("AUTENTICANDO", CENTER, 34); //Imprimir Texto en pantalla,que se está autenticando los datos de la tarjeta y tomando la asistencia en el server.
      long readingTimeStamp = millis(); //Tomar el tiempo en que se envió la cadena de datos al server para saber cuanto tiempo ha transcuido desde el envio.

      while(incomingByte == 2) { //bucle while: repetir mientras el comando de acceso sea igual a 2.
        if (millis() - readingTimeStamp >= 5000) { //revisa si ya han pasado 5 segundos o más desde que se envió la cadena de datos al server.
           //Al entrar en este if significa que no hubo respuesta del servidor despues de 5 segundos despues de enviar la cadena de datos.
           incomingByte = 3; //asignar como comando de acceso el valor 3 para indicar un error.
           myGLCD.setBackColor(127,0,0); //Usar color de fondo de letras rojo.
           myGLCD.print("  ERROR DE  ", CENTER, 60); //Imprimir primera linea del texto de error.
           myGLCD.print(" COMUNICACION  ", CENTER, 80); //Imprimir segunda linea del texto de error.
           delay(1000); //Esperar 1 segundo mostrando el error en pantalla.
           myGLCD.clrScr(); //Limpiar pantalla.
           myGLCD.setColor(255, 255, 255); //Usar color blanco.
           myGLCD.setBackColor(255,40,0); //Usar color de fondo de letras naranja.
           myGLCD.print("SERIAL-RFID", CENTER, 5); //Imprimir texto al tope de pantalla.
        } else {
            //Al entrar en el ELSE significa que aún no han transcurrido 5 segundos desde que se envió la cadenay que hay que revisar si hay alguna respuesta del server.
          if (Serial.available()){ //Revisa si hay alguna cadena de datos almacenada en el Buffer del puerto serial
            incomingByte = Serial.read(); //Lectura del primer byte de la cadena de respuesta del servidor.
            if (incomingByte == '1') { //si el primer byte es igual a 1 significa que la tarjeta es válida y no hay ningún error
              myGLCD.setBackColor(0, 127, 0); //Usar color de fondo de letras verde.
              myGLCD.print(" AUTORIZADO ", CENTER, 60); //Imprimir en pantalla el texto indicando que el servidor validó la información de la tarjeta escaneada.
            } else { //si el valor del primer byte no es igual a 1 significa que hubo algún error
              myGLCD.setBackColor(127,0,0); //Usar color de fondo de letras rojo.
              myGLCD.print("   ERROR   ", CENTER, 60); //Imprimir en pantalla el texto indicando que hubo un error con la validación de la tarjeta escaneada.
            }

            int serialLength = Serial.available(); //almacenar la longitud de caracteres disponibles en el buffer del puerto serial.
            char message[serialLength]; //Inicializar un array/vector de char (caracteres) con la longitud del buffer que contiene el mensaje del servidor.

            for (int pos = 0; pos < serialLength; pos++) { //bucle for para leer los bytes del mensaje enviado por el servidor.
                int letter = Serial.read(); //lectura del siguiente caracter del buffer del puerto serial.
                message[pos] = letter; //asignación del byte o letra en la posición correspondiente
            }
            message[serialLength] = 0;   //Agregar el valor null para finalizar la cadena del mensaje del servidor.

            myGLCD.setBackColor(0, 0, 0); //Usar color de fondo de letras negro.
            myGLCD.print(message, CENTER, 80); //Imprimir el mensaje enviado por el servidor. Puede ser el nombre del alumno, o el detalle del error.
            delay(2000); //Esperar 2 segundos mostrando el mensaje

            myGLCD.clrScr(); //Limpiar pantalla.
            myGLCD.setColor(255, 255, 255); //Usar color blanco.
            myGLCD.setBackColor(255,40,0); //Usar color de fondo de letras naranja.
            myGLCD.print("ASISTENCIA RFID", CENTER, 5); //Imprimir texto al tope de pantalla.
          }
        }
      }
      incomingByte = 2; //Reset del comando de acceso
    }
  }
  //Limpieza de Buffer para evitar comandos erroneos a la hora de esperar el comando de acceso
  while(Serial.available()){
     Serial.read();
  }
}

