<img src="/documentation/logo.png" />
A calendar parser to parse the waste bin calendar of aachen and provides a simple to use api

# FEATURES





# GET YOUR WASTE BIN CALENDAR

Go to the Aachens ServiceCenter Website (https://serviceportal.aachen.de/abfallnavi) and insert your street and streetnumber to get your calendar.

Click on the button `DOWNLOAD ICAL` to download the calendar file.

Rename the calendar to `calendar.ics` and place it in the root directory (`/src/api/calendar.ics`) of the script, where the `server.js` file is located.

# RUN THE API
If you have NodeJS installed, you can simply run `node /src/api/server.js` or you can use docker (see below).
If the API is started you can browse to `http://127.0.0.1:3015/static/index.html` to explore the API.

* `	/rest/all_events` - Show all events that are found in the parsed calendar
* `/rest/get_next_events`- Shows all next events
* `/rest/get_events_of_the_day` - Lists all events for the day

* `/rest/get_events_of_the_day/:color/:simplified` Return if a event for a specific bin color is present for this day. I used it to integrtate the API in FHEM

* `/rest/get_color_events_of_the_day` A simplified Version of `/rest/get_events_of_the_day` for easy parsing with an microcontroller

* `/rest/calendar_need_update` - Returns `1` if only three events in the calendar left. So. a reminder to update to a new one


<img src="/documentation/apiexplorer.png" />

# USING DOCKER

If you want to use docker, first you have to build the image.
Run `bash /src/api/build_docker_image.sh` to build the API with the image name `recycling_calendar_api`.

To run the docker image simply `cd` into the `/src/api` directotry and run:
`docker run -itd --name recycling_calendar_api -v $(pwd)/data_volume:/usr/src/app/data_volume recycling_calendar_api`

The image a the `data_volume`-Volume so you can easy access the `calendar.ics` file. After replacing the File you can use the API or restart the container to parse the calendar file again.
# BUILD THE NOTIFIER DEVICE

Ok now you have an API, but i tink a device to show which bin will be the next would be nice.
So by using a ESP8266 and some mechanical parts, it notifies you at the day of an event.

## PARTS
