export type {
  BoardingPoint,
  ClientLocation,
  BusLocation,
  MapProps,
} from '@/components/Map';

export interface RoadInfo {
  distance: string;
  duration: string;
  summary?: string;
  roadFound: boolean;
}
