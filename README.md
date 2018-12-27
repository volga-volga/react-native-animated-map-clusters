# react native animated map clusters

Module that adds map clustering with smooth marker's movement

<img src="https://raw.githubusercontent.com/volga-volga/react-native-animated-map-clusters/master/demo.gif" width="250px"/>

## Note

You need to install  https://github.com/react-community/react-native-maps

## Installation

```sh
yarn add react-native-animated-map-clusters
# or
npm i --save react-native-animated-map-clusters
```

## Usage
```jsx harmony
import { Marker } from 'react-native-maps';
import ClusteringMap from 'react-native-animated-map-clusters';
import marker from './marker.png';

<ClusteringMap
  initialRegion={this.state.region}
  minDistance={40}
  moveDuration={300}
  onPressCluster={this.handlePressCluster}
  onPressMarker={this.handlePressMarker}
  style={styles.map}
>
  {markers.map((coord) => (
    <Marker
      coordinate={coord}
      key={i}
    >
      <Image
        source={marker}
        style={styles.markerStyle}
      />
    </Marker>
  ))}
</ClusteringMap>
```

## Props
- All MapView props
- **minDistance**: `number`

Distance to collapse markers. Default: 30

- **moveDuration**: `number`

Marker's movement duration (ms). Default: 300

- **onPressCluster**: `function`

onPress prop for clusters. Receive `Cluster` object:
```flow js
type Point ={
  longitude: number,
  latitude: number,
}
type Cluster = {
  points: Array<Point>,
  center: Point,
}
```

- **onPressCluster**: `function`

onPress prop for marker. Receive marker's coordinate and index in children array

- **innerRef**: `function`

ref prop for MapView

- **children**: `Marker | Array<Marker>`
Only Marker's supported now.

- **showClusters**: `boolean`
Set true, if you want to show clusters components. Otherwise markers will be merged without count indicator.

- **renderCluster**: `(cluster: Cluster, props: Props) => ReactNode,`
Method for render custom clusters.

**Note:** 
For forwarding ref prop in marker use innerRef prop.
You should to use cluster component which will be greater then marker.

## Functions

- **animatedMoveToMarkers**: `(markers: Point, duration: number) => void`
 
Set region which contain all `markers`

Example:
```jsx harmony
this.map.animatedMoveToMarkers(this.markers, 50);
```
