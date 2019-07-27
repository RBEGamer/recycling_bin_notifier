
#define VERSION "0.9"

#include <ESP8266WiFi.h>
#include <WiFiClient.h>
#include <ESP8266WebServer.h>
#include <ESP8266HTTPClient.h>
#include <ESP8266mDNS.h>
#include <WiFiUdp.h>
#include <Wire.h>
#include <FS.h> //Include File System Headers
#include <WiFiManager.h>
#include <WiFiUdp.h>
#include <ArduinoOTA.h>

// CONFIG -------------------------------------
#define WEBSERVER_PORT 80                    // set the port for the webserver eg 80 8080
#define MDNS_NAME "recyclingbinnotifier"     // set hostname
#define WEBSITE_TITLE "RecyclingBinNotifier" // name your device
#define SERIAL_BAUD_RATE 115200


const int KEYWORD_LEN = 4;
const String keywords[KEYWORD_LEN] = { "green", "black", "blue", "yellow"}; //MODIFY
int states[KEYWORD_LEN] = { 0, 0, 0, 0};
int states_old[KEYWORD_LEN] = { 0, 0, 0, 0};
const int output_pins[KEYWORD_LEN] = { D1, D2, D6, D7 }; //MODIFY
const int TRIGGER_TIME = 700; //solanoid trigger time
const int REQUEST_TIME_MINUTES = 60;


// END CONFIG ---------------------------------

//FILES FOR STORiNG CONFIGURATION DATA
const char * file_rbnurl = "/file_rbnurl.txt";

String rbnurl = "";

//VARS
int sync_mode = 0;
int timezone = 0;

long long last = 0;
String bin_table = "";
ESP8266WebServer server(WEBSERVER_PORT);

const String phead_1 = "<!DOCTYPE html><html><head><title>";
const String phead_2 = "</title>"
"<meta http-equiv='content-type' content='text/html; charset=utf-8'>"
"<meta charset='utf-8'>"
"<link "
"href='http://ajax.googleapis.com/ajax/libs/jqueryui/1.8.16/themes/base/"
"jquery-ui.css' rel=stylesheet />"
"<script "
"src='http://ajax.googleapis.com/ajax/libs/jquery/1.6.4/jquery.min.js'></"
"script>"
"<script "
"src='http://ajax.googleapis.com/ajax/libs/jqueryui/1.8.16/"
"jquery-ui.min.js'></script>"
"<style>"
"html, body {"
"  background: #F2F2F2;"
" width: 100%;"
" height: 100%;"
" margin: 0px;"
" padding: 0px;"
" font-family: 'Verdana';"
" font-size: 16px;"
" color: #404040;"
" }"
"img {"
" border: 0px;"
"}"
"span.title {"
" display: block;"
" color: #000000;"
" font-size: 30px;"
"}"
"span.subtitle {"
" display: block;"
" color: #000000;"
" font-size: 20px;"
"}"
".sidebar {"
" background: #FFFFFF;"
" width: 250px;"
" min-height: 100%;"
" height: 100%;"
" height: auto;"
" position: fixed;"
" top: 0px;"
" left: 0px;"
" border-right: 1px solid #D8D8D8;"
"}"
".logo {"
" padding: 25px;"
" text-align: center;"
" border-bottom: 1px solid #D8D8D8;"
"}"
".menu {"
" padding: 25px 0px 25px 0px;"
" border-bottom: 1px solid #D8D8D8;"
"}"
".menu a {"
" padding: 15px 25px 15px 25px;"
" display: block;"
" color: #000000;"
" text-decoration: none;"
" transition: all 0.25s;"
"}"
".menu a:hover {"
" background: #0088CC;"
" color: #FFFFFF;"
"}"
".right {"
" margin-left: 250px;"
" padding: 50px;"
"}"
".content {"
" background: #FFFFFF;"
" padding: 25px;"
" border-radius: 5px;"
" border: 1px solid #D8D8D8;"
"}"
"</style>";

const String pstart = "</head>"
"<body style='font-size:62.5%;'>"
"<div class='sidebar'>"
"<div class='logo'>"
"<span class='title'>Recycling Notifier Device</span>"
"<span class='subtitle'>- Backend -</span>"
"</div>"
"<div class='menu'>"
"<a href='index.html'>Settings</a>"
"</div>"
"</div>"
"<div class='right'>"
"<div class='content'>";

const String pend = "</div>"
"</div>"
"</body>"
"</html>";

String last_error = "";

// ONLY READ THE FIRST LINE UNTIL NEW LINE !!!!!
String read_file(const char * _file, String _default = "")
{
    File f = SPIFFS.open(_file, "r");
    String tmp = _default;
    if (!f) {
        last_error = "open filesystem failed";
    }
    else {
        tmp = f.readStringUntil('\n');
        last_error = "read from FS:" + String(_file) + " " + tmp;
    }
    return tmp;
}

void restore_eeprom_values()
{
    rbnurl = read_file(file_rbnurl, "192.168.1.24:3015");
}

bool write_file(const char * _file, String _content)
{
    File f = SPIFFS.open(_file, "w");
    if (!f) {
        last_error = "Oeffnen der Datei fehlgeschlagen";
        return -1;
    }
    f.print(_content);
    f.close();
    return 0;
}

void save_values_to_eeprom()
{
    write_file(file_rbnurl, rbnurl);

    last = millis() - 60 * 60 * 8;
}

void handleSave()
{
    // PARSE ALL GET ARGUMENTS
    for (uint8_t i = 0; i < server.args(); i++)
    {

        // rbnurl
        if (server.argName(i) == "rbnurl") {
            rbnurl = server.arg(i);
            last_error = "set ntp_server_url to" + rbnurl;
        }

        // formats the filesystem= resets all settings
        if (server.argName(i) == "fsformat") {
            if (SPIFFS.format()) {
                last_error = "Datei-System formatiert";
            }
            else {
                last_error = "Datei-System formatiert Error";
            }
        }

        //LOAD CURRENT SAVED DATA

        // if (server.argName(i) == "sendtime") {
        //       send_time_to_clock();
        //       delay(100);
        //   }
    }
    //SAVE THESE DATA
    save_values_to_eeprom();

    server.send(404, "text/html",
        "<html><head><meta http-equiv='refresh' content='1; url=/' "
                "/></head><body>SAVE SETTINGS PLEASE WAIT</body></html>");
}
void handleRoot()
{

    String control_forms = "<hr><h2>CONTROLS</h2>";

    control_forms += "<form name='req_url' action='/save' method='GET' required >"
    "<input type='text' value='" +
        rbnurl + "' placeolder='recycling_bin_notifier API URL' name='rbnurl' id='rbnurl' />"
    "<input type='submit' value='SAVE RBN-API-URL'/>"
    "</form>";

    control_forms += "<br>";

    control_forms += "<h3>PLEASE NOTE ONLY THE IP:PORT for e.g. 192.168.1.2:3015</h3>";

    
     control_forms += "<br>";
    control_forms += "<br><hr><h3>LAST ERROR</h3><br>" + bin_table;
    
    control_forms += "<br>";
    control_forms += "<br><hr><h3>LAST ERROR</h3><br>" + last_error;


     control_forms += "<br>";
      control_forms += "<br>SEE MY OTHER PROJECTS <a href='https://github.com/RBEGamer'>Marcel Ochsendorf (RBEGamer)</a>" + last_error;

    server.send(200, "text/html", phead_1 + WEBSITE_TITLE + phead_2 + pstart + control_forms + pend);
}
void handleNotFound()
{
    server.send(404, "text/html",
        "<html><head>header('location: /'); </head></html>");
}
void setup(void)
{
    Serial.begin(SERIAL_BAUD_RATE);

    for(int i = 0;i <KEYWORD_LEN; i++){
      pinMode(output_pins[i],OUTPUT);
    }

  
    // START THE FILESYSTEM
    if (SPIFFS.begin()) {
        last_error = "SPIFFS Initialisierung....OK";
    }
    else {
        last_error = "SPIFFS Initialisierung...Fehler!";
    }

    // LOAD SETTINGS
    restore_eeprom_values();
    // START WFIFIMANAGER FOR CAPTIVE PORTAL
    WiFiManager wifiManager;
    wifiManager.setDebugOutput(true);
    wifiManager.autoConnect("RecyclingBinNotifier");

    if (MDNS.begin(MDNS_NAME)) {
    }
    //WEBSERVER ROUTES
    delay(1000);
    server.on("/", handleRoot);
    server.on("/save", handleSave);
    server.on("/index.html", handleRoot);
    server.onNotFound(handleNotFound);
    server.begin();

    //START OTA LIB
    ArduinoOTA.onStart([]() {
        String type;
        if(ArduinoOTA.getCommand() == U_FLASH)
    {
        type = "sketch";
    }
        else
    { // U_SPIFFS
        type = "filesystem";
    }
    SPIFFS.end();
});
ArduinoOTA.onEnd([]() { Serial.println("\nEnd"); });
ArduinoOTA.onProgress([](unsigned int progress, unsigned int total) {
    Serial.printf("Progress: %u%%\r", (progress / (total / 100)));
});
ArduinoOTA.onError([](ota_error_t error) {
    // Serial.printf("Error[%u]: ", error);
    if(error == OTA_AUTH_ERROR)
{
    // Serial.println("Auth Failed");
}
        else if (error == OTA_BEGIN_ERROR) {
    // Serial.println("Begin Failed");
}
else if (error == OTA_CONNECT_ERROR) {
    // Serial.println("Connect Failed");
}
else if (error == OTA_RECEIVE_ERROR) {
    // Serial.println("Receive Failed");
}
else if (error == OTA_END_ERROR) {
    // Serial.println("End Failed");
}
    });
ArduinoOTA.onEnd([]() {
    if(SPIFFS.begin())
{
    restore_eeprom_values(); // RESTORE FILE SETTINGS
}
    });
ArduinoOTA.begin();
}



void loop(void)
{
    //HANDLE SERVER
    server.handleClient();

    //HANDLE OTA
    ArduinoOTA.handle();

    //MAKE A REQUEST ALLE STUNDEN
    if (millis() - last > (1000*60*REQUEST_TIME_MINUTES)) {
        last = millis();
        HTTPClient http;
        http.begin("http://" + rbnurl + "/rest/get_color_events_of_the_day/1");
        Serial.println("http://" + rbnurl + "/rest/get_color_events_of_the_day/1"); //USING THE SIMPLIFIED VERSION
        int httpCode = http.GET();

        if (httpCode > 0) {
            String payload = http.getString();
            last_error = "GET-REQUEST-RESPONSE: "+payload;
            Serial.println(payload);
            for (int i = 0; i < KEYWORD_LEN; i++) {
               if (strstr(payload.c_str(), keywords[i].c_str()) != NULL)
              {
                  Serial.println("KW"+keywords[i]+" found "+ keywords[i] + "-----");
                    states[i] = 1;
                } else {
                    states[i] = 0;
                }
            }
            bin_table = "<table><tr><th>KEYWORD</th><th>STATE</th></tr>";
            for (int i = 0; i < KEYWORD_LEN; i++) {
              bin_table +="</tr><td>"+keywords[i]+"</td><td>"+String(states[i])+"</td></tr>";
                if (states[i] != states_old[i]) {
                    states_old[i] = states[i];
                    Serial.println("set output" + String(output_pins[i]) + " to " + String(states[i]));
                    if (states[i]) {
                        digitalWrite(output_pins[i], HIGH); //ONLY TRIGGER A SHORT AMOUNT OF TIME
                        delay(TRIGGER_TIME);
                        digitalWrite(output_pins[i], LOW);
                    }else{
                      digitalWrite(output_pins[i], LOW);
                      }
                }
            }
              bin_table +="</table>";
        } else {
            last_error = "httpCode > 0 = " + String(httpCode);
        }
        http.end();
    }
    delay(70);
}
