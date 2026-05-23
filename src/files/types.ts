import type { RequestHandler } from '@sveltejs/kit';

export type FileObject = {
  key: string;
  url: string;
  filename: string;
  contentType?: string;
  size?: number;
  visibility?: 'public' | 'private' | string;
  metadata?: Record<string, unknown>;
};

export type FileStorageDriver = {
  read(file: FileObject): Promise<Buffer>;
  write(file: FileObject, bytes: Buffer): Promise<FileObject>;
  delete(file: FileObject): Promise<void>;
  exists?(file: FileObject): Promise<boolean>;
  move?(from: FileObject, to: FileObject): Promise<FileObject>;
};

export type FileLocationStrategy = {
  fromUrl(url: string): FileObject | null;
  isTemp(file: FileObject): boolean;
  toTemp(input: {
    filename: string;
    contentType?: string;
    visibility: string;
    requestUrl: URL;
  }): FileObject;
  toPermanent(tempFile: FileObject): FileObject;
  derivativeFor?(source: FileObject, filename: string): FileObject;
};

export type FileProcessorResult = {
  primary?: {
    file: FileObject;
    bytes: Buffer;
  };
  derivatives?: Array<{
    file: FileObject;
    bytes: Buffer;
    role: string;
    metadata?: Record<string, unknown>;
  }>;
  metadata?: Record<string, unknown>;
};

export type FileManagerContext = {
  storage: FileStorageDriver;
  locations: FileLocationStrategy;
  metadataStore?: FileMetadataStore;
};

export type FileProcessor = {
  name: string;
  supports(input: {
    file: FileObject;
    bytes: Buffer;
  }): boolean | Promise<boolean>;
  process(input: {
    file: FileObject;
    bytes: Buffer;
    manager: FileManagerContext;
  }): Promise<FileProcessorResult>;
  cleanup?(input: {
    file: FileObject;
    metadata?: Record<string, unknown>;
    manager: FileManagerContext;
  }): Promise<void>;
};

export type FileMetadataRecord = {
  fileKey: string;
  fileUrl: string;
  processor: string;
  data: Record<string, unknown>;
  derivatives?: FileObject[];
  createdAt?: Date;
  updatedAt?: Date;
};

export type FileMetadataStore = {
  get(fileKey: string, processor?: string): Promise<FileMetadataRecord | null>;
  upsert(record: FileMetadataRecord): Promise<void>;
  delete(fileKey: string, processor?: string): Promise<void>;
};

export type FileManagerConfig = {
  storage: FileStorageDriver;
  locations: FileLocationStrategy;
  processors?: FileProcessor[];
  metadataStore?: FileMetadataStore;
  upload?: {
    allowedVisibilities?: string[];
    defaultVisibility?: string;
    maxFileSizeBytes?: number;
    publicBaseUrl?: string;
  };
};

export type FileManager = {
  createUploadHandler(): RequestHandler;
  createServeHandler(): RequestHandler;
  createDownloadHandler(): RequestHandler;
  promoteTempFile(url: string): Promise<string>;
  writeProcessedFile(file: FileObject, bytes: Buffer): Promise<FileObject>;
  deleteFile(url: string): Promise<void>;
  processPayloadFiles<T>(input: T, options?: {
    previousData?: unknown;
    deleteReplacedFiles?: boolean;
  }): Promise<T>;
  collectFileUrls(input: unknown): string[];
};

export type ImageVariantMetadata = {
  width: number;
  format: string;
  key: string;
  url: string;
  size: number;
};

export type ImageMetadata = {
  width: number;
  height: number;
  aspectRatio: number;
  format: string;
  size: number;
  placeholder: string;
  variants: ImageVariantMetadata[];
};
