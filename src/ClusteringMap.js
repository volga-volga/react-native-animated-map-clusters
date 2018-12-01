// @flow
import React from 'react';
import MapView, {
  AnimatedRegion,
  Region,
  MarkerAnimated,
  Marker,
} from 'react-native-maps';
import {
  calcCenter,
  calcDistanceSqr,
  calcRegionForMarkers,
  convertPtInDistance,
} from './functions';
import type {
  PressEvent,
  InnerCluster,
  Point,
  Cluster,
} from './types';

type Props = {
  moveDuration?: number,
  minDistance?: number,
  onPressCluster?: (cluster: Cluster) => void,
  onPressMarker?: (point: Point, index: number) => void,
  onRegionChangeComplete?: (region: Region) => void,
  innerRef: (r: ?MapView) => void,
  initialRegion?: Region,
  region?: Region,
  children: Marker | MarkerAnimated | Array<Marker | MarkerAnimated>,
};

type State = {
  markers: Array<AnimatedRegion>,
};

export default class ClusteringMap extends React.Component<Props, State> {
  clusters: Array<InnerCluster> = [];

  map: ?MapView = null;

  mapHeight: number = 0;

  region: ?Region = this.props.initialRegion || this.props.region;

  markers: {[number]: MarkerAnimated} = {};

  MIN_DISTANCE_SQR: number = 0;

  state = {
    // $FlowFixMe
    markers: this.getChildren().map((marker: Marker | MarkerAnimated) => new AnimatedRegion(marker.props.coordinate)),
  };

  handleLayout = this.handleLayout.bind(this);

  setMapComponent = this.setMapComponent.bind(this);

  handleChangeRegion = this.handleChangeRegion.bind(this);

  handleMarkerPress = this.handleMarkerPress.bind(this);

  setMarker = this.setMarker.bind(this);

  renderMarker = this.renderMarker.bind(this);

  static defaultProps = {
    minDistance: 30,
    moveDuration: 300,
    initialRegion: undefined,
    region: undefined,
    onPressCluster: undefined,
    onPressMarker: undefined,
    onRegionChangeComplete: undefined,
  };

  componentDidUpdate(prevProps: Props): void {
    if (prevProps.children !== this.props.children) {
      if ((
        JSON.stringify(this.getChildren(prevProps.children, true).map(i => i.props.coordinate)) !==
        JSON.stringify(this.getChildren().map(i => i.props.coordinate))
      )) {
        this.setState({
          markers:
            this.getChildren().map((marker: Marker | MarkerAnimated) => new AnimatedRegion(marker.props.coordinate)),
        }, () => {
          this.updateClusters(this.region);
        });
      }
    }
  }

  onEndClustering(clusters: Array<InnerCluster>) {
    const { markers } = this.state;
    for (let i = 0; i < clusters.length; i++) {
      for (let j = 0; j < clusters[i].points.length; ++j) {
        if (this.state.markers[clusters[i].points[j]]) {
          markers[clusters[i].points[j]].timing({ ...clusters[i].center, duration: this.props.moveDuration }).start();
        }
      }
    }
  }

  getChildren(children?: MarkerAnimated | Marker | Array<MarkerAnimated | Marker>, force: boolean = false)
    : Array<MarkerAnimated | Marker> {
    const child = force ? children : this.props.children;
    if (Array.isArray(child)) {
      return child;
    }
    return child ? [child] : [];
  }

  animatedMoveToMarkers(markers: Array<Point>, duration: number = 50) {
    const region = calcRegionForMarkers(markers);
    if (this.map) {
      this.map.animateToRegion(region, duration);
    }
  }

  getCenter(cluster: Array<number>) {
    return calcCenter(cluster.map(i => this.getChildren()[i].props.coordinate));
  }

  calcDistance(a: Array<number>, b: Array<number>) {
    return calcDistanceSqr(this.getCenter(a), this.getCenter(b));
  }

  mergeClusters(a: Array<number>, b: Array<number>) {
    return [...a, ...b];
  }

  calc(clusters: Array<Array<number>>) {
    let newClusters;
    for (let i = 0; i < clusters.length; ++i) {
      for (let j = i + 1; j < clusters.length; ++j) {
        const dist = this.calcDistance(clusters[i], clusters[j]);
        if (dist < this.MIN_DISTANCE_SQR) {
          newClusters = [...clusters];
          newClusters.splice(j, 1);
          newClusters[i] = this.mergeClusters(clusters[i], clusters[j]);
          return this.calc(newClusters);
        }
      }
    }
    return clusters;
  }

  calcClusters(region: Region) {
    const MIN_DISTANCE = convertPtInDistance(region, this.props.minDistance || 30, this.mapHeight);
    this.MIN_DISTANCE_SQR = MIN_DISTANCE * MIN_DISTANCE;
    const clusters = this.calc(new Array(this.getChildren().length).fill(1)
      .map((i, index) => [index]));
    const clusterInfo = [];
    for (let i = 0; i < clusters.length; ++i) {
      const clusterCenter = calcCenter(clusters[i].map(k => this.getChildren()[k].props.coordinate));
      clusterInfo.push({
        center: clusterCenter,
        points: clusters[i],
      });
    }
    return clusterInfo;
  }

  handleLayout(event: { nativeEvent: {layout: { height: number }} }) {
    this.mapHeight = event.nativeEvent.layout.height;
  }

  handleMarkerPress(event: PressEvent) {
    const { coordinate } = event.nativeEvent;
    for (let i = 0; i < this.clusters.length; ++i) {
      const { center } = this.clusters[i];
      if (center.latitude === coordinate.latitude && center.longitude === coordinate.longitude) {
        if (this.clusters[i].points.length === 1) {
          const index: number = this.clusters[i].points[0];
          const coord: Point = this.getChildren()[index].props.coordinate;
          if (this.props.onPressMarker) {
            this.props.onPressMarker(coord, index);
          }
        } else {
          const cluster = {
            center: this.clusters[i].center,
            points: this.clusters[i].points.map((index: number) => this.getChildren()[index].props.coordinate),
          };
          if (this.props.onPressCluster) {
            this.props.onPressCluster(cluster);
          }
        }
      }
    }
  };

  setMarker(i: number) {
    return (marker: MarkerAnimated) => {
      this.markers[i] = marker;
      const child = this.getChildren()[i];
      if (child) {
        const { innerRef } = child.props;
        if (innerRef) {
          innerRef(marker);
        }
      }
    };
  }

  setMapComponent(map: ?MapView) {
    this.map = map;
    if (this.props.innerRef) {
      this.props.innerRef(map);
    }
  }

  updateClusters(region:Region) {
    this.region = region;
    this.clusters = this.calcClusters(region);
    this.onEndClustering(this.clusters);
  }

  handleChangeRegion(region: Region) {
    this.updateClusters(region);
    if (this.props.onRegionChangeComplete) {
      this.props.onRegionChangeComplete(region);
    }
  }

  renderMarker(marker: AnimatedRegion, i: number) {
    const markerComp = this.getChildren()[i];
    if (!markerComp) {
      return null;
    }
    return (
      <MarkerAnimated
        {...markerComp.props}
        coordinate={marker}
        key={i}
        onPress={this.handleMarkerPress}
        ref={this.setMarker(i)}
      />
    );
  }

  render() {
    return (
      <MapView
        {...this.props}
        onLayout={this.handleLayout}
        onRegionChangeComplete={this.handleChangeRegion}
        ref={this.setMapComponent}
      >
        {this.state.markers.map(this.renderMarker)}
      </MapView>
    );
  }
}
