# NavCaster

A prototype maritime weather forecasting and navigation application.

Parse latest GFS on disk:
```
curl -X POST "http://localhost:3002/api/gfs/wind/reload?latest=1"
```
