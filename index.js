/* 
Leaflet.DrawingManager.js 
Licensed under the MIT License: https://opensource.org/licenses/MIT
*/

let DRAWING_MODE_MARKER = "marker";
let DRAWING_MODE_CIRCLE = "circle";
let DRAWING_MODE_AREA = "area";

(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? factory() :
        typeof define === 'function' && define.amd ? define(['exports'], factory) :
            (factory((global.L = {})));

}(this, (function () {
    'use strict';

    L.DrawingManager = (L.Layer ? L.Layer : L.Class).extend({

        CIRCLE_CENTRE_COMPLETE: 'draw:circle_center_complete',
        CIRCLE_RADIUS_CHANGE: 'draw:circle_radius_change',
        CIRCLE_RADIUS_COMPLETE: 'draw:circle_radius_complete',
        CIRCLE_CENTRE_CHANGE: 'draw:circle_centre_change',
        MARKER_CENTER_CLICK: 'draw:marker_click',


        initialize: function (map, opts) {

            let me = this;

            me.map = map;
            me._opts = opts;
            me._drawingType = opts.drawingMode || DRAWING_MODE_MARKER;
            me._fitBounds = opts._fitBounds || true;
            me.markerOptions = opts.markerOptions || {};
            me.circleOptions = opts.circleOptions || {};
            me.areaOptions = opts.areaOptions || {};
            me._enableDraw = opts.enableDraw;
            me.radius = opts.circleOptions.radius;

            me.map.on('zoom', () => {
                me.map.fire('draw:zoom_map', me._getZoom());
            });
        },


        setDrawingMode: function (drawingType) {

            let me = this;

            this._drawingType = drawingType;

            switch (drawingType) {
                case DRAWING_MODE_MARKER:
                    me._bindMarker();
                    break;
                case DRAWING_MODE_CIRCLE:
                    me._bindCircle();
                    break;
                case DRAWING_MODE_AREA:
                    me._bindArea();
                    break;
                    default:
                    me._redraw();
                    break;
            }
        },

        _bindMarker: function () {

            let me = this;

            me.map.off('mousedown');
            me.map.off('click');

            me._removeCenterMarker();
            me._removeCircle();

            var createcenterMarker = (e) => {

                me._removeArea();
                me._removeCenterMarker();
                me._removeCircle();


                if (e) {
                    me._setPosition(e);
                }

                if (me.position) {

                    const icon = L.icon({
                        iconUrl: me.markerOptions.iconUrl,
                    });

                    me._centerMarker = new L.marker(me.position, { draggable: false, icon: icon });
                    me.map.addLayer(me._centerMarker);
                    me._centerMarker.getElement().style.cursor = 'default';

                    me.map.setView(me.position, 9);
                    me.position = null;
                    me._centerMarkerAddEventListener();
                    me.map.fire('draw:marker_create', null);

                }
            }

            if (!this._enableDraw) {
                createcenterMarker();
                me.map.off('click');
            }

            this.map.on('click', (event) => {
                if (this._enableDraw) {
                    createcenterMarker(event);
                }
            });
        },

        _bindCircle: function () {

            let me = this;

            if (me.circle) {
                me.map.removeLayer(me.circle);
                me.map.removeLayer(me._vertexMarker);
                me.map.fire('draw:circle_remove', null);
            }

            if (me._centerMarker) {

                me.circle = new L.circle(me._centerMarker.getLatLng(), {
                    color: me.circleOptions.fillColor,
                    fillOpacity: me.circleOptions.fillOpacity,
                    strokeOpacity: me.circleOptions.strokeOpacity,
                    radius: me.circleOptions.radius,
                    strokeColor: me.circleOptions.strokeColor,
                    strokeWeight: me.circleOptions.strokeWeight,
                    radius: me.radius
                });

                me.map.addLayer(me.circle);
                me._centerMarker.getElement().style.cursor = 'move';
                me._centerMarker.setZIndexOffset(99999);
                me._centerMarker.dragging.enable();

                me.map.fitBounds(me.circle.getBounds());

                me._createVertexMarker();

                me.map.fire('draw:circle_create', me._getInfo());

            }
        },


        _bindArea: function () {

            var me = this;

            me._removeArea();
            me._removeCenterMarker();
            me._removeCircle();

            var createArea = () => {

                me._removeArea();

                var patch = [];

                me._setDrawing(false);

                let options = {
                    strokeColor: me.areaOptions.strokeColor,
                    strokeOpacity: me.areaOptions.strokeOpacity,
                    color: me.areaOptions.fillColor,
                    fillOpacity: me.areaOptions.fillOpacity,
                    strokeWeight: me.areaOptions.strokeWeight,
                }

                me.area = new L.polyline([], options).addTo(me.map);

                me.map.on('mousemove', (event) => {
                    patch.push(event.latlng)
                    me.area.setLatLngs(patch);

                });

                me.map.once('mouseup', () => {

                    me.map.off('mousemove');
                    me.map.removeLayer(me.area);

                    me.area = new L.polygon(patch, options).addTo(me.map);
                    me._setDrawing(true);

                    me.map.fire('draw:area_create', me._convertCoordinates(patch));

                    me._fitBoundsArea(patch);
                });
            }

            this.map.once('mousedown', () => {
                createArea();
            });
        },

        _redraw: function () {

            let me = this;

            me._removeArea();
            me._removeCenterMarker();
            me._removeCircle();
        },


        _removeCircle: function () {

            let me = this;

            if (me.circle) {
                me.map.removeLayer(me.circle);
                me.map.removeLayer(me._vertexMarker);
                me.circle = null;
                me._vertexMarker = null;
                me.map.fire('draw:circle_remove', null);
            }
        },

        _removeCenterMarker: function () {

            let me = this;

            if (me._centerMarker) {
                me.map.removeLayer(me._centerMarker);
                me._centerMarker = null;
                me.map.fire('draw:marker_remove', null);
            }
        },

        _removeArea: function () {

            let me = this;

            if (me.area) {
                me.map.removeLayer(me.area);
                me.area = null;
                me.map.fire('draw:area_remove', null);
            }
        },

        _setDrawing: function (enabled) {

            let me = this;

            enabled ? me.map.dragging.enable() : me.map.dragging.disable();
            enabled ? me.map.scrollWheelZoom.enable() : me.map.scrollWheelZoom.disable();
            enabled ? me.map.doubleClickZoom.enable() : me.map.doubleClickZoom.disable();
        },

        _fitBoundsArea: function () {

            let me = this;

            if (me.area) {
                me.map.fitBounds(me.area.getBounds());
            }
        },

        _convertCoordinates: function (coordinates) {

            let positions = [];

            for (var n = 0; n < coordinates.length; n++) {
                let item = coordinates[n];
                let position = {
                    latitude: item.lat,
                    longitude: item.lng,
                }
                positions.push(position);
            }
            return positions;

        },

        setEnableDraw: function (enabled) {

            this._enableDraw = enabled;
        },

        destination: function (latlng, heading, distance) {
            heading = (heading + 360) % 360;
            var rad = Math.PI / 180,
                radInv = 180 / Math.PI,
                R = 6378137,
                lon1 = latlng.lng * rad,
                lat1 = latlng.lat * rad,
                rheading = heading * rad,
                sinLat1 = Math.sin(lat1),
                cosLat1 = Math.cos(lat1),
                cosDistR = Math.cos(distance / R),
                sinDistR = Math.sin(distance / R),
                lat2 = Math.asin(sinLat1 * cosDistR + cosLat1 *
                    sinDistR * Math.cos(rheading)),
                lon2 = lon1 + Math.atan2(Math.sin(rheading) * sinDistR *
                    cosLat1, cosDistR - sinLat1 * Math.sin(lat2));
            lon2 = lon2 * radInv;
            lon2 = lon2 > 180 ? lon2 - 360 : lon2 < -180 ? lon2 + 360 : lon2;
            return L.latLng([lat2 * radInv, lon2]);
        },

        _setPosition: function (event) {

            let me = this;
            me.position = null;

            if (event) {
                me.position = event.latlng
            }
        },

        setPosition: function (latitude, longitude) {

            let me = this;
            me.position = null;
            me.position = new L.LatLng(latitude, longitude)
        },

        _createVertexMarker: function () {

            var to = this.destination(this._centerMarker.getLatLng(), 90, this.radius);

            let svg = [
                '<?xml version="1.0"?>',
                '<svg width="15px" height="15px" viewBox="0 0 100 100" version="1.1" xmlns="http://www.w3.org/2000/svg">',
                '<circle stroke="#003dd9" fill="white" stroke-width="10" cx="50" cy="50" r="35"/>',
                '</svg>'
            ].join('\n');

            const icon = L.icon({
                iconUrl: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg),
                iconAnchor: [7, 10],
                iconSize: [15, 15]
            });

            this._vertexMarker = new L.marker(to, { draggable: true, icon: icon }).addTo(this.map);
            this._vertexMarker.getElement().style.cursor = 'col-resize';

            this._vertexMarkerAddEventListener();
        },

        redraw: function () { },

        _vertexMarkerAddEventListener: function () {

            let me = this;

            me._vertexMarker.on('drag', function (event) {

                let distance = L.latLng(me._centerMarker.getLatLng()).distanceTo(event.latlng);

                me.radius = distance;

                if (me.circle) {
                    me.circle.setRadius(distance);
                }

                let pixel = {
                    clientX: event.originalEvent.clientX + 3,
                    clientY: event.originalEvent.clientY + 2,
                }
                let ev = {
                    pixel,
                    radius: me.circle.getRadius(),

                }

                me.map.fire('draw:circle_radius_change', ev);
            });

            me._vertexMarker.on('dragend', function () {

                me.map.fire('draw:circle_radius_complete', me._getInfo());
            });

        },

        _centerMarkerAddEventListener: function () {

            let me = this;

            me._centerMarker.on('drag', function (event) {

                me.circle.setLatLng(event.latlng);
                let to = me.destination(event.latlng, 90, me.radius);
                if (me._vertexMarker) {
                    me._vertexMarker.setLatLng(to);
                }

                me.map.fire('draw:circle_centre_change', me._getInfo());
            });

            me._centerMarker.on('dragend', function () {

                me.map.fire('draw:circle_center_complete', me._getInfo());

            });

            me._centerMarker.on('mouseover', function () {

                me.map.fire('draw:marker_mouseover', me._getInfo());

            });

            me._centerMarker.on('mouseout', function () {

                me.map.fire('draw:marker_mouseout', me._getInfo());

            });


            me._centerMarker.on('click', function () {

                me.map.fire('draw:marker_click', me._getInfo());
            });
        },

        _getInfo: function () {

            let me = this;

            let position = {
                latitude: me._centerMarker.getLatLng().lat,
                longitude: me._centerMarker.getLatLng().lng
            }
            let info = {
                radius: me.circle.getRadius(),
                position,
            };

            return info;
        },

        _getZoom: function () {

            let me = this;

            let zoom = {
                zoom: me.map.getZoom()
            }
            return zoom;
        },


        _getPosition: function () {

            let me = this;

            let position = {
                latitude: me._centerMarker.getLatLng().lat,
                longitude: me._centerMarker.getLatLng().lng
            }

            return position;
        },

        onAdd: function (map) {
            this._map = map;
        },

        onRemove: function (map) { },

        addTo: function (map) {
            map.addLayer(this);
            return this;
        },

        _reset: function () { },

    });

})));
