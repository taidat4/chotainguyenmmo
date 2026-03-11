# -*- coding: utf-8 -*-
"""
Farm Account Recovery Tool
Tự động thu hồi acc farm khi hết bảo hành bằng cách đổi password trên Google Admin Console

Sử dụng Playwright - TỰ ĐỘNG TẢI BROWSER, không cần cài Firefox/Chrome

Features:
- Chạy 100% background với browser riêng
- Không ảnh hưởng chuột/bàn phím của user
- Tự động ghi kết quả vào Google Sheet "Acc thu hồi"
"""

import os
import sys
import json
import time
import logging
import asyncio
from datetime import datetime
from pathlib import Path

# Thêm path để import từ MY_BOT
sys.path.insert(0, str(Path(__file__).parent.parent))

try:
    from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeout
except ImportError:
    print("❌ Cần cài đặt Playwright:")
    print("   pip install playwright")
    print("   playwright install firefox")
    sys.exit(1)

try:
    import gspread
    from oauth2client.service_account import ServiceAccountCredentials
except ImportError:
    print("❌ Cần cài đặt: pip install gspread oauth2client")
    sys.exit(1)

# ============ CONFIG ============
CURRENT_DIR = Path(__file__).parent
FARM_ACCOUNTS_FILE = CURRENT_DIR / "farm_accounts.json"
CREDENTIALS_FILE = CURRENT_DIR.parent / "credentials.json"
BROWSER_DATA_DIR = CURRENT_DIR / "browser_data"
LOG_FILE = CURRENT_DIR / "recovery.log"

# Google Sheets config
SPREADSHEET_NAME = "Danh Mục Sản Phẩm"
WORKSHEET_NAME = "Acc thu hồi"

# Column indexes (0-based)
COL_ACC_GOC = 0        # A - Acc Gốc
COL_ACC_THU_HOI = 1    # B - Acc Thu Hồi
COL_NGAY_DOI_PASS = 2  # C - Ngày Đổi Pass + Password mới
COL_TINH_TRANG = 3     # D - Tình Trạng
COL_NGAY_MUA = 4       # E - Ngày Mua
COL_HET_HAN = 5        # F - Hết Hạn
COL_ORDER_ID = 6       # G - ID Đơn Hàng

# ============ LOGGING ============
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(LOG_FILE, encoding='utf-8'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# ============ HELPER FUNCTIONS ============

def load_farm_accounts():
    """Load danh sách admin accounts từ file"""
    if not FARM_ACCOUNTS_FILE.exists():
        logger.error(f"❌ Không tìm thấy file {FARM_ACCOUNTS_FILE}")
        return []
    
    with open(FARM_ACCOUNTS_FILE, 'r', encoding='utf-8') as f:
        return json.load(f)

def extract_domain(email_str):
    """Extract domain từ email, xử lý cả format email|password"""
    if not email_str:
        return None
    
    if '|' in email_str:
        email_str = email_str.split('|')[0].strip()
    
    if '@' in email_str:
        return email_str.split('@')[1].lower().strip()
    return None

def extract_email_only(email_str):
    """Lấy phần email, bỏ password nếu có"""
    if not email_str:
        return None
    
    if '|' in email_str:
        return email_str.split('|')[0].strip()
    return email_str.strip()

def find_admin_for_domain(domain, farm_accounts):
    """Tìm admin account cho domain tương ứng"""
    for farm in farm_accounts:
        if farm.get('domain', '').lower() == domain.lower():
            return farm
    return None

def get_google_sheet():
    """Kết nối Google Sheets"""
    try:
        scopes = [
            "https://spreadsheets.google.com/feeds",
            'https://www.googleapis.com/auth/spreadsheets',
            "https://www.googleapis.com/auth/drive.file",
            "https://www.googleapis.com/auth/drive"
        ]
        
        if not CREDENTIALS_FILE.exists():
            logger.error(f"❌ Không tìm thấy file credentials: {CREDENTIALS_FILE}")
            return None
        
        creds = ServiceAccountCredentials.from_json_keyfile_name(str(CREDENTIALS_FILE), scopes)
        client = gspread.authorize(creds)
        spreadsheet = client.open(SPREADSHEET_NAME)
        worksheet = spreadsheet.worksheet(WORKSHEET_NAME)
        logger.info(f"✅ Đã kết nối Google Sheets: {SPREADSHEET_NAME} / {WORKSHEET_NAME}")
        return worksheet
    except gspread.exceptions.WorksheetNotFound:
        logger.error(f"❌ Không tìm thấy worksheet '{WORKSHEET_NAME}'")
        return None
    except gspread.exceptions.SpreadsheetNotFound:
        logger.error(f"❌ Không tìm thấy spreadsheet '{SPREADSHEET_NAME}'")
        return None  
    except Exception as e:
        logger.error(f"❌ Lỗi kết nối Google Sheets: {e}")
        return None

def parse_date_flexible(date_str, current_year):
    """Parse ngày linh hoạt, hỗ trợ nhiều format:
    - dd/mm (VD: 06/02)
    - dd/mm/yyyy (VD: 06/02/2026)
    - dd/mm/yy (VD: 06/02/26)
    - d/m (VD: 6/2)
    """
    import re
    date_str = date_str.strip()
    if not date_str:
        return None
    
    # Thử parse dd/mm/yyyy trước
    patterns = [
        (r'^(\d{1,2})/(\d{1,2})/(\d{4})$', True),   # dd/mm/yyyy
        (r'^(\d{1,2})/(\d{1,2})/(\d{2})$', True),    # dd/mm/yy
        (r'^(\d{1,2})/(\d{1,2})$', False),            # dd/mm
    ]
    
    for pattern, has_year in patterns:
        match = re.match(pattern, date_str)
        if match:
            day = int(match.group(1))
            month = int(match.group(2))
            if has_year:
                year = int(match.group(3))
                if year < 100:
                    year += 2000
            else:
                year = current_year
            
            try:
                return datetime(year, month, day)
            except ValueError:
                return None
    return None


def get_accounts_to_recover(worksheet):
    """Lấy danh sách acc cần thu hồi
    
    Logic:
    - Chỉ thu hồi khi ngày hiện tại > ngày hết hạn (cột F)
    - Cột D = 'CHƯA THU HỒI': Thu hồi acc ở cột A (acc mua gốc)
    - Cột D = 'ĐÃ BẢO HÀNH': Thu hồi acc ở cột B (acc bảo hành thay thế)
    """
    try:
        all_records = worksheet.get_all_values()
        accounts_to_recover = []
        
        today = datetime.now()
        current_year = today.year
        
        logger.info(f"📅 Ngày hôm nay: {today.strftime('%d/%m/%Y')}")
        logger.info(f"📋 Tổng số rows trong sheet: {len(all_records)}")
        
        # Log header để verify column mapping
        if all_records:
            header = all_records[0]
            logger.info(f"📋 Header: {header}")
            logger.info(f"📋 Số cột header: {len(header)}")
        
        for row_idx, row in enumerate(all_records[1:], start=2):
            # Debug: log RAW row data
            logger.info(f"🔍 Row {row_idx} RAW ({len(row)} cột): {row}")
            
            if len(row) <= COL_TINH_TRANG:
                logger.info(f"   ⏩ Bỏ qua: Row chỉ có {len(row)} cột, cần ít nhất {COL_TINH_TRANG + 1}")
                continue
            
            tinh_trang = row[COL_TINH_TRANG].strip().upper()
            acc_goc = row[COL_ACC_GOC].strip() if len(row) > COL_ACC_GOC else ""
            acc_thu_hoi = row[COL_ACC_THU_HOI].strip() if len(row) > COL_ACC_THU_HOI else ""
            het_han_str = row[COL_HET_HAN].strip() if len(row) > COL_HET_HAN else ""
            
            logger.info(f"   -> Acc gốc: '{acc_goc[:40]}'")
            logger.info(f"   -> Tình trạng (D): '{tinh_trang}'")
            logger.info(f"   -> Hết hạn (F, index {COL_HET_HAN}): '{het_han_str}'")
            
            # Bỏ qua nếu đã thu hồi
            if tinh_trang == "ĐÃ THU HỒI":
                logger.info(f"   ⏩ Bỏ qua: Đã thu hồi rồi")
                continue
            
            # Bỏ qua nếu không có ngày hết hạn
            if not het_han_str:
                logger.info(f"   ⏩ Bỏ qua: Không có ngày hết hạn")
                continue
            
            # Parse ngày hết hạn (linh hoạt nhiều format)
            expiry_date = parse_date_flexible(het_han_str, current_year)
            if not expiry_date:
                logger.warning(f"   ⚠️ Không parse được ngày: '{het_han_str}'")
                continue
            
            logger.info(f"   📆 Ngày hết hạn parsed: {expiry_date.strftime('%d/%m/%Y')}")
            
            # Chỉ thu hồi nếu ngày hiện tại > ngày hết hạn
            if today.date() <= expiry_date.date():
                logger.info(f"   ⏩ Bỏ qua: Chưa hết hạn (today={today.date()} <= expiry={expiry_date.date()})")
                continue
            
            logger.info(f"   ✅ Đã hết hạn! (today={today.date()} > expiry={expiry_date.date()})")
            # Xác định email cần thu hồi
            # Cột A có thể chứa: email|password HOẶC số "1" (khi acc nằm ở cột B)
            # Cột B chứa: email hoặc email|password (acc thay thế/bảo hành)
            
            # Tách email (bỏ phần |password nếu có)
            def extract_email(val):
                if not val:
                    return ""
                return val.split('|')[0].strip()
            
            email_a = extract_email(acc_goc)
            email_b = extract_email(acc_thu_hoi)
            
            # CHƯA THU HỒI: Ưu tiên cột A, fallback cột B
            if tinh_trang == "CHƯA THU HỒI":
                if email_a and '@' in email_a:
                    target_email = email_a
                    logger.info(f"   ✅ THÊM thu hồi từ cột A: {target_email}")
                elif email_b and '@' in email_b:
                    target_email = email_b
                    logger.info(f"   ✅ THÊM thu hồi từ cột B (fallback): {target_email}")
                else:
                    logger.info(f"   ⏩ Bỏ qua: Không tìm thấy email hợp lệ (A='{acc_goc[:20]}', B='{acc_thu_hoi[:20]}')")
                    continue
                
                accounts_to_recover.append({
                    'row': row_idx,
                    'acc_goc': acc_goc,
                    'acc_thu_hoi': target_email,
                    'order_id': row[COL_ORDER_ID] if len(row) > COL_ORDER_ID else "",
                    'expiry': het_han_str
                })
            
            # ĐÃ BẢO HÀNH: thu hồi acc thay thế (cột B)
            elif tinh_trang == "ĐÃ BẢO HÀNH":
                if email_b and '@' in email_b:
                    logger.info(f"   ✅ THÊM thu hồi acc BH từ cột B: {email_b}")
                    accounts_to_recover.append({
                        'row': row_idx,
                        'acc_goc': acc_goc,
                        'acc_thu_hoi': email_b,
                        'order_id': row[COL_ORDER_ID] if len(row) > COL_ORDER_ID else "",
                        'expiry': het_han_str
                    })
                else:
                    logger.info(f"   ⏩ Bỏ qua: BẢO HÀNH nhưng cột B không có email")
            else:
                logger.info(f"   ⏩ Bỏ qua: Tình trạng '{tinh_trang}' không cần thu hồi")
        
        logger.info(f"📊 Tổng số acc cần thu hồi: {len(accounts_to_recover)}")
        return accounts_to_recover
    except Exception as e:
        logger.error(f"❌ Lỗi đọc Sheet: {e}")
        return []

# ============ PLAYWRIGHT AUTOMATION ============

class GoogleAdminRecovery:
    """Class để tự động đổi password trên Google Admin Console bằng Chrome thật"""
    
    def __init__(self, admin_email, admin_password, headless=False):
        self.admin_email = admin_email
        self.admin_password = admin_password
        self.headless = headless
        self.playwright = None
        self.browser = None
        self.context = None
        self.page = None
        self.chrome_process = None  # Process Chrome thật
        
    def _find_chrome_path(self):
        """Tìm Chrome.exe trên máy Windows"""
        import os
        possible_paths = [
            os.path.expandvars(r'%ProgramFiles%\Google\Chrome\Application\chrome.exe'),
            os.path.expandvars(r'%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe'),
            os.path.expandvars(r'%LocalAppData%\Google\Chrome\Application\chrome.exe'),
            # Edge fallback
            os.path.expandvars(r'%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe'),
            os.path.expandvars(r'%ProgramFiles%\Microsoft\Edge\Application\msedge.exe'),
        ]
        for p in possible_paths:
            if os.path.exists(p):
                return p
        return None
    
    def setup_browser(self, worker_index=0, total_workers=5):
        """Khởi tạo Firefox THẬT qua Playwright persistent context
        
        Dùng persistent profile giống browser thật → Google ít detect hơn.
        Không popup "Sign in to Chrome?".
        
        Args:
            worker_index: Vị trí cửa sổ (0-4) để xếp grid
            total_workers: Tổng số workers
        """
        try:
            self.playwright = sync_playwright().start()
            
            # Tạo thư mục profile riêng cho mỗi worker
            BROWSER_DATA_DIR.mkdir(exist_ok=True)
            worker_profile = BROWSER_DATA_DIR / f"firefox_worker_{worker_index}"
            worker_profile.mkdir(exist_ok=True)
            
            # Tính toán vị trí cửa sổ grid: 3 trên + 2 dưới
            screen_w, screen_h = 1920, 1080
            taskbar_h = 40
            usable_h = screen_h - taskbar_h
            
            if worker_index < 3:
                cols = 3
                row = 0
                col = worker_index
            else:
                cols = 2
                row = 1
                col = worker_index - 3
            
            win_w = screen_w // cols
            win_h = usable_h // 2
            pos_x = col * win_w
            pos_y = row * win_h
            
            logger.info(f"🦊 Launching Firefox worker {worker_index}...")
            
            # Launch Firefox với persistent context (giống browser thật)
            self.context = self.playwright.firefox.launch_persistent_context(
                user_data_dir=str(worker_profile),
                headless=self.headless,
                viewport={'width': win_w - 20, 'height': win_h - 80},
                locale="vi-VN",
                timezone_id="Asia/Ho_Chi_Minh",
                firefox_user_prefs={
                    # Tắt popup/warning
                    "browser.shell.checkDefaultBrowser": False,
                    "browser.startup.homepage_override.mstone": "ignore",
                    "browser.tabs.warnOnClose": False,
                    "datareporting.policy.dataSubmissionEnabled": False,
                    "toolkit.telemetry.reportingpolicy.firstRun": False,
                    # Anti-detection
                    "dom.webdriver.enabled": False,
                    "marionette.enabled": False,
                    "network.http.sendRefererHeader": 2,
                    # Performance
                    "browser.cache.disk.enable": False,
                    "browser.cache.memory.enable": True,
                },
            )
            
            # Lấy page đầu tiên hoặc tạo mới
            self.browser = None  # Persistent context không có browser riêng
            pages = self.context.pages
            self.page = pages[0] if pages else self.context.new_page()
            self.page.set_default_timeout(30000)
            
            # Di chuyển cửa sổ đến vị trí grid
            if not self.headless:
                time.sleep(1)
                self._position_window(worker_index, pos_x, pos_y, win_w, win_h)
            
            logger.info(f"✅ Worker {worker_index}: Firefox đã sẵn sàng")
            return True
            
        except Exception as e:
            logger.error(f"❌ Lỗi khởi tạo Firefox: {e}")
            return False
    
    def _position_window(self, worker_index, pos_x, pos_y, win_w, win_h):
        """Di chuyển cửa sổ browser đến vị trí grid bằng Win32 API"""
        try:
            import ctypes
            from ctypes import wintypes
            
            user32 = ctypes.windll.user32
            
            # Đặt title đặc biệt để tìm đúng cửa sổ
            unique_title = f"WORKER_{worker_index}_{id(self)}"
            self.page.goto("about:blank")
            self.page.evaluate(f"document.title = '{unique_title}'")
            time.sleep(0.5)
            
            # Tìm cửa sổ có title chứa unique_title
            target_hwnd = None
            
            # Khai báo đúng kiểu dữ liệu cho 64-bit Windows
            EnumWindowsProc = ctypes.WINFUNCTYPE(
                wintypes.BOOL, wintypes.HWND, wintypes.LPARAM
            )
            
            def find_window(hwnd, lParam):
                nonlocal target_hwnd
                if user32.IsWindowVisible(hwnd):
                    length = user32.GetWindowTextLengthW(hwnd)
                    if length > 0:
                        buf = ctypes.create_unicode_buffer(length + 1)
                        user32.GetWindowTextW(hwnd, buf, length + 1)
                        if unique_title in buf.value:
                            target_hwnd = hwnd
                            return False  # Dừng enum
                return True
            
            user32.EnumWindows(EnumWindowsProc(find_window), 0)
            
            if target_hwnd:
                # Set window position và size
                SWP_NOZORDER = 0x0004
                SWP_SHOWWINDOW = 0x0040
                user32.SetWindowPos(
                    target_hwnd, None,
                    pos_x, pos_y, win_w, win_h,
                    SWP_NOZORDER | SWP_SHOWWINDOW
                )
                logger.info(f"📐 ✅ Worker {worker_index} → vị trí ({pos_x},{pos_y}) size {win_w}x{win_h}")
            else:
                logger.warning(f"📐 ⚠️ Không tìm thấy cửa sổ cho worker {worker_index}")
                
        except Exception as e:
            logger.debug(f"Window positioning error: {e}")
    
    def login(self):
        """Login vào Google Admin Console"""
        try:
            logger.info(f"🔐 Đang login với {self.admin_email}...")
            
            # Dùng 'domcontentloaded' - Admin Console WebSocket sẽ treo networkidle
            self.page.goto("https://admin.google.com/", wait_until='domcontentloaded', timeout=30000)
            time.sleep(3)
            
            # === CHECK: Đã login sẵn hay cần login? ===
            needs_login = False
            for attempt in range(15):  # Check tối đa 15 lần x 2s = 30s
                current_url = self.page.url
                logger.info(f"🔍 Check attempt {attempt+1}: URL = {current_url}")
                
                # Đã login - URL ở admin.google.com
                if 'admin.google.com' in current_url and 'accounts.google.com' not in current_url:
                    logger.info("✅ Đã login sẵn từ session trước!")
                    self._dismiss_admin_popups()
                    return True
                
                # URL ở accounts.google.com - có thể đang auto-redirect hoặc cần login
                if 'accounts.google.com' in current_url:
                    # Kiểm tra email input CÓ THẬT SỰ HIỆN không
                    try:
                        email_input = self.page.locator("input[type='email']")
                        if email_input.is_visible(timeout=3000):
                            logger.info("🔑 Tìm thấy form login, bắt đầu đăng nhập...")
                            needs_login = True
                            break
                    except:
                        pass
                    
                    # Không thấy email input → có thể đang auto-redirect
                    logger.info("⏳ URL ở accounts.google.com nhưng chưa thấy form, chờ redirect...")
                
                time.sleep(2)
            
            # Nếu không cần login (đã redirect về admin)
            if not needs_login:
                current_url = self.page.url
                if 'admin.google.com' in current_url:
                    logger.info("✅ Auto-redirect về Admin Console thành công!")
                    self._dismiss_admin_popups()
                    return True
                else:
                    logger.error(f"❌ Không xác định được trạng thái: {current_url}")
                    return False
            
            # === LOGIN FLOW ===
            # Nhập email
            email_input = self.page.locator("input[type='email']")
            email_input.fill(self.admin_email)
            
            # Click Next
            try:
                self.page.locator("#identifierNext").click()
            except:
                try:
                    self.page.get_by_role("button", name="Next").click()
                except:
                    self.page.get_by_role("button", name="Tiếp theo").click()
            time.sleep(3)
            
            # Nhập password - Google có 2 input password (1 ẩn, 1 thật)
            # Dùng name='Passwd' để chỉ target input thật
            try:
                password_input = self.page.locator("input[name='Passwd']")
                password_input.wait_for(timeout=20000)
            except:
                # Fallback: lọc bỏ hidden input
                password_input = self.page.locator("input[type='password']:not([aria-hidden='true'])")
                password_input.wait_for(timeout=10000)
            password_input.fill(self.admin_password)
            
            # Click Next
            try:
                self.page.locator("#passwordNext").click()
            except:
                try:
                    self.page.get_by_role("button", name="Next").click()
                except:
                    self.page.get_by_role("button", name="Tiếp theo").click()
            time.sleep(5)
            
            # Verify đã login
            for _ in range(15):
                if 'admin.google.com' in self.page.url and 'accounts.google.com' not in self.page.url:
                    break
                time.sleep(2)
            
            time.sleep(3)
            self._dismiss_admin_popups()
            
            logger.info("✅ Login thành công!")
            return True
            
        except Exception as e:
            logger.error(f"❌ Lỗi login: {e}")
            return False
    
    def _dismiss_admin_popups(self):
        """Đóng các popup/banner trên Admin Console dashboard"""
        try:
            # Đóng banner "Activate Gmail" (nút X)
            for close_btn in ['[aria-label="Close"]', '[aria-label="Đóng"]', 'button:has-text("×")', '.banner-close']:
                try:
                    btn = self.page.locator(close_btn).first
                    if btn.is_visible(timeout=1000):
                        btn.click()
                        time.sleep(0.5)
                except:
                    pass
            
            # Dismiss "Set up billing" - click ngoài hoặc đóng
            try:
                skip_btn = self.page.locator("text=SKIP").first
                if skip_btn.is_visible(timeout=1000):
                    skip_btn.click()
                    time.sleep(0.5)
            except:
                pass
            
            # Dismiss onboarding cards
            try:
                dismiss_btn = self.page.locator("text=Dismiss").first
                if dismiss_btn.is_visible(timeout=1000):
                    dismiss_btn.click()
                    time.sleep(0.5)
            except:
                pass
                
        except Exception as e:
            logger.debug(f"Popup dismiss: {e}")
    
    def navigate_to_users(self):
        """Navigate đến Directory > Users bằng URL trực tiếp"""
        try:
            logger.info("📂 Đang vào Directory > Users...")
            
            # Navigate trực tiếp đến trang Users bằng URL
            # Dùng domcontentloaded thay vì networkidle (tránh treo)
            self.page.goto("https://admin.google.com/ac/users", wait_until='domcontentloaded', timeout=30000)
            time.sleep(3)
            
            # Verify đã vào trang Users
            for _ in range(10):
                if '/users' in self.page.url:
                    break
                time.sleep(2)
            
            logger.info("✅ Đã vào trang Users")
            return True
            
        except Exception as e:
            logger.error(f"❌ Lỗi navigate: {e}")
            return False
    
    def search_and_reset_password(self, user_email):
        """
        Quy trình reset password theo đúng UI Google Admin:
        1. Search user
        2. Click vào TÊN user trong kết quả tìm kiếm
        3. Trong trang profile, click "ĐẶT LẠI MẬT KHẨU" ở menu bên trái
        4. Dialog xuất hiện - click "ĐẶT LẠI"
        5. Click "SAO CHÉP MẬT KHẨU"
        6. Click "XONG"
        """
        try:
            logger.info(f"🔍 Đang tìm và reset password cho: {user_email}")
            
            # Chờ trang load
            time.sleep(2)
            
            # ========== BƯỚC 1: SEARCH USER ==========
            logger.info("📝 Bước 1: Search user...")
            
            # Tìm search box trong header
            search_box = self.page.locator("input[type='text'], input[type='search'], [role='combobox'], [role='searchbox']").first
            search_box.click()
            time.sleep(0.5)
            search_box.fill(user_email)
            self.page.keyboard.press("Enter")
            time.sleep(3)
            
            logger.info("✅ Đã search user")
            
            # ========== BƯỚC 2: CLICK VÀO TÊN USER ==========
            logger.info("📝 Bước 2: Click vào tên user trong kết quả...")
            
            # Lấy username từ email (phần trước @)
            username = user_email.split('@')[0] if '@' in user_email else user_email
            
            # Tìm link có tên user trong kết quả search
            # Kết quả search hiển thị dạng: "test 1" hoặc "test1" với email bên dưới
            user_link = None
            
            # Thử tìm theo nhiều cách
            selectors_to_try = [
                f"a:has-text('{username}')",
                f"[role='link']:has-text('{username}')",
                f"text={username}",
                f"a:has-text('{user_email}')"
            ]
            
            for selector in selectors_to_try:
                try:
                    user_link = self.page.locator(selector).first
                    if user_link.is_visible(timeout=3000):
                        user_link.click()
                        logger.info(f"✅ Đã click vào user: {selector}")
                        break
                except:
                    continue
            
            time.sleep(3)
            
            # ========== BƯỚC 3: CLICK "ĐẶT LẠI MẬT KHẨU" ==========
            logger.info("📝 Bước 3: Click 'ĐẶT LẠI MẬT KHẨU' trong menu...")
            
            # Tìm và click text "ĐẶT LẠI MẬT KHẨU" trong menu bên trái
            reset_menu = None
            reset_selectors = [
                # Tiếng Việt
                "text=ĐẶT LẠI MẬT KHẨU",
                "text=Đặt lại mật khẩu",
                # Tiếng Anh
                "text=RESET PASSWORD",
                "text=Reset password",
                "text=Reset Password",
                "[data-action='resetPassword']"
            ]
            
            for selector in reset_selectors:
                try:
                    reset_menu = self.page.locator(selector).first
                    if reset_menu.is_visible(timeout=3000):
                        reset_menu.click()
                        logger.info("✅ Đã click 'ĐẶT LẠI MẬT KHẨU'")
                        break
                except:
                    continue
            
            time.sleep(2)
            
            # ========== BƯỚC 4: CLICK "ĐẶT LẠI" TRONG DIALOG ==========
            logger.info("📝 Bước 4: Click 'ĐẶT LẠI' trong dialog...")
            
            # Chờ dialog load
            time.sleep(1)
            
            # Cách 1: Click trực tiếp vào text "ĐẶT LẠI" (phải là exact match, không phải "ĐẶT LẠI MẬT KHẨU")
            clicked = False
            
            # Thử get_by_text với exact match
            try:
                # Tìm element có text chính xác "ĐẶT LẠI" (không phải "ĐẶT LẠI MẬT KHẨU")
                reset_btn = self.page.get_by_text("ĐẶT LẠI", exact=True)
                if reset_btn.is_visible(timeout=3000):
                    reset_btn.click()
                    clicked = True
                    logger.info("✅ Đã click 'ĐẶT LẠI' (exact match)")
            except:
                pass
            
            # Cách 2: Thử tiếng Anh
            if not clicked:
                try:
                    reset_btn = self.page.get_by_text("RESET", exact=True)
                    if reset_btn.is_visible(timeout=2000):
                        reset_btn.click()
                        clicked = True
                        logger.info("✅ Đã click 'RESET' (exact match)")
                except:
                    pass
            
            # Cách 3: Click bằng locator đơn giản
            if not clicked:
                simple_selectors = [
                    "text=ĐẶT LẠI",
                    "text=RESET",
                    "*:text-is('ĐẶT LẠI')",
                    "*:text-is('RESET')"
                ]
                for sel in simple_selectors:
                    try:
                        elements = self.page.locator(sel).all()
                        for elem in elements:
                            txt = elem.inner_text().strip()
                            # Chỉ click nếu text CHÍNH XÁC là "ĐẶT LẠI" hoặc "RESET"
                            if txt.upper() == "ĐẶT LẠI" or txt.upper() == "RESET":
                                elem.click()
                                clicked = True
                                logger.info(f"✅ Đã click: {txt}")
                                break
                        if clicked:
                            break
                    except:
                        continue
            
            if not clicked:
                logger.error("❌ Không tìm thấy nút ĐẶT LẠI / RESET")
                return None
            
            time.sleep(2)
            
            # ========== BƯỚC 5: LẤY MẬT KHẨU MỚI ==========
            logger.info("📝 Bước 5: Lấy mật khẩu mới...")
            
            new_password = None
            import re
            import html as html_module
            
            SKIP_VALUES = {'autogenerate', 'auto', 'true', 'false', 'on', 'off', 'submit', 'button', 'text', 'password', 'hidden'}
            
            # === CÁCH 1: JavaScript đọc TẤT CẢ input values từ DOM ===
            try:
                all_inputs = self.page.evaluate("""() => {
                    const inputs = document.querySelectorAll('input');
                    const results = [];
                    for (const inp of inputs) {
                        if (inp.value && inp.value.length >= 8) {
                            results.push({type: inp.type, value: inp.value});
                        }
                    }
                    return results;
                }""")
                
                for inp_data in (all_inputs or []):
                    val = inp_data.get('value', '')
                    if val and len(val) >= 8 and '@' not in val and val.lower() not in SKIP_VALUES:
                        new_password = val
                        logger.info(f"✅ Lấy password từ JS DOM ({inp_data.get('type')}): {val[:3]}***")
                        break
            except Exception as e:
                logger.warning(f"⚠️ JS DOM failed: {e}")
            
            # === CÁCH 2: Click icon mắt → reveal → đọc lại ===
            if not new_password:
                try:
                    # Click tất cả button/icon gần password field
                    eye_selectors = [
                        "[aria-label*='Show']",
                        "[aria-label*='password']", 
                        "[aria-label*='Hiện']",
                        "[data-tooltip*='Show']",
                        "[data-tooltip*='Hiện']"
                    ]
                    for sel in eye_selectors:
                        try:
                            icon = self.page.locator(sel).first
                            if icon.is_visible(timeout=1000):
                                icon.click(force=True)
                                time.sleep(0.5)
                                break
                        except:
                            continue
                    
                    # Đọc lại tất cả inputs bằng JS
                    all_inputs2 = self.page.evaluate("""() => {
                        const inputs = document.querySelectorAll('input[type=text], input[type=password]');
                        const results = [];
                        for (const inp of inputs) {
                            if (inp.value && inp.value.length >= 8) {
                                results.push({type: inp.type, value: inp.value});
                            }
                        }
                        return results;
                    }""")
                    
                    for inp_data in (all_inputs2 or []):
                        val = inp_data.get('value', '')
                        if val and len(val) >= 8 and '@' not in val and val.lower() not in SKIP_VALUES and '.' not in val:
                            new_password = val
                            logger.info(f"✅ Lấy password sau reveal: {val[:3]}***")
                            break
                except Exception as e:
                    logger.warning(f"⚠️ Eye icon method failed: {e}")
            
            # === CÁCH 3: Regex HTML + decode entities ===
            if not new_password:
                try:
                    page_html = self.page.content()
                    matches = re.findall(r'value="([^"]{8,30})"', page_html)
                    for m in matches:
                        decoded = html_module.unescape(m)
                        if len(decoded) >= 8 and '@' not in decoded and decoded.lower() not in SKIP_VALUES:
                            if not decoded.startswith('http') and not decoded.startswith('/'):
                                new_password = decoded
                                logger.info(f"✅ Lấy password từ HTML: {decoded[:3]}***")
                                break
                except:
                    pass
            
            # Trả về ngay - browser sẽ tự đóng
            if new_password:
                logger.info(f"✅ Password mới: {new_password[:3]}***")
                return new_password
            else:
                logger.error("❌ Đã reset nhưng KHÔNG lấy được password!")
                return None
            
        except Exception as e:
            logger.error(f"❌ Lỗi reset password: {e}")
            return None
    
    def close(self):
        """Đóng browser Firefox"""
        try:
            if self.context:
                try:
                    self.context.close()
                except:
                    pass
            if self.browser:
                try:
                    self.browser.close()
                except:
                    pass
            if self.playwright:
                try:
                    self.playwright.stop()
                except:
                    pass
            logger.info("🔒 Đã đóng browser")
        except:
            pass

# ============ SINGLE ACC RECOVERY WORKER ============

def recover_single_acc(acc, farm_accounts, headless=True, worker_index=0, total_workers=5):
    """
    Worker function để thu hồi 1 acc trong 1 browser riêng biệt.
    Được gọi bởi ThreadPoolExecutor.
    Có watchdog timer 90s để tự đóng browser nếu bị stuck.
    """
    import threading
    
    user_email_raw = acc['acc_thu_hoi']
    user_email = extract_email_only(user_email_raw)
    row = acc['row']
    domain = extract_domain(user_email_raw)
    
    if not domain:
        logger.error(f"❌ Không xác định được domain cho {user_email}")
        return {'success': False, 'email': user_email, 'error': 'Invalid domain'}
    
    # ⛔ BẢO VỆ: KHÔNG ĐƯỢC reset password acc admin
    admin_emails = [f.get('admin_email', '').lower() for f in farm_accounts]
    if user_email.lower() in admin_emails:
        logger.warning(f"⛔ BỎ QUA acc admin: {user_email} (không được reset password admin!)")
        return {'success': False, 'email': user_email, 'error': 'SKIPPED - Admin account'}
    
    # Tìm admin cho domain
    admin = find_admin_for_domain(domain, farm_accounts)
    if not admin:
        logger.warning(f"⚠️ Không tìm thấy admin cho domain {domain}")
        return {'success': False, 'email': user_email, 'error': f'No admin for {domain}'}
    
    logger.info(f"\n🚀 [Thread] Bắt đầu xử lý: {user_email} (Row {row})")
    
    recovery = None
    timed_out = threading.Event()
    
    def watchdog_kill():
        """Force-close browser sau 90 giây"""
        timed_out.set()
        logger.warning(f"⏱️ WATCHDOG: Force-close browser cho {user_email} (>90s)")
        if recovery:
            try:
                recovery.close()
            except:
                pass
    
    # Watchdog 90 giây - đủ cho login + navigate + reset
    watchdog = threading.Timer(90.0, watchdog_kill)
    watchdog.daemon = True
    watchdog.start()
    
    try:
        # Dọn sạch data cũ của worker này TRƯỚC khi mở browser mới
        import shutil
        worker_dir = BROWSER_DATA_DIR / f"firefox_worker_{worker_index}"
        if worker_dir.exists():
            try:
                shutil.rmtree(worker_dir)
            except:
                pass
        
        # Khởi tạo browser riêng cho acc này
        recovery = GoogleAdminRecovery(
            admin_email=admin['admin_email'],
            admin_password=admin['admin_password'],
            headless=headless
        )
        
        # Setup browser với vị trí grid
        if not recovery.setup_browser(worker_index=worker_index, total_workers=total_workers):
            return {'success': False, 'email': user_email, 'error': 'Browser setup failed'}
        
        # Login
        if timed_out.is_set():
            return {'success': False, 'email': user_email, 'error': 'Timeout'}
        if not recovery.login():
            return {'success': False, 'email': user_email, 'error': 'Login failed'}
        
        # Navigate to users
        if timed_out.is_set():
            return {'success': False, 'email': user_email, 'error': 'Timeout'}
        if not recovery.navigate_to_users():
            return {'success': False, 'email': user_email, 'error': 'Navigate failed'}
        
        # Reset password
        if timed_out.is_set():
            return {'success': False, 'email': user_email, 'error': 'Timeout'}
        new_password = recovery.search_and_reset_password(user_email)
        if not new_password:
            return {'success': False, 'email': user_email, 'error': 'Reset password failed'}
        
        # KHÔNG update Sheet ở đây (tránh rate limit)
        return {'success': True, 'email': user_email, 'password': new_password, 'row': row}
        
    except Exception as e:
        if timed_out.is_set():
            logger.warning(f"⏱️ {user_email}: Bị timeout, browser đã bị đóng")
            return {'success': False, 'email': user_email, 'error': 'Timeout (watchdog)'}
        logger.error(f"❌ [Thread] Lỗi xử lý {user_email}: {e}")
        return {'success': False, 'email': user_email, 'error': str(e)}
    
    finally:
        # Hủy watchdog timer
        watchdog.cancel()
        # Đóng browser (nếu chưa bị watchdog đóng)
        if recovery and not timed_out.is_set():
            recovery.close()
        
        # Đợi browser THỰC SỰ đóng xong trước khi xóa data
        time.sleep(3)
        
        # Xóa browser_data của worker này
        # KHÔNG dùng taskkill vì sẽ kill browser của worker khác!
        import shutil
        worker_dir = BROWSER_DATA_DIR / f"firefox_worker_{worker_index}"
        if worker_dir.exists():
            for attempt in range(3):
                try:
                    shutil.rmtree(worker_dir)
                    logger.info(f"🗑️ Đã xóa browser data worker {worker_index}")
                    break
                except Exception as e:
                    if attempt < 2:
                        time.sleep(2)  # Chờ thêm rồi thử lại
                    else:
                        logger.warning(f"⚠️ Chưa xóa được worker {worker_index}, sẽ xóa cuối cùng")


# ============ MAIN RECOVERY FUNCTION ============

def run_recovery(headless=True, max_workers=5):
    """
    Chạy quy trình thu hồi acc với multi-threading.
    
    Args:
        headless: Ẩn browser (True) hoặc hiện (False)
        max_workers: Số browser chạy song song (mặc định 5)
    """
    from concurrent.futures import ThreadPoolExecutor, as_completed
    
    logger.info("=" * 50)
    logger.info("🚀 BẮT ĐẦU QUY TRÌNH THU HỒI ACC (MULTI-THREAD)")
    logger.info(f"📊 Max {max_workers} browser song song")
    logger.info("=" * 50)
    
    # Load farm accounts
    farm_accounts = load_farm_accounts()
    if not farm_accounts:
        logger.error("❌ Không có farm accounts nào!")
        return {'total': 0, 'success': 0, 'failed': 0}
    
    # Kết nối Google Sheets
    worksheet = get_google_sheet()
    if not worksheet:
        logger.error("❌ Không thể kết nối Google Sheets!")
        return {'total': 0, 'success': 0, 'failed': 0}
    
    # Lấy danh sách acc cần thu hồi
    accounts_to_recover = get_accounts_to_recover(worksheet)
    if not accounts_to_recover:
        logger.info("✅ Không có acc nào cần thu hồi!")
        return {'total': 0, 'success': 0, 'failed': 0}
    
    total = len(accounts_to_recover)
    logger.info(f"📋 Có {total} acc cần thu hồi")
    
    # === CHẠY KIỂU POOL LIÊN TỤC ===
    # Xong 1 browser → mở ngay browser mới, KHÔNG đợi hết 5
    success_count = 0
    failed_count = 0
    results = []
    
    actual_workers = min(total, max_workers)
    logger.info(f"🔧 Pool {actual_workers} luồng cho {total} acc (liên tục, không đợi batch)")
    
    ws_live = None  # Worksheet connection dùng chung
    
    with ThreadPoolExecutor(max_workers=actual_workers) as executor:
        # Submit TẤT CẢ accounts cùng lúc - pool tự quản lý max_workers
        future_to_acc = {}
        for idx, acc in enumerate(accounts_to_recover):
            # worker_index xoay vòng 0-4 để xếp grid
            future = executor.submit(
                recover_single_acc, acc, farm_accounts, headless,
                worker_index=idx % actual_workers, total_workers=actual_workers
            )
            future_to_acc[future] = acc
        
        # Xử lý kết quả NGAY KHI TỪNG ACC XONG (không đợi batch)
        for future in as_completed(future_to_acc):
            acc = future_to_acc[future]
            try:
                result = future.result(timeout=120)
                results.append(result)
                
                if result.get('success'):
                    success_count += 1
                    logger.info(f"✅ Thành công: {result['email']}")
                    
                    # === GHI NGAY VÀO SHEET ===
                    try:
                        if not ws_live:
                            ws_live = get_google_sheet()
                        if ws_live:
                            row_num = result['row']
                            new_pass = result.get('password', 'RESET_SUCCESS')
                            
                            ws_live.update_cell(row_num, COL_NGAY_DOI_PASS + 1, new_pass)
                            time.sleep(0.5)
                            ws_live.update_cell(row_num, COL_TINH_TRANG + 1, "ĐÃ THU HỒI")
                            time.sleep(0.5)
                            
                            logger.info(f"  📝 Row {row_num}: GHI SHEET OK | Pass: {new_pass[:3]}***")
                    except Exception as sheet_err:
                        logger.error(f"  ❌ Lỗi ghi sheet row {result.get('row')}: {sheet_err}")
                        ws_live = None
                else:
                    failed_count += 1
                    logger.error(f"❌ Thất bại: {result['email']} - {result.get('error', 'Unknown')}")
                    
            except Exception as e:
                failed_count += 1
                email = acc.get('acc_thu_hoi', 'unknown')
                logger.error(f"❌ Exception: {email}: {e}")
                results.append({'success': False, 'email': email, 'error': str(e)})
            
            # Log tiến độ
            done = success_count + failed_count
            logger.info(f"📊 Tiến độ: {done}/{total} ({success_count} OK, {failed_count} fail)")
    
    logger.info("\n" + "=" * 50)
    logger.info("✅ HOÀN TẤT QUY TRÌNH THU HỒI ACC")
    logger.info(f"📊 Kết quả: {success_count}/{total} thành công, {failed_count} thất bại")
    logger.info("=" * 50)
    
    # ============ AUTO CLEANUP ============
    cleanup_browser_data()
    cleanup_logs()
    
    return {'total': total, 'success': success_count, 'failed': failed_count, 'results': results}


def cleanup_browser_data():
    """Xóa browser_data sau mỗi lần chạy để giải phóng dung lượng"""
    import shutil
    try:
        if BROWSER_DATA_DIR.exists():
            size_mb = sum(f.stat().st_size for f in BROWSER_DATA_DIR.rglob('*') if f.is_file()) / (1024 * 1024)
            shutil.rmtree(BROWSER_DATA_DIR, ignore_errors=True)
            logger.info(f"🗑️ Đã xóa browser_data ({size_mb:.0f} MB)")
    except Exception as e:
        logger.warning(f"⚠️ Không thể xóa browser_data: {e}")


def cleanup_logs():
    """Truncate log files nếu quá 5MB"""
    try:
        max_log_size = 5 * 1024 * 1024  # 5MB
        
        # Recovery log
        if LOG_FILE.exists() and LOG_FILE.stat().st_size > max_log_size:
            # Giữ lại 1000 dòng cuối
            lines = LOG_FILE.read_text(encoding='utf-8', errors='ignore').splitlines()
            keep_lines = lines[-1000:]
            LOG_FILE.write_text('\n'.join(keep_lines) + '\n', encoding='utf-8')
            logger.info(f"📋 Đã truncate recovery.log (giữ 1000 dòng cuối)")
        
        # Sheet dump
        dump_file = CURRENT_DIR / "sheet_dump.txt"
        if dump_file.exists() and dump_file.stat().st_size > max_log_size:
            dump_file.unlink()
            logger.info("🗑️ Đã xóa sheet_dump.txt")
        
        # Recovery log dump
        dump_file2 = CURRENT_DIR / "recovery_log_dump.txt"
        if dump_file2.exists() and dump_file2.stat().st_size > max_log_size:
            dump_file2.unlink()
            logger.info("🗑️ Đã xóa recovery_log_dump.txt")
            
    except Exception as e:
        logger.warning(f"⚠️ Lỗi cleanup logs: {e}")

# ============ ENTRY POINT ============

if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Farm Account Recovery Tool")
    parser.add_argument("--visible", action="store_true", help="Hiện cửa sổ browser (debug)")
    args = parser.parse_args()
    
    headless = not args.visible
    
    print("=" * 50)
    print("[RECOVERY] FARM ACCOUNT RECOVERY TOOL (Playwright)")
    print("=" * 50)
    print(f"Mode: {'Headless (background)' if headless else 'Visible (debug)'}")
    print()
    
    run_recovery(headless=headless)
