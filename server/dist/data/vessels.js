"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mockVessels = void 0;
exports.mockVessels = [
    {
        id: 'v001',
        name: 'MV Atlantic Pioneer',
        type: 'cargo',
        mmsi: '366998710',
        position: { lat: 29.5, lng: -88.2 },
        heading: 45,
        speed: 14.2,
        status: 'underway',
        route: [
            { lat: 29.5, lng: -88.2 },
            { lat: 30.8, lng: -85.1 },
            { lat: 32.0, lng: -81.0 },
            { lat: 32.8, lng: -79.9 }
        ]
    },
    {
        id: 'v002',
        name: 'MT Gulf Trader',
        type: 'tanker',
        mmsi: '366998711',
        position: { lat: 27.3, lng: -90.5 },
        heading: 280,
        speed: 11.5,
        status: 'underway',
        route: [
            { lat: 27.3, lng: -90.5 },
            { lat: 26.8, lng: -94.2 },
            { lat: 26.5, lng: -97.0 }
        ]
    },
    {
        id: 'v003',
        name: 'SS Caribbean Star',
        type: 'passenger',
        mmsi: '366998712',
        position: { lat: 24.5, lng: -83.0 },
        heading: 180,
        speed: 18.0,
        status: 'underway',
        route: [
            { lat: 24.5, lng: -83.0 },
            { lat: 23.1, lng: -82.3 },
            { lat: 21.5, lng: -80.0 },
            { lat: 20.0, lng: -76.8 }
        ]
    },
    {
        id: 'v004',
        name: 'RV Ocean Explorer',
        type: 'research',
        mmsi: '366998713',
        position: { lat: 26.0, lng: -86.5 },
        heading: 90,
        speed: 6.5,
        status: 'underway',
        route: [
            { lat: 26.0, lng: -86.5 },
            { lat: 26.2, lng: -84.0 },
            { lat: 26.5, lng: -82.0 }
        ]
    },
    {
        id: 'v005',
        name: 'MV Bayou Express',
        type: 'cargo',
        mmsi: '366998714',
        position: { lat: 28.9, lng: -89.3 },
        heading: 0,
        speed: 0,
        status: 'anchored',
        route: []
    },
    {
        id: 'v006',
        name: 'MT Southern Cross',
        type: 'tanker',
        mmsi: '366998715',
        position: { lat: 25.7, lng: -80.2 },
        heading: 350,
        speed: 12.8,
        status: 'underway',
        route: [
            { lat: 25.7, lng: -80.2 },
            { lat: 27.5, lng: -80.0 },
            { lat: 30.3, lng: -81.4 },
            { lat: 32.0, lng: -80.9 }
        ]
    }
];
