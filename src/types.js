// @flow
export type Point = {
  latitude: number,
  longitude: number,
};

export type InnerCluster = {
  center: Point,
  points: Array<number>
};

export type Cluster = {
  center: Point,
  points: Array<Point>
};

export type PressEvent = {
  nativeEvent: {
    coordinate: Point,
  },
};
