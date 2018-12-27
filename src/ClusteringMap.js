// @flow
import React from 'react';
import type { Node as ReactNode} from 'react';
import { View, Text, StyleSheet } from 'react-native';
import MapView, {
  AnimatedRegion,
  Region,
  MarkerAnimated,
  Marker,
} from 'react-native-maps';
import hash from 'object-hash';
import {
  calcCenter,
  calcCommonMarkersCount,
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
  renderCluster?: (cluster: Cluster, props: Props) => ReactNode,
  innerRef: (r: ?MapView) => void,
  initialRegion?: Region,
  region?: Region,
  showClusters?: boolean,
  children: Marker | MarkerAnimated | Array<Marker | MarkerAnimated>,
};

const styles = StyleSheet.create({
  clusterContainer: {
    width: 45,
    height: 45,
    borderRadius: 30,
    borderWidth: 2,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

type State = {
  markers: Array<AnimatedRegion>,
  clusters: Array<InnerCluster & { center: AnimatedRegion }>,
};

type ClusterWithHash = InnerCluster & { hash: string };

export default class ClusteringMap extends React.Component<Props, State> {
  clusters: ClusterWithHash[] = [];

  map: ?MapView = null;

  mapHeight: number = 0;

  region: ?Region = this.props.initialRegion || this.props.region;

  markers: {[number]: MarkerAnimated} = {};

  MIN_DISTANCE_SQR: number = 0;

  state = {
    // $FlowFixMe
    markers: this.getChildren().map((marker: Marker | MarkerAnimated) => new AnimatedRegion(marker.props.coordinate)),
    clusters: [],
  };

  handleLayout = this.handleLayout.bind(this);

  setMapComponent = this.setMapComponent.bind(this);

  handleChangeRegion = this.handleChangeRegion.bind(this);

  handleMarkerPress = this.handleMarkerPress.bind(this);

  setMarker = this.setMarker.bind(this);

  renderMarker = this.renderMarker.bind(this);

  renderCluster = this.renderCluster.bind(this);

  zoom: boolean = false;

  static defaultProps = {
    showClusters: true,
    minDistance: 30,
    moveDuration: 300,
    initialRegion: undefined,
    renderCluster: undefined,
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

  animateMarkerToCoordinate(animated: ?AnimatedRegion, center: Point) {
    if (animated) {
      animated.timing({
        ...center,
        duration: this.props.moveDuration
      }).start();
    }
  }

  animateClusterToCoordinate(cluster: ClusterWithHash, center: Point) {
    if (cluster) {
      this.animateMarkerToCoordinate(cluster.center, center);
    }
  }

  moveDividedClusters(clusters: ClusterWithHash[]) {
    if (this.zoom) {
      const parents = [];
      for (let i = 0; i < clusters.length; ++i) {
        for (let k = 0; k < this.clusters.length; k++) {
          let commonMarkersCount = calcCommonMarkersCount(clusters[i], this.clusters[k]);
          if (commonMarkersCount > 0) {
            parents[i] = k;
            break;
          }
        }
      }
      this.setState({
        clusters: clusters.map((i, index) => ({
          ...i,
          center: new AnimatedRegion(this.clusters[parents[index]].center),
        }))
      }, () => {
        for (let i = 0; i < this.state.clusters.length; ++i) {
          this.animateClusterToCoordinate(this.state.clusters[i], clusters[i].center);
        }
      });
    }
  }

  moveMergedClusters(cluster: ClusterWithHash, alreadyMoved: { [string]: boolean }) {
    if (!this.zoom) {
      for (let k = 0; k < this.clusters.length; k++) {
        if (!alreadyMoved[this.clusters[k].hash]) {
          let commonMarkersCount = calcCommonMarkersCount(cluster, this.clusters[k]);
          if (commonMarkersCount > 0) {
            alreadyMoved[this.clusters[k].hash] = true;
            this.animateClusterToCoordinate(this.state.clusters[k], cluster.center);
          }
        }
      }
    }
  }

  overwriteClustersAfterMerge() {
    if (!this.zoom) {
      setTimeout(() => {
        this.setState({
          clusters: this.clusters.map(i => ({
            ...i,
            center: new AnimatedRegion(i.center)
          }))
        });
      }, this.props.moveDuration);
    }
  }

  onEndClustering(clusters: ClusterWithHash[]) {
    this.moveDividedClusters(clusters);
    const alreadyMoved = {};
    for (let i = 0; i < clusters.length; i++) {
      let isExist = false;
      for (let k = 0; k < this.clusters.length; k++) {
        if (this.clusters[k].hash === clusters[i].hash) {
          isExist = true;
          break;
        }
      }
      if (!isExist) {
        this.moveMergedClusters(clusters[i], alreadyMoved);
        for (let j = 0; j < clusters[i].points.length; ++j) {
          this.animateMarkerToCoordinate(this.state.markers[clusters[i].points[j]], clusters[i].center);
        }
      }
    }
    this.clusters = clusters;
    this.overwriteClustersAfterMerge();
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
        hash: hash.sha1(clusters[i]),
      });
    }
    return clusterInfo;
  }

  handleLayout(event: { nativeEvent: {layout: { height: number }} }) {
    this.mapHeight = event.nativeEvent.layout.height;
  }

  makeCluster(cluster: InnerCluster): Cluster {
    return {
      center: cluster.center,
      points: cluster.points.map((index: number) => this.getChildren()[index].props.coordinate),
    };
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
          const cluster = this.makeCluster(this.clusters[i]);
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
    this.zoom = Boolean(this.region && this.region.latitudeDelta > region.latitudeDelta);
    this.region = region;
    const clusters = this.calcClusters(region);
    this.onEndClustering(clusters);
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
    const style = this.props.showClusters ? markerComp.props.style : [markerComp.props.style, { zIndex: i }];
    return (
      <MarkerAnimated
        {...markerComp.props}
        coordinate={marker}
        key={i}
        onPress={this.handleMarkerPress}
        ref={this.setMarker(i)}
        style={style}
      />
    );
  }

  renderCluster(marker: InnerCluster, i: number) {
    if (marker.points.length === 1) {
      return null;
    }
    // $FlowFixMe
    const clusterView = this.props.renderCluster ? this.props.renderCluster(this.makeCluster(marker), this.props) : (
      <View style={styles.clusterContainer}>
        <Text>{marker.points.length}</Text>
      </View>
    );
    return (
      <MarkerAnimated
        coordinate={marker.center}
        key={'cluster'+i}
        onPress={this.handleMarkerPress}
        style={{ zIndex: i + 1000 }}
      >
        {clusterView}
      </MarkerAnimated>
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
        {this.state.clusters.map(this.renderCluster)}
      </MapView>
    );
  }
}
