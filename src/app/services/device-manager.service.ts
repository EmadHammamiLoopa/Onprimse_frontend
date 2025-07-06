import { Injectable } from "@angular/core";
import { Platform } from "@ionic/angular";

@Injectable({ providedIn: 'root' })
export class DeviceManagerService {
  private deviceLocks = new Map<string, string>(); // deviceId -> tabId
  private readonly LOCK_TIMEOUT = 30000; // 30 seconds

  async acquireDevice(deviceId: string, tabId: string): Promise<boolean> {
    const currentLock = this.deviceLocks.get(deviceId);
  
    if (currentLock && currentLock !== tabId) {
      console.warn(`🔓 Releasing device ${deviceId} from tab ${currentLock} and assigning to tab ${tabId}`);
      this.releaseDevice(deviceId, currentLock); // release from the previous tab
    }
  
    // Assign to the current tab
    this.deviceLocks.set(deviceId, tabId);
  
    // Auto-release after timeout
    setTimeout(() => {
      if (this.deviceLocks.get(deviceId) === tabId) {
        this.deviceLocks.delete(deviceId);
      }
    }, this.LOCK_TIMEOUT);
    this.logAllLocks(); // ← add here

    return true;
  }
  
  logAllLocks() {
    console.log("🔐 Current Device Locks:");
    for (const [deviceId, ownerTab] of this.deviceLocks.entries()) {
      console.log(`→ ${deviceId} locked by ${ownerTab}`);
    }
  }
  
  // ✅ Added: immediate locking version used in WebrtcService
  lockDevice(deviceId: string, tabId: string): boolean {
    const currentLock = this.deviceLocks.get(deviceId);
    if (currentLock && currentLock !== tabId) {
      console.log(`🔒 Device ${deviceId} is already locked by tab ${currentLock}`);
      return false;
    }
    this.deviceLocks.set(deviceId, tabId);
    return true;
  }

  releaseDevice(deviceId: string, tabId: string): void {
    if (this.deviceLocks.get(deviceId) === tabId) {
      this.deviceLocks.delete(deviceId);
      console.log(`✅ Device ${deviceId} released by tab ${tabId}`);
      this.logAllLocks(); // ← add here
    }
  }
  

  getDeviceOwner(deviceId: string): string | undefined {
    return this.deviceLocks.get(deviceId);
  }

  async getAvailableDevice(kind: 'videoinput' | 'audioinput', tabId: string): Promise<string | null> {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const availableDevices = devices.filter(d => d.kind === kind);

    for (const device of availableDevices) {
      if (!this.deviceLocks.has(device.deviceId)) {
        const acquired = await this.acquireDevice(device.deviceId, tabId);
        if (acquired) return device.deviceId;
      }
    }
    return null;
  }

  isDeviceAvailable(deviceId: string): boolean {
    return !this.deviceLocks.has(deviceId);
  }
}
