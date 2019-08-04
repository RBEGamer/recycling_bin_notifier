
![Gopher image](/documentation/logo.png)
A calendar parser to parse the waste bin calendar of aachen and provides a simple to use api





# GET YOUR WASTE BIN CALENDAR

Go to the Aachens ServiceCenter Website (https://serviceportal.aachen.de/abfallnavi) and insert your street and streetnumber to get your calendar.

Click on the button `DOWNLOAD ICAL` to download the calendar file.

Rename the calendar to `calendar.ics` and place it in the root directory (`/src/api/data_volume/calendar.ics`) of the script, where the `server.js` file is located.

# RUN THE API
If you have NodeJS installed, you can simply run `node /src/api/server.js` or you can use docker (see below).
If the API is started you can browse to `http://127.0.0.1:3015/static/index.html` to explore the API.

* `	/rest/all_events` - Show all events that are found in the parsed calendar
* `/rest/get_next_events`- Shows all next events
* `/rest/get_events_of_the_day` - Lists all events for the day

* `/rest/get_events_of_the_day/:color/:simplified` Return if a event for a specific bin color is present for this day. I used it to integrtate the API in FHEM

* `/rest/get_color_events_of_the_day/:simplified` A simplified Version of `/rest/get_events_of_the_day` for easy parsing with an microcontroller

* `/rest/calendar_need_update` - Returns `1` if only three events in the calendar left. So. a reminder to update to a new one


Some API endpoints have the `:simplified` parameter: The normal response is JSON, but on embedded devices its a big overhead to use a json decoder. So if the parameter is set to `1` the output is much simpler.

* `/rest/get_color_events_of_the_day/0` -> `{'bin':['blue','black']}` JSON output
* `/rest/get_color_events_of_the_day/0` -> `blue','black` simplified output


<img src="/documentation/apiexplorer.png" />

# USING DOCKER

If you want to use docker, first you have to build the image.
Run `bash /src/api/build_docker_image.sh` to build the API with the image name `recycling_calendar_api`.

To run the docker image simply `cd` into the `/src/api` directotry and run:
`docker run -itd -p 3015:3015 --name recycling_calendar_api -v $(pwd)/data_volume:/usr/src/app/data_volume recycling_calendar_api`

The image a the `data_volume`-Volume so you can easy access the `calendar.ics` file. After replacing the File you can use the API or restart the container to parse the calendar file again.


# CALENDAR STRUCTURE
To modify the list avariable bin types like Paper,Organic, Residual Waste you can edit the array in `line 28` of the `server.js`. The im portant value is `BIN_KEYWORDS`. A calendar event description will be searched for the word in `BIN_KEYWORDS`. You can specify a color for the type of waste in `color_desc` this value will be returned from the api call `/rest/get_color_events_of_the_day`. Or you can add own json keys for your needs.


# BUILD THE NOTIFIER DEVICE

Ok now you have an API, but i tink a device to show which bin will be the next would be nice.
So by using a ESP8266 and some mechanical parts, it notifies you at the day of an event.

The esp8266 uses the. `/rest/get_color_events_of_the_day` API. The API returns a array of all bin colors they will be taken.

In my example im building the device for four bin types : black,blue,yellow,green.

## PARTS
* ESP8266
* 4x 6V Solanoid
* 4x MOSFETS



## SOFTWARE SETUP
Flash the Ardino Sketch (/src/esp8266_sketch/rbn/rbn.ino) to the ESP8266. After startup you will find a wifi called `Recycling Notifier Device`. Setup your local wifi and reset the ESP8266. Back in your homenetwork visit the ip of your esp8266 with your browser and setup the IP of this REST interface.

<img src="/documentation/esp8266.png" />

* setup the port to which the mosfets are connected `line 27 int output_pins`
* setup the keyword `color_desc` to which your device react to `line 24 String keywords`


### USBALE OUTPUT PINS
The ESP8266-12E has the following outputs you can use:
* D1 = GPIO5
* D2 = GPIO4
* D6 = GPIO12
* D7 = GPIO13
* D3 = GPIO0


## 3D Printing
# todo
<img src="/documentation/3dpart1.PNG" />
