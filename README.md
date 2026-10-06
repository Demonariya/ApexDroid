# ApexDroid - Android Management Suite ⚡📱
### Native Desktop Android Device Controller & Diagnostic Suite (Rust + Tauri 2 + React)

[English](#english) | [فارسی (Persian)](#فارسی)

---

<a name="english"></a>
## 🇬🇧 English Documentation

**ApexDroid** is a commercial-grade, high-performance desktop application designed for inspecting, managing, mirroring, and diagnosing Android devices over **ADB (Android Debug Bridge)** and **scrcpy**. Built natively with **Rust (Tokio / Tauri 2)** for process execution and system-level hardware communication, paired with a modern **React + TypeScript + Tailwind CSS** frontend.

---

### Key Capabilities

- **Real-Time Fleet Dashboard**: Live telemetry for connected USB and Wi-Fi devices, battery status, storage allocation, and Android OS distribution charts.
- **Deep Hardware & Software Inspection**: Detailed SoC info (Snapdragon, Tensor, Exynos), core topologies, RAM free/used, display resolution, refresh rate (120Hz), security patch level, kernel version, and root detection.
- **Wireless ADB Pairing**: One-click connection over Wi-Fi 6 (Android 11+ pairing codes and direct IP:port connections).
- **Interactive File Manager**: Full filesystem explorer (`/sdcard`, `/storage/emulated/0`), breadcrumbs, drag-and-drop push/pull transfers, Linux permissions (`drwxrwx--x`), renaming, and directory creation.
- **Package Manager (APK)**: Sideload APKs via drag-and-drop, filter by User (`-3`), System (`-s`), and Disabled packages. Force stop, clear app data, disable, and launch apps.
- **Scrcpy Screen Mirroring**: Integrated mirror session with touch navigation, soft keys (Home, Back, Recents), volume toggles, live H.264 video recording, and direct PNG framebuffer snapshots.
- **Interactive ADB Terminal**: Embedded shell console with command history recall (Up/Down arrow keys), quick presets (`getprop`, `dumpsys battery`, `logcat`, `df -h`), copy buffer, and safety confirmation for destructive commands.
- **Backup & Restore Pipeline**: Genuine offline backup of user APKs and storage partitions with SHA-256 file manifest verification, restore installer, and accurate Android permission boundary disclosures.
- **Structured Tracing Logs**: High-density log viewer powered by Rust `tracing` with level filtering (INFO, WARN, ERROR, DEBUG) and export support.
- **Bilingual & RTL**: Seamless toggle between English and **Persian (فارسی)** with complete RTL layout mirroring and `Vazirmatn` typography.

---

### Technology Stack

| Layer | Technology | Details |
|---|---|---|
| **Desktop Shell** | [Tauri v2](https://v2.tauri.app/) | Low memory footprint, secure IPC, Windows x64 NSIS/MSI bundles |
| **Backend Core** | [Rust](https://www.rust-lang.org/) | Tokio async runtime, Serde, Tracing, Parking Lot |
| **Device Integration**| ADB & Scrcpy | Subprocess management, socket streaming, safe quoting |
| **Frontend UI** | [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/) | Modular components, typed IPC bridge |
| **Styling** | [Tailwind CSS v4](https://tailwindcss.com/) | Dark graphite aesthetic, zero-pill metadata, responsive layouts |
| **Animations & Icons** | Motion & Lucide Icons | 60 FPS transitions, clean technical iconography |

---

### Project Structure

```text
├── src-tauri/                  # Native Rust Backend (Tauri 2)
│   ├── Cargo.toml              # Rust crate dependencies & Windows x64 build flags
│   ├── tauri.conf.json         # Tauri v2 window, security CSP, and bundler config
│   ├── build.rs                # Tauri build script
│   └── src/
│       ├── main.rs             # Windows subsystem entrypoint (no console window)
│       ├── lib.rs              # App initialization and command handler registration
│       ├── adb/                # ADB subprocess invoker, parsers, and unit tests
│       ├── devices/            # Hardware specs, battery, storage, and SoC parsers
│       ├── filesystem/         # Android file manager operations (ls -la, push, pull)
│       ├── packages/           # APK list parser, installer, and process control
│       ├── scrcpy/             # Scrcpy process supervisor and video parameters
│       ├── monitoring/         # Tokio background device polling and event emission
│       ├── backup/             # Archive creation and transfer progress calculator
│       ├── logging/            # Tracing subscriber and thread-safe ring buffer
│       ├── state/              # Thread-safe application state (Arc<RwLock>)
│       ├── commands/           # Typed #[tauri::command] IPC handlers
│       └── errors/             # Strongly typed error enums (AppError)
│
├── src/                        # Frontend UI (React + TypeScript)
│   ├── components/             # Reusable layout and modal components
│   │   ├── layout/             # Sidebar, TopBar, CommandPalette
│   │   └── common/             # ToastContainer, ConfirmDialog
│   ├── features/               # Domain-specific views
│   │   ├── dashboard/          # Fleet overview and telemetry
│   │   ├── devices/            # Device grid, hardware modal, wireless connect
│   │   ├── files/              # Android filesystem explorer
│   │   ├── apps/               # Installed applications manager
│   │   ├── mirror/             # Scrcpy mirror and virtual device frame
│   │   ├── terminal/           # ADB shell console
│   │   ├── tools/              # Logcat viewer, report exporter, reset daemon
│   │   ├── backup/             # Backup & restore pipeline
│   │   ├── logs/               # Structured log viewer
│   │   └── settings/           # Configuration and localization
│   ├── lib/
│   │   ├── i18n.ts             # English & Persian dictionary with RTL hooks
│   │   ├── ipc.ts              # Unified IPC bridge (Tauri native + web engine)
│   │   └── adb-engine.ts       # High-fidelity runtime simulator for browser mode
│   ├── types/                  # Typed interfaces matching Rust structs
│   ├── App.tsx                 # Root application controller
│   └── index.css               # Tailwind CSS, custom scrollbars, and fonts
```

---

### Prerequisites

1. **Rust & Cargo**:
   - Install Rust via [rustup.rs](https://rustup.rs/) (stable channel, 1.75+).
   - On Windows: Visual Studio C++ Build Tools (MSVC).
2. **Node.js**:
   - Node.js 18+ or 20+ and npm / pnpm.
3. **Android Tools (Optional for native local device control)**:
   - Android SDK Platform-Tools (`adb`) added to your system `PATH`.
   - `scrcpy` added to system `PATH` for screen mirroring.

---

### Development & Build Commands

#### 1. Install Frontend Dependencies
```bash
npm install
```

#### 2. Run in Development Mode
```bash
# Web preview mode (works in any browser):
npm run dev

# Native Tauri Desktop mode:
npm run tauri:dev
```

#### 3. Build Production Executable (Windows x64)
```bash
# Builds frontend assets and produces Windows installer / standalone binary
npm run tauri:build
```
The output executable will be created in `src-tauri/target/release/bundle/nsis/` or `bundle/msi/`.

---

### Global Keyboard Shortcuts

| Shortcut | Description |
|---|---|
| `Ctrl + K` / `Cmd + K` | Open Command Palette & Quick Navigation |
| `Ctrl + Shift + S` | Capture Instant Framebuffer Screenshot |
| `Ctrl + Shift + M` | Toggle Scrcpy Screen Mirroring |
| `Ctrl + R` | Refresh Connected Devices Scan |
| `Esc` | Close Open Modals, Dialogs, or Command Palette |

---

<br />

---

<a name="فارسی"></a>
## 🇮🇷 راهنمای فارسی (Persian Documentation)

**اَپکس‌دروید (ApexDroid)** یک نرم‌افزار حرفه‌ای و پیشرفته دسکتاپ برای مدیریت، کنترل، نمایش تصویر و عیب‌یابی دستگاه‌های اندرویدی از طریق بستر **ADB** و **Scrcpy** است. این برنامه با هسته بومی **Rust (مبتنی بر Tokio و Tauri 2)** توسعه داده شده و از رابط کاربری سریع و مدرن بر پایه **React 19 + TypeScript + Tailwind CSS** با پشتیبانی کامل از چینش راست‌به‌چپ (RTL) و فونت وزیرمتن بهره می‌برد.

---

### امکانات و ویژگی‌های اصلی

1. **داشبورد تله‌متری بلادرنگ**:
   - نمایش وضعیت اتصال دستگاه‌های متصل (کابل USB و دیباگ وای‌فای).
   - پایش باتری، جریان شارژ، دما، استفاده از حافظه و توزیع نسخه‌های اندروید.
   - دسترسی فوری به عملیات‌های سریع (اسکرین‌شات، ریبوت، انتقال تصویر، نصب برنامه).

2. **شناسایی دقیق مشخصات سخت‌افزاری و نرم‌افزاری**:
   - بررسی نوع تراشه و پردازنده (Qualcomm Snapdragon، Google Tensor، Samsung Exynos).
   - پایش حافظه رم فعال و آزاد، گرافیک GPU، رزولوشن، تراکم پیکسل (DPI) و نرخ نوسازی ۱۲۰ هرتز.
   - نمایش سطح وصله امنیتی، نسخه کرنل لینوکس، وضعیت قفل بوت‌لودر و دسترسی روت (Root/SU).

3. **اتصال بی‌سیم از طریق وای‌فای (Wireless ADB)**:
   - اتصال مستقیم بر اساس آدرس آی‌پی و پورت (`IP:Port`).
   - اتصال از طریق کد جفت‌سازی ۶ رقمی در اندروید ۱۱ به بالا (Wi-Fi Pairing Code).

4. **مدیریت فایل پیشرفته (File Manager)**:
   - کاوش سریع در حافظه داخلی (`/sdcard`، `/storage/emulated/0`).
   - نوار مسیردهی تعاملی (Breadcrumbs) و بوک‌مارک‌های سریع (دانلودها، دوربین، اسناد).
   - انتقال فایل دوطرفه (بارگذاری Push و دانلود Pull).
   - ایجاد پوشه، تغییر نام، حذف دائمی فایل‌ها با تایید امنیتی و نمایش سطح دسترسی لینوکس (`drwxrwx--x`).

5. **مدیریت برنامه‌ها و پکیج‌ها (Applications)**:
   - نصب آسان بسته‌های نصبی اندروید با کشیدن و رها کردن فایل‌های APK.
   - فیلتر کردن برنامه‌ها: برنامه‌های کاربر، برنامه‌های سیستمی و برنامه‌های غیرفعال‌شده.
   - توقف اجباری (Force Stop)، پاکسازی کامل داده و کش (Clear Data)، فعال/غیرفعال‌سازی و اجرای برنامه‌ها.

6. **انتقال تصویر صفحه با Scrcpy (Screen Mirroring)**:
   - نمایش روان تصویر گوشی با کیفیت بالا و تاخیر ناچیز.
   - تعامل لمسی با صفحه مجازی گوشی و کلیدهای ناوبری نرم‌افزاری (بازگشت، خانه، برنامه‌های اخیر).
   - کلیدهای سخت‌افزاری مجازی (تنظیم صدا، قفل صفحه).
   - تنظیم رزولوشن (720p، 1080p، 1440p)، بیت‌ریت ویدیو و فریم بر ثانیه (تا ۱۲۰ فریم).
   - قابلیت فیلم‌برداری از صفحه با تایمر لحظه‌ای و اسکرین‌شات با فرمت PNG.

7. **ترمینال تعاملی ADB (Built-in Terminal)**:
   - کنسول خط فرمان با قابلیت پیمایش تاریخچه دستورات با کلیدهای جهت‌نما (Up/Down).
   - دکمه‌های آماده برای دستورات پرکاربرد (`getprop`، `dumpsys battery`، `pm list`، `df -h`، `logcat`).
   - کپی خروجی در کلیپ‌بورد، پاکسازی صفحه و پنجره تایید برای دستورات مخرب.

8. **دستیار پشتیبان‌گیری و بازیابی واقعی (Backup & Restore)**:
   - پشتیبان‌گیری آفلاین واقعی از فایل‌های APK و رسانه‌های حافظه دستگاه با استخراج مستقیم ADB.
   - ایجاد شناسه و مانیفست کامل امنیتی با تاییدیه هش جامع SHA-256 برای تضمین سلامت فایل‌ها.
   - شفاف‌سازی محدودیت‌های سیستمی اندروید (عدم ادعای نادرست دسترسی به سکتورهای محرمانه سیستمی بدون روت).
   - مسیر بازگردانی و نصب مجدد برنامه‌ها و رسانه‌ها با گزارش آمار واقعی اقلام موفق و ناموفق.

9. **لاگ‌های ساختاریافته Tracing**:
   - مشاهده لحظه‌ای رخدادهای سیستم با سطوح INFO، WARN، ERROR و DEBUG.
   - امکان جستجو و خروجی لاگ‌ها در قالب فایل متنی.

10. **پشتیبانی دو زبانه و چیدمان استاندارد فارسی**:
    - پشتیبانی کامل از زبان‌های انگلیسی و **فارسی**.
    - چیدمان راست‌به‌چپ (RTL) استاندارد با فونت **وزیرمتن** بدون بهم‌ریختگی اعداد و عناصر.

---

### معماری و فناوری‌ها

- **شل دسکتاپ**: Tauri 2 (سبک، امن، سازگار با معماری ۶۴ بیتی ویندوز).
- **بک‌اند پردازشی**: زبان Rust با فریم‌ورک همزمانی Tokio و ثبت گزارش Tracing.
- **فرانت‌اند**: React 19 به همراه TypeScript.
- **استایل‌دهی**: Tailwind CSS با تم تیره گرافیتی (`#090b10`) و نشانگرهای سیان.
- **ارتباط فرانت‌اند و بک‌اند**: پل ارتباطی دولایه تایپ‌شده (در دسکتاپ مستقیماً به کدهای Rust وصل می‌شود و در نسخه وب/پیش‌نمایش توسط شبیه‌ساز دقیق AdbEngine اجرا می‌گردد).

---

### پیش‌نیازها و نحوه اجرا

#### پیش‌نیازها:
- **نصب زبان Rust**: از طریق [rustup.rs](https://rustup.rs).
- **نصب Node.js**: نسخه 18 یا بالاتر.
- **نرم‌افزارهای ADB و Scrcpy** (اختیاری جهت اتصال به گوشی‌های فیزیکی واقعی): اضافه کردن مسیر آنها به متغیر PATH سیستم.

#### دستورات راه‌اندازی و اجرا:

```bash
# ۱. نصب پکیج‌های فرانت‌اند:
npm install

# ۲. اجرای نسخه پیش‌نمایش در مرورگر:
npm run dev

# ۳. اجرای نرم‌افزار به صورت دسکتاپ نیتیو (Tauri):
npm run tauri:dev

# ۴. خروجی نهایی برای ویندوز (تولید فایل exe و نصاب):
npm run tauri:build
```

---

### کلیدهای میانبر برنامه

| کلید میانبر | عملکرد |
|---|---|
| `Ctrl + K` / `Cmd + K` | باز کردن پالت دستورات و جستجوی سریع |
| `Ctrl + Shift + S` | گرفتن سریع اسکرین‌شات از صفحه گوشی |
| `Ctrl + Shift + M` | ورود به بخش انتقال تصویر Scrcpy |
| `Ctrl + R` | اسکن مجدد دستگاه‌های متصل |
| `Esc` | بستن پنجره‌ها و دیالوگ‌ها |
