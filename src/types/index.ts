import type { AxiosResponse } from 'axios';
import type { CookieJar } from 'tough-cookie';
import type OperationClass from '../core/operation'

/**
 * The parameters required for Facebook internal API requests.
 * 
 * These values are typically extracted from authenticated sessions.
 */
export type FBApiParams = {
  /** The app version. */
  av: string;
  
  /** The user ID. */
  __user: string;
  
  /** The request ID. */
  __req: string;
  
  /** The revision. */
  __rev: string;
  
  /** The API version. */
  __a: number;
  
  /** The Facebook DTSG token. */
  fb_dtsg: string;
  
  /** The Facebook Jazoest token. */
  jazoest: string;
};

export type FBApiParamsWithDefaults = FBApiParams & {
  av: string;
  __user: string;
  __req: string;
  __rev: string;
  __a: number;
  fb_dtsg: string;
  jazoest: string;
};

export type FCAOptions = {
  selfListen: boolean;
  selfListenEvent: boolean;
  listenEvents: boolean;
  listenTyping: boolean;
  updatePresence: boolean;
  forceLogin: boolean;
  autoMarkDelivery: boolean;
  autoMarkRead: boolean;
  autoReconnect: boolean;
  online: boolean;
  emitReady: boolean;
  userAgent: string;
  randomUserAgent: boolean;
  proxy: string;
  timeout: number;
  httpClientSettings: {
    proxy: string | null,
    jar: CookieJar | null,
    keepAlive: boolean,
    timeout: number | 60000,
    maxSockets: number | 30
  }
}

export type FCAEvents = {
  login: (user: string) => void;
  logout: () => void;
  error: (error: Error) => void;
};

export type Operation = typeof OperationClass;

export type Appstate = {
  
}

export type HttpClient = Readonly<{
  cleanGet: (url: string) => Promise<string>;
  get: (url: string, qs: Object, options: Object, ctx: Object, customHeader: Object) => Promise<string>;
  post: (url: string, data: Object, options: Object, ctx: Object, customHeader: Object) => Promise<string>;
  postFormData: (url: string, data: Object, options: Object, ctx: Object, customHeader: Object) => Promise<string>;
}>;

export type HttpClientResponse = {
  statusCode: AxiosResponse['status'],
  statusMessage: AxiosResponse['statusText'],
  headers: AxiosResponse['headers'],
  body: AxiosResponse['data'],
  url: AxiosResponse['config']['url'],
  method: AxiosResponse['config']['method'],
}