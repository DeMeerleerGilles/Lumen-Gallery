export interface ExifMetadata {
  camera?: string;
  lens?: string;
  aperture?: string;
  shutterSpeed?: string;
  iso?: number;
  dateTaken?: string;
  latitude?: number;
  longitude?: number;
}

export interface Photo {
  id: number;
  albumId: number;
  filename: string;
  relativePath: string;
  thumbPath: string;
  mediumPath: string;
  largePath: string;
  width: number;
  height: number;
  metadata: ExifMetadata;
}

export interface Album {
  id: number;
  name: string;
  relativePath: string;
  photoCount: number;
  coverPath?: string;
}
