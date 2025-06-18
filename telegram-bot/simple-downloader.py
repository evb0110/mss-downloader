#!/usr/bin/env python3
"""
MSS Downloader Installer
A simple installer that downloads and runs the MSS Downloader setup.
"""

import os
import sys
import urllib.request
import subprocess
import tempfile
import tkinter as tk
from tkinter import ttk, messagebox
import threading
import webbrowser

class MSS_Installer:
    def __init__(self):
        self.root = tk.Tk()
        self.root.title("MSS Downloader Installer")
        self.root.geometry("500x300")
        self.root.resizable(False, False)
        
        # Center the window
        self.root.eval('tk::PlaceWindow . center')
        
        self.setup_ui()
        
    def setup_ui(self):
        # Main frame
        main_frame = ttk.Frame(self.root, padding="20")
        main_frame.grid(row=0, column=0, sticky=(tk.W, tk.E, tk.N, tk.S))
        
        # Title
        title_label = ttk.Label(main_frame, text="MSS Downloader Installer", 
                               font=("Arial", 16, "bold"))
        title_label.grid(row=0, column=0, columnspan=2, pady=(0, 20))
        
        # Description
        desc_text = """This installer will download and install the latest version of MSS Downloader.

MSS Downloader helps you download manuscripts from digital libraries like Gallica, e-codices, Vatican Library, and many others.

The installer will:
1. Download the latest setup file (~87MB)
2. Run the installer automatically
3. Clean up temporary files

Click 'Install' to begin."""
        
        desc_label = ttk.Label(main_frame, text=desc_text, wraplength=450, justify="left")
        desc_label.grid(row=1, column=0, columnspan=2, pady=(0, 20))
        
        # Progress bar
        self.progress = ttk.Progressbar(main_frame, length=400, mode='indeterminate')
        self.progress.grid(row=2, column=0, columnspan=2, pady=(0, 10), sticky=(tk.W, tk.E))
        
        # Status label
        self.status_label = ttk.Label(main_frame, text="Ready to install")
        self.status_label.grid(row=3, column=0, columnspan=2, pady=(0, 20))
        
        # Buttons
        button_frame = ttk.Frame(main_frame)
        button_frame.grid(row=4, column=0, columnspan=2)
        
        self.install_btn = ttk.Button(button_frame, text="Install", command=self.start_install)
        self.install_btn.grid(row=0, column=0, padx=(0, 10))
        
        self.manual_btn = ttk.Button(button_frame, text="Manual Download", command=self.manual_download)
        self.manual_btn.grid(row=0, column=1, padx=(10, 0))
        
        self.cancel_btn = ttk.Button(button_frame, text="Cancel", command=self.root.quit)
        self.cancel_btn.grid(row=0, column=2, padx=(10, 0))
        
    def start_install(self):
        self.install_btn.config(state='disabled')
        self.progress.start()
        self.status_label.config(text="Starting download...")
        
        # Start download in separate thread
        thread = threading.Thread(target=self.download_and_install)
        thread.daemon = True
        thread.start()
        
    def download_and_install(self):
        try:
            # GitHub releases URL - replace with actual repository
            download_url = "https://github.com/USER/REPO/releases/latest/download/MSS-Downloader-Setup.exe"
            
            # For now, use a placeholder URL that we'll update
            self.root.after(0, lambda: self.status_label.config(text="Contacting server..."))
            
            # Create temporary file
            temp_dir = tempfile.gettempdir()
            installer_path = os.path.join(temp_dir, "MSS-Downloader-Setup.exe")
            
            self.root.after(0, lambda: self.status_label.config(text="Downloading installer..."))
            
            # Download with progress (simplified for now)
            try:
                urllib.request.urlretrieve(download_url, installer_path)
            except Exception as e:
                self.root.after(0, lambda: self.download_failed(str(e)))
                return
                
            self.root.after(0, lambda: self.status_label.config(text="Starting installer..."))
            
            # Run the installer
            subprocess.run([installer_path], check=True)
            
            # Clean up
            try:
                os.remove(installer_path)
            except:
                pass
                
            self.root.after(0, self.install_complete)
            
        except Exception as e:
            self.root.after(0, lambda: self.download_failed(str(e)))
            
    def download_failed(self, error):
        self.progress.stop()
        self.install_btn.config(state='normal')
        self.status_label.config(text="Download failed")
        
        messagebox.showerror("Download Failed", 
                           f"Failed to download installer: {error}\\n\\nPlease try the manual download option.")
        
    def install_complete(self):
        self.progress.stop()
        self.status_label.config(text="Installation completed!")
        messagebox.showinfo("Success", "MSS Downloader has been installed successfully!")
        self.root.quit()
        
    def manual_download(self):
        url = "https://github.com/USER/REPO/releases/latest"
        webbrowser.open(url)
        messagebox.showinfo("Manual Download", 
                          "Your browser will open to the download page. Download the latest Windows installer.")
        
    def run(self):
        self.root.mainloop()

if __name__ == "__main__":
    app = MSS_Installer()
    app.run()