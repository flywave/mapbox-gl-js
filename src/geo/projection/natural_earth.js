// @flow
import LngLat from '../lng_lat.js';
import {clamp, degToRad, radToDeg} from '../../util/util.js';
import {mercatorZfromAltitude, MAX_MERCATOR_LATITUDE} from '../mercator_coordinate.js';
import type Transform from '../../geo/transform.js';
import Point from '@mapbox/point-geometry';
import FlatTileTransform from './flat_tile_transform.js';
import {farthestPixelDistanceOnPlane} from './far_z.js';
import type {Vec3} from 'gl-matrix';
import type {ElevationScale} from './index.js';

const maxPhi = degToRad(MAX_MERCATOR_LATITUDE);

export default {
    name: 'naturalEarth',
    center: [0, 0],
    range: [3.5, 7],
    isReprojectedInTileSpace: true,
    zAxisUnit: "meters",
    unsupportedLayers: ['custom'],

    project(lng: number, lat: number) {
        // based on https://github.com/d3/d3-geo, MIT-licensed
        lat = degToRad(lat);
        lng = degToRad(lng);

        const phi2 = lat * lat;
        const phi4 = phi2 * phi2;
        const x = lng * (0.8707 - 0.131979 * phi2 + phi4 * (-0.013791 + phi4 * (0.003971 * phi2 - 0.001529 * phi4)));
        const y = lat * (1.007226 + phi2 * (0.015085 + phi4 * (-0.044475 + 0.028874 * phi2 - 0.005916 * phi4)));

        return {
            x: (x / Math.PI + 0.5) * 0.5,
            y: 1 - (y / Math.PI + 1) * 0.5,
            z: 0
        };
    },

    unproject(x: number, y: number) {
        // based on https://github.com/d3/d3-geo, MIT-licensed
        x = (2 * x - 0.5) * Math.PI;
        y = (2 * (1 - y) - 1) * Math.PI;
        const epsilon = 1e-6;
        let phi = y;
        let i = 25;
        let delta = 0;
        let phi2 = phi * phi;

        do {
            phi2 = phi * phi;
            const phi4 = phi2 * phi2;
            delta = (phi * (1.007226 + phi2 * (0.015085 + phi4 * (-0.044475 + 0.028874 * phi2 - 0.005916 * phi4))) - y) /
                (1.007226 + phi2 * (0.015085 * 3 + phi4 * (-0.044475 * 7 + 0.028874 * 9 * phi2 - 0.005916 * 11 * phi4)));
            phi = clamp(phi - delta, -maxPhi, maxPhi);
        } while (Math.abs(delta) > epsilon && --i > 0);

        phi2 = phi * phi;
        const lambda = x / (0.8707 + phi2 * (-0.131979 + phi2 * (-0.013791 + phi2 * phi2 * phi2 * (0.003971 - 0.001529 * phi2))));

        const lng = clamp(radToDeg(lambda), -180, 180);
        const lat = radToDeg(phi);

        return new LngLat(lng, lat);
    },

    projectTilePoint(x: number, y: number): {x: number, y: number, z: number} {
        return {x, y, z: 0};
    },

    locationPoint(tr: Transform, lngLat: LngLat): Point {
        return tr._coordinatePoint(tr.locationCoordinate(lngLat), false);
    },

    pixelsPerMeter(lat: number, worldSize: number) {
        return mercatorZfromAltitude(1, lat) * worldSize;
    },

    farthestPixelDistance(tr: Transform): number {
        const pixelsPerMeter = this.pixelsPerMeter(tr.center.lat, tr.worldSize);
        return farthestPixelDistanceOnPlane(tr, pixelsPerMeter);
    },

    createTileTransform(tr: Transform, worldSize: number): Object {
        return new FlatTileTransform(tr, worldSize);
    },

    upVector(): Vec3 {
        return [0, 0, 1];
    },

    upVectorScale(): ElevationScale {
        return {metersToTile: 1, metersToLabelSpace: 1};
    }
};
