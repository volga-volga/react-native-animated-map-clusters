// @flow
import { Dimensions } from 'react-native';
import { Region } from 'react-native-maps';
import type {
  Cluster,
  InnerCluster,
  Point,
} from './types';

const { height, width } = Dimensions.get('window');

export function calcDistanceSqr(marker1: Point, marker2: Point) {
  const { longitude: x1, latitude: y1 } = marker1;
  const { longitude: x2, latitude: y2 } = marker2;
  return ((x1 - x2) * (x1 - x2)) + ((y1 - y2) * (y1 - y2));
}

export function calcCenter(points: Array<Point>) {
  let longitude = 0;
  let latitude = 0;
  for (let i = 0; i < points.length; ++i) {
    longitude += points[i].longitude;
    latitude += points[i].latitude;
  }
  longitude /= points.length;
  latitude /= points.length;
  return {
    longitude,
    latitude,
  };
}

export function convertPtInDistance(region: Region, distance: number, mapHeight: number = height) {
  return (region.latitudeDelta / mapHeight) * distance;
}

export function calcRegionForMarkers(markers: Array<Point>): Region {
  let minLat = markers[0].latitude;
  let maxLat = markers[0].latitude;
  let minLong = markers[0].longitude;
  let maxLong = markers[0].longitude;
  for (let i = 0; i < markers.length; i++) {
    if (markers[i].longitude < minLong) {
      minLong = markers[i].longitude;
    }
    if (markers[i].latitude < minLat) {
      minLat = markers[i].latitude;
    }
    if (markers[i].longitude > maxLong) {
      maxLong = markers[i].longitude;
    }
    if (markers[i].latitude > maxLat) {
      maxLat = markers[i].latitude;
    }
  }
  const region = {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLong + maxLong) / 2,
    latitudeDelta: (maxLat - minLat) * 1.3,
    longitudeDelta: (maxLong - minLong) * 1.3,
  };
  const minLongDelta = (width / height) * region.latitudeDelta;
  const minLatDelta = (height / width) * region.longitudeDelta;
  region.latitudeDelta = Math.max(minLatDelta, region.latitudeDelta);
  region.longitudeDelta = Math.max(minLongDelta, region.longitudeDelta);
  return region;
}

export function calcCommonMarkersCount(first: InnerCluster, second: InnerCluster): number {
  let commonMarkersCount = 0;
  for (let x = 0; x < first.points.length; x++) {
    for (let y = 0; y < second.points.length; y++) {
      if (first.points[x] === second.points[y]) {
        ++commonMarkersCount;
        break;
      }
    }
  }
  return commonMarkersCount;
}
