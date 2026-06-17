import { devices as playwrightDevices } from 'playwright';

export const DEVICE_PRESETS = {
  'iphone-se': { name: 'iPhone SE', width: 375, height: 667, isMobile: true, deviceScaleFactor: 2, userAgent: playwrightDevices['iPhone SE']?.userAgent },
  'iphone-14': { name: 'iPhone 14', width: 390, height: 844, isMobile: true, deviceScaleFactor: 3, userAgent: playwrightDevices['iPhone 14']?.userAgent || playwrightDevices['iPhone 13']?.userAgent },
  'iphone-pro-max': { name: 'iPhone Pro Max', width: 430, height: 932, isMobile: true, deviceScaleFactor: 3, userAgent: playwrightDevices['iPhone 14 Pro Max']?.userAgent || playwrightDevices['iPhone 13 Pro Max']?.userAgent },
  'galaxy-s21': { name: 'Samsung/Galaxy', width: 412, height: 915, isMobile: true, deviceScaleFactor: 3, userAgent: playwrightDevices['Galaxy S9+']?.userAgent },
  'pixel-7': { name: 'Pixel 7', width: 412, height: 915, isMobile: true, deviceScaleFactor: 2.6, userAgent: playwrightDevices['Pixel 7']?.userAgent || playwrightDevices['Pixel 5']?.userAgent },
  ipad: { name: 'iPad', width: 820, height: 1180, isMobile: true, deviceScaleFactor: 2, userAgent: playwrightDevices['iPad Pro 11']?.userAgent },
  'tablet-wide': { name: 'Tablet Wide', width: 1024, height: 1366, isMobile: true, deviceScaleFactor: 2, userAgent: playwrightDevices['iPad Pro 11']?.userAgent },
  desktop: { name: 'Desktop', width: 1440, height: 1000, isMobile: false, deviceScaleFactor: 1 },
  laptop: { name: 'Laptop', width: 1366, height: 768, isMobile: false, deviceScaleFactor: 1 },
  'desktop-wide': { name: 'Desktop Wide', width: 1920, height: 1080, isMobile: false, deviceScaleFactor: 1 }
};

export function parseDevice(token) {
  const trimmed = String(token || '').trim();
  if (!trimmed) return null;
  if (DEVICE_PRESETS[trimmed]) return { id: trimmed, ...DEVICE_PRESETS[trimmed] };

  const custom = trimmed.match(/^custom:(\d+)x(\d+)$/i);
  if (custom) {
    const width = Number(custom[1]);
    const height = Number(custom[2]);
    if (!Number.isFinite(width) || !Number.isFinite(height) || width < 240 || height < 240 || width > 7680 || height > 7680) {
      throw new Error(`Invalid custom device size: ${trimmed}. Use custom:WIDTHxHEIGHT, minimum 240x240.`);
    }
    return {
      id: `custom-${width}x${height}`,
      name: `Custom ${width}x${height}`,
      width,
      height,
      isMobile: width < 900,
      deviceScaleFactor: width < 900 ? 2 : 1,
      userAgent: width < 900 ? playwrightDevices['iPhone 13']?.userAgent : undefined
    };
  }

  throw new Error(`Unknown device preset: ${trimmed}`);
}
