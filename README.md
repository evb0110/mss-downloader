# Manuscript Downloader

A modern Electron application for downloading manuscripts from digital libraries including Gallica BnF, e-codices Unifr, and Vatican Library.

![Built with Electron](https://img.shields.io/badge/Built%20with-Electron-blueviolet.svg)
![Vue.js](https://img.shields.io/badge/Vue.js-35495E?style=flat&logo=vuedotjs&logoColor=4FC08D)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat&logo=typescript&logoColor=white)

## Features

- 🏛️ **Multi-library Support**: Download manuscripts from 50+ digital libraries worldwide
- 🔍 **Smart Library Search**: Find libraries quickly with fuzzy search and filtering
- 🎨 **Modern UI**: Clean, professional interface based on modern design principles
- 🌐 **Multilingual**: Support for English and Russian
- 📱 **Responsive**: Optimized for different window sizes
- ⚡ **Fast Downloads**: Parallel processing with progress tracking
- 📄 **PDF Generation**: Automatic PDF creation from downloaded images
- 💾 **Smart Caching**: Efficient image caching to prevent re-downloads
- 🎯 **Progress Tracking**: Real-time download progress with ETA and speed
- 🔬 **Maximum Resolution**: Automatically downloads highest available image quality

## Supported Libraries

The application supports **59 digital libraries** worldwide, including:

### Major International Libraries
- **Library of Congress** - US national library digital manuscripts and rare books
- **British Library** - UK national library digital manuscript collections  
- **Gallica (BnF)** - French National Library digital manuscripts
- **Vatican Library** - Vatican Apostolic Library digital collections
- **Berlin State Library** - German national library manuscript collections

### European University Libraries
- **Cambridge University Digital Library** - CUDL manuscript collections
- **University of Toronto (Fisher)** - Thomas Fisher Rare Book Library
- **Trinity College Cambridge** - Historical manuscript collections
- **Durham University** - Digital manuscript library

### Specialized Manuscript Collections
- **e-codices (Unifr)** - Swiss virtual manuscript library
- **Morgan Library & Museum** - Renowned manuscript and art collections
- **Stanford Parker Library** - Corpus Christi College, Cambridge manuscripts
- **IRHT (CNRS)** - French research institute historical texts

### Regional Libraries
- **BNE (Spain)** - Spanish National Library manuscripts
- **ONB (Austria)** - Austrian National Library collections
- **University of Graz** - Austrian manuscript collections
- **Rome National Library** - Italian historical manuscripts

The application includes intelligent library search with fuzzy matching to help you quickly find the library you need from the full list of 59 supported institutions.

## Library Search Features

The application now includes an enhanced library browsing experience:

- **🔍 Fuzzy Search**: Type partial library names to quickly find matches (e.g., "vatic" finds "Vatican Library")
- **📝 Multi-field Search**: Search across library names, descriptions, and example URLs
- **🔄 Real-time Filtering**: Libraries are filtered as you type with instant results
- **📚 Alphabetical Sorting**: All libraries are automatically sorted alphabetically for consistent browsing
- **❌ No Results Handling**: Clear messaging when no libraries match your search
- **🌍 Multilingual Support**: Search works in both English and Russian interfaces

### How to Use Library Search

1. Open the application and scroll to the "Supported Libraries" section
2. Use the search bar at the top of the libraries list
3. Type any part of a library name, institution, or country
4. Browse filtered results or click example URLs to use them immediately

## Development Setup

### Prerequisites

- Node.js 18+ 
- npm 9+

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd mss-downloader
```

2. Install dependencies:
```bash
npm install
```

3. Start development server:
```bash
npm run dev
```

This will start both the Vite dev server for the renderer process and the Electron main process.

## Build Commands

### Development
```bash
npm run dev              # Start development mode
npm run dev:main         # Build and run main process only
npm run dev:renderer     # Build renderer for development
```

### Production Build
```bash
npm run build            # Build all components for production
npm run build:main       # Build main process
npm run build:renderer   # Build renderer process
npm run build:preload    # Build preload scripts
npm run build:workers    # Build worker scripts
```

### Distribution
```bash
npm run dist             # Build for current platform
npm run dist:win         # Build Windows installer (.exe)
npm run dist:mac         # Build macOS installer (.dmg)
```

## Windows Exe Building

To build a Windows executable:

1. Run the build command:
```bash
npm run dist:win
```

2. The installer will be created in the `release/` directory as:
   - `Manuscript Downloader Setup 1.0.0.exe` - Windows installer
   - `win-arm64-unpacked/` - Unpacked application files

### Adding Custom Icons

For a custom application icon:

1. Create `assets/icon.png` (256x256 recommended)
2. Convert to Windows ICO format:
   ```bash
   # Using ImageMagick
   convert assets/icon.png -resize 256x256 assets/icon.ico
   ```
3. Uncomment the icon line in `package.json`:
   ```json
   "win": {
     "target": "nsis",
     "icon": "assets/icon.ico"
   }
   ```

## Project Structure

```
src/
├── main/                 # Electron main process
│   ├── services/         # Core services (downloaders, PDF, cache)
│   └── main.ts           # Main entry point
├── preload/              # Preload scripts for security
├── renderer/             # Vue.js frontend
│   ├── components/       # Vue components
│   ├── styles/           # SCSS stylesheets
│   └── translations/     # i18n translations
├── shared/               # Shared types and utilities
└── workers/              # Web workers for PDF processing
```

## Technology Stack

- **Electron 33+** - Desktop app framework
- **Vue.js 3** - Frontend framework with Composition API
- **TypeScript** - Type safety
- **Vite** - Fast build tool and dev server
- **Vue I18n** - Internationalization
- **jsPDF** - PDF generation
- **SCSS** - Styling with modern CSS features

## UI Design

The interface is based on the barsky.club design system featuring:

- Clean, minimal design with subtle shadows and blur effects
- Professional color palette with CSS custom properties
- Smooth animations and transitions
- Responsive grid layouts
- Modern typography with Nunito Sans font
- Card-based components with proper visual hierarchy
- **Smart Library Search**: Real-time fuzzy search across library names, descriptions, and URLs
- **Alphabetical Ordering**: Libraries automatically sorted for easy browsing

## Configuration

The application uses `electron-store` for persistent configuration including:

- Language preferences (English/Russian)
- Window state and position
- Download history and settings
- Cache management

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test both development and build processes
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Troubleshooting

### Development Issues

- **Build errors**: Ensure all TypeScript files compile without errors
- **Missing dependencies**: Run `npm install` to ensure all packages are installed
- **Port conflicts**: The dev server uses port 5173 by default

### Windows Build Issues

- **Missing icon**: Ensure `assets/icon.ico` exists or remove icon reference from package.json
- **Path issues**: Verify the main entry point in package.json matches the built file location
- **Architecture**: Building on macOS creates ARM64 Windows builds by default

### Runtime Issues

- **Download failures**: Check network connectivity and URL validity
- **PDF creation errors**: Ensure sufficient disk space and permissions
- **Cache issues**: Clear application cache through the UI or manually delete cache directory 