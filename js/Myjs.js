//Init Map
//*******************************************************************************************************************************************************
var lat = 41.141376;
var lng = -8.613999;
var zoom = 14;

google.charts.load('current', {'packages':['sankey']});
google.charts.load('current', {'packages':['corechart']}); // Loads the scatter matrix from Google
// add an OpenStreetMap tile layer
var mbAttr = 'Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors, ' +
    '<a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, ' +
    'Imagery © <a href="http://mapbox.com">Mapbox</a>',
    mbUrl = 'https://api.tiles.mapbox.com/v4/{id}/{z}/{x}/{y}.png?access_token=pk.eyJ1IjoicGxhbmVtYWQiLCJhIjoiemdYSVVLRSJ9.g3lbg_eN0kztmsfIPxa9MQ';


var grayscale = L.tileLayer(mbUrl, {
        id: 'mapbox.light',
        attribution: mbAttr
    }),
    streets = L.tileLayer(mbUrl, {
        id: 'mapbox.streets',
        attribution: mbAttr
    });


var map = L.map('map', {
    center: [lat, lng], // Porto
    zoom: zoom,
    layers: [streets],
    zoomControl: true,
    fullscreenControl: true,
    fullscreenControlOptions: { // optional
        title: "Show me the fullscreen !",
        titleCancel: "Exit fullscreen mode",
        position: 'bottomright'
    }
});

var baseLayers = {
    "Grayscale": grayscale, // Grayscale tile layer
    "Streets": streets, // Streets tile layer
};

layerControl = L.control.layers(baseLayers, null, {
    position: 'bottomleft'
}).addTo(map);

// Initialise the FeatureGroup to store editable layers
var drawnItems = new L.FeatureGroup();
map.addLayer(drawnItems);

var featureGroup = L.featureGroup();

var drawControl = new L.Control.Draw({
    position: 'bottomright',
	collapsed: false,
    draw: {
        // Available Shapes in Draw box. To disable anyone of them just convert true to false
        polyline: false,
        polygon: false,
        circle: false,
        rectangle: true,
        marker: false,
    }

});
map.addControl(drawControl); // To add anything to map, add it to "drawControl"
//*******************************************************************************************************************************************************
//*****************************************************************************************************************************************
// Index Road Network by Using R-Tree
//*****************************************************************************************************************************************
var rt = cw(function(data,cb){
	var self = this;
	var request,_resp;
	importScripts("js/rtree.js");
	if(!self.rt){
		self.rt=RTree();
		request = new XMLHttpRequest();
		request.open("GET", data);
		request.onreadystatechange = function() {
			if (request.readyState === 4 && request.status === 200) {
				_resp=JSON.parse(request.responseText);
				self.rt.geoJSON(_resp);
				cb(true);
			}
		};
		request.send();
	}else{
		return self.rt.bbox(data);
	}
});

rt.data(cw.makeUrl("js/trips.json"));
//*****************************************************************************************************************************************	
//*****************************************************************************************************************************************
// Drawing Shapes (polyline, polygon, circle, rectangle, marker) Event:
// Select from draw box and start drawing on map.
//*****************************************************************************************************************************************	

map.on('draw:created', function (e) {
	
	var type = e.layerType,
		layer = e.layer;
	
	if (type === 'rectangle') {
		console.log(layer.getLatLngs()); //Rectangle Corners points
		var bounds=layer.getBounds();
		rt.data([[bounds.getSouthWest().lng,bounds.getSouthWest().lat],[bounds.getNorthEast().lng,bounds.getNorthEast().lat]]).
		then(function(d){var result = d.map(function(a) {return a.properties;});
		console.log(result);		// Trip Info: avspeed, distance, duration, endtime, maxspeed, minspeed, starttime, streetnames, taxiid, tripid
		DrawRS(result);
		// Passing Result To Sankey 
		SankeyPlot(result)

		// Passing Result To Word Cloud
		WordCloud(result)

		drawScatterMatrix(result)
		});
	}
	
	drawnItems.addLayer(layer);			//Add your Selection to Map  
});
//*****************************************************************************************************************************************
// DrawRS Function:
// Input is a list of road segments ID and their color. Then the visualization can show the corresponding road segments with the color
// Test:      var input_data = [{road:53, color:"#f00"}, {road:248, color:"#0f0"}, {road:1281, color:"#00f"}];
//            DrawRS(input_data);
//*****************************************************************************************************************************************
function DrawRS(trips) {
	for (var j=0; j<trips.length; j++) {  // Check Number of Segments and go through all segments
		var TPT = new Array();			  
		TPT = TArr[trips[j].tripid].split(',');  		 // Find each segment in TArr Dictionary. 
		var polyline = new L.Polyline([]).addTo(drawnItems);
        polyline.setStyle({
            color: 'red',                      // polyline color
			weight: 1,                         // polyline weight
			opacity: 0.5,                      // polyline opacity
			smoothFactor: 1.0  
        });
		for(var y = 0; y < TPT.length-1; y=y+2){    // Parse latlng for each segment
			polyline.addLatLng([parseFloat(TPT[y+1]), parseFloat(TPT[y])]);
		}
	}		
}


// ---------------------------------------
// SANKEY
// ---------------------------------------


function SankeyPlot(result){
	
	var source = [];
	var destination = [];

	var start,end;
	var i = 0,j = 0;

	while(i < result.length){

		start = result[i].streetnames[0];
		end = result[i].streetnames[result[i].streetnames.length-1];

		if(start!=end && start!=undefined && end!=undefined){
		    source[j] = start;
            destination[j] = end;
			j++;
		}
		i++;
	}

	console.log("Source");
	console.log(source);
    console.log("Destination:");
	console.log(destination);

	google.charts.setOnLoadCallback(drawSankeyChart(source,destination));
}

function drawSankeyChart(source, destination){
	var data = new google.visualization.DataTable();
	data.addColumn('string', 'From');
	data.addColumn('string', 'To');
	data.addColumn('number', 'Weight');
	var length =15;
	if(source.length<15){
		length=source.length;
	}

	// Calculating result from source A to source B as number of trips
	var hm = {};

	for(var i = 0; i < length; i++){
		if ([source[i], destination[i]] in hm){
			hm[[source[i], destination[i]]] += 1
		}
		else{
			hm[[source[i], destination[i]]] = 1
		}

	}
	// console.log(source.length(), destination.length(), hm.length())

	for(var i=0;i<length ; i++){
		data.addRow([source[i], destination[i], hm[[source[i], destination[i]]]]);
	}
	// Sets chart options.
	var options = {
	  width: 400, height: 500
	};
	// Instantiates and draws our chart, passing in some options.
	var chart = new google.visualization.Sankey(document.getElementById('sankey'));
	chart.draw(data, options);
}

// ---------------------------------------
// Word Cloud
// ---------------------------------------

function WordCloud(result){
	d3.layout.cloud().clear;
	var wordlist =[];
	var wordlist1 = []
	for(var i = 0; i < result.length; i++){
		for(var j = 0; j < result[i].streetnames.length; j++){
			wordlist.push(result[i].streetnames[j]);
		}
	}

	wordsMap = createWordMap(wordlist);
	opwordslist = sortByCount(wordsMap);
	for(var i = 0; i < 15; i ++){
		wordlist1[i] =  opwordslist[i];
	}

	console.log(wordlist1);
	var layout = d3.layout.cloud()
		.size([1400, 800])
		.words(opwordslist)
		.padding(5)
		.rotate(function() { return Math.floor(Math.random() * 2) * 90; })
		.font("Impact")
		.fontSize(function(d) { return d.size; })
		.on("end", draw);

	layout.start();
}

function draw(words) {
	d3.select("#wordcloud").append("svg")
		.attr("width", 1400)
		.attr("height", 800)
	  .append("g")
		.attr("transform", "translate(" + 700 + "," + 400 + ")")
	  .selectAll("text")
		.data(words)
	  .enter().append("text")
		.text(function(d) { return d.text; })
		.style("font-size", function(d) { return d.size + "px"; })
		.style("fill", function(d) { return d.color; })
		.style("font-family", "Impact")
		.attr("text-anchor", "middle")
		.attr("transform", function(d) {
		  return "translate(" + [d.x, d.y] + ")rotate(" + d.rotate + ")";
		});
  }

function createWordMap (wordsArray) {
	var wordsMap = {};

	wordsArray.forEach(function (key) {
	  if (wordsMap.hasOwnProperty(key)) {
		wordsMap[key]++;
	  } else {
		wordsMap[key] = 1;
	  }
	});
  
	return wordsMap;
  }

  function sortByCount(wordsMap) {
	var opwordslist = [];
	opwordslist = Object.keys(wordsMap).map(function (key) {
	  return {
		text: key,
		size: wordsMap[key],
		color: d3.schemeDark2[Math.floor(random(wordsMap[key]) * 7)]
	  };
	});
  
	opwordslist.sort(function (a, b) {
	  return b.size - a.size;
	});
  
	return opwordslist;
  
  }

  function random(seed) {
	  var x = Math.sin(seed++) * 10000;
	  return x - Math.floor(x);
  }

// ---------------------------------------
// Scatter Matrix
// Code Reference: https://github.com/ManjunathBirajdar/UrbanTrajectoryViz/blob/master/IV/js/Myjs.js
// ---------------------------------------

  function drawScatterMatrix(trips){

	speed = [];
	distance =[];
	duration=[];
	for (var i =0;i<trips.length;i++)
	{
	      speed[i]=trips[i].avspeed;
		  distance[i]=trips[i].distance;
		  duration[i]=trips[i].duration;
	}

	google.charts.load('current', {'packages':['corechart']}); 
    google.charts.setOnLoadCallback(drawScatterMatrixCallBack(speed,distance,duration)); 
}

function drawScatterMatrixCallBack(maxSpeed,distance,duration){
	
	document.getElementById('scatter').innerHTML=  "<div id=\"scatter1\" style=\"width:40%; float:left\"></div>"+
													"<div id=\"scatter2\" style=\"width:40%; float:left\"></div>" +
													"<div id=\"scatter3\" style=\"width:40%; float:left\"></div>" +
													"<div id=\"scatter4\" style=\"width:40%; float:left\"></div>" +
													"<div id=\"scatter5\" style=\"width:40%; float:left\"></div>" +
													"<div id=\"scatter6\" style=\"width:40%; float:left\"></div>" +
													"<div id=\"scatter7\" style=\"width:40%; float:left\"></div>" +
													"<div id=\"scatter8\" style=\"width:40%; float:left\"></div>" +
													"<div id=\"scatter9\" style=\"width:40%; float:left\"></div>" +
													"<p style=\"color:white; margin-bottom: 10px;\"></p>";
	
	drawScatterPlot('Distance', distance, 'Distance', distance, 1);
	drawScatterPlot('Distance', distance, 'Duration', duration, 2);
	drawScatterPlot('Distance', distance, 'Avg Speed', maxSpeed, 3);
	
	drawScatterPlot('Duration', duration, 'Distance', distance, 4);
	drawScatterPlot('Duration', duration, 'Duration', duration, 5);
	drawScatterPlot('Duration', duration, 'Avg Speed', maxSpeed, 6);
	
	drawScatterPlot('Avg Speed', maxSpeed, 'Distance', distance, 7);
	drawScatterPlot('Avg Speed', maxSpeed, 'Duration', duration, 8);
	drawScatterPlot('Avg Speed', maxSpeed, 'Avg Speed', maxSpeed, 9);
}


function drawScatterPlot(title1, param_arr1, title2, param_arr2, chartNum) {
	
	arr1 = param_arr1.slice();
	arr2 = param_arr2.slice();

	
	let rawData = [[title1, title2]];
	
	for (let i = 0; i < arr2.length; i++) {
		rawData.push([arr1[i], arr2[i]]);
	}
	
	var data = google.visualization.arrayToDataTable(rawData);
	
	var options = {
		title: title1 + ' vs. ' + title2,
		hAxis: {title: title1, minValue: 0, maxValue: arr1.sort((a, b) => b - a)[0]},
		vAxis: {title: title2, minValue: 0, maxValue: arr2.sort((a, b) => b - a)[0]},
		legend: 'none'
	};
	
	var chart = new google.visualization.ScatterChart(document.getElementById('scatter'+chartNum));
	chart.draw(data, options);
}