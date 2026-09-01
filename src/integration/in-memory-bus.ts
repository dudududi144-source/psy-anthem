// PSY ANTHEM - src/integration/in-memory-bus.ts
// Minimal in-memory PSYBUS for examples and tests (mirrors psybus host semantics:
// register/subscribe/publish with filters). The real bus lives in psyboss.

import type { PsyBusEnvelope, PsyBusPayload } from './psybus-types';

export type BusFilter = (e: PsyBusEnvelope) => boolean;
export type BusHandler = (e: PsyBusEnvelope) => void;
export type Unsubscribe = () => void;

export class InMemoryPSYBUS {
  private seedValue: number;
  private rev = 0;
  private devices = new Map<string, { capabilities: Record<string, unknown> | null }>();
  private subscriptions: Array<{ device: string; filter: BusFilter; handler: BusHandler }> = [];
  public delivered: PsyBusEnvelope[] = []; // inspection log for tests

  constructor(seed: number) {
    this.seedValue = seed;
  }

  seed(): number {
    return this.seedValue;
  }

  nextRev(): number {
    this.rev += 1;
    return this.rev;
  }

  register(device: string, capabilities: Record<string, unknown> | null = null): void {
    this.devices.set(device, { capabilities });
  }

  unregister(device: string): void {
    this.devices.delete(device);
    this.subscriptions = this.subscriptions.filter((s) => s.device !== device);
  }

  subscribe(device: string, filter: BusFilter, handler: BusHandler): Unsubscribe {
    const entry = { device, filter, handler };
    this.subscriptions.push(entry);
    return () => {
      this.subscriptions = this.subscriptions.filter((s) => s !== entry);
    };
  }

  publish(envelope: PsyBusEnvelope): void {
    this.delivered.push(envelope);
    for (const sub of this.subscriptions) {
      if (sub.device === envelope.src) continue; // no self-delivery
      if (envelope.dst !== 'broadcast' && envelope.dst !== sub.device) continue;
      if (sub.filter(envelope)) sub.handler(envelope);
    }
  }

  broadcast(payload: PsyBusPayload, src: string): void {
    this.publish({
      rev: this.nextRev(),
      seed: this.seedValue,
      src,
      dst: 'broadcast',
      ts: Date.now(),
      payload,
    });
  }

  sendToDevice(device: string, envelope: PsyBusEnvelope): void {
    const targeted: PsyBusEnvelope = { ...envelope, dst: device };
    this.publish(targeted);
  }

  getDevices(): string[] {
    return Array.from(this.devices.keys());
  }
}
