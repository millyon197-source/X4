# Environment & Installation Guide

This document provides step-by-step setup and installation instructions for running the **X4 Vite Explorer** and **X4 Station Visualizer** applications, covering **Node.js**, **Vite**, and all third-party dependencies.

---

## 1. System Requirements

| Component | Minimum Requirement | Recommended |
| :--- | :--- | :--- |
| **Operating System** | Windows 10/11 (64-bit), macOS 12+, or Linux | Windows 11 (64-bit) |
| **Memory (RAM)** | 4 GB RAM | 8 GB+ RAM |
| **GPU / Graphics** | Standard display adapter | Hardware Acceleration enabled in browser |
| **Browser** | Chromium 109+, Firefox 115+, Safari 16+ | Google Chrome or Microsoft Edge |
| **Node.js** | Node.js 18.x LTS | Node.js 20.x or 22.x LTS (Node 26.x supported) |

---

## 2. Core Environment Setup (Node.js & Vite)

### Step 2.1: Install Node.js & npm

Node.js provides the JavaScript runtime environment, and npm manages dependencies and build scripts.

#### Option A: Windows Package Manager (`winget`) — Recommended
Open **PowerShell** or **Command Prompt** and execute:
```powershell
winget install OpenJS.NodeJS.LTS
```

#### Option B: Official Web Installer
1. Navigate to: [https://nodejs.org/](https://nodejs.org/).
2. Download the **LTS** package for your system.
3. Run the installer, accept default settings, and ensure **"Add to PATH"** is selected.

#### Option C: Node Version Manager (`nvm-windows`)
For switching between Node versions:
```powershell
winget install CoreyButler.NVMforWindows
nvm install 20.18.0
nvm use 20.18.0
```

#### Verification
Open a new terminal window and verify:
```powershell
node -v
# Expected: v18.x.x, v20.x.x, v22.x.x, or v26.x.x

npm -v
# Expected: 9.x.x, 10.x.x, or 11.x.x
```

> [!TIP]
> **PowerShell Execution Policy**:
> If script execution is blocked on Windows (`File ... cannot be loaded because running scripts is disabled`), run:
> ```powershell
> Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
> ```

---

### Step 2.2: Navigate to the Project Folder

```powershell
cd $HOME\projects\x4-supply-matrix
```

---

### Step 2.3: Install Dependencies

Install all required packages defined in `package.json`:

```powershell
npm install
```

#### Installed Packages:
- **`vite`** (`^8.2.1`): Next-generation local development server and bundler. Features sub-millisecond Hot Module Replacement (HMR) and production bundling via Rollup.

---

### Step 2.4: Running the Local Development Server

Start the live interactive development environment:

```powershell
npm run dev
```

- Vite will start local hosting (typically at **`http://localhost:5173`** or **`http://localhost:5174`**).
- Open the displayed URL in your browser.
- Live edits to JavaScript, CSS, or SVG templates will automatically hot-reload in the browser.

To stop the server, press `Ctrl + C`.

---

### Step 2.5: Building for Production

Compile and optimize the application into a standalone static web build:

```powershell
npm run build
```

- Generates optimized assets inside the `dist/` directory.

To test the compiled production build locally:
```powershell
npm run preview
```

---

## 3. Quick Reference Commands

### One-Click Startup (Recommended for all deployments)
Double-click `Start.bat` or run:
```powershell
.\setup_x4_supply_matrix.ps1
```
* Automatically verifies Node.js and installs missing dependencies.
* Synchronizes `extensions/x4_companion_bridge` into your local X4 game directories (Steam and Egosoft Documents).
* Cleans up stale port listeners.
* Starts the Companion backend server (`http://localhost:3000`) and the web application (`http://localhost:5173/X4/`).
* Automatically launches the web interface in your default browser.
* Cleanly shuts down both server and frontend when you press `Ctrl + C`.

### Advanced CLI Commands
```powershell
# Run setup script with specific options
.\setup_x4_supply_matrix.ps1 -Mode dev -NoBrowser       # Start without opening browser
.\setup_x4_supply_matrix.ps1 -ServerOnly                # Start backend companion server only
.\setup_x4_supply_matrix.ps1 -Clean                     # Full clean reinstall of modules

# Manual CLI commands
npm install         # Install packages
npm run dev         # Start Vite development server
npm run server      # Start companion backend server
npm run build       # Compile production bundle
npm run preview     # Preview production build locally
```

---

## 4. Troubleshooting

### Issue: `Port 5173 is in use`
Vite will automatically try port `5174` or subsequent open ports. To force a specific port:
```powershell
npx vite --port 8080
```

### Issue: `Browser display or SVG rendering issues`
- Confirm your browser has hardware acceleration turned on.
- In Chrome / Edge: **Settings > System > Use graphics acceleration when available**.
