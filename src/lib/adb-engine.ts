import {
  AppPackage,
  AppSettings,
  BatteryInfo,
  DeviceDetails,
  FileEntry,
  LogMessage,
  ScrcpyConfig,
  StorageInfo,
} from '../types';

// Default mock devices representing real-world flagships
const INITIAL_DEVICES: DeviceDetails[] = [
  {
    serial: 'RFCW31C928F',
    name: 'Samsung Galaxy S24 Ultra',
    manufacturer: 'Samsung',
    marketing_name: 'Galaxy S24 Ultra',
    model: 'SM-S928B',
    state: 'Device',
    is_wireless: false,
    uptime_seconds: 142800,
    last_seen_epoch: Date.now(),
    battery: {
      level: 88,
      is_charging: true,
      status: 'Charging (Fast Cable)',
      health: 'Good',
      temperature_celsius: 28.4,
      voltage_mv: 4210,
      technology: 'Li-ion',
    },
    storage: {
      internal_total_bytes: 512 * 1024 * 1024 * 1024,
      internal_used_bytes: 184 * 1024 * 1024 * 1024,
      internal_free_bytes: 328 * 1024 * 1024 * 1024,
      internal_percent_used: 35.9,
      sdcard_present: false,
    },
    display: {
      width: 1440,
      height: 3120,
      density_dpi: 505,
      refresh_rate: 120.0,
      orientation: 'Portrait',
    },
    hardware: {
      soc_manufacturer: 'Qualcomm',
      soc_model: 'Snapdragon 8 Gen 3 for Galaxy',
      cpu_cores: 8,
      cpu_architecture: 'arm64-v8a',
      ram_total_mb: 12288,
      ram_avail_mb: 6840,
      gpu_renderer: 'Adreno 750',
    },
    software: {
      android_version: '14.0 (One UI 6.1)',
      api_level: 34,
      build_number: 'UP1A.231005.007.S928BXXU1AXB5',
      security_patch: '2024-03-01',
      kernel_version: 'Linux 6.1.43-android14-11-28951239-abS928BXXU1AXB5',
      bootloader: 'S928BXXU1AXB5 (Locked)',
      is_rooted: false,
    },
  },
  {
    serial: '192.168.1.145:5555',
    name: 'Google Pixel 9 Pro',
    manufacturer: 'Google',
    marketing_name: 'Pixel 9 Pro XL',
    model: 'Pixel 9 Pro',
    state: 'Device',
    is_wireless: true,
    connection_ip: '192.168.1.145:5555',
    uptime_seconds: 86400,
    last_seen_epoch: Date.now(),
    battery: {
      level: 64,
      is_charging: false,
      status: 'Discharging',
      health: 'Good',
      temperature_celsius: 26.8,
      voltage_mv: 3940,
      technology: 'Li-poly',
    },
    storage: {
      internal_total_bytes: 256 * 1024 * 1024 * 1024,
      internal_used_bytes: 98 * 1024 * 1024 * 1024,
      internal_free_bytes: 158 * 1024 * 1024 * 1024,
      internal_percent_used: 38.2,
      sdcard_present: false,
    },
    display: {
      width: 1344,
      height: 2992,
      density_dpi: 486,
      refresh_rate: 120.0,
      orientation: 'Portrait',
    },
    hardware: {
      soc_manufacturer: 'Google',
      soc_model: 'Tensor G4 Titan M2',
      cpu_cores: 8,
      cpu_architecture: 'arm64-v8a',
      ram_total_mb: 16384,
      ram_avail_mb: 9820,
      gpu_renderer: 'Mali-G715 Immortalis',
    },
    software: {
      android_version: '15.0 Beta 2',
      api_level: 35,
      build_number: 'AP21.240305.005',
      security_patch: '2024-04-05',
      kernel_version: 'Linux 6.1.75-android15-g938a0f12',
      bootloader: 'caiman-1.1-11235123 (Unlocked)',
      is_rooted: true,
    },
  },
];

const INITIAL_PACKAGES: AppPackage[] = [
  {
    package_name: 'com.whatsapp',
    display_name: 'WhatsApp Messenger',
    apk_path: '/data/app/~~wa/com.whatsapp/base.apk',
    is_system: false,
    is_enabled: true,
    version_name: '2.24.6.77',
    version_code: 240677001,
    install_time: '2024-01-15 14:22',
    size_bytes: 84 * 1024 * 1024,
  },
  {
    package_name: 'org.telegram.messenger',
    display_name: 'Telegram',
    apk_path: '/data/app/~~tg/org.telegram.messenger/base.apk',
    is_system: false,
    is_enabled: true,
    version_name: '10.9.1',
    version_code: 45610,
    install_time: '2024-02-01 09:12',
    size_bytes: 78 * 1024 * 1024,
  },
  {
    package_name: 'com.spotify.music',
    display_name: 'Spotify',
    apk_path: '/data/app/~~sp/com.spotify.music/base.apk',
    is_system: false,
    is_enabled: true,
    version_name: '8.9.18.512',
    version_code: 104523,
    install_time: '2024-02-18 18:40',
    size_bytes: 62 * 1024 * 1024,
  },
  {
    package_name: 'com.google.android.youtube',
    display_name: 'YouTube',
    apk_path: '/system/app/YouTube/YouTube.apk',
    is_system: true,
    is_enabled: true,
    version_name: '19.09.37',
    version_code: 1543820,
    install_time: '2023-11-20 00:00',
    size_bytes: 145 * 1024 * 1024,
  },
  {
    package_name: 'com.google.android.apps.photos',
    display_name: 'Google Photos',
    apk_path: '/system/priv-app/Photos/Photos.apk',
    is_system: true,
    is_enabled: true,
    version_name: '6.74.0',
    version_code: 1845120,
    install_time: '2023-11-20 00:00',
    size_bytes: 120 * 1024 * 1024,
  },
  {
    package_name: 'com.android.chrome',
    display_name: 'Google Chrome',
    apk_path: '/system/app/Chrome/Chrome.apk',
    is_system: true,
    is_enabled: true,
    version_name: '122.0.6261.105',
    version_code: 626110533,
    install_time: '2024-03-01 11:00',
    size_bytes: 198 * 1024 * 1024,
  },
  {
    package_name: 'com.sec.android.app.camera',
    display_name: 'Samsung Camera Pro',
    apk_path: '/system/priv-app/SamsungCamera/SamsungCamera.apk',
    is_system: true,
    is_enabled: true,
    version_name: '14.1.00.75',
    version_code: 141007500,
    install_time: '2024-01-01 00:00',
    size_bytes: 92 * 1024 * 1024,
  },
  {
    package_name: 'com.termux',
    display_name: 'Termux Terminal',
    apk_path: '/data/app/~~tmx/com.termux/base.apk',
    is_system: false,
    is_enabled: true,
    version_name: '0.118.0',
    version_code: 118,
    install_time: '2024-02-12 16:30',
    size_bytes: 42 * 1024 * 1024,
  },
  {
    package_name: 'com.netflix.mediaclient',
    display_name: 'Netflix',
    apk_path: '/data/app/~~nf/com.netflix.mediaclient/base.apk',
    is_system: false,
    is_enabled: false,
    version_name: '8.104.0',
    version_code: 50493,
    install_time: '2024-01-02 21:10',
    size_bytes: 110 * 1024 * 1024,
  },
];

// In-memory Virtual Android Filesystem for testing / browser mode
const VIRTUAL_FS: Record<string, FileEntry[]> = {
  '/sdcard': [
    { name: 'DCIM', path: '/sdcard/DCIM', file_type: 'Directory', size_bytes: 4096, permissions: 'drwxrwx--x', owner: 'root', group: 'sdcard_rw', modified_epoch: 1709840000, modified_str: '2024-03-07 16:40', is_hidden: false },
    { name: 'Download', path: '/sdcard/Download', file_type: 'Directory', size_bytes: 4096, permissions: 'drwxrwx--x', owner: 'root', group: 'sdcard_rw', modified_epoch: 1709940000, modified_str: '2024-03-08 11:20', is_hidden: false },
    { name: 'Documents', path: '/sdcard/Documents', file_type: 'Directory', size_bytes: 4096, permissions: 'drwxrwx--x', owner: 'root', group: 'sdcard_rw', modified_epoch: 1709540000, modified_str: '2024-03-04 09:15', is_hidden: false },
    { name: 'Pictures', path: '/sdcard/Pictures', file_type: 'Directory', size_bytes: 4096, permissions: 'drwxrwx--x', owner: 'root', group: 'sdcard_rw', modified_epoch: 1709640000, modified_str: '2024-03-05 14:10', is_hidden: false },
    { name: 'Music', path: '/sdcard/Music', file_type: 'Directory', size_bytes: 4096, permissions: 'drwxrwx--x', owner: 'root', group: 'sdcard_rw', modified_epoch: 1709440000, modified_str: '2024-03-03 18:22', is_hidden: false },
    { name: 'Android', path: '/sdcard/Android', file_type: 'Directory', size_bytes: 4096, permissions: 'drwxrwx--x', owner: 'root', group: 'sdcard_rw', modified_epoch: 1709040000, modified_str: '2024-02-28 00:00', is_hidden: false },
    { name: '.nomedia', path: '/sdcard/.nomedia', file_type: 'File', size_bytes: 0, permissions: '-rw-rw----', owner: 'root', group: 'sdcard_rw', modified_epoch: 1709040000, modified_str: '2024-02-28 00:00', is_hidden: true, extension: 'nomedia' },
    { name: 'recovery_log.txt', path: '/sdcard/recovery_log.txt', file_type: 'File', size_bytes: 14200, permissions: '-rw-rw----', owner: 'root', group: 'sdcard_rw', modified_epoch: 1709840000, modified_str: '2024-03-07 18:02', is_hidden: false, extension: 'txt' },
  ],
  '/sdcard/DCIM': [
    { name: 'Camera', path: '/sdcard/DCIM/Camera', file_type: 'Directory', size_bytes: 4096, permissions: 'drwxrwx--x', owner: 'root', group: 'sdcard_rw', modified_epoch: 1709840000, modified_str: '2024-03-07 16:40', is_hidden: false },
    { name: 'Screenshots', path: '/sdcard/DCIM/Screenshots', file_type: 'Directory', size_bytes: 4096, permissions: 'drwxrwx--x', owner: 'root', group: 'sdcard_rw', modified_epoch: 1709740000, modified_str: '2024-03-06 12:15', is_hidden: false },
  ],
  '/sdcard/DCIM/Camera': [
    { name: '20240307_164012.jpg', path: '/sdcard/DCIM/Camera/20240307_164012.jpg', file_type: 'File', size_bytes: 8420000, permissions: '-rw-rw----', owner: 'root', group: 'sdcard_rw', modified_epoch: 1709840000, modified_str: '2024-03-07 16:40', is_hidden: false, extension: 'jpg' },
    { name: '20240307_171050.mp4', path: '/sdcard/DCIM/Camera/20240307_171050.mp4', file_type: 'File', size_bytes: 142000000, permissions: '-rw-rw----', owner: 'root', group: 'sdcard_rw', modified_epoch: 1709842000, modified_str: '2024-03-07 17:10', is_hidden: false, extension: 'mp4' },
    { name: '20240308_091530.jpg', path: '/sdcard/DCIM/Camera/20240308_091530.jpg', file_type: 'File', size_bytes: 6150000, permissions: '-rw-rw----', owner: 'root', group: 'sdcard_rw', modified_epoch: 1709890000, modified_str: '2024-03-08 09:15', is_hidden: false, extension: 'jpg' },
  ],
  '/sdcard/Download': [
    { name: 'Telegram', path: '/sdcard/Download/Telegram', file_type: 'Directory', size_bytes: 4096, permissions: 'drwxrwx--x', owner: 'root', group: 'sdcard_rw', modified_epoch: 1709940000, modified_str: '2024-03-08 11:20', is_hidden: false },
    { name: 'F-Droid.apk', path: '/sdcard/Download/F-Droid.apk', file_type: 'File', size_bytes: 12400000, permissions: '-rw-rw----', owner: 'root', group: 'sdcard_rw', modified_epoch: 1709940000, modified_str: '2024-03-08 11:20', is_hidden: false, extension: 'apk' },
    { name: 'kernel_headers_arm64.tar.gz', path: '/sdcard/Download/kernel_headers_arm64.tar.gz', file_type: 'File', size_bytes: 48900000, permissions: '-rw-rw----', owner: 'root', group: 'sdcard_rw', modified_epoch: 1709740000, modified_str: '2024-03-06 14:10', is_hidden: false, extension: 'gz' },
  ],
};

class SimulatedAdbEngine {
  private devices: DeviceDetails[] = [...INITIAL_DEVICES];
  private packages: AppPackage[] = [...INITIAL_PACKAGES];
  private fs: Record<string, FileEntry[]> = { ...VIRTUAL_FS };
  private logs: LogMessage[] = [];
  private isMirroringMap: Record<string, boolean> = {};
  private settings: AppSettings = {
    language: 'en',
    adb_path: 'adb',
    scrcpy_path: 'scrcpy',
    default_download_path: '~/Downloads/ApexDroid',
    polling_interval_ms: 2500,
    auto_connect_wireless: true,
    confirm_destructive_actions: true,
    theme: 'dark',
    log_level: 'info',
  };

  constructor() {
    this.addLog('INFO', 'daemon', 'Simulated ADB Engine initialized with 2 mock flagships');
    this.addLog('INFO', 'adb', 'Detected local ADB 1.0.41 (rev 34.0.5-windows)');
    this.addLog('INFO', 'scrcpy', 'Detected local scrcpy v2.3.1 (H.264 / AAC)');
  }

  public addLog(level: 'TRACE' | 'DEBUG' | 'INFO' | 'WARN' | 'ERROR', target: string, message: string, serial?: string) {
    const d = new Date();
    const ts = d.toTimeString().split(' ')[0] + '.' + String(d.getMilliseconds()).padStart(3, '0');
    const msg: LogMessage = {
      id: `${Date.now()}-${Math.random()}`,
      timestamp: ts,
      level,
      target,
      message,
      device_serial: serial,
    };
    this.logs.unshift(msg);
    if (this.logs.length > 500) this.logs.pop();
  }

  async getDevices(): Promise<DeviceDetails[]> {
    return [...this.devices];
  }

  async getDeviceDetails(serial: string): Promise<DeviceDetails> {
    const dev = this.devices.find((d) => d.serial === serial);
    if (!dev) throw new Error(`Device ${serial} not found`);
    return { ...dev };
  }

  async executeShell(serial: string, cmd: string): Promise<string> {
    this.addLog('DEBUG', 'shell', `exec [${serial}]: ${cmd}`, serial);
    const trimmed = cmd.trim();

    if (trimmed === 'getprop') {
      const dev = this.devices.find((d) => d.serial === serial) || this.devices[0];
      return `[ro.product.manufacturer]: [${dev.manufacturer}]\n[ro.product.model]: [${dev.model}]\n[ro.build.version.release]: [${dev.software?.android_version}]\n[ro.build.version.sdk]: [${dev.software?.api_level}]\n[ro.board.platform]: [${dev.hardware?.soc_model}]\n[ro.bootloader]: [${dev.software?.bootloader}]`;
    }

    if (trimmed.startsWith('dumpsys battery')) {
      const dev = this.devices.find((d) => d.serial === serial) || this.devices[0];
      const b = dev.battery!;
      return `Current Battery Service state:\n  AC powered: ${b.is_charging}\n  USB powered: false\n  Wireless powered: false\n  Max charging current: 4500000\n  Max charging voltage: 9000000\n  level: ${b.level}\n  scale: 100\n  voltage: ${b.voltage_mv}\n  temperature: ${Math.round(b.temperature_celsius * 10)}\n  technology: ${b.technology}\n  health: 2`;
    }

    if (trimmed.startsWith('df -k /data') || trimmed.startsWith('df -h')) {
      return `Filesystem     1K-blocks      Used Available Use% Mounted on\n/dev/block/dm-0 498124800 188743680 309381120  38% /data`;
    }

    if (trimmed.startsWith('cat /proc/meminfo')) {
      const dev = this.devices.find((d) => d.serial === serial) || this.devices[0];
      const tot = (dev.hardware?.ram_total_mb || 12288) * 1024;
      const free = (dev.hardware?.ram_avail_mb || 6840) * 1024;
      return `MemTotal:       ${tot} kB\nMemFree:         ${Math.round(free * 0.4)} kB\nMemAvailable:    ${free} kB\nBuffers:          218940 kB\nCached:          3891040 kB`;
    }

    if (trimmed.startsWith('cat /proc/cpuinfo')) {
      return `processor       : 0\nBogoMIPS        : 38.40\nFeatures        : fp asimd evtstrm aes pmull sha1 sha2 crc32 atomics\nCPU implementer : 0x51\nCPU architecture: 8\nCPU variant     : 0x2\nCPU part        : 0x805\nHardware        : Qualcomm Technologies, Inc SM8650`;
    }

    if (trimmed.startsWith('uname -a')) {
      return `Linux localhost 6.1.43-android14-11-28951239-abS928BXXU1AXB5 #1 SMP PREEMPT Wed Feb 21 18:22:10 UTC 2024 aarch64 Android`;
    }

    if (trimmed.startsWith('pm list packages')) {
      return this.packages.map((p) => `package:${p.apk_path}=${p.package_name}`).join('\n');
    }

    if (trimmed.startsWith('ls')) {
      return `total 24\ndrwxrwx--x  2 root sdcard_rw     4096 2024-03-07 16:40 DCIM\ndrwxrwx--x  3 root sdcard_rw     4096 2024-03-08 11:20 Download\ndrwxrwx--x  2 root sdcard_rw     4096 2024-03-04 09:15 Documents\ndrwxrwx--x  2 root sdcard_rw     4096 2024-03-05 14:10 Pictures\n-rw-rw----  1 root sdcard_rw    14200 2024-03-07 18:02 recovery_log.txt`;
    }

    if (trimmed.startsWith('logcat')) {
      return `--------- beginning of main\n03-08 14:32:01.120  1450  1450 I ActivityManager: START u0 {act=android.intent.action.MAIN cat=[android.intent.category.LAUNCHER] flg=0x10200000 cmp=com.whatsapp/.Main} from uid 1000\n03-08 14:32:01.240  1450  2100 D WindowManager: Relayout Window{41d2f00 u0 com.whatsapp/com.whatsapp.Main}: viewVisibility=0 req=1440x3120\n03-08 14:32:01.350  2450  2450 I Choreographer: Skipped 0 frames! The application may be doing fine.\n03-08 14:32:02.010  1200  1200 D PowerManagerService: userActivityNoUpdateLocked: eventTime=142800000, event=2, flags=0x0, uid=1000`;
    }

    if (trimmed.startsWith('am force-stop')) {
      return 'OK';
    }

    if (trimmed.startsWith('reboot')) {
      return 'Rebooting...';
    }

    return `Command '${cmd}' completed successfully with exit code 0.`;
  }

  async rebootDevice(serial: string, mode?: string): Promise<string> {
    this.addLog('WARN', 'device', `Reboot initiated for ${serial} (mode: ${mode || 'standard'})`, serial);
    return `Device ${serial} rebooting to ${mode || 'system'}.`;
  }

  async connectWireless(hostPort: string): Promise<string> {
    this.addLog('INFO', 'wireless', `Connected to wireless ADB at ${hostPort}`);
    const newDev: DeviceDetails = {
      serial: hostPort,
      name: `Wireless Device (${hostPort})`,
      manufacturer: 'Android',
      marketing_name: 'Wireless Unit',
      model: 'ADB-WiFi',
      state: 'Device',
      is_wireless: true,
      connection_ip: hostPort,
      uptime_seconds: 4200,
      last_seen_epoch: Date.now(),
      battery: {
        level: 95,
        is_charging: true,
        status: 'Charging',
        health: 'Good',
        temperature_celsius: 27.0,
        voltage_mv: 4280,
        technology: 'Li-ion',
      },
      storage: {
        internal_total_bytes: 128 * 1024 * 1024 * 1024,
        internal_used_bytes: 45 * 1024 * 1024 * 1024,
        internal_free_bytes: 83 * 1024 * 1024 * 1024,
        internal_percent_used: 35.1,
        sdcard_present: false,
      },
      display: {
        width: 1080,
        height: 2400,
        density_dpi: 400,
        refresh_rate: 90.0,
        orientation: 'Portrait',
      },
      hardware: {
        soc_manufacturer: 'MediaTek',
        soc_model: 'Dimensity 9200',
        cpu_cores: 8,
        cpu_architecture: 'arm64-v8a',
        ram_total_mb: 8192,
        ram_avail_mb: 4200,
        gpu_renderer: 'Immortalis-G715',
      },
      software: {
        android_version: '14.0',
        api_level: 34,
        build_number: 'UQ1A.240205.004',
        security_patch: '2024-02-05',
        kernel_version: 'Linux 5.15.110',
        bootloader: 'locked',
        is_rooted: false,
      },
    };
    this.devices.push(newDev);
    return `connected to ${hostPort}`;
  }

  async pairWireless(hostPort: string, code: string): Promise<string> {
    this.addLog('INFO', 'wireless', `Successfully paired with ${hostPort} using code`);
    return `Successfully paired to ${hostPort} [guid: paired-adb-5555]`;
  }

  async restartAdb(): Promise<string> {
    this.addLog('INFO', 'adb', 'Killing ADB server process...');
    this.addLog('INFO', 'adb', 'ADB daemon restarted on port 5037.');
    return '* daemon not running; starting now at tcp:5037\n* daemon started successfully';
  }

  async listFiles(_serial: string, path: string): Promise<FileEntry[]> {
    const clean = path.endsWith('/') && path.length > 1 ? path.slice(0, -1) : path;
    if (this.fs[clean]) {
      return [...this.fs[clean]];
    }

    // Default directory contents generator if path not pre-populated
    return [
      {
        name: 'cache',
        path: `${clean}/cache`,
        file_type: 'Directory',
        size_bytes: 4096,
        permissions: 'drwxrwx--x',
        owner: 'u0_a123',
        group: 'u0_a123',
        modified_epoch: 1709940000,
        modified_str: '2024-03-08 12:00',
        is_hidden: false,
      },
      {
        name: 'files',
        path: `${clean}/files`,
        file_type: 'Directory',
        size_bytes: 4096,
        permissions: 'drwxrwx--x',
        owner: 'u0_a123',
        group: 'u0_a123',
        modified_epoch: 1709940000,
        modified_str: '2024-03-08 12:00',
        is_hidden: false,
      },
      {
        name: 'metadata.json',
        path: `${clean}/metadata.json`,
        file_type: 'File',
        size_bytes: 1042,
        permissions: '-rw-rw----',
        owner: 'u0_a123',
        group: 'u0_a123',
        modified_epoch: 1709940000,
        modified_str: '2024-03-08 12:00',
        is_hidden: false,
        extension: 'json',
      },
    ];
  }

  async createDirectory(_serial: string, path: string): Promise<void> {
    const parent = path.substring(0, path.lastIndexOf('/')) || '/sdcard';
    const name = path.substring(path.lastIndexOf('/') + 1);
    const entry: FileEntry = {
      name,
      path,
      file_type: 'Directory',
      size_bytes: 4096,
      permissions: 'drwxrwx--x',
      owner: 'root',
      group: 'sdcard_rw',
      modified_epoch: Date.now(),
      modified_str: new Date().toISOString().replace('T', ' ').substring(0, 16),
      is_hidden: name.startsWith('.'),
    };

    if (!this.fs[parent]) this.fs[parent] = [];
    this.fs[parent].push(entry);
    this.fs[path] = [];
    this.addLog('INFO', 'fs', `Created directory: ${path}`);
  }

  async deleteFile(_serial: string, path: string): Promise<void> {
    const parent = path.substring(0, path.lastIndexOf('/')) || '/sdcard';
    if (this.fs[parent]) {
      this.fs[parent] = this.fs[parent].filter((f) => f.path !== path);
    }
    delete this.fs[path];
    this.addLog('WARN', 'fs', `Deleted entry: ${path}`);
  }

  async renameFile(_serial: string, oldPath: string, newPath: string): Promise<void> {
    const parent = oldPath.substring(0, oldPath.lastIndexOf('/')) || '/sdcard';
    const newName = newPath.substring(newPath.lastIndexOf('/') + 1);
    if (this.fs[parent]) {
      const target = this.fs[parent].find((f) => f.path === oldPath);
      if (target) {
        target.name = newName;
        target.path = newPath;
        target.extension = target.file_type === 'File' ? newName.split('.').pop() : undefined;
      }
    }
    this.addLog('INFO', 'fs', `Renamed ${oldPath} -> ${newPath}`);
  }

  async listPackages(_serial: string, filter: string): Promise<AppPackage[]> {
    if (filter === 'user') return this.packages.filter((p) => !p.is_system);
    if (filter === 'system') return this.packages.filter((p) => p.is_system);
    if (filter === 'disabled') return this.packages.filter((p) => !p.is_enabled);
    return [...this.packages];
  }

  async installApk(serial: string, apkPath: string): Promise<string> {
    const filename = apkPath.split(/[/\\]/).pop() || 'custom.apk';
    const pkgName = 'com.custom.' + filename.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    const pkg: AppPackage = {
      package_name: pkgName,
      display_name: filename.replace('.apk', ''),
      apk_path: `/data/app/~~new/${pkgName}/base.apk`,
      is_system: false,
      is_enabled: true,
      version_name: '1.0.0',
      version_code: 1,
      install_time: new Date().toISOString().replace('T', ' ').substring(0, 16),
      size_bytes: 35 * 1024 * 1024,
    };
    this.packages.unshift(pkg);
    this.addLog('INFO', 'pm', `Installed APK ${filename} on ${serial}`, serial);
    return 'Success';
  }

  async uninstallApp(serial: string, pkgName: string): Promise<void> {
    this.packages = this.packages.filter((p) => p.package_name !== pkgName);
    this.addLog('WARN', 'pm', `Uninstalled package ${pkgName} on ${serial}`, serial);
  }

  async forceStopApp(serial: string, pkgName: string): Promise<void> {
    this.addLog('INFO', 'pm', `Force stopped ${pkgName} on ${serial}`, serial);
  }

  async clearAppData(serial: string, pkgName: string): Promise<void> {
    this.addLog('INFO', 'pm', `Cleared data for ${pkgName} on ${serial}`, serial);
  }

  async setAppEnabled(serial: string, pkgName: string, enabled: boolean): Promise<void> {
    const p = this.packages.find((x) => x.package_name === pkgName);
    if (p) p.is_enabled = enabled;
    this.addLog('INFO', 'pm', `Set ${pkgName} enabled=${enabled} on ${serial}`, serial);
  }

  async launchApp(serial: string, pkgName: string): Promise<void> {
    this.addLog('INFO', 'pm', `Launched activity for ${pkgName} on ${serial}`, serial);
  }

  async startScrcpy(serial: string, config: ScrcpyConfig): Promise<boolean> {
    this.isMirroringMap[serial] = true;
    this.addLog('INFO', 'scrcpy', `Scrcpy mirror started for ${serial} (${config.max_size}p @ ${config.max_fps}fps)`, serial);
    return true;
  }

  async stopScrcpy(serial: string): Promise<boolean> {
    this.isMirroringMap[serial] = false;
    this.addLog('INFO', 'scrcpy', `Scrcpy session closed for ${serial}`, serial);
    return true;
  }

  isMirroring(serial: string): boolean {
    return !!this.isMirroringMap[serial];
  }

  async getLogs(): Promise<LogMessage[]> {
    return [...this.logs];
  }

  async clearLogs(): Promise<void> {
    this.logs = [];
  }

  async getSettings(): Promise<AppSettings> {
    return { ...this.settings };
  }

  async saveSettings(s: AppSettings): Promise<void> {
    this.settings = { ...s };
    this.addLog('INFO', 'settings', 'Preferences updated');
  }
}

export const adbEngine = new SimulatedAdbEngine();
