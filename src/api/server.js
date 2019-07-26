'use strict';


var dotenv = require('dotenv');
var ical = require('ical');
var fs = require('fs');
var config = require('./config.json');
var currentPath = process.cwd();
var path = require('path');
var express = require('express');
var app = express();
var listEndpoints = require('express-list-endpoints');
var uuidv1 = require('uuid/v1');
var port = process.env.PORT || 3015;
var server = app.listen(port);
server.timeout = 1000 * 60 * 10; // 10 minutes
app.use('/static', express.static(__dirname + '/public'));
app.use(require('sanitize').middleware);

var cal_path = currentPath + '/data_volume/calendar.ics';
console.log(cal_path);
var data = ical.parseFile(cal_path);


const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// SETUP HERE YOUR BINS THE calendar_keyword has to be in the event description of the calendar entry, make a entry for each bin you haven
var BIN_KEYWORDS = [
    { calendar_keyword: "Gelber Sack", type: "", color_desc: "yellow", color: "#fafa00", bin_desc: "Gelbe Tonne", check_for_this_bin: true },
    { calendar_keyword: "Altpapier", type: "", color_desc: "blue", color: "#008ffc", bin_desc: "Balue Tonne", check_for_this_bin: true },
    { calendar_keyword: "Restabfall", type: "", color_desc: "black", color: "#bababa", bin_desc: "Schwarze Tonne", check_for_this_bin: true },
    { calendar_keyword: "Bio", type: "", color_desc: "green", color: "#00ff15", bin_desc: "Gruene Tonne", check_for_this_bin: true },
];
var bin_keywords = BIN_KEYWORDS;
const api_result_prototype = {
    bin_desk: null,
    location: null,
    date_string: null,
    notification_send_counter: 0 //mehrmals die mqtt notification senden

}

var date_sort_asc = function (date1, date2) {
    if (date1.timestamp > date2.timestamp) return 1;
    if (date1.timestamp < date2.timestamp) return -1;
    return 0;
};
var date_sort_desc = function (date1, date2) {
    if (date1.timestamp > date2.timestamp) return -1;
    if (date1.timestamp < date2.timestamp) return 1;
    return 0;
};
var results = [];

function parse_ical(_data){
    console.log(_data);
    var rr = [];
    for (let k in _data) {
    if (_data.hasOwnProperty(k)) {
        var ev = _data[k];
        if (_data[k].type == 'VEVENT') {
            console.log(`${ev.description} is in ${ev.location} on the ${ev.start.getDate()} of ${ev.start.getMonth()} at ${ev.start.toLocaleTimeString('de-DE')}`);
            for (let bkindex = 0; bkindex < BIN_KEYWORDS.length; bkindex++) {
                if (String(ev.description).includes(BIN_KEYWORDS[bkindex].calendar_keyword) && BIN_KEYWORDS[bkindex].check_for_this_bin) {
                    var res = {};
                    res.location = ev.location;
                    res.description = ev.description;
                    res.local_time = ev.start.toLocaleTimeString('de-DE');
                    res.local_date = ev.start.getDate() + "." + (ev.start.getMonth() + 1) + "." + (ev.start.getYear() - 100);
                    res.bin_type = BIN_KEYWORDS[bkindex];
                    res.timestamp = new Date(ev.start);
                    res.uuid = uuidv1();
                    rr.push(res);
                }
            }
        }
    }
}
    //SORT ALL FOUND EVENTS BY DATE
    rr.sort(date_sort_asc);
    return rr;
}

results= parse_ical(data);

for (let index = 0; index < results.length; index++) {
    const element = results[index];
    console.log(element);
}




function encode(unencoded) {
    return encodeURIComponent(unencoded).replace(/'/g, "%27").replace(/"/g, "%22");
}
function decode(encoded) {
    return decodeURIComponent(encoded.replace(/\+/g, " "));
}

// ------ API ---------------

app.get('/rest/parse_url_calendar/:url', function (req, res) {
    var url = req.params.url;
    var _url = decode(url);//String(url).split(";").join("/");
    try {
        ical.fromURL(_url, {}, function (err, data) {
            results = parse_ical(data);
            
            res.json({ parsed_data: results, url: _url,err: err,data:data});
        });
    } catch (error) {
        res.json({ error: error });
    }
    
});
//var data = ical.parseFile(currentPath + '/calendar.ics');
app.get('/rest/parse_file_calendar_relative/:file', function (req, res) {
    var file = req.params.file;
    var pa = currentPath + "/" + file;
    cal_path = pa;
    data = ical.parseFile(pa);
    results = parse_ical(data);
    res.json({ parsed_data: results, path: pa, app_directory: currentPath});
});

app.get('/rest/parse_last_set_calendar', function (req, res) {
    results = parse_ical(data);
    res.json({ parsed_data: results });
});


app.get('/rest/all_events', (req, res) => {
    res.json(results);
});

app.get('/rest/get_time', (req, res) => {
    var date = new Date();
    var month = date.getMonth() + 1;
    var day = date.getDate();
    var hour = date.getHours();
    var min = date.getMinutes();
    var sec = date.getSeconds();
    month = (month < 10 ? "0" : "") + month;
    day = (day < 10 ? "0" : "") + day;
    hour = (hour < 10 ? "0" : "") + hour;
    min = (min < 10 ? "0" : "") + min;
    sec = (sec < 10 ? "0" : "") + sec;
    var str = date.getFullYear() + "-" + month + "-" + day + "_" + hour + ":" + min + ":" + sec;
    res.json({ timestamp: date, timestamp_string: str, minute:min,hours:hour,seconds:sec  });
});

app.get('/rest/get_next_events', (req, res) => {
    var date = new Date();
    var tmp = [];
    for (let index = 0; index < results.length; index++) {
        if (date < results[index].timestamp) {
            tmp.push(results[index]);
        }
    }
    res.json(tmp);
});


app.get('/rest/calendar_need_update/:simplified', (req, res) => {
    var sf = req.params.simplified;
    var date = new Date();
    var tmp = [];
    for (let index = 0; index < results.length; index++) {
        if (date < results[index].timestamp) {
            tmp.push(results[index]);
        }
    }
    var nu = false;
    if (tmp.length < 3){
        nu = true;
    }

    if (String(sf) == "1") {
        res.set('Content-Type', 'text/plain');
        if (nu){
            res.send("1");
        }else{
            res.send("0");
        }
        
    }else{
        res.json({ len: tmp.length, min_entry_required: 3, need_update: nu });
    }
   
});



app.get('/rest/get_events_of_the_day', (req, res) => {
    var date_begin = new Date();
    date_begin.setHours(0);
    date_begin.setMinutes(0);
    date_begin.setSeconds(0);
    var tmp = [];
    for (let index = 0; index < results.length; index++) {
        var dt = new Date(results[index].timestamp);
        if (dt.getDate() == date_begin.getDate() && dt.getMonth() == date_begin.getMonth() && dt.getFullYear() == date_begin.getFullYear()){
            tmp.push(results[index]);
        }
    }
    res.json(tmp);
});

app.get('/rest/get_color_events_of_the_day/:simplified', (req, res) => {
    //console.log(req);
    var sf = req.params.simplified;
    var date_begin = new Date();
    date_begin.setHours(0);
    date_begin.setMinutes(0);
    date_begin.setSeconds(0);
    var tmp = [];
    for (let index = 0; index < results.length; index++) {
        var dt = new Date(results[index].timestamp);
        if (dt.getDate() == date_begin.getDate() && dt.getMonth() == date_begin.getMonth() && dt.getFullYear() == date_begin.getFullYear()){
            tmp.push(results[index].bin_type.color_desc);
        }
    }
    if (String(sf) == "1") {
        res.set('Content-Type', 'text/plain');
        var tmpstr = "";
        for (let index = 0; index < tmp.length; index++) {
            tmpstr += tmp[index] + ",";
            
        }
        res.send(tmpstr.slice(0,-1));
    }else{
        res.json(tmp);
    }
    
});

app.get('/rest/get_events_of_the_day/:color/:simplified', (req, res) => {
    var color = req.params.color;
    var sf = req.params.simplified; //0 1
    //alle events die nur an diesem tag sind
    var date_begin = new Date();
    date_begin.setHours(0);
    date_begin.setMinutes(0);
    date_begin.setSeconds(0);
    var tmp = [];
    for (let index = 0; index < results.length; index++) {
        var dt = new Date(results[index].timestamp);
        if (String(color) == results[index].bin_type.color_desc && dt.getDate() == date_begin.getDate() && dt.getMonth() == date_begin.getMonth() && dt.getFullYear() == date_begin.getFullYear()) {
            tmp.push(results[index]);
        }
    }
    if(String(sf) == "1"){
        res.set('Content-Type', 'text/plain');
        if (tmp.length > 0){
            res.send("1");
        }else{
            res.send("0");
        }
    }else{
        res.json(tmp);
    }
});







//RETURNS A JSON WITH ONLY /rest ENPOINTS TO GENERATE A NICE HTML SITE
var REST_ENDPOINT_PATH_BEGIN_REGEX = "^\/rest\/(.)*$"; //REGEX FOR ALL /rest/* beginning
var REST_API_TITLE = "RecyclingBinNotifier";
var rest_endpoint_regex = new RegExp(REST_ENDPOINT_PATH_BEGIN_REGEX);
var REST_PARAM_REGEX = "\/:(.*)\/"; // FINDS /:id/ /:hallo/test
//HERE YOU CAN ADD ADDITIONAL CALL DESCTIPRION
var REST_ENDPOINTS_DESCRIPTIONS = [
    { endpoints: "/rest/all_events", text: "Returns all parsed calendar results" },
    { endpoints: "/rest/get_events_of_the_day/:color/:simplified", text: "color: black,yellow,green,blue: simplified 0=json 1=textonly"},
    { endpoints: "/rest/parse_url_calendar/:url", text:"url must escaped use unescape/ecape in pyton; %3A for : and %2F for /"},
    { endpoints: "/rest/parse_file_calendar_relative/:file", text: "file path must escaped use unescape/ecape in pyton; %3A for : and %2F for /" },
    { endpoints: "/rest/calendar_need_update", text:"returns true if only X events left"}
];

app.get('/listendpoints', function (req, res) {
    var ep = listEndpoints(app);
    var tmp = [];
    for (let index = 0; index < ep.length; index++) {
        var element = ep[index];
        if (rest_endpoint_regex.test(element.path)) {
            //LOAD OPTIONAL DESCRIPTION
            for (let descindex = 0; descindex < REST_ENDPOINTS_DESCRIPTIONS.length; descindex++) {
                if (REST_ENDPOINTS_DESCRIPTIONS[descindex].endpoints == element.path) {
                    element.desc = REST_ENDPOINTS_DESCRIPTIONS[descindex].text;
                }
            }
            //SEARCH FOR PARAMETERS
            //ONLY REST URL PARAMETERS /:id/ CAN BE PARSED
            //DO A REGEX TO THE FIRST:PARAMETER
            element.url_parameters = [];
            var arr = (String(element.path) + "/").match(REST_PARAM_REGEX);
            if (arr != null) {
                //SPLIT REST BY /
                var splittedParams = String(arr[0]).split("/");
                var cleanedParams = [];
                //CLEAN PARAEMETER BY LOOKING FOR A : -> THAT IS A PARAMETER
                for (let cpIndex = 0; cpIndex < splittedParams.length; cpIndex++) {
                    if (splittedParams[cpIndex].startsWith(':')) {
                        cleanedParams.push(splittedParams[cpIndex].replace(":", "")); //REMOVE :
                    }
                }
                //ADD CLEANED PARAMES TO THE FINAL JOSN OUTPUT
                for (let finalCPIndex = 0; finalCPIndex < cleanedParams.length; finalCPIndex++) {
                    element.url_parameters.push({ name: cleanedParams[finalCPIndex] });

                }
            }
            //ADD ENPOINT SET TO FINAL OUTPUT
            tmp.push(element);
        }
    }
    res.json({ api_name: REST_API_TITLE, endpoints: tmp });
});


app.get('/', function (req, res) {
    res.redirect('static/index.html');
});
app.get('/index.html', function (req, res) {
    res.redirect('static/index.html');
});