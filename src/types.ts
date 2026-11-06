export interface ExifMetadata {
  camera?: string;
  lens?: string;
  focalLength?: string;
  aperture?: string;
  shutterSpeed?: string;
  iso?: number;
  dateTaken?: string;
  latitude?: number;
  longitude?: number;
  city?: string;
  country?: string;
  megapixels?: string;
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
  fileSize: number;
  mediaType: 'image' | 'video';
  blurPlaceholder?: string;
  dominantColor?: string;
  metadata: ExifMetadata;
}

export interface AlbumConfig {
  title?: string;
  description?: string;
  cover?: string;
  sort?: 'date-desc' | 'date-asc' | 'name-asc' | 'name-desc';
  hidden?: boolean;
  tags?: string[];
  dateOverride?: string;
}

export interface Album {
  id: number;
  name: string;
  title?: string;
  description?: string;
  relativePath: string;
  photoCount: number;
  coverPath?: string;
  dateStart?: string;
  dateEnd?: string;
  locations?: string[];
  tags?: string[];
}
