"""
Google Auto Login Tool - Main GUI Application
Modern GUI with multi-threading, animations, and real-time progress tracking
"""
import os
import sys
import time
import logging
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime
from typing import List, Dict, Optional
from dataclasses import dataclass
from enum import Enum

import customtkinter as ctk
from tkinter import filedialog, messagebox
import psutil  # For CPU/RAM monitoring

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from config import (
    SMSPOOL_API_KEY, AZCAPTCHA_API_KEY,
    MAX_THREADS, THREAD_STARTUP_DELAY,
    OUTPUT_DIR, SUCCESS_FILE, FAILED_FILE,
    PHONE_COUNTRIES
)
from clients.smspool_client import SMSPoolClient
from clients.captcha_client import AzCaptchaClient
from automation.browser import BrowserManager
from automation.window_manager import WindowManager
from automation.google_login import GoogleLoginAutomation

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class AccountStatus(Enum):
    PENDING = "pending"
    RUNNING = "running"
    SUCCESS = "success"
    FAILED = "failed"
    VERIFIED = "verified"


@dataclass
class AccountTask:
    email: str
    password: str
    status: AccountStatus = AccountStatus.PENDING
    message: str = ""
    index: int = 0
    credit: int = -1  # -1 = not checked yet


class ModernProgressBar(ctk.CTkFrame):
    """Custom animated progress bar widget."""
    
    def __init__(self, master, **kwargs):
        super().__init__(master, **kwargs)
        
        self.configure(fg_color="transparent")
        
        self.progress_bar = ctk.CTkProgressBar(
            self,
            width=400,
            height=20,
            corner_radius=10,
            progress_color="#00D4AA",
            fg_color="#2D2D2D"
        )
        self.progress_bar.pack(fill="x", padx=10, pady=5)
        self.progress_bar.set(0)
        
        self.label = ctk.CTkLabel(
            self,
            text="0%",
            font=ctk.CTkFont(size=14, weight="bold"),
            text_color="#00D4AA"
        )
        self.label.pack(pady=2)
    
    def set_progress(self, value: float, text: str = None):
        """Set progress value (0-1) and optional text."""
        self.progress_bar.set(value)
        if text:
            self.label.configure(text=text)
        else:
            self.label.configure(text=f"{int(value * 100)}%")


class AccountListItem(ctk.CTkFrame):
    """Individual account item in the list."""
    
    STATUS_COLORS = {
        AccountStatus.PENDING: "#666666",
        AccountStatus.RUNNING: "#FFA500",
        AccountStatus.SUCCESS: "#00D4AA",
        AccountStatus.FAILED: "#FF4444",
        AccountStatus.VERIFIED: "#00FF00"
    }
    
    def __init__(self, master, account: AccountTask, index: int, **kwargs):
        super().__init__(master, **kwargs)
        
        self.configure(fg_color="#2D2D2D", corner_radius=8, height=50)
        
        # Index label
        self.index_label = ctk.CTkLabel(
            self,
            text=f"#{index + 1}",
            width=40,
            font=ctk.CTkFont(size=12, weight="bold"),
            text_color="#888888"
        )
        self.index_label.pack(side="left", padx=10)
        
        # Email label
        self.email_label = ctk.CTkLabel(
            self,
            text=account.email[:30] + "..." if len(account.email) > 30 else account.email,
            font=ctk.CTkFont(size=13),
            text_color="#FFFFFF",
            anchor="w",
            width=200
        )
        self.email_label.pack(side="left", padx=5)
        
        # Status indicator
        self.status_frame = ctk.CTkFrame(
            self,
            width=12,
            height=12,
            corner_radius=6,
            fg_color=self.STATUS_COLORS[account.status]
        )
        self.status_frame.pack(side="left", padx=5)
        
        # Message label (shorter width to make room for credit)
        self.message_label = ctk.CTkLabel(
            self,
            text=account.message or account.status.value,
            font=ctk.CTkFont(size=11),
            text_color="#AAAAAA",
            anchor="w",
            width=80
        )
        self.message_label.pack(side="left", padx=5)
        
        # Credit label (new!) - shows actual credit number
        self.credit_label = ctk.CTkLabel(
            self,
            text="",
            font=ctk.CTkFont(size=11, weight="bold"),
            text_color="#888888",
            width=70
        )
        self.credit_label.pack(side="right", padx=10)
    
    def _parse_credit_from_message(self, message: str) -> tuple:
        """
        Parse credit value and label from status message.
        Returns: (credit_number, label)
        
        Format from automation: CREDIT:number|label
        """
        if not message:
            return -1, ""
        
        # New format: CREDIT:number|label
        if message.startswith("CREDIT:"):
            try:
                parts = message[7:].split("|", 1)
                credit = int(parts[0])
                label = parts[1] if len(parts) > 1 else ""
                return credit, label
            except:
                pass
        
        # Fallback: parse old format for backwards compatibility
        msg = message.lower()
        
        # Ultra = 45000
        if "ultra" in msg and "lên" not in msg:
            return 45000, "Ultra"
        # Lên Ultra = 100
        if "lên ultra" in msg or "lên được ultra" in msg:
            return 100, "Lên Ultra"
        # Die = 0
        if "die" in msg or "deleted" in msg or "no access" in msg:
            return 0, "Die"
        # Credits: XXX format
        import re
        match = re.search(r'credits?[:\s]*(\d+)', msg, re.IGNORECASE)
        if match:
            return int(match.group(1)), "Active"
        # Check for plain number in message
        match = re.search(r'(\d+)', msg)
        if match:
            return int(match.group(1)), ""
        
        return -1, message  # Unknown
    
    def update_status(self, status: AccountStatus, message: str = "", credit: int = None):
        """Update the status and credit display."""
        self.status_frame.configure(fg_color=self.STATUS_COLORS[status])
        
        # Parse credit and label from message
        parsed_credit, label = self._parse_credit_from_message(message)
        
        if credit is None:
            credit = parsed_credit
        
        # Show label in message column
        if label:
            self.message_label.configure(text=label)
        else:
            self.message_label.configure(text=message or status.value)
        
        # Update credit display with EXACT number and color coding
        if credit >= 0:
            # Format credit number
            credit_text = f"{credit:,}" if credit >= 1000 else str(credit)
            
            # Color based on credit value
            if credit >= 45000:
                self.credit_label.configure(text=credit_text, text_color="#00D4AA")  # Green - Ultra
            elif credit >= 100:
                self.credit_label.configure(text=credit_text, text_color="#FFD700")  # Yellow - Lên Ultra
            elif credit == 0:
                self.credit_label.configure(text="0", text_color="#FF4444")  # Red - Die
            else:
                self.credit_label.configure(text=credit_text, text_color="#FFA500")  # Orange - Low credit
        else:
            self.credit_label.configure(text="--", text_color="#888888")  # Unknown


class GoogleAutoLoginApp(ctk.CTk):
    """Main application window."""
    
    def __init__(self):
        super().__init__()
        
        # Window setup
        self.title("🔐 Google Auto Login Tool")
        self.geometry("900x700")
        self.minsize(800, 600)
        
        # Set dark theme
        ctk.set_appearance_mode("dark")
        ctk.set_default_color_theme("dark-blue")
        
        # State
        self.accounts: List[AccountTask] = []
        self.account_widgets: Dict[int, AccountListItem] = {}
        self.is_running = False
        self.executor: Optional[ThreadPoolExecutor] = None
        self.window_manager = WindowManager()
        self.active_browsers: Dict[int, BrowserManager] = {}
        self.stop_event = threading.Event()
        self.selected_country = "ID"  # Default country - Indonesia
        
        # Initialize clients
        self.smspool_client = SMSPoolClient(SMSPOOL_API_KEY)
        self.captcha_client = AzCaptchaClient(AZCAPTCHA_API_KEY)
        
        # Create output directory
        os.makedirs(OUTPUT_DIR, exist_ok=True)
        
        # Build UI
        self._build_ui()
        self._apply_animations()
    
    def _build_ui(self):
        """Build the main UI layout."""
        # Header
        self.header_frame = ctk.CTkFrame(self, fg_color="#1A1A2E", corner_radius=0, height=80)
        self.header_frame.pack(fill="x", padx=0, pady=0)
        self.header_frame.pack_propagate(False)
        
        self.title_label = ctk.CTkLabel(
            self.header_frame,
            text="🔐 Google Auto Login Tool",
            font=ctk.CTkFont(size=28, weight="bold"),
            text_color="#00D4AA"
        )
        self.title_label.pack(side="left", padx=30, pady=20)
        
        # Balance info
        self.balance_frame = ctk.CTkFrame(self.header_frame, fg_color="transparent")
        self.balance_frame.pack(side="right", padx=10)
        
        self.smspool_balance = ctk.CTkLabel(
            self.balance_frame,
            text="SMSPool: $--",
            font=ctk.CTkFont(size=12),
            text_color="#888888"
        )
        self.smspool_balance.pack(pady=2)
        
        self.captcha_balance = ctk.CTkLabel(
            self.balance_frame,
            text="AzCaptcha: $--",
            font=ctk.CTkFont(size=12),
            text_color="#888888"
        )
        self.captcha_balance.pack(pady=2)
        
        # System monitor - inline next to balance (on the left of balance)
        self.system_monitor_frame = ctk.CTkFrame(self.header_frame, fg_color="transparent")
        self.system_monitor_frame.pack(side="right", padx=20)
        
        self.tabs_label = ctk.CTkLabel(
            self.system_monitor_frame,
            text="🌐 Tabs: 0",
            font=ctk.CTkFont(size=11),
            text_color="#FFA500"
        )
        self.tabs_label.pack(pady=1)
        
        self.cpu_label = ctk.CTkLabel(
            self.system_monitor_frame,
            text="💻 CPU: 0%",
            font=ctk.CTkFont(size=11),
            text_color="#FF6B6B"
        )
        self.cpu_label.pack(pady=1)
        
        self.ram_label = ctk.CTkLabel(
            self.system_monitor_frame,
            text="🧠 RAM: 0%",
            font=ctk.CTkFont(size=11),
            text_color="#9B59B6"
        )
        self.ram_label.pack(pady=1)
        
        # Start system monitor update loop
        self._start_system_monitor()
        
        # Main content
        self.main_frame = ctk.CTkFrame(self, fg_color="transparent")
        self.main_frame.pack(fill="both", expand=True, padx=20, pady=10)
        
        # Left panel - Controls
        self.control_panel = ctk.CTkFrame(self.main_frame, fg_color="#16213E", corner_radius=15, width=280)
        self.control_panel.pack(side="left", fill="y", padx=10, pady=10)
        self.control_panel.pack_propagate(False)
        
        # Import button
        self.import_btn = ctk.CTkButton(
            self.control_panel,
            text="📁 Import File (.txt)",
            font=ctk.CTkFont(size=12, weight="bold"),
            fg_color="#0F3460",
            hover_color="#1A5276",
            height=35,
            corner_radius=10,
            command=self._import_accounts
        )
        self.import_btn.pack(fill="x", padx=20, pady=(15, 5))
        
        # === PASTE ACCOUNTS SECTION ===
        self.paste_frame = ctk.CTkFrame(self.control_panel, fg_color="#0F3460", corner_radius=10)
        self.paste_frame.pack(fill="x", padx=20, pady=(5, 5))
        
        self.paste_title = ctk.CTkLabel(
            self.paste_frame,
            text="📋 Paste Accounts (email|pass)",
            font=ctk.CTkFont(size=11, weight="bold"),
            text_color="#00D4AA"
        )
        self.paste_title.pack(pady=(8, 3))
        
        # Textbox for pasting accounts
        self.paste_textbox = ctk.CTkTextbox(
            self.paste_frame,
            height=80,
            font=ctk.CTkFont(size=10),
            fg_color="#1A1A2E",
            text_color="#FFFFFF",
            corner_radius=8
        )
        self.paste_textbox.pack(fill="x", padx=10, pady=3)
        
        # Add button
        self.add_accounts_btn = ctk.CTkButton(
            self.paste_frame,
            text="➕ Thêm Accounts",
            font=ctk.CTkFont(size=11, weight="bold"),
            fg_color="#00D4AA",
            hover_color="#00B894",
            text_color="#000000",
            height=30,
            corner_radius=8,
            command=self._add_pasted_accounts
        )
        self.add_accounts_btn.pack(fill="x", padx=10, pady=(3, 8))
        
        # Thread count slider
        self.thread_label = ctk.CTkLabel(
            self.control_panel,
            text=f"Max Threads: {MAX_THREADS}",
            font=ctk.CTkFont(size=12),
            text_color="#AAAAAA"
        )
        self.thread_label.pack(pady=(10, 5))
        
        self.thread_slider = ctk.CTkSlider(
            self.control_panel,
            from_=1,
            to=20,
            number_of_steps=19,
            width=200,
            progress_color="#00D4AA",
            button_color="#00D4AA",
            command=self._on_thread_change
        )
        self.thread_slider.set(MAX_THREADS)
        self.thread_slider.pack(pady=5)
        
        # Phone Country Settings
        self.phone_settings_frame = ctk.CTkFrame(self.control_panel, fg_color="#0F3460", corner_radius=10)
        self.phone_settings_frame.pack(fill="x", padx=20, pady=(15, 5))
        
        self.phone_title = ctk.CTkLabel(
            self.phone_settings_frame,
            text="📱 Phone Settings",
            font=ctk.CTkFont(size=14, weight="bold"),
            text_color="#00D4AA"
        )
        self.phone_title.pack(pady=(10, 5))
        
        self.country_label = ctk.CTkLabel(
            self.phone_settings_frame,
            text="SMS Country:",
            font=ctk.CTkFont(size=12),
            text_color="#AAAAAA"
        )
        self.country_label.pack(pady=2)
        
        # Country dropdown
        country_options = [f"{code} ({info['dial']}) - {info['name']}" for code, info in PHONE_COUNTRIES.items()]
        self.country_dropdown = ctk.CTkComboBox(
            self.phone_settings_frame,
            values=country_options,
            width=220,
            height=35,
            font=ctk.CTkFont(size=12),
            dropdown_font=ctk.CTkFont(size=11),
            fg_color="#1A1A2E",
            border_color="#00D4AA",
            button_color="#00D4AA",
            button_hover_color="#00B894",
            command=self._on_country_change
        )
        # Get first country (ID) as default
        first_country = list(PHONE_COUNTRIES.keys())[0]
        country_info = PHONE_COUNTRIES[first_country]
        default_option = f"{first_country} ({country_info['dial']}) - {country_info['name']}"
        self.country_dropdown.set(default_option)
        self.selected_country = first_country
        self.country_dropdown.pack(pady=(5, 10))
        
        # GPM Browser Settings
        self.gpm_frame = ctk.CTkFrame(self.control_panel, fg_color="#0F3460", corner_radius=10)
        self.gpm_frame.pack(fill="x", padx=20, pady=(5, 5))
        
        self.gpm_title = ctk.CTkLabel(
            self.gpm_frame,
            text="🌐 GPM Browsers",
            font=ctk.CTkFont(size=14, weight="bold"),
            text_color="#00D4AA"
        )
        self.gpm_title.pack(pady=(10, 5))
        
        # GPM status label
        self.gpm_status = ctk.CTkLabel(
            self.gpm_frame,
            text="Profiles: --",
            font=ctk.CTkFont(size=11),
            text_color="#888888"
        )
        self.gpm_status.pack(pady=2)
        
        # Scan GPM button
        self.scan_gpm_btn = ctk.CTkButton(
            self.gpm_frame,
            text="🔍 Scan GPM",
            font=ctk.CTkFont(size=12, weight="bold"),
            fg_color="#1A1A2E",
            hover_color="#2D2D2D",
            height=32,
            corner_radius=8,
            command=self._scan_gpm_profiles
        )
        self.scan_gpm_btn.pack(fill="x", padx=10, pady=(5, 3))
        
        # Select profiles button
        self.select_profiles_btn = ctk.CTkButton(
            self.gpm_frame,
            text="☑️ Select Profiles",
            font=ctk.CTkFont(size=12),
            fg_color="#1A1A2E",
            hover_color="#2D2D2D",
            height=32,
            corner_radius=8,
            command=self._show_profile_selector
        )
        self.select_profiles_btn.pack(fill="x", padx=10, pady=(3, 3))
        
        # Arrange Windows button
        self.arrange_btn = ctk.CTkButton(
            self.gpm_frame,
            text="📐 Arrange Windows",
            font=ctk.CTkFont(size=12),
            fg_color="#1A1A2E",
            hover_color="#2D2D2D",
            height=32,
            corner_radius=8,
            command=self._arrange_gpm_windows
        )
        self.arrange_btn.pack(fill="x", padx=10, pady=(3, 5))
        
        # Firefox mode checkbox (bypass GPM - no signin dialogs!)
        self.use_standalone_var = ctk.BooleanVar(value=False)
        self.standalone_checkbox = ctk.CTkCheckBox(
            self.gpm_frame,
            text="🦊 Use Firefox Browser",
            font=ctk.CTkFont(size=11),
            variable=self.use_standalone_var,
            text_color="#FF6B00",
            hover_color="#2D2D2D"
        )
        self.standalone_checkbox.pack(fill="x", padx=10, pady=(0, 5))
        
        # Headless mode checkbox (run browser hidden)
        self.headless_var = ctk.BooleanVar(value=False)
        self.headless_checkbox = ctk.CTkCheckBox(
            self.gpm_frame,
            text="👻 Chạy ẩn Browser (Headless)",
            font=ctk.CTkFont(size=11),
            variable=self.headless_var,
            text_color="#9B59B6",
            hover_color="#2D2D2D"
        )
        self.headless_checkbox.pack(fill="x", padx=10, pady=(0, 10))
        
        # Store GPM profiles
        self.gpm_profiles = []
        self.selected_profiles = []
        
        # Start/Stop button
        self.start_btn = ctk.CTkButton(
            self.control_panel,
            text="▶️ START",
            font=ctk.CTkFont(size=16, weight="bold"),
            fg_color="#00D4AA",
            hover_color="#00B894",
            text_color="#000000",
            height=50,
            corner_radius=10,
            command=self._toggle_start
        )
        self.start_btn.pack(fill="x", padx=20, pady=15)
        
        # Stats frame
        self.stats_frame = ctk.CTkFrame(self.control_panel, fg_color="#0F3460", corner_radius=10)
        self.stats_frame.pack(fill="x", padx=20, pady=10)
        
        self.stats_title = ctk.CTkLabel(
            self.stats_frame,
            text="📊 Statistics",
            font=ctk.CTkFont(size=14, weight="bold"),
            text_color="#00D4AA"
        )
        self.stats_title.pack(pady=10)
        
        self.total_label = ctk.CTkLabel(
            self.stats_frame,
            text="Total: 0",
            font=ctk.CTkFont(size=12),
            text_color="#FFFFFF"
        )
        self.total_label.pack(pady=2)
        
        self.success_label = ctk.CTkLabel(
            self.stats_frame,
            text="✅ Success: 0",
            font=ctk.CTkFont(size=12),
            text_color="#00D4AA"
        )
        self.success_label.pack(pady=2)
        
        self.failed_label = ctk.CTkLabel(
            self.stats_frame,
            text="❌ Failed: 0",
            font=ctk.CTkFont(size=12),
            text_color="#FF4444"
        )
        self.failed_label.pack(pady=2)
        
        self.pending_label = ctk.CTkLabel(
            self.stats_frame,
            text="⏳ Pending: 0",
            font=ctk.CTkFont(size=12),
            text_color="#888888"
        )
        self.pending_label.pack(pady=(2, 10))
        
        # Filter buttons frame
        self.filter_frame = ctk.CTkFrame(self.control_panel, fg_color="#0F3460", corner_radius=10)
        self.filter_frame.pack(fill="x", padx=20, pady=10)
        
        self.filter_title = ctk.CTkLabel(
            self.filter_frame,
            text="🔍 Quick Filters",
            font=ctk.CTkFont(size=14, weight="bold"),
            text_color="#00D4AA"
        )
        self.filter_title.pack(pady=10)
        
        # Die button (Red)
        self.die_btn = ctk.CTkButton(
            self.filter_frame,
            text="💀 Acc Die (0 Credit)",
            font=ctk.CTkFont(size=12, weight="bold"),
            fg_color="#FF4444",
            hover_color="#CC3333",
            height=35,
            corner_radius=8,
            command=lambda: self._show_filtered("Die")
        )
        self.die_btn.pack(fill="x", padx=10, pady=5)
        
        # Lên Ultra button (Yellow/Gold)
        self.len_ultra_btn = ctk.CTkButton(
            self.filter_frame,
            text="⭐ Lên Ultra (100 Credit)",
            font=ctk.CTkFont(size=12, weight="bold"),
            fg_color="#FFD700",
            hover_color="#DAA520",
            text_color="#000000",
            height=35,
            corner_radius=8,
            command=lambda: self._show_filtered("Lên được Ultra")
        )
        self.len_ultra_btn.pack(fill="x", padx=10, pady=5)
        
        # Ultra button (Green)
        self.ultra_btn = ctk.CTkButton(
            self.filter_frame,
            text="🏆 Ultra (45000 Credit)",
            font=ctk.CTkFont(size=12, weight="bold"),
            fg_color="#00D4AA",
            hover_color="#00B894",
            text_color="#000000",
            height=35,
            corner_radius=8,
            command=lambda: self._show_filtered("Ultra")
        )
        self.ultra_btn.pack(fill="x", padx=10, pady=5)
        
        # Show All button
        self.all_btn = ctk.CTkButton(
            self.filter_frame,
            text="📋 Show All",
            font=ctk.CTkFont(size=12),
            fg_color="#666666",
            hover_color="#555555",
            height=30,
            corner_radius=8,
            command=lambda: self._show_filtered(None)
        )
        self.all_btn.pack(fill="x", padx=10, pady=(5, 10))
        
        # Progress bar
        self.progress = ModernProgressBar(self.control_panel)
        self.progress.pack(fill="x", padx=20, pady=20)
        
        # Right panel - Account list
        self.list_panel = ctk.CTkFrame(self.main_frame, fg_color="#16213E", corner_radius=15)
        self.list_panel.pack(side="right", fill="both", expand=True, padx=10, pady=10)
        
        self.list_title = ctk.CTkLabel(
            self.list_panel,
            text="📋 Account List",
            font=ctk.CTkFont(size=16, weight="bold"),
            text_color="#00D4AA"
        )
        self.list_title.pack(pady=10)
        
        # === FILTER BUTTONS ROW (at top of list) ===
        self.filter_row = ctk.CTkFrame(self.list_panel, fg_color="transparent")
        self.filter_row.pack(fill="x", padx=10, pady=(0, 10))
        
        # Xem ULTRA button (Yellow)
        self.xem_ultra_btn = ctk.CTkButton(
            self.filter_row,
            text="⭐ Xem ULTRA",
            font=ctk.CTkFont(size=13, weight="bold"),
            fg_color="#FFD700",
            hover_color="#DAA520",
            text_color="#000000",
            width=140,
            height=38,
            corner_radius=8,
            command=lambda: self._show_filtered("Ultra")
        )
        self.xem_ultra_btn.pack(side="left", padx=5)
        
        # Xem Thành Công button (Green)
        self.xem_success_btn = ctk.CTkButton(
            self.filter_row,
            text="✅ Xem Thành Công",
            font=ctk.CTkFont(size=13, weight="bold"),
            fg_color="#00D4AA",
            hover_color="#00B894",
            text_color="#000000",
            width=160,
            height=38,
            corner_radius=8,
            command=lambda: self._show_filtered("Success")
        )
        self.xem_success_btn.pack(side="left", padx=5)
        
        # Xem Die button (Red)
        self.xem_die_btn = ctk.CTkButton(
            self.filter_row,
            text="💀 Xem Die",
            font=ctk.CTkFont(size=13, weight="bold"),
            fg_color="#FF4444",
            hover_color="#CC3333",
            width=120,
            height=38,
            corner_radius=8,
            command=lambda: self._show_filtered("Die")
        )
        self.xem_die_btn.pack(side="left", padx=5)
        
        # Xem Lên Ultra button (Orange)
        self.xem_len_ultra_btn = ctk.CTkButton(
            self.filter_row,
            text="🔼 Lên Ultra",
            font=ctk.CTkFont(size=13, weight="bold"),
            fg_color="#FF8C00",
            hover_color="#FF7000",
            text_color="#000000",
            width=120,
            height=38,
            corner_radius=8,
            command=lambda: self._show_filtered("Lên được Ultra")
        )
        self.xem_len_ultra_btn.pack(side="left", padx=5)
        
        # Xem Deleted button (Purple)
        self.xem_deleted_btn = ctk.CTkButton(
            self.filter_row,
            text="🗑️ Deleted",
            font=ctk.CTkFont(size=13, weight="bold"),
            fg_color="#9B59B6",
            hover_color="#8E44AD",
            width=100,
            height=38,
            corner_radius=8,
            command=lambda: self._show_filtered("Deleted")
        )
        self.xem_deleted_btn.pack(side="left", padx=5)
        
        # Scrollable account list
        self.account_scroll = ctk.CTkScrollableFrame(
            self.list_panel,
            fg_color="transparent",
            corner_radius=0
        )
        self.account_scroll.pack(fill="both", expand=True, padx=10, pady=(0, 10))
        
        # Footer
        self.footer_frame = ctk.CTkFrame(self, fg_color="#1A1A2E", corner_radius=0, height=40)
        self.footer_frame.pack(fill="x", side="bottom")
        self.footer_frame.pack_propagate(False)
        
        self.status_label = ctk.CTkLabel(
            self.footer_frame,
            text="Ready - Import accounts to begin",
            font=ctk.CTkFont(size=12),
            text_color="#666666"
        )
        self.status_label.pack(side="left", padx=20, pady=10)
        
        # Update balances
        self._update_balances()
    
    def _apply_animations(self):
        """Apply entrance animations."""
        # Fade in effect (simulated)
        self.attributes("-alpha", 0.0)
        
        def fade_in(alpha=0.0):
            if alpha < 1.0:
                self.attributes("-alpha", alpha)
                self.after(20, lambda: fade_in(alpha + 0.05))
            else:
                self.attributes("-alpha", 1.0)
        
        self.after(100, fade_in)
    
    def _update_balances(self):
        """Update API balance displays."""
        def fetch_balances():
            try:
                smspool_bal = self.smspool_client.get_balance()
                if smspool_bal is not None:
                    self.after(0, lambda: self.smspool_balance.configure(
                        text=f"SMSPool: ${smspool_bal:.2f}",
                        text_color="#00D4AA"
                    ))
            except:
                pass
            
            try:
                captcha_bal = self.captcha_client.get_balance()
                if captcha_bal is not None:
                    self.after(0, lambda: self.captcha_balance.configure(
                        text=f"AzCaptcha: ${captcha_bal:.2f}",
                        text_color="#00D4AA"
                    ))
            except:
                pass
        
        threading.Thread(target=fetch_balances, daemon=True).start()
    
    def _start_system_monitor(self):
        """Start background thread to update system stats."""
        def update_stats():
            while True:
                try:
                    # Count active browser tabs
                    active_tabs = len(self.active_browsers)
                    
                    # Get CPU and RAM usage
                    cpu_percent = psutil.cpu_percent(interval=0.5)
                    ram_percent = psutil.virtual_memory().percent
                    
                    # Update UI (thread-safe)
                    self.after(0, lambda t=active_tabs, c=cpu_percent, r=ram_percent: self._update_system_labels(t, c, r))
                    
                except Exception as e:
                    pass
                
                time.sleep(2)  # Update every 2 seconds
        
        monitor_thread = threading.Thread(target=update_stats, daemon=True)
        monitor_thread.start()
    
    def _update_system_labels(self, tabs: int, cpu: float, ram: float):
        """Update system monitor labels."""
        try:
            self.tabs_label.configure(text=f"🌐 Tabs: {tabs}")
            
            # Color code CPU based on usage
            cpu_color = "#00D4AA" if cpu < 50 else "#FFA500" if cpu < 80 else "#FF6B6B"
            self.cpu_label.configure(text=f"💻 CPU: {cpu:.0f}%", text_color=cpu_color)
            
            # Color code RAM based on usage
            ram_color = "#00D4AA" if ram < 50 else "#FFA500" if ram < 80 else "#FF6B6B"
            self.ram_label.configure(text=f"🧠 RAM: {ram:.0f}%", text_color=ram_color)
        except:
            pass
    
    def _on_thread_change(self, value):
        """Handle thread slider change."""
        self.thread_label.configure(text=f"Max Threads: {int(value)}")
    
    def _on_country_change(self, value):
        """Handle country dropdown change."""
        # Extract country code from dropdown value
        country_code = value.split(" ")[0]
        self.selected_country = country_code
        logger.info(f"Selected country: {country_code}")
    
    def _import_accounts(self):
        """Import accounts from text file."""
        filepath = filedialog.askopenfilename(
            title="Select Accounts File",
            filetypes=[("Text files", "*.txt"), ("All files", "*.*")]
        )
        
        if not filepath:
            return
        
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                lines = f.readlines()
            
            self.accounts.clear()
            for widget in self.account_widgets.values():
                widget.destroy()
            self.account_widgets.clear()
            
            for i, line in enumerate(lines):
                line = line.strip()
                if '|' in line:
                    parts = line.split('|', 1)
                    if len(parts) == 2:
                        email, password = parts
                        account = AccountTask(
                            email=email.strip(),
                            password=password.strip(),
                            index=i
                        )
                        self.accounts.append(account)
                        
                        # Create widget
                        widget = AccountListItem(
                            self.account_scroll,
                            account,
                            i,
                            fg_color="#2D2D2D"
                        )
                        widget.pack(fill="x", pady=3, padx=5)
                        self.account_widgets[i] = widget
            
            self._update_stats()
            self.status_label.configure(text=f"Loaded {len(self.accounts)} accounts from file")
            
        except Exception as e:
            messagebox.showerror("Error", f"Failed to load file: {e}")
    
    def _add_pasted_accounts(self):
        """Add accounts from paste textbox."""
        text = self.paste_textbox.get("1.0", "end").strip()
        
        if not text:
            messagebox.showwarning("Warning", "Vui lòng paste accounts vào ô trước!")
            return
        
        lines = text.split('\n')
        added_count = 0
        start_index = len(self.accounts)
        
        for line in lines:
            line = line.strip()
            if '|' in line:
                parts = line.split('|', 1)
                if len(parts) == 2:
                    email, password = parts
                    email = email.strip()
                    password = password.strip()
                    
                    # Skip if already exists
                    if any(acc.email == email for acc in self.accounts):
                        continue
                    
                    i = start_index + added_count
                    account = AccountTask(
                        email=email,
                        password=password,
                        index=i
                    )
                    self.accounts.append(account)
                    
                    # Create widget
                    widget = AccountListItem(
                        self.account_scroll,
                        account,
                        i,
                        fg_color="#2D2D2D"
                    )
                    widget.pack(fill="x", pady=3, padx=5)
                    self.account_widgets[i] = widget
                    added_count += 1
        
        # Clear textbox after adding
        self.paste_textbox.delete("1.0", "end")
        
        if added_count > 0:
            self._update_stats()
            self.status_label.configure(text=f"Đã thêm {added_count} accounts từ paste")
        else:
            messagebox.showinfo("Info", "Không tìm thấy account hợp lệ. Format: email|password")
    
    def _update_stats(self):
        """Update statistics display."""
        total = len(self.accounts)
        success = sum(1 for a in self.accounts if a.status in [AccountStatus.SUCCESS, AccountStatus.VERIFIED])
        failed = sum(1 for a in self.accounts if a.status == AccountStatus.FAILED)
        pending = sum(1 for a in self.accounts if a.status in [AccountStatus.PENDING, AccountStatus.RUNNING])
        
        self.total_label.configure(text=f"Total: {total}")
        self.success_label.configure(text=f"✅ Success: {success}")
        self.failed_label.configure(text=f"❌ Failed: {failed}")
        self.pending_label.configure(text=f"⏳ Pending: {pending}")
        
        if total > 0:
            progress = (success + failed) / total
            self.progress.set_progress(progress, f"{int(progress * 100)}% ({success + failed}/{total})")
    
    def _show_filtered(self, filter_type: str):
        """Show filtered accounts in a popup window."""
        # Filter accounts based on type
        filtered = []
        
        for acc in self.accounts:
            msg = acc.message.lower() if acc.message else ""
            
            if filter_type is None:
                # Show all
                filtered.append(acc)
            elif filter_type == "Die":
                if "die" in msg or "0 credit" in msg or "account deleted" in msg or "no access" in msg:
                    filtered.append(acc)
            elif filter_type == "Lên được Ultra":
                # Match both "Lên Ultra" and "Lên được Ultra" (legacy)
                if "lên ultra" in msg or "lên được ultra" in msg or "100 credit" in msg:
                    filtered.append(acc)
            elif filter_type == "Ultra":
                if (("ultra" in msg and "lên" not in msg) or "45000" in msg) and msg != "lên ultra":
                    filtered.append(acc)
            elif filter_type == "Success":
                if acc.status == AccountStatus.SUCCESS or acc.status == AccountStatus.VERIFIED:
                    filtered.append(acc)
            elif filter_type == "Deleted":
                if "deleted" in msg or "đã xóa" in msg or "không tồn tại" in msg:
                    filtered.append(acc)
        
        # Create popup window
        popup = ctk.CTkToplevel(self)
        popup.title(f"🔍 Filtered: {filter_type or 'All'} ({len(filtered)} accounts)")
        popup.geometry("600x500")
        popup.transient(self)
        popup.grab_set()
        
        # Title
        title_label = ctk.CTkLabel(
            popup,
            text=f"📋 {filter_type or 'All Accounts'} - {len(filtered)} accounts",
            font=ctk.CTkFont(size=18, weight="bold"),
            text_color="#00D4AA"
        )
        title_label.pack(pady=15)
        
        # Scrollable frame for accounts
        scroll_frame = ctk.CTkScrollableFrame(
            popup,
            fg_color="#1A1A2E",
            corner_radius=10
        )
        scroll_frame.pack(fill="both", expand=True, padx=20, pady=10)
        
        # Add accounts to list
        for acc in filtered:
            acc_frame = ctk.CTkFrame(scroll_frame, fg_color="#2D2D2D", corner_radius=5)
            acc_frame.pack(fill="x", pady=3, padx=5)
            
            # Show email|password format
            acc_label = ctk.CTkLabel(
                acc_frame,
                text=f"📧 {acc.email}|{acc.password}",
                font=ctk.CTkFont(size=12, weight="bold"),
                text_color="#FFFFFF"
            )
            acc_label.pack(side="left", padx=10, pady=8)
            
            msg_label = ctk.CTkLabel(
                acc_frame,
                text=acc.message or acc.status.value,
                font=ctk.CTkFont(size=11),
                text_color="#888888"
            )
            msg_label.pack(side="right", padx=10, pady=8)
        
        # Copy button
        def copy_to_clipboard():
            text = "\n".join([f"{acc.email}|{acc.password}" for acc in filtered])
            self.clipboard_clear()
            self.clipboard_append(text)
            messagebox.showinfo("Copied", f"Copied {len(filtered)} accounts to clipboard!")
        
        copy_btn = ctk.CTkButton(
            popup,
            text="📋 Copy All to Clipboard",
            font=ctk.CTkFont(size=14, weight="bold"),
            fg_color="#00D4AA",
            hover_color="#00B894",
            text_color="#000000",
            height=40,
            command=copy_to_clipboard
        )
        copy_btn.pack(fill="x", padx=20, pady=15)
    
    def _scan_gpm_profiles(self):
        """Scan GPM for available profiles."""
        try:
            from automation.browser import GPMClient
            gpm = GPMClient()
            
            self.gpm_profiles = gpm.get_profiles()
            
            if self.gpm_profiles:
                self.gpm_status.configure(
                    text=f"Profiles: {len(self.gpm_profiles)} found",
                    text_color="#00D4AA"
                )
                # Auto-select all profiles
                self.selected_profiles = [p.get('id') for p in self.gpm_profiles]
                messagebox.showinfo(
                    "GPM Scan", 
                    f"Found {len(self.gpm_profiles)} GPM profiles!\n"
                    f"Click 'Select Profiles' to choose which ones to use."
                )
            else:
                self.gpm_status.configure(
                    text="No profiles found",
                    text_color="#FF4444"
                )
                messagebox.showwarning(
                    "GPM Scan", 
                    "No GPM profiles found.\n"
                    "Make sure GPM is running at http://127.0.0.1:11894"
                )
        except Exception as e:
            self.gpm_status.configure(text="GPM Error", text_color="#FF4444")
            messagebox.showerror("GPM Error", f"Failed to scan GPM: {e}")
    
    def _arrange_gpm_windows(self):
        """Arrange all open GPM browser windows."""
        try:
            from automation.browser import GPMClient
            gpm = GPMClient()
            
            if gpm.arrange_windows():
                messagebox.showinfo("GPM", "Windows arranged successfully!")
            else:
                messagebox.showwarning("GPM", "Failed to arrange windows.\nMake sure browsers are open.")
        except Exception as e:
            messagebox.showerror("GPM Error", f"Failed to arrange windows: {e}")
    
    def _show_profile_selector(self):
        """Show popup to select which GPM profiles to use."""
        if not self.gpm_profiles:
            messagebox.showwarning("Warning", "No profiles scanned. Click 'Scan GPM' first.")
            return
        
        popup = ctk.CTkToplevel(self)
        popup.title("☑️ Select GPM Profiles")
        popup.geometry("500x600")
        popup.transient(self)
        popup.grab_set()
        
        # Title
        title_label = ctk.CTkLabel(
            popup,
            text=f"🌐 Select Profiles ({len(self.gpm_profiles)} available)",
            font=ctk.CTkFont(size=18, weight="bold"),
            text_color="#00D4AA"
        )
        title_label.pack(pady=15)
        
        # Select All / Deselect All buttons
        btn_frame = ctk.CTkFrame(popup, fg_color="transparent")
        btn_frame.pack(fill="x", padx=20, pady=5)
        
        # Checkbox variables
        checkbox_vars = {}
        
        def select_all():
            for var in checkbox_vars.values():
                var.set(True)
        
        def deselect_all():
            for var in checkbox_vars.values():
                var.set(False)
        
        ctk.CTkButton(
            btn_frame, text="✅ Select All", width=100,
            command=select_all, fg_color="#00D4AA", text_color="#000"
        ).pack(side="left", padx=5)
        
        ctk.CTkButton(
            btn_frame, text="❌ Deselect All", width=100,
            command=deselect_all, fg_color="#FF4444"
        ).pack(side="left", padx=5)
        
        # Scrollable frame for profiles
        scroll_frame = ctk.CTkScrollableFrame(
            popup,
            fg_color="#1A1A2E",
            corner_radius=10
        )
        scroll_frame.pack(fill="both", expand=True, padx=20, pady=10)
        
        # Add profile checkboxes
        for profile in self.gpm_profiles:
            profile_id = profile.get('id', '')
            profile_name = profile.get('profile_name', profile.get('name', 'Unknown'))
            
            var = ctk.BooleanVar(value=profile_id in self.selected_profiles)
            checkbox_vars[profile_id] = var
            
            cb = ctk.CTkCheckBox(
                scroll_frame,
                text=f"📁 {profile_name}",
                variable=var,
                font=ctk.CTkFont(size=12),
                fg_color="#00D4AA",
                hover_color="#00B894"
            )
            cb.pack(fill="x", pady=3, padx=10)
        
        # Confirm button
        def confirm_selection():
            self.selected_profiles = [
                pid for pid, var in checkbox_vars.items() if var.get()
            ]
            self.gpm_status.configure(
                text=f"Selected: {len(self.selected_profiles)} profiles"
            )
            popup.destroy()
            messagebox.showinfo(
                "Selection Saved",
                f"Selected {len(self.selected_profiles)} profiles for use."
            )
        
        ctk.CTkButton(
            popup,
            text=f"💾 Confirm Selection",
            font=ctk.CTkFont(size=14, weight="bold"),
            fg_color="#00D4AA",
            hover_color="#00B894",
            text_color="#000000",
            height=40,
            command=confirm_selection
        ).pack(fill="x", padx=20, pady=15)
    
    def _toggle_start(self):
        """Toggle start/stop."""
        if self.is_running:
            self._stop_processing()
        else:
            self._start_processing()
    
    def _start_processing(self):
        """Start processing accounts."""
        if not self.accounts:
            messagebox.showwarning("Warning", "No accounts loaded. Import a file first.")
            return
        
        pending_accounts = [a for a in self.accounts if a.status == AccountStatus.PENDING]
        if not pending_accounts:
            messagebox.showinfo("Info", "All accounts have been processed.")
            return
        
        self.is_running = True
        self.stop_event.clear()
        self.start_btn.configure(text="⏹️ STOP", fg_color="#FF4444", hover_color="#CC3333")
        self.import_btn.configure(state="disabled")
        self.thread_slider.configure(state="disabled")
        
        thread = threading.Thread(target=self._process_accounts, daemon=True)
        thread.start()
    
    def _stop_processing(self):
        """Stop processing accounts."""
        self.is_running = False
        self.stop_event.set()
        self.start_btn.configure(text="▶️ START", fg_color="#00D4AA", hover_color="#00B894")
        self.import_btn.configure(state="normal")
        self.thread_slider.configure(state="normal")
        self.status_label.configure(text="Stopped - Processing halted")
        
        # Close all browsers
        self._cleanup_browsers()
    
    def _process_accounts(self):
        """Process accounts with multi-threading."""
        max_workers = int(self.thread_slider.get())
        pending_accounts = [a for a in self.accounts if a.status == AccountStatus.PENDING]
        
        self.after(0, lambda: self.status_label.configure(text=f"Processing {len(pending_accounts)} accounts with {max_workers} threads..."))
        
        # Calculate window positions for all workers
        positions = self.window_manager.get_window_positions(min(len(pending_accounts), max_workers))
        
        # Get selected GPM profile IDs (cycle through them)
        profile_ids = self.selected_profiles if self.selected_profiles else [None]
        
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            self.executor = executor
            futures = {}
            
            for i, account in enumerate(pending_accounts):
                if self.stop_event.is_set():
                    break
                
                # Get position for this worker
                position = positions[i % len(positions)] if positions else None
                
                # Get GPM profile ID (cycle through selected profiles)
                profile_id = profile_ids[i % len(profile_ids)] if profile_ids else None
                
                # Submit task with profile_id
                future = executor.submit(self._process_single_account, account, position, profile_id)
                futures[future] = account
                
                # Staggered startup
                time.sleep(THREAD_STARTUP_DELAY)
            
            # Wait for completion
            for future in as_completed(futures):
                if self.stop_event.is_set():
                    break
                
                account = futures[future]
                try:
                    success, message = future.result()
                    account.status = AccountStatus.SUCCESS if success else AccountStatus.FAILED
                    account.message = message
                except Exception as e:
                    account.status = AccountStatus.FAILED
                    account.message = str(e)
                
                # Update UI
                self.after(0, lambda a=account: self._update_account_widget(a))
                self.after(0, self._update_stats)
        
        # Completion
        self.after(0, self._on_processing_complete)
    
    def _process_single_account(self, account: AccountTask, position, profile_id: str = None) -> tuple:
        """Process a single account using GPM profile."""
        browser = None
        try:
            # Update status
            account.status = AccountStatus.RUNNING
            account.message = "Starting browser..."
            self.after(0, lambda: self._update_account_widget(account))
            
            # Create browser - use standalone Firefox if checkbox is enabled
            use_standalone = self.use_standalone_var.get()
            use_headless = self.headless_var.get()
            browser = BrowserManager(profile_id=profile_id, use_standalone=use_standalone)
            driver = browser.create_browser(position=position, profile_id=profile_id, headless=use_headless)
            
            if not driver:
                return False, "Failed to create browser"
            
            # Store browser reference
            self.active_browsers[account.index] = browser
            
            # Get country info
            country_info = PHONE_COUNTRIES.get(self.selected_country, PHONE_COUNTRIES["US"])
            
            # Create automation instance
            automation = GoogleLoginAutomation(
                driver,
                self.smspool_client,
                self.captcha_client,
                phone_country=self.selected_country,
                phone_dial_code=country_info["dial"]
            )
            
            # Callback for status updates
            def status_callback(msg):
                account.message = msg
                self.after(0, lambda: self._update_account_widget(account))
            
            # Perform login
            success, message = automation.login(
                account.email,
                account.password,
                callback=status_callback
            )
            
            return success, message
            
        except Exception as e:
            logger.error(f"Error processing {account.email}: {e}")
            return False, str(e)
        finally:
            # Close browser
            if browser:
                try:
                    browser.close()
                except:
                    pass
            if account.index in self.active_browsers:
                del self.active_browsers[account.index]
    
    def _update_account_widget(self, account: AccountTask):
        """Update account widget in UI."""
        if account.index in self.account_widgets:
            self.account_widgets[account.index].update_status(account.status, account.message)
    
    def _cleanup_browsers(self):
        """Close all active browsers."""
        for browser in list(self.active_browsers.values()):
            try:
                browser.close()
            except:
                pass
        self.active_browsers.clear()
    
    def _on_processing_complete(self):
        """Handle processing completion."""
        self.is_running = False
        self.start_btn.configure(text="▶️ START", fg_color="#00D4AA", hover_color="#00B894")
        self.import_btn.configure(state="normal")
        self.thread_slider.configure(state="normal")
        
        # Save results
        self._save_results()
        
        # Update status
        success_count = sum(1 for a in self.accounts if a.status in [AccountStatus.SUCCESS, AccountStatus.VERIFIED])
        failed_count = sum(1 for a in self.accounts if a.status == AccountStatus.FAILED)
        
        self.status_label.configure(
            text=f"Complete! ✅ {success_count} success, ❌ {failed_count} failed - Results saved to output/"
        )
        
        # Update balances
        self._update_balances()
    
    def _save_results(self):
        """Save results to output files."""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        
        # Success file
        success_accounts = [a for a in self.accounts if a.status in [AccountStatus.SUCCESS, AccountStatus.VERIFIED]]
        success_path = os.path.join(OUTPUT_DIR, f"success_{timestamp}.txt")
        with open(success_path, 'w', encoding='utf-8') as f:
            for account in success_accounts:
                f.write(f"{account.email}:{account.password}\n")
        
        # Failed file
        failed_accounts = [a for a in self.accounts if a.status == AccountStatus.FAILED]
        failed_path = os.path.join(OUTPUT_DIR, f"failed_{timestamp}.txt")
        with open(failed_path, 'w', encoding='utf-8') as f:
            for account in failed_accounts:
                f.write(f"{account.email}:{account.password} | {account.message}\n")
        
        logger.info(f"Results saved: {len(success_accounts)} success, {len(failed_accounts)} failed")
    
    def on_closing(self):
        """Handle window close."""
        self._stop_processing()
        self._cleanup_browsers()
        self.destroy()


def main():
    """Main entry point."""
    app = GoogleAutoLoginApp()
    app.protocol("WM_DELETE_WINDOW", app.on_closing)
    app.mainloop()


if __name__ == "__main__":
    main()
