/**
 * Copyright 2023 ACSONE SA/NV
 */

import {Component, onMounted, onRendered, onWillStart, useEffect} from "@odoo/owl";
import {loadBundle} from "@web/core/assets";
import {registry} from "@web/core/registry";
import {standardFieldProps} from "@web/views/fields/standard_field_props";
import {useService} from "@web/core/utils/hooks";

export class FieldGeoEngineEditMap extends Component {
    setup() {
        // Allows you to have a unique id if you put the same field in the view several times
        this.id = `map_${this.props.id}`;
        this.orm = useService("orm");
        this.ol = undefined;

        onWillStart(() =>
            Promise.all([loadBundle("base_geoengine.assets_jsLibs_geoengine")])
        );

        // Is executed when component is mounted.
        onMounted(async () => {
            const result = await this.orm.call(
                this.props.record.resModel,
                "get_edit_info_for_geo_column",
                [this.props.name]
            );
            this.projection = result.projection;
            this.defaultExtent = result.default_extent;
            this.defaultZoom = result.default_zoom;
            this.restrictedExtent = result.restricted_extent;
            this.srid = result.srid;
            this.createLayers();
            this.renderMap();
            this.setValue(this.props.record.data[this.props.name]);
        });

        useEffect(
            () => {
                if (!this.props.readonly && this.map !== undefined) {
                    this.setupControls();
                }
            },
            () => [this.props.record.data[this.props.name]]
        );

        // Is executed after component is rendered. When we use pagination.
        onRendered(() => {
            this.setValue(this.props.record.data[this.props.name]);
        });
    }

    /**
     * Displays geo data on the map using the collection of features.
     * @returns {*}
     */
    createVectorLayer() {
        this.features = new ol.Collection();
        this.source = new ol.source.Vector({features: this.features});
        const colorHex = this.props.color === undefined ? "#ee9900" : this.props.color;
        const opacity = this.props.opacity === undefined ? 1 : this.props.opacity;
        const color = chroma(colorHex).alpha(opacity).css();
        const fill = new ol.style.Fill({
            color: color,
        });
        const stroke = new ol.style.Stroke({
            color,
            width: 2,
        });
        return new ol.layer.Vector({
            source: this.source,
            style: new ol.style.Style({
                fill,
                stroke,
                image: new ol.style.Circle({
                    radius: 5,
                    fill,
                    stroke,
                }),
            }),
        });
    }

    /**
     * Call the method that creates the layer to display the geo data on the map.
     */
    createLayers() {
        this.vectorLayer = this.createVectorLayer();
    }

    /**
     * Displays a background for the layer being edited.
     * */
    createBackgroundLayer() {
        const background = this.props.background !== undefined ? this.props.background : 'osm';
        const token = session.mapbox_token || ""
        const styleUrl = this.props.styleUrl !== undefined ? this.props.styleUrl : 'mapbox://styles/mapbox/outdoors-v12'
        switch (background) {
            case "mb_wmts":
                const style = styleUrl.replace('mapbox://styles/', '');
                const style_layer = style.split('/')[1];
                const tilegrid_opt_mb = {};
                const source_opt_mb = {
                    layer: style_layer,
                    matrixSet: this.props.matrixSet !== undefined ? this.props.matrixSet : 'GoogleMapsCompatible',
                };
                const layer_opt_mb = {
                    title: "Background",
                    visible: true,
                    type: "base",
                    style: "default",
                };
                if (this.props.formatSuffix) {
                    source_opt_mb.format = this.props.formatSuffix;
                }
                if (this.props.requestEncoding) {
                    source_opt_mb.requestEncoding = this.props.requestEncoding;
                }
                if (this.props.projection) {
                    source_opt_mb.projection = ol.proj.get(this.props.projection);
                    if (source_opt_mb.projection) {
                        const projectionExtent = source_opt_mb.projection.getExtent();
                        tilegrid_opt_mb.origin =
                            ol.extent.getTopLeft(projectionExtent);
                    }
                }
                if (this.props.resolutions) {
                    tilegrid_opt_mb.resolutions = this.props.resolutions
                        .split(",")
                        .map(Number);
                    const nbRes = tilegrid_opt_mb.resolutions.length;
                    const matrixIds = new Array(nbRes);
                    for (let i = 0; i < nbRes; i++) {
                        matrixIds[i] = i;
                    }
                    tilegrid_opt_mb.matrixIds = matrixIds;
                    tilegrid_opt_mb.tileSize = [512, 512];
                }
                if (this.props.maxExtent) {
                    const extent = this.props.maxExtent.split(",").map(Number);
                    layer_opt_mb.extent = extent;
                    tilegrid_opt_mb.extent = extent;
                }
                source_opt_mb.url = 'https://api.mapbox.com/styles/v1/' + style + '/tiles/{TileMatrix}/{TileCol}/{TileRow}?access_token=' + token
                source_opt_mb.tileGrid = new ol.tilegrid.WMTS(tilegrid_opt_mb);
                layer_opt_mb.source = new ol.source.WMTS(source_opt_mb);
                return new ol.layer.Tile(layer_opt_mb);
            case 'mvt':
                const layer = new ol.layer.VectorTile({
                    title: "Background",
                    opacity: this.props.opacity,
                    visible: true,
                    declutter: true
                });
                olms.applyStyle(layer, styleUrl, {accessToken: token});
                return layer;
            default:
                return new ol.layer.Tile({
                    source: new ol.source.OSM(),
                });
        }
    }

    /**
     * Allows you to centre the area defined for the user.
     * If there is an item to display.
     */
    updateMapZoom() {
        if (this.source) {
            var extent = this.source.getExtent();
            var infinite_extent = [Infinity, Infinity, -Infinity, -Infinity];
            if (extent !== infinite_extent) {
                var map_view = this.map.getView();
                if (map_view) {
                    map_view.fit(extent, {maxZoom: this.defaultZoom || 15});
                }
            }
        }
    }

    /**
     * Allows you to centre the area defined for the user.
     * If there is not item to display.
     */
    updateMapEmpty() {
        var map_view = this.map.getView();
        if (map_view) {
            var extent = this.defaultExtent.replace(/\s/g, "").split(",");
            extent = extent.map((coord) => Number(coord));
            map_view.fit(extent, {maxZoom: this.defaultZoom || 5});
        }
    }

    /**
     * Based on the value passed in props, adds a new feature to the collection.
     * @param {*} value
     */
    setValue(value) {
        if (this.map) {
            /**
             * If the value to be displayed is equal to the one passed in props, do nothing
             * otherwise clear the map and display the new value.
             */
            if (this.displayValue === value) return;
            this.displayValue = value;
            const projection = {
                featureProjection: this.projection,
                dataProjection: 'EPSG:' + this.srid
            };
            var ft = new ol.Feature({
                geometry: new ol.format.GeoJSON().readGeometry(value, projection),
                labelPoint: new ol.format.GeoJSON().readGeometry(value, projection),
            });
            this.source.clear();
            this.source.addFeature(ft);

            if (value) {
                this.updateMapZoom();
            } else {
                this.updateMapEmpty();
            }
        }
    }

    /**
     * This is triggered when the view changed. When we have finished drawing our geo data, or
     * when we clear the map.
     * @param {*} geometry
     */
    onUIChange(geometry) {
        var value = null;
        if (geometry) {
            value = this.format.writeGeometry(geometry);
        }
        this.props.record.update({[this.props.name]: value});
    }

    /**
     * Allow you to setup the trash button and the draw interaction.
     */
    setupControls() {
        if (!this.props.record.data[this.props.name]) {
            void (
                this.selectInteraction !== undefined &&
                this.map.removeInteraction(this.selectInteraction)
            );
            void (
                this.modifyInteraction !== undefined &&
                this.map.removeInteraction(this.modifyInteraction)
            );
            this.drawInteraction = new ol.interaction.Draw({
                type: this.geoType,
                source: this.source,
            });
            this.map.addInteraction(this.drawInteraction);

            this.drawInteraction.on("drawend", (e) => {
                this.onUIChange(e.feature.getGeometry());
            });
        } else {
            void (
                this.drawInteraction !== undefined &&
                this.map.removeInteraction(this.drawInteraction)
            );
            this.selectInteraction = new ol.interaction.Select();
            this.modifyInteraction = new ol.interaction.Modify({
                features: this.selectInteraction.getFeatures(),
            });
            this.map.addInteraction(this.selectInteraction);
            this.map.addInteraction(this.modifyInteraction);

            this.modifyInteraction.on("modifyend", (e) => {
                e.features.getArray().forEach((item) => {
                    this.onUIChange(item.getGeometry());
                });
            });
        }

        const element = this.createTrashControl();

        this.clearmapControl = new ol.control.Control({element: element});

        this.map.addControl(this.clearmapControl);
    }

    /**
     * Create the trash button that clears the map.
     * @returns the div in which the button is located.
     */
    createTrashControl() {
        const button = document.createElement("button");
        button.innerHTML = '<i class="fa fa-trash"/>';
        button.addEventListener("click", () => {
            this.source.clear();
            this.onUIChange(null);
        });
        const element = document.createElement("div");
        element.className = "ol-clear ol-unselectable ol-control";
        element.appendChild(button);
        return element;
    }

    /**
     * Displays the map in the div provided.
     */
    renderMap() {
        this.map = new ol.Map({
            target: this.id,
            layers: [this.createBackgroundLayer()],
            view: new ol.View({
                center: [0, 0],
                zoom: 7,
            }),
        });
        this.map.addLayer(this.vectorLayer);
        this.format = new ol.format.GeoJSON({
            featureProjection: this.map.getView().getProjection(),
            dataProjection: 'EPSG:' + this.srid
        });

        if (!this.props.readonly) {
            this.setupControls();
        }
    }
}

FieldGeoEngineEditMap.template = "base_geoengine.FieldGeoEngineEditMap";
FieldGeoEngineEditMap.props = {
    ...standardFieldProps,
    opacity: {type: Number, optional: true},
    color: {type: String, optional: true},
    background: {type: String, optional: true},
    styleUrl: {type: String, optional: true},
    matrixSet: {type: String, optional: true},
    formatSuffix: {type: String, optional: true},
    requestEncoding: {type: String, optional: true},
    projection: {type: String, optional: true},
    resolutions: {type: String, optional: true},
};

export class FieldGeoEngineEditMapMultiPolygon extends FieldGeoEngineEditMap {
    setup() {
        this.geoType = "MultiPolygon";
        super.setup();
    }
}

export class FieldGeoEngineEditMapPolygon extends FieldGeoEngineEditMap {
    setup() {
        this.geoType = "Polygon";
        super.setup();
    }
}

export class FieldGeoEngineEditMapPoint extends FieldGeoEngineEditMap {
    setup() {
        this.geoType = "Point";
        super.setup();
    }
}

export class FieldGeoEngineEditMapMultiPoint extends FieldGeoEngineEditMap {
    setup() {
        this.geoType = "MultiPoint";
        super.setup();
    }
}

export class FieldGeoEngineEditMapLine extends FieldGeoEngineEditMap {
    setup() {
        this.geoType = "LineString";
        super.setup();
    }
}

export class FieldGeoEngineEditMapMultiLine extends FieldGeoEngineEditMap {
    setup() {
        this.geoType = "MultiLineString";
        super.setup();
    }
}


function extractProps({attrs, options}) {
    return {
        opacity: options.opacity,
        color: options.color,
        background: options.background,
        styleUrl: options.styleUrl,
        matrixSet: options.matrixSet,
        formatSuffix: options.formatSuffix,
        requestEncoding: options.requestEncoding,
        projection: options.projection,
        resolutions: options.resolutions,
    };
}

export const fieldGeoEngineEditMapMultiPolygon = {
    component: FieldGeoEngineEditMapMultiPolygon,
    extractProps,
};

export const fieldGeoEngineEditMapPolygon = {
    component: FieldGeoEngineEditMapPolygon,
    extractProps: (attrs) => FieldGeoEngineEditMap.extractProps(attrs),
};

export const fieldGeoEngineEditMapPoint = {
    component: FieldGeoEngineEditMapPoint,
    extractProps: (attrs) => FieldGeoEngineEditMap.extractProps(attrs),
};

export const fieldGeoEngineEditMapMultiPoint = {
    component: FieldGeoEngineEditMapMultiPoint,
    extractProps: (attrs) => FieldGeoEngineEditMap.extractProps(attrs),
};

export const fieldGeoEngineEditMapLine = {
    component: FieldGeoEngineEditMapLine,
    extractProps: (attrs) => FieldGeoEngineEditMap.extractProps(attrs),
};

export const fieldGeoEngineEditMapMultiLine = {
    component: FieldGeoEngineEditMapMultiLine,
    extractProps: (attrs) => FieldGeoEngineEditMap.extractProps(attrs),
};

registry.category("fields").add("geo_multi_polygon", fieldGeoEngineEditMapMultiPolygon);
registry.category("fields").add("geo_polygon", fieldGeoEngineEditMapPolygon);
registry.category("fields").add("geo_point", fieldGeoEngineEditMapPoint);
registry.category("fields").add("geo_multi_point", fieldGeoEngineEditMapMultiPoint);
registry.category("fields").add("geo_line", fieldGeoEngineEditMapLine);
registry.category("fields").add("geo_multi_line", fieldGeoEngineEditMapMultiLine);
