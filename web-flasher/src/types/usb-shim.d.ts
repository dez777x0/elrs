/** Минимальные типы WebUSB для TS без полного lib */
interface USBDevice {
  open(): Promise<void>;
  close(): Promise<void>;
  selectConfiguration(configurationValue: number): Promise<void>;
  claimInterface(interfaceNumber: number): Promise<void>;
  releaseInterface(interfaceNumber: number): Promise<void>;
  transferIn(endpointNumber: number, length: number): Promise<USBInTransferResult>;
  transferOut(endpointNumber: number, data: BufferSource): Promise<USBOutTransferResult>;
  readonly configuration: USBConfiguration | null;
  readonly configurations: USBConfiguration[];
}

interface USBConfiguration {
  readonly interfaces: USBInterface[];
}

interface USBInterface {
  readonly interfaceNumber: number;
  readonly alternates: USBAlternateInterface[];
}

interface USBAlternateInterface {
  readonly interfaceClass: number;
  readonly endpoints: USBEndpoint[];
}

interface USBEndpoint {
  readonly type: USBEndpointType;
  readonly direction: USBDirection;
  readonly endpointNumber: number;
  readonly packetSize: number;
}

interface USBInTransferResult {
  status: USBTransferStatus;
  data?: DataView;
}

interface USBOutTransferResult {
  status: USBTransferStatus;
}

type USBEndpointType = 'bulk' | 'interrupt' | 'isochronous' | 'control';
type USBDirection = 'in' | 'out';
type USBTransferStatus = 'ok' | 'stall' | 'babble';

interface USBDeviceFilter {
  vendorId?: number;
  productId?: number;
}

interface USB {
  requestDevice(options: { filters: USBDeviceFilter[] }): Promise<USBDevice>;
}
