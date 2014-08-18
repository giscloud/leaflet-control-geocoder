(function (factory) {
	// Packaging/modules magic dance
	var L;
	if (typeof define === 'function' && define.amd) {
		// AMD
		define(['leaflet'], factory);
	} else if (typeof module !== 'undefined') {
		// Node/CommonJS
		L = require('leaflet');
		module.exports = factory(L);
	} else {
        giscloud.common().deferreds.leafletLoading.done(function() {
            L = window.L || giscloud.exposeLeaflet();
		    // Browser globals
		    if (typeof L === 'undefined')
			    console.log( 'Leaflet must be loaded first' );
		    factory(L);
        });
	}
}(function (L) {
	'use strict';
	L.Control.Geocoder = L.Control.extend({
		options: {
			showResultIcons: false,
			collapsed: true,
			expand: 'click',
			position: 'topright',
			placeholder: 'Search...',
			errorMessage: 'Nothing found.'
		},

		_callbackId: 0,

		initialize: function (options) {
			L.Util.setOptions(this, options);
			if (!this.options.geocoder) {
				this.options.geocoder = new L.Control.Geocoder.Nominatim();
			}

            if (this.options.geocoder=="google") {
                this.options.geocoder = new L.Control.Geocoder.Google(this);
            }
		},

		onAdd: function (map) {
			var className = 'leaflet-control-geocoder',
			    container = L.DomUtil.create('div', className),
				icon = this._icon = L.DomUtil.create('div', 'leaflet-control-geocoder-icon fa fa-search', container),
			    form = this._form = L.DomUtil.create('form', className + '-form', container),
			    input;

			this._map = map;
			this._container = container;
			input = this._input = L.DomUtil.create('input');
			input.id = 'leaflet_geocoder_input';
			input.type = 'text';
			input.className = 'leaflet-geocoder-input';

			L.DomEvent.addListener(input, 'keydown', this._keydown, this);
			//L.DomEvent.addListener(input, 'onpaste', this._clearResults, this);
			//L.DomEvent.addListener(input, 'oninput', this._clearResults, this);

			this._errorElement = document.createElement('div');
			this._errorElement.className = className + '-form-no-error';
			this._errorElement.innerHTML = this.options.errorMessage;

			this._alts = L.DomUtil.create('ul', className + '-alternatives leaflet-control-geocoder-alternatives-minimized');

			form.appendChild(input);
			form.appendChild(this._errorElement);
			container.appendChild(this._alts);

			L.DomEvent.addListener(form, 'submit', this._geocode, this);

			if (this.options.collapsed) {
				if (this.options.expand === 'click') {
					L.DomEvent.addListener(icon, 'click', function(e) {
						// TODO: touch
						if (e.button === 0 && e.detail === 1) {
							this._toggle();
						}
					}, this);
				} else {
					L.DomEvent.addListener(icon, 'mouseover', this._expand, this);
					L.DomEvent.addListener(icon, 'mouseout', this._collapse, this);
					this._map.on('movestart', this._collapse, this);
				}
			} else {
				this._expand();
			}

			L.DomEvent.disableClickPropagation(container);

			return container;
		},

		_geocodeResult: function (results) {
			L.DomUtil.removeClass(this._container, 'leaflet-control-geocoder-throbber');
			if (results.length === 1) {
				this._geocodeResultSelected(results[0]);
			} else if (results.length > 0) {
				this._alts.innerHTML = '';
				this._results = results;
				L.DomUtil.removeClass(this._alts, 'leaflet-control-geocoder-alternatives-minimized');
				for (var i = 0; i < results.length; i++) {
					this._alts.appendChild(this._createAlt(results[i], i));
				}
			} else {
				L.DomUtil.addClass(this._errorElement, 'leaflet-control-geocoder-error');
			}
		},

		markGeocode: function(result) {
			if (result.bbox) this._map.fitBounds(result.bbox);

			if (this._geocodeMarker) {
				this._map.removeLayer(this._geocodeMarker);
			}

			this._geocodeMarker = new L.Marker(result.center)
				.bindPopup("<div style='margin: 14px 20px;' >"+result.name+"</div>")
				.addTo(this._map)
				.openPopup();

			return this;
		},

		_geocode: function(event) {
			L.DomEvent.preventDefault(event);

			L.DomUtil.addClass(this._container, 'leaflet-control-geocoder-throbber');
			this._clearResults();
			this.options.geocoder.geocode(this._input.value, this._geocodeResult, this);

			return false;
		},

		_geocodeResultSelected: function(result) {
			if (this.options.collapsed) {
				this._collapse();
			} else {
				this._clearResults();
			}
			this.markGeocode(result);
		},

		_toggle: function() {
			if (this._container.className.indexOf('leaflet-control-geocoder-expanded') >= 0) {
				this._collapse();
			} else {
				this._expand();
			}
		},

		_expand: function () {
			L.DomUtil.addClass(this._container, 'leaflet-control-geocoder-expanded');
			L.DomUtil.addClass(this._form, 'leaflet-control-display-inline');
			L.DomUtil.removeClass(this._icon, 'fa-search');
			L.DomUtil.addClass(this._icon, 'fa-times');
			this._input.select();
		},

		_collapse: function () {
			L.DomUtil.removeClass(this._form, 'leaflet-control-display-inline');
            L.DomUtil.addClass(this._icon, 'fa-search');
            L.DomUtil.removeClass(this._icon, 'fa-times');

			this._container.className = this._container.className.replace(' leaflet-control-geocoder-expanded', '');
			L.DomUtil.addClass(this._alts, 'leaflet-control-geocoder-alternatives-minimized');
			L.DomUtil.removeClass(this._errorElement, 'leaflet-control-geocoder-error');
            if (this._geocodeMarker) this._map.removeLayer(this._geocodeMarker);
		},

		_clearResults: function () {
			L.DomUtil.addClass(this._alts, 'leaflet-control-geocoder-alternatives-minimized');
			this._selection = null;
			L.DomUtil.removeClass(this._errorElement, 'leaflet-control-geocoder-error');
		},

		_createAlt: function(result, index) {
			var li = document.createElement('li');
			li.innerHTML = '<a href="#" data-result-index="' + index + '">' +
				(this.options.showResultIcons && result.icon ?
					'<img src="' + result.icon + '"/>' :
					'') +
				result.name + '</a>';
			L.DomEvent.addListener(li, 'click', function clickHandler() {
				this._geocodeResultSelected(result);
			}, this);

			return li;
		},

		_keydown: function(e) {
			var _this = this,
				select = function select(dir) {
					if (_this._selection) {
						L.DomUtil.removeClass(_this._selection.firstChild, 'leaflet-control-geocoder-selected');
						_this._selection = _this._selection[dir > 0 ? 'nextSibling' : 'previousSibling'];
					}
					if (!_this._selection) {
						_this._selection = _this._alts[dir > 0 ? 'firstChild' : 'lastChild'];
					}

					if (_this._selection) {
						L.DomUtil.addClass(_this._selection.firstChild, 'leaflet-control-geocoder-selected');
					}
				};

			switch (e.keyCode) {
			// Up
			case 38:
				select(-1);
				L.DomEvent.preventDefault(e);
				break;
			// Up
			case 40:
				select(1);
				L.DomEvent.preventDefault(e);
				break;
			// Enter
			case 13:
				if (this._selection) {
					var index = parseInt(this._selection.firstChild.getAttribute('data-result-index'), 10);
					this._geocodeResultSelected(this._results[index]);
					this._clearResults();
					L.DomEvent.preventDefault(e);
				}
			}
			return true;
		}
	});

	L.Control.geocoder = function(id, options) {
		return new L.Control.Geocoder(id, options);
	};

	L.Control.Geocoder.callbackId = 0;
	L.Control.Geocoder.jsonp = function(url, params, callback, context, jsonpParam) {
		var callbackId = '_l_geocoder_' + (L.Control.Geocoder.callbackId++);
		params[jsonpParam || 'callback'] = callbackId;
		window[callbackId] = L.Util.bind(callback, context);
		var script = document.createElement('script');
		script.type = 'text/javascript';
		script.src = url + L.Util.getParamString(params);
		script.id = callbackId;
		document.getElementsByTagName('head')[0].appendChild(script);
	};

	L.Control.Geocoder.Nominatim = L.Class.extend({
		options: {
			serviceUrl: 'http://nominatim.openstreetmap.org/',
			geocodingQueryParams: {},
			reverseQueryParams: {}
		},

		initialize: function(options) {
			L.Util.setOptions(this, options);
		},

		geocode: function(query, cb, context) {
			L.Control.Geocoder.jsonp(this.options.serviceUrl + 'search/', L.extend({
				q: query,
				limit: 5,
				format: 'json'
			}, this.options.geocodingQueryParams),
			function(data) {
				var results = [];
				for (var i = data.length - 1; i >= 0; i--) {
					var bbox = data[i].boundingbox;
					for (var j = 0; j < 4; j++) bbox[j] = parseFloat(bbox[j]);
					results[i] = {
						icon: data[i].icon,
						name: data[i].display_name,
						bbox: L.latLngBounds([bbox[0], bbox[2]], [bbox[1], bbox[3]]),
						center: L.latLng(data[i].lat, data[i].lon)
					};
				}
				cb.call(context, results);
			}, this, 'json_callback');
		},

		reverse: function(location, scale, cb, context) {
			L.Control.Geocoder.jsonp(this.options.serviceUrl + 'reverse/', L.extend({
				lat: location.lat,
				lon: location.lng,
				zoom: Math.round(Math.log(scale / 256) / Math.log(2)),
				format: 'json'
			}, this.options.reverseQueryParams), function(data) {
				var result = [],
				    loc;

				if (data && data.lat && data.lon) {
					loc = L.latLng(data.lat, data.lon);
					result.push({
						name: data.display_name,
						center: loc,
						bounds: L.latLngBounds(loc, loc)
					});
				}

				cb.call(context, result);
			}, this, 'json_callback');
		}
	});

	L.Control.Geocoder.nominatim = function(options) {
		return new L.Control.Geocoder.Nominatim(options);
	};

	L.Control.Geocoder.Google = L.Class.extend({

        onPlaceChanged: function() {

    		if (giscloud.ui.map.markers.length != 0){
        		for (var i = 0; i < giscloud.ui.map.markers.length; i++) {
        			giscloud.ui.map.markers[i].visible(false);
        		}
        	}

            var place = this.autocomplete.getPlace(), marker = new giscloud.FlagMarker();
            // console.log(place);
            // console.log(place.geometry.location);

            if (!place.geometry || !place.geometry.location) {
                return;
            }

            var x = place.geometry.location.B, y = place.geometry.location.k,
            wgs84 = new Proj4js.Proj("WGS84"),
            p = new Proj4js.Point(x+","+y);

            Proj4js.transform(wgs84, giscloud.ui.map.projection, p);
            gcapp.gcmap.smartSetLocation({__xmin: p.x, __xmax: p.x, __ymin: p.y, __ymax: p.y});

			// var result = {
			// 	icon: null,
			// 	name: place.formatted_address,
			// 	//bbox: L.latLngBounds([y, x], [y, x]),
			// 	center: L.latLng(y, x)
			// };

			//this.parent.markGeocode(result);

			marker.position(new giscloud.LonLat(p.x, p.y)).content(place.formatted_address);
			giscloud.ui.map.addMarker(marker);

        },

		initialize: function(parentControl) {
            var that = this;
            this.parent = parentControl;

            //giscloud.Viewer.__googleMapsApiLoaded.done(function() {
            giscloud.__googleMapsApiLoadedGeocoder = function() {

                if (!window.google) {
                    console.log("Google map API is not loaded.");
                }

                L.DomUtil.addClass(parentControl._container, 'leaflet-control-display-block');

                (function() {
                    var gsearch_input = document.getElementById('leaflet_geocoder_input'),
                    goptions = {
                        //bounds: defaultBounds,
                        //types: ['establishment']
                    }, i, lyr,
                    gmap;

                    for (i in giscloud.ui.map.layers) {
                        lyr = giscloud.ui.map.layers[i];
                        if ( jQuery.inArray(lyr.source, ["gmaps"])>=0 ) {
                            gmap = lyr.instance._google;
                            break;
                        }
                    }

                    gsearch_input.value = '';

                    var autocomplete = that.autocomplete = new google.maps.places.Autocomplete(gsearch_input, goptions);
                    //autocomplete.bindTo('bounds', gmap);
                    //var places = new google.maps.places.PlacesService(gmap);
                    google.maps.event.addListener(autocomplete, 'place_changed',
                                                  that.onPlaceChanged.bind(that));

                }).delay(500);
            };

            giscloud.includeJs(
                (window.location.protocol == "https:" ? "https:" : "http:") +
                    "//maps.googleapis.com/maps/api/js?libraries=places&sensor=true&callback=giscloud.__googleMapsApiLoadedGeocoder");
		},

        geocode: function(query, cb, context) {
            L.DomUtil.removeClass(context._container, 'leaflet-control-geocoder-throbber');
        }

	});

	L.Control.Geocoder.google = function(key) {
		return new L.Control.Geocoder.Google(key);
	};

	L.Control.Geocoder.Bing = L.Class.extend({
		initialize: function(key) {
			this.key = key;
		},

		geocode : function (query, cb, context) {
			L.Control.Geocoder.jsonp('http://dev.virtualearth.net/REST/v1/Locations', {
				query: query,
				key : this.key
			}, function(data) {
				var results = [];
				for (var i = data.resourceSets[0].resources.length - 1; i >= 0; i--) {
					var resource = data.resourceSets[0].resources[i],
						bbox = resource.bbox;
					results[i] = {
						name: resource.name,
						bbox: L.latLngBounds([bbox[0], bbox[1]], [bbox[2], bbox[3]]),
						center: L.latLng(resource.point.coordinates)
					};
				}
				cb.call(context, results);
			}, this, 'jsonp');
		},

		reverse: function(location, scale, cb, context) {
			L.Control.Geocoder.jsonp('http://dev.virtualearth.net/REST/v1/Locations/' + location.lat + ',' + location.lng, {
				key : this.key
			}, function(data) {
				var results = [];
				for (var i = data.resourceSets[0].resources.length - 1; i >= 0; i--) {
					var resource = data.resourceSets[0].resources[i],
						bbox = resource.bbox;
					results[i] = {
						name: resource.name,
						bbox: L.latLngBounds([bbox[0], bbox[1]], [bbox[2], bbox[3]]),
						center: L.latLng(resource.point.coordinates)
					};
				}
				cb.call(context, results);
			}, this, 'jsonp');
		}
	});

	L.Control.Geocoder.bing = function(key) {
		return new L.Control.Geocoder.Bing(key);
	};

	L.Control.Geocoder.RaveGeo = L.Class.extend({
		options: {
			querySuffix: '',
			deepSearch: true,
			wordBased: false
		},

		jsonp: function(params, callback, context) {
			var callbackId = '_l_geocoder_' + (L.Control.Geocoder.callbackId++),
				paramParts = [];
			params.prepend = callbackId + '(';
			params.append = ')';
			for (var p in params) {
				paramParts.push(p + '=' + escape(params[p]));
			}

			window[callbackId] = L.Util.bind(callback, context);
			var script = document.createElement('script');
			script.type = 'text/javascript';
			script.src = this._serviceUrl + '?' + paramParts.join('&');
			script.id = callbackId;
			document.getElementsByTagName('head')[0].appendChild(script);
		},

		initialize: function(serviceUrl, scheme, options) {
			L.Util.setOptions(this, options);

			this._serviceUrl = serviceUrl;
			this._scheme = scheme;
		},

		geocode: function(query, cb, context) {
			L.Control.Geocoder.jsonp(this._serviceUrl, {
				address: query + this.options.querySuffix,
				scheme: this._scheme,
				outputFormat: 'jsonp',
				deepSearch: this.options.deepSearch,
				wordBased: this.options.wordBased
			}, function(data) {
				var results = [];
				for (var i = data.length - 1; i >= 0; i--) {
					var r = data[i],
						c = L.latLng(r.y, r.x);
					results[i] = {
						name: r.address,
						bbox: L.latLngBounds([c]),
						center: c
					};
				}
				cb.call(context, results);
			}, this);
		}
	});

	L.Control.Geocoder.raveGeo = function(serviceUrl, scheme, options) {
		return new L.Control.Geocoder.RaveGeo(serviceUrl, scheme, options);
	};

	L.Control.Geocoder.MapQuest = L.Class.extend({
		initialize: function(key) {
			// MapQuest seems to provide URI encoded API keys,
			// so to avoid encoding them twice, we decode them here
			this._key = decodeURIComponent(key);
		},

		_formatName: function() {
			var r = [],
				i;
			for (i = 0; i < arguments.length; i++) {
				if (arguments[i]) {
					r.push(arguments[i]);
				}
			}

			return r.join(', ');
		},

		geocode: function(query, cb, context) {
			L.Control.Geocoder.jsonp('http://www.mapquestapi.com/geocoding/v1/address', {
				key: this._key,
				location: query,
				limit: 5,
				outFormat: 'json'
			}, function(data) {
				var results = [],
					loc,
					latLng;
				if (data.results && data.results[0].locations) {
					for (var i = data.results[0].locations.length - 1; i >= 0; i--) {
						loc = data.results[0].locations[i];
						latLng = L.latLng(loc.latLng);
						results[i] = {
							name: this._formatName(loc.street, loc.adminArea4, loc.adminArea3, loc.adminArea1),
							bbox: L.latLngBounds(latLng, latLng),
							center: latLng
						};
					}
				}

				cb.call(context, results);
			}, this);
		},

		reverse: function(location, scale, cb, context) {
			L.Control.Geocoder.jsonp('http://www.mapquestapi.com/geocoding/v1/reverse', {
				key: this._key,
				location: location.lat + ',' + location.lng,
				outputFormat: 'json'
			}, function(data) {
				var results = [],
					loc,
					latLng;
				if (data.results && data.results[0].locations) {
					for (var i = data.results[0].locations.length - 1; i >= 0; i--) {
						loc = data.results[0].locations[i];
						latLng = L.latLng(loc.latLng);
						results[i] = {
							name: this._formatName(loc.street, loc.adminArea4, loc.adminArea3, loc.adminArea1),
							bbox: L.latLngBounds(latLng, latLng),
							center: latLng
						};
					}
				}

				cb.call(context, results);
			}, this);
		}
	});

	L.Control.Geocoder.mapQuest = function(key) {
		return new L.Control.Geocoder.MapQuest(key);
	};

	return L.Control.Geocoder;
}));
