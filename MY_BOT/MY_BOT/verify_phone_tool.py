#!/usr/bin/env python3
"""
Google Phone Verification Tool v2
Tự động verify phone cho Google account sử dụng SMSPool API
Hỗ trợ đa luồng - verify nhiều account cùng lúc (tối đa 10)

Author: Auto-generated
"""

import asyncio
import gc
import json
import logging
import os
import sys
import time
import threading
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any, List
from concurrent.futures import ThreadPoolExecutor

import requests
from playwright.async_api import async_playwright, Page, Browser

# ==============================================================================
# CONFIGURATION
# ==============================================================================

VIETNAM_TZ = timezone(timedelta(hours=7))
CONFIG_FILE = "config/smspool_config.json"
QUEUE_FILE = "pending_orders/verify_queue.json"
RESULTS_FILE = "pending_orders/verify_results.json"
STATUS_FILE = "pending_orders/verify_status.json"

MAX_CONCURRENT_WORKERS = 5  # Tối đa 5 account cùng lúc

# Lock for file operations
file_lock = threading.Lock()

# STOP SIGNAL FILE - giao tiếp với main.py để dừng tool
VERIFY_STOP_SIGNAL_FILE = "pending_orders/verify_stop_signal.json"

def check_stop_signal() -> bool:
    """Kiểm tra xem có yêu cầu dừng tool không (từ /stop verify_phone)"""
    try:
        if os.path.exists(VERIFY_STOP_SIGNAL_FILE):
            with open(VERIFY_STOP_SIGNAL_FILE, 'r', encoding='utf-8') as f:
                signal = json.load(f)
                return signal.get("stopped", False)
        return False
    except:
        return False

# PROXY FILE SUPPORT
PROXY_FILE = "proxy.txt"
proxy_list = []
proxy_index = 0
proxy_lock = threading.Lock()

def load_proxies_from_file():
    """Đọc proxy từ file proxy.txt - hỗ trợ nhiều định dạng"""
    global proxy_list
    try:
        if not os.path.exists(PROXY_FILE):
            logger.info("📂 Không tìm thấy proxy.txt - chạy không proxy")
            return []
        
        with open(PROXY_FILE, 'r', encoding='utf-8') as f:
            lines = f.readlines()
        
        proxies = []
        for idx, line in enumerate(lines):
            line = line.strip()
            if not line or line.startswith('#'):
                continue
            
            # Parse các định dạng proxy khác nhau
            proxy_config = parse_proxy_line(line)
            if proxy_config:
                proxies.append(proxy_config)
                # Log chi tiết proxy đã parse
                server = proxy_config.get('server', 'unknown')
                has_auth = 'username' in proxy_config
                logger.info(f"   [{idx+1}] {server} {'(có auth)' if has_auth else '(no auth)'}")
        
        proxy_list = proxies
        logger.info(f"✅ Đã load {len(proxies)} proxy từ {PROXY_FILE}")
        return proxies
    except Exception as e:
        logger.error(f"❌ Lỗi đọc proxy file: {e}")
        return []

def parse_proxy_line(line: str) -> Optional[Dict]:
    """Parse một dòng proxy - hỗ trợ nhiều định dạng
    
    Formats supported:
    1. host:port                           -> http://host:port
    2. host:port:user:pass                 -> với auth
    3. user:pass:host:port                 -> với auth (user chứa ký tự đặc biệt)
    4. protocol://user:pass@host:port      -> full URL format
    
    Auto-detect SOCKS5:
    - Nếu host chứa "socks", "s5", "sock5" -> dùng socks5://
    - Nếu port là 1080, 1081, 6200-6300   -> dùng socks5://
    """
    try:
        line = line.strip()
        if not line or line.startswith('#'):
            return None
        
        # Nếu đã có protocol prefix
        if '://' in line:
            # Format: protocol://user:pass@host:port hoặc protocol://host:port
            if '@' in line:
                # Có auth - VD: http://user:pass@host:port
                protocol_and_auth, host_port = line.rsplit('@', 1)
                protocol, auth = protocol_and_auth.split('://')
                if ':' in auth:
                    user, password = auth.split(':', 1)
                else:
                    user, password = auth, ""
                
                result = {
                    "server": f"{protocol}://{host_port}",
                    "username": user,
                    "password": password
                }
                logger.info(f"✅ Parsed proxy with auth: server={result['server']}, user={user[:15]}...")
                return result
            else:
                return {"server": line}
        
        parts = line.split(':')
        host = None
        port = None
        user = None
        password = None
        
        if len(parts) == 2:
            # Format: host:port
            host, port = parts[0], parts[1]
            
        elif len(parts) == 4:
            # Có thể là host:port:user:pass hoặc user:pass:host:port
            # Kiểm tra xem phần nào là host (có dấu . hoặc kết thúc bằng .com/.net)
            
            # Thử check parts[0] là host không (có dấu .)
            if '.' in parts[0] and parts[1].isdigit():
                # host:port:user:pass
                host, port, user, password = parts[0], parts[1], parts[2], parts[3]
            elif '.' in parts[2] and parts[3].isdigit():
                # user:pass:host:port
                user, password, host, port = parts[0], parts[1], parts[2], parts[3]
            else:
                # Fallback - giả sử host:port:user:pass
                host, port, user, password = parts[0], parts[1], parts[2], parts[3]
                
        elif len(parts) > 4:
            # Format phức tạp - tìm host và port
            # Thường host ở cuối hoặc có dạng xxx.xxx.com
            for i, part in enumerate(parts):
                if ('.' in part) and (part.endswith('.com') or part.endswith('.net') or 
                    part.endswith('.io') or part.replace('.', '').isdigit()):
                    # Tìm thấy host
                    host = part
                    # Port thường ngay sau host
                    if i + 1 < len(parts) and parts[i + 1].isdigit():
                        port = parts[i + 1]
                        # User là tất cả trước host
                        user = ':'.join(parts[:i]) if i > 0 else None
                        # Password là tất cả sau port
                        password = ':'.join(parts[i + 2:]) if i + 2 < len(parts) else None
                    break
            
            # Nếu không tìm được, thử format đơn giản nhất
            if not host:
                # Giả sử 2 phần đầu là host:port, còn lại là user:pass
                host = parts[0]
                port = parts[1] if len(parts) > 1 else "80"
                user = parts[2] if len(parts) > 2 else None
                password = ':'.join(parts[3:]) if len(parts) > 3 else None
        
        if not host or not port:
            logger.warning(f"⚠️ Không parse được proxy: {line[:50]}...")
            return None
        
        # Auto-detect SOCKS5 vs HTTP
        # LƯU Ý: Playwright KHÔNG hỗ trợ SOCKS5 với authentication
        # Nên ta sẽ dùng HTTP cho tất cả proxy có auth
        protocol = "http"
        host_lower = host.lower()
        port_int = int(port) if port.isdigit() else 0
        
        # SOCKS5 detection - CHỈ dùng SOCKS5 nếu KHÔNG có auth
        is_socks5_host = any(s in host_lower for s in ['socks', 's5', 'sock5', 'proxys5'])
        is_socks5_port = port_int in [1080, 1081] or (6200 <= port_int <= 6300)
        
        if (is_socks5_host or is_socks5_port) and not user:
            # SOCKS5 không có auth - OK
            protocol = "socks5"
        elif is_socks5_host or is_socks5_port:
            # SOCKS5 có auth - Playwright không hỗ trợ, dùng HTTP thay thế
            # Nhiều proxy provider (như proxys5.net) hỗ trợ cả HTTP và SOCKS5 trên cùng port
            protocol = "http"
            logger.warning(f"⚠️ SOCKS5+auth không được hỗ trợ, thử dùng HTTP cho {host}:{port}")
        
        # Build config
        config = {"server": f"{protocol}://{host}:{port}"}
        if user:
            config["username"] = user
        if password:
            config["password"] = password
            
        logger.debug(f"✅ Parsed proxy: {protocol}://{host}:{port} (user={user is not None})")
        return config
        
    except Exception as e:
        logger.error(f"❌ Lỗi parse proxy '{line[:30]}...': {e}")
        return None

def get_next_proxy() -> Optional[Dict]:
    """Lấy proxy NGẪU NHIÊN từ danh sách"""
    if not proxy_list:
        return None
    
    import random
    with proxy_lock:
        proxy = random.choice(proxy_list)
        return proxy

# Admin IDs for notifications
ADMIN_IDS = [8560622519]  # Admin ID chính

# Logging setup with RotatingFileHandler - PHẢI ở trước các hàm dùng logger
from logging.handlers import RotatingFileHandler

log_formatter = logging.Formatter('%(asctime)s - %(levelname)s - [%(threadName)s] %(message)s')

# File handler với auto-rotation: max 5MB, giữ 3 file cũ
verify_file_handler = RotatingFileHandler(
    "verify_tool.log",
    maxBytes=5*1024*1024,  # 5MB per file
    backupCount=1,  # Chỉ giữ 1 file backup, xóa cũ hơn
    encoding='utf-8'
)
verify_file_handler.setFormatter(log_formatter)
verify_file_handler.setLevel(logging.INFO)

# Console handler
verify_console_handler = logging.StreamHandler(sys.stdout)
verify_console_handler.setFormatter(log_formatter)
verify_console_handler.setLevel(logging.INFO)

# Setup root logger
logging.basicConfig(level=logging.INFO, handlers=[verify_console_handler, verify_file_handler])
logger = logging.getLogger(__name__)

# ==============================================================================
# ==============================================================================
# AZCAPTCHA CLIENT - GIẢI CAPTCHA TỰ ĐỘNG
# ==============================================================================

AZCAPTCHA_API_KEY = "ctdhml9hmrkcwxpnqyby6xbd3vf74zjg"
AZCAPTCHA_IN_URL = "http://azcaptcha.com/in.php"
AZCAPTCHA_RES_URL = "http://azcaptcha.com/res.php"

class AZCaptchaSolver:
    """Client để giải captcha bằng AZcaptcha API"""
    
    def __init__(self, api_key: str = AZCAPTCHA_API_KEY):
        self.api_key = api_key
        
    def solve_image_captcha(self, image_base64: str, timeout: int = 120) -> Optional[str]:
        """
        Giải captcha từ hình ảnh base64
        Returns: text result hoặc None nếu thất bại
        """
        try:
            # Bước 1: Gửi hình captcha
            logger.info("🔐 [AZCaptcha] Đang gửi captcha để giải...")
            
            response = requests.post(AZCAPTCHA_IN_URL, data={
                "method": "base64",
                "key": self.api_key,
                "body": image_base64,
                "json": 1
            }, timeout=30)
            
            data = response.json()
            
            if data.get("status") != 1:
                logger.error(f"❌ [AZCaptcha] Lỗi gửi: {data}")
                return None
            
            captcha_id = data.get("request")
            logger.info(f"✅ [AZCaptcha] ID: {captcha_id} - Đang chờ kết quả...")
            
            # Bước 2: Poll kết quả
            start_time = time.time()
            while time.time() - start_time < timeout:
                time.sleep(5)  # Đợi 5s giữa mỗi request
                
                res = requests.get(AZCAPTCHA_RES_URL, params={
                    "key": self.api_key,
                    "action": "get",
                    "id": captcha_id,
                    "json": 1
                }, timeout=10)
                
                result = res.json()
                
                if result.get("status") == 1:
                    answer = result.get("request")
                    logger.info(f"✅ [AZCaptcha] Đã giải: {answer}")
                    return answer
                elif result.get("request") == "CAPCHA_NOT_READY":
                    continue
                else:
                    logger.warning(f"⚠️ [AZCaptcha] Lỗi: {result}")
                    return None
            
            logger.error("❌ [AZCaptcha] Timeout - không giải được")
            return None
            
        except Exception as e:
            logger.error(f"❌ [AZCaptcha] Exception: {e}")
            return None
    
    def solve_recaptcha_v2(self, site_key: str, page_url: str, timeout: int = 180) -> Optional[str]:
        """
        Giải reCAPTCHA v2 (checkbox hoặc image selection)
        Args:
            site_key: Google reCAPTCHA site key (lấy từ data-sitekey)
            page_url: URL của trang đang có captcha
            timeout: Thời gian chờ tối đa (giây)
        Returns: g-recaptcha-response token hoặc None nếu thất bại
        """
        try:
            logger.info(f"🔐 [AZCaptcha] Đang gửi reCAPTCHA v2 để giải...")
            logger.info(f"   Site key: {site_key[:20]}...")
            logger.info(f"   URL: {page_url}")
            
            # Bước 1: Gửi yêu cầu giải reCAPTCHA
            response = requests.post(AZCAPTCHA_IN_URL, data={
                "key": self.api_key,
                "method": "userrecaptcha",
                "googlekey": site_key,
                "pageurl": page_url,
                "json": 1
            }, timeout=30)
            
            data = response.json()
            
            if data.get("status") != 1:
                logger.error(f"❌ [AZCaptcha] Lỗi gửi reCAPTCHA: {data}")
                return None
            
            captcha_id = data.get("request")
            logger.info(f"✅ [AZCaptcha] reCAPTCHA ID: {captcha_id} - Đang chờ kết quả (có thể mất 30-120s)...")
            
            # Bước 2: Poll kết quả
            start_time = time.time()
            while time.time() - start_time < timeout:
                time.sleep(10)  # reCAPTCHA cần nhiều thời gian hơn - đợi 10s
                
                res = requests.get(AZCAPTCHA_RES_URL, params={
                    "key": self.api_key,
                    "action": "get",
                    "id": captcha_id,
                    "json": 1
                }, timeout=10)
                
                result = res.json()
                
                if result.get("status") == 1:
                    token = result.get("request")
                    logger.info(f"✅ [AZCaptcha] Đã giải reCAPTCHA! Token: {token[:50]}...")
                    return token
                elif result.get("request") == "CAPCHA_NOT_READY":
                    elapsed = int(time.time() - start_time)
                    logger.info(f"⏳ [AZCaptcha] reCAPTCHA đang xử lý... ({elapsed}s)")
                    continue
                else:
                    logger.warning(f"⚠️ [AZCaptcha] Lỗi: {result}")
                    return None
            
            logger.error("❌ [AZCaptcha] Timeout - không giải được reCAPTCHA")
            return None
            
        except Exception as e:
            logger.error(f"❌ [AZCaptcha] reCAPTCHA Exception: {e}")
            return None

# Global AZCaptcha solver
azcaptcha_solver: Optional[AZCaptchaSolver] = None

def init_azcaptcha():
    """Khởi tạo AZCaptcha solver"""
    global azcaptcha_solver
    azcaptcha_solver = AZCaptchaSolver()
    logger.info("✅ AZCaptcha solver initialized")





# BOT CONFIG - Dùng để gửi thông báo trực tiếp
BOT_TOKEN = "8532063081:AAFFIjXLsYOqjHdZh7S2RahT_mMfQWi5MqQ"

def send_telegram_notification(user_id: int, message: str) -> bool:
    """Gửi thông báo Telegram trực tiếp đến user"""
    print(f"📨 [NOTIFY] Đang gửi thông báo cho user_id: {user_id}")
    
    if not user_id:
        print("❌ [NOTIFY] Không có user_id!")
        logger.warning("Không có user_id để gửi thông báo")
        return False
    
    try:
        url = f"https://api.telegram.org/bot{BOT_TOKEN}/sendMessage"
        data = {
            "chat_id": user_id,
            "text": message,
            "parse_mode": "HTML"
        }
        print(f"📨 [NOTIFY] Gọi API: {url}")
        response = requests.post(url, data=data, timeout=10)
        
        print(f"📨 [NOTIFY] Response status: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            if result.get("ok"):
                print(f"✅ [NOTIFY] GỬI THÀNH CÔNG cho user {user_id}")
                logger.info(f"✅ Đã gửi thông báo cho user {user_id}")
                return True
            else:
                print(f"❌ [NOTIFY] Telegram API error: {result}")
                logger.warning(f"❌ Telegram API error: {result}")
                return False
        else:
            error_text = response.text[:500]
            print(f"❌ [NOTIFY] HTTP error {response.status_code}: {error_text}")
            logger.warning(f"❌ HTTP error {response.status_code}: {error_text}")
            return False
    except Exception as e:
        print(f"❌ [NOTIFY] Exception: {e}")
        logger.error(f"❌ Lỗi gửi thông báo Telegram: {e}")
        return False



# ==============================================================================
# SMSPOOL API CLIENT
# ==============================================================================

class SMSPoolClient:
    """Client cho SMSPool API - Thread-safe"""
    
    BASE_URL = "https://api.smspool.net"
    
    def __init__(self, api_key: str):
        self.api_key = api_key
        self._lock = threading.Lock()
        
    def get_balance(self) -> float:
        """Lấy số dư tài khoản - với retry và error handling tốt hơn"""
        max_retries = 3
        for attempt in range(max_retries):
            try:
                response = requests.post(
                    f"{self.BASE_URL}/request/balance",
                    data={"key": self.api_key},
                    timeout=15
                )
                
                # Log response để debug
                logger.debug(f"Balance API response status: {response.status_code}")
                logger.debug(f"Balance API response text: {response.text[:200] if response.text else 'empty'}")
                
                # Kiểm tra HTTP status
                if response.status_code != 200:
                    logger.error(f"Balance API HTTP error: {response.status_code}")
                    if attempt < max_retries - 1:
                        time.sleep(2)
                        continue
                    return 0
                
                # Parse JSON
                try:
                    data = response.json()
                except Exception as json_err:
                    logger.error(f"Balance API JSON parse error: {json_err}, raw: {response.text[:100]}")
                    if attempt < max_retries - 1:
                        time.sleep(2)
                        continue
                    return 0
                
                # Kiểm tra lỗi từ API
                if "error" in str(data).lower():
                    logger.error(f"Balance API returned error: {data}")
                    return 0
                
                # Lấy balance
                balance = float(data.get("balance", 0))
                logger.info(f"✅ SMSPool balance: ${balance}")
                return balance
                
            except requests.exceptions.Timeout:
                logger.error(f"Balance API timeout (attempt {attempt + 1}/{max_retries})")
                if attempt < max_retries - 1:
                    time.sleep(2)
                    continue
            except requests.exceptions.ConnectionError as conn_err:
                logger.error(f"Balance API connection error: {conn_err}")
                if attempt < max_retries - 1:
                    time.sleep(2)
                    continue
            except Exception as e:
                logger.error(f"Lỗi lấy balance (attempt {attempt + 1}): {e}")
                if attempt < max_retries - 1:
                    time.sleep(2)
                    continue
        
        logger.error("❌ Không thể lấy balance sau nhiều lần thử")
        return 0

    
    # Dial code mapping cho SMSPool
    DIAL_CODES = {
        "VN": "+84", "ID": "+62", "NL": "+31", "EE": "+372", "PH": "+63",
        "MY": "+60", "TH": "+66", "IN": "+91", "PK": "+92", "BD": "+880",
        "RU": "+7", "UA": "+380", "US": "+1", "UK": "+44", "GB": "+44",
        "CA": "+1", "AU": "+61", "DE": "+49", "FR": "+33", "IT": "+39",
        "ES": "+34", "BR": "+55", "MX": "+52", "AR": "+54", "CL": "+56",
        "CO": "+57", "PE": "+51", "VE": "+58", "KR": "+82", "JP": "+81",
        "PL": "+48", "HR": "+385",
    }
    
    def order_sms(self, country: str, service: str = "395") -> Optional[Dict]:
        """Đặt số điện thoại để nhận SMS - có thêm dial code prefix"""
        try:
            with self._lock:
                response = requests.post(
                    f"{self.BASE_URL}/purchase/sms",
                    data={
                        "key": self.api_key,
                        "country": country,
                        "service": service,
                        "pricing_option": "1"
                    },
                    timeout=15
                )
                data = response.json()
            
            logger.debug(f"SMSPool order response [{country}]: {data}")
            
            if data.get("success") == 1 or "order_id" in data:
                phone = data.get("phonenumber", data.get("number", ""))
                dial_code = self.DIAL_CODES.get(country.upper(), "")
                
                # Format phone với dial code
                if phone and dial_code:
                    # Chỉ giữ số và dấu +
                    phone = ''.join(c for c in str(phone) if c.isdigit() or c == '+')
                    if not phone.startswith("+"):
                        phone = dial_code + phone
                
                logger.info(f"✅ SMSPool order thành công: {phone} [{country}]")
                
                return {
                    "order_id": data.get("order_id"),
                    "phone_number": phone,
                    "country": country
                }
            else:
                logger.warning(f"SMSPool order failed [{country}]: {data}")
                return None
                
        except Exception as e:
            logger.error(f"Lỗi order SMS SMSPool: {e}")
            return None
    
    def check_sms(self, order_id: str) -> Optional[str]:
        """Kiểm tra OTP code"""
        try:
            response = requests.post(
                f"{self.BASE_URL}/sms/check",
                data={
                    "key": self.api_key,
                    "orderid": order_id
                },
                timeout=10
            )
            data = response.json()
            
            status = data.get("status")
            if status == 3:  # SMS received
                sms_text = data.get("sms", "")
                import re
                match = re.search(r'\b(\d{6})\b', sms_text)
                if match:
                    return match.group(1)
                match = re.search(r'G-(\d+)', sms_text)
                if match:
                    return match.group(1)
                return sms_text
            elif status == 1:  # Pending
                return None
            elif status == 6:  # Refunded/Cancelled
                return "CANCELLED"
            else:
                return None
                
        except Exception as e:
            logger.error(f"Lỗi check SMS: {e}")
            return None
    
    def cancel_order(self, order_id: str) -> bool:
        """Hủy đơn hàng"""
        try:
            response = requests.post(
                f"{self.BASE_URL}/sms/cancel",
                data={
                    "key": self.api_key,
                    "orderid": order_id
                },
                timeout=10
            )
            data = response.json()
            return data.get("success") == 1
        except Exception as e:
            logger.error(f"Lỗi cancel order: {e}")
            return False


# ==============================================================================
# CODESIM API CLIENT
# ==============================================================================

class CodesimClient:
    """Client cho Codesim API - Thread-safe, tương thích với SMSPoolClient interface"""
    
    BASE_URL = "https://apisim.codesim.net"
    
    def __init__(self, api_key: str, service_id: str = "", network_id: str = ""):
        self.api_key = api_key
        self.service_id = service_id  # ID dịch vụ (VD: Google)
        self.network_id = network_id  # ID nhà mạng
        self._lock = threading.Lock()
        self._current_sim_id = None  # Lưu sim_id để cancel
        self._current_otp_id = None  # Lưu otp_id để check OTP
        
    def get_balance(self) -> float:
        """Lấy số dư tài khoản"""
        try:
            response = requests.get(
                f"{self.BASE_URL}/yourself/information-by-api-key",
                params={"api_key": self.api_key},
                timeout=15
            )
            data = response.json()
            
            # Codesim API trả về status == 200 (integer) khi thành công
            if data.get("status") == 200:
                balance = float(data.get("data", {}).get("balance", 0))
                logger.info(f"✅ Codesim balance: {balance:,.0f} VND")
                return balance
            else:
                logger.warning(f"Codesim get balance failed: {data}")
                return 0
        except Exception as e:
            logger.error(f"Lỗi lấy balance Codesim: {e}")
            return 0
    
    def get_services(self) -> List[Dict]:
        """Lấy danh sách dịch vụ hỗ trợ"""
        try:
            response = requests.get(
                f"{self.BASE_URL}/service/get_service_by_api_key",
                params={"api_key": self.api_key},
                timeout=15
            )
            data = response.json()
            
            if data.get("status") == 200:
                return data.get("data", [])
            return []
        except Exception as e:
            logger.error(f"Lỗi lấy services Codesim: {e}")
            return []
    
    def get_networks(self) -> List[Dict]:
        """Lấy danh sách nhà mạng hỗ trợ"""
        try:
            response = requests.get(
                f"{self.BASE_URL}/network/get-network-by-api-key",
                params={"api_key": self.api_key},
                timeout=15
            )
            data = response.json()
            
            if data.get("status") == 200:
                return data.get("data", [])
            return []
        except Exception as e:
            logger.error(f"Lỗi lấy networks Codesim: {e}")
            return []
    
    def _find_google_service_id(self) -> str:
        """Tìm service_id cho Google/Gmail"""
        services = self.get_services()
        for service in services:
            name = service.get("name", "").lower()
            if "google" in name or "gmail" in name:
                return str(service.get("id", ""))
        # Fallback - trả về service_id đã config hoặc rỗng
        return self.service_id
    
    def _find_first_network_id(self) -> str:
        """Lấy network_id đầu tiên"""
        networks = self.get_networks()
        if networks:
            return str(networks[0].get("id", ""))
        return self.network_id
    
    def order_sms(self, country: str = "", service: str = "") -> Optional[Dict]:
        """Đặt số điện thoại để nhận SMS - tương thích interface SMSPoolClient"""
        try:
            # Auto-detect service_id nếu chưa có
            svc_id = self.service_id or self._find_google_service_id()
            net_id = self.network_id or self._find_first_network_id()
            
            if not svc_id:
                logger.error("Codesim: Không tìm thấy service_id cho Google")
                return None
            
            with self._lock:
                response = requests.get(
                    f"{self.BASE_URL}/sim/get_sim",
                    params={
                        "api_key": self.api_key,
                        "service_id": svc_id,
                        "network_id": net_id
                    },
                    timeout=30
                )
                data = response.json()
            
            if data.get("status") == 200:
                sim_data = data.get("data", {})
                self._current_sim_id = sim_data.get("simId")
                
                phone = sim_data.get("phone", "")
                # Codesim dùng sim Việt Nam - đảm bảo luôn có prefix +84
                if phone:
                    # Bỏ các ký tự không phải số
                    phone = ''.join(c for c in phone if c.isdigit() or c == '+')
                    
                    if phone.startswith("0"):
                        # Số bắt đầu bằng 0 → thay bằng +84
                        phone = "+84" + phone[1:]
                    elif phone.startswith("84") and not phone.startswith("+"):
                        # Số có 84 nhưng thiếu +
                        phone = "+" + phone
                    elif not phone.startswith("+"):
                        # Số không có prefix → thêm +84
                        phone = "+84" + phone
                
                logger.info(f"📱 Codesim phone formatted: {phone}")
                
                logger.info(f"✅ Codesim order thành công: {phone}")
                # Lưu otp_id vào instance để check_sms có thể dùng
                self._current_otp_id = sim_data.get("otpId")  # Sửa typo: optId → otpId
                
                logger.info(f"📱 Codesim sim_id={self._current_sim_id}, otpId={self._current_otp_id}")
                
                return {
                    "order_id": str(self._current_sim_id),  # order_id = sim_id để cancel/track
                    "phone_number": phone,
                    "country": "VN",  # Codesim chủ yếu sim Việt Nam
                    "sim_id": self._current_sim_id,
                    "otp_id": self._current_otp_id  # otp_id từ API response
                }
            else:
                logger.warning(f"Codesim order failed: {data}")
                return None
                
        except Exception as e:
            logger.error(f"Lỗi order SMS Codesim: {e}")
            return None
    
    def check_sms(self, order_id: str) -> Optional[str]:
        """Kiểm tra OTP code - dùng otp_id từ instance hoặc order_id
        
        Codesim API 5: GET /otp/get_otp_by_phone_api_key?otp_id=xxx&api_key=xxx
        Lưu ý: Độ trễ tối thiểu 4 giây/lần call API
        """
        import re
        
        try:
            # Lấy otp_id đã lưu khi order_sms (ưu tiên), fallback về order_id
            otp_id = getattr(self, '_current_otp_id', None) or order_id
            
            if not otp_id:
                logger.warning("Codesim: Không có otp_id để check SMS")
                return None
            
            # API endpoint đúng theo docs: /otp/get_otp_by_phone_api_key
            response = requests.get(
                f"{self.BASE_URL}/otp/get_otp_by_phone_api_key",
                params={
                    "api_key": self.api_key,
                    "otp_id": otp_id
                },
                timeout=10
            )
            data = response.json()
            
            logger.debug(f"Codesim check_sms (otp_id={otp_id}): {data}")
            
            if data.get("status") == 200:
                otp_data = data.get("data", {})
                
                # Handle nếu data là list
                if isinstance(otp_data, list) and len(otp_data) > 0:
                    otp_data = otp_data[0]
                
                # Lấy content từ nhiều field khác nhau
                sms_content = (
                    otp_data.get("content", "") or 
                    otp_data.get("smsContent", "") or 
                    otp_data.get("code", "")
                )
                
                if sms_content:
                    # Extract OTP từ nội dung SMS
                    # Tìm G-xxxxx format của Google trước
                    match = re.search(r'G-(\d+)', sms_content)
                    if match:
                        otp = match.group(1)
                        logger.info(f"✅ Codesim OTP received (G-format): {otp}")
                        return otp
                    # Tìm mã 6 số
                    match = re.search(r'\b(\d{6})\b', sms_content)
                    if match:
                        otp = match.group(1)
                        logger.info(f"✅ Codesim OTP received: {otp}")
                        return otp
                    # Trả về toàn bộ nếu không parse được
                    logger.info(f"✅ Codesim SMS content (raw): {sms_content}")
                    return sms_content
                
                # Chưa có SMS - API trả về 200 nhưng chưa có content
                return None
            
            # Kiểm tra lỗi
            if data.get("status") == "error" or data.get("message"):
                msg = data.get("message", "")
                if "cancelled" in str(msg).lower() or "hủy" in str(msg).lower():
                    return "CANCELLED"
            
            return None
                
        except Exception as e:
            logger.error(f"Lỗi check SMS Codesim: {e}")
            return None
    
    def cancel_order(self, order_id: str) -> bool:
        """Hủy đơn hàng - order_id là sim_id"""
        try:
            response = requests.get(
                f"{self.BASE_URL}/sim/cancel_api_key/{order_id}",
                params={"api_key": self.api_key},
                timeout=10
            )
            data = response.json()
            
            success = data.get("status") == 200
            if success:
                logger.info(f"✅ Codesim cancel thành công: {order_id}")
            else:
                logger.warning(f"Codesim cancel failed: {data}")
            return success
        except Exception as e:
            logger.error(f"Lỗi cancel order Codesim: {e}")
            return False


# ==============================================================================
# VIOTP CLIENT
# ==============================================================================

class ViotpClient:
    """Client cho Viotp API - Thread-safe, tương thích với SMSPoolClient interface
    
    API Base: https://api.viotp.com
    Docs: https://viotp.com/api-guide
    """
    
    BASE_URL = "https://api.viotp.com"
    
    def __init__(self, api_key: str, service_id: str = "7", network_id: str = ""):
        """
        Args:
            api_key: Token từ Viotp
            service_id: ID dịch vụ (7 = Google/Gmail)
            network_id: ID nhà mạng (để trống = tất cả)
        """
        self.api_key = api_key
        self.service_id = service_id  # 7 = Google
        self.network_id = network_id
        self._lock = threading.Lock()
        self._current_request_id = None  # Lưu request_id để check OTP
        
    def get_balance(self) -> float:
        """Lấy số dư tài khoản"""
        try:
            response = requests.get(
                f"{self.BASE_URL}/users/balance",
                params={"token": self.api_key},
                timeout=15
            )
            data = response.json()
            
            # Viotp API trả về status_code == 200 khi thành công
            if data.get("status_code") == 200:
                balance = float(data.get("data", {}).get("balance", 0))
                logger.info(f"✅ Viotp balance: {balance:,.0f} VND")
                return balance
            else:
                logger.warning(f"Viotp get balance failed: {data}")
                return 0
        except Exception as e:
            logger.error(f"Lỗi lấy balance Viotp: {e}")
            return 0
    
    def get_services(self) -> List[Dict]:
        """Lấy danh sách dịch vụ hỗ trợ"""
        try:
            response = requests.get(
                f"{self.BASE_URL}/service/getv2",
                params={"token": self.api_key, "country": "vn"},
                timeout=15
            )
            data = response.json()
            
            if data.get("status_code") == 200:
                return data.get("data", [])
            return []
        except Exception as e:
            logger.error(f"Lỗi lấy services Viotp: {e}")
            return []
    
    def get_networks(self) -> List[Dict]:
        """Lấy danh sách nhà mạng hỗ trợ"""
        try:
            response = requests.get(
                f"{self.BASE_URL}/networks/get",
                params={"token": self.api_key},
                timeout=15
            )
            data = response.json()
            
            if data.get("status_code") == 200:
                return data.get("data", [])
            return []
        except Exception as e:
            logger.error(f"Lỗi lấy networks Viotp: {e}")
            return []
    
    def _find_google_service_id(self) -> str:
        """Tìm service_id cho Google/Gmail"""
        services = self.get_services()
        for service in services:
            name = str(service.get("name", "")).lower()
            if "google" in name or "gmail" in name:
                return str(service.get("id", ""))
        # Fallback - dùng service_id đã config (mặc định 7 cho Google)
        return self.service_id or "7"
    
    def order_sms(self, country: str = "", service: str = "") -> Optional[Dict]:
        """Đặt số điện thoại để nhận SMS - tương thích interface SMSPoolClient
        
        Viotp Endpoint: GET /request/getv2?token=xxx&serviceid=7
        """
        try:
            # Auto-detect service_id nếu chưa có
            svc_id = self.service_id or self._find_google_service_id()
            
            params = {
                "token": self.api_key,
                "serviceid": svc_id,
            }
            
            # Thêm network nếu có
            if self.network_id:
                params["network"] = self.network_id
            
            with self._lock:
                response = requests.get(
                    f"{self.BASE_URL}/request/getv2",
                    params=params,
                    timeout=30
                )
                data = response.json()
            
            if data.get("status_code") == 200:
                result_data = data.get("data", {})
                self._current_request_id = result_data.get("request_id")
                
                # Viotp trả về re_phone_number đã có format +84xxx
                phone = result_data.get("re_phone_number", "") or result_data.get("phone_number", "")
                
                # Đảm bảo luôn có prefix +84 cho số VN
                if phone:
                    phone = ''.join(c for c in phone if c.isdigit() or c == '+')
                    
                    if phone.startswith("0"):
                        phone = "+84" + phone[1:]
                    elif phone.startswith("84") and not phone.startswith("+"):
                        phone = "+" + phone
                    elif not phone.startswith("+"):
                        phone = "+84" + phone
                
                logger.info(f"✅ Viotp order thành công: {phone}")
                logger.info(f"📱 Viotp phone formatted: {phone}")
                
                return {
                    "order_id": str(self._current_request_id),
                    "phone_number": phone,
                    "country": "VN",
                    "request_id": self._current_request_id,
                    "balance": result_data.get("balance", 0)
                }
            else:
                msg = data.get("message", "Unknown error")
                status = data.get("status_code", -1)
                logger.warning(f"Viotp order failed [{status}]: {msg}")
                return None
                
        except Exception as e:
            logger.error(f"Lỗi order SMS Viotp: {e}")
            return None
    
    def check_sms(self, order_id: str) -> Optional[str]:
        """Kiểm tra OTP code - order_id là request_id từ Viotp
        
        Viotp Endpoint: GET /session/getv2?requestid=xxx&token=xxx
        Response Status: 1 = Complete, 0 = Waiting, 2 = Expired
        """
        try:
            response = requests.get(
                f"{self.BASE_URL}/session/getv2",
                params={
                    "token": self.api_key,
                    "requestid": order_id
                },
                timeout=10
            )
            data = response.json()
            
            if data.get("status_code") == 200:
                result_data = data.get("data", {})
                status = result_data.get("Status", 0)
                
                if status == 1:  # Complete - đã nhận OTP
                    # Ưu tiên lấy Code, nếu không có thì parse từ SmsContent
                    otp = result_data.get("Code", "")
                    
                    if not otp:
                        sms_content = result_data.get("SmsContent", "")
                        if sms_content:
                            import re
                            # Tìm mã 6 số
                            match = re.search(r'\b(\d{6})\b', sms_content)
                            if match:
                                otp = match.group(1)
                            # Tìm G-xxxxx format của Google
                            match = re.search(r'G-(\d+)', sms_content)
                            if match:
                                otp = match.group(1)
                    
                    if otp:
                        logger.info(f"✅ Viotp OTP received: {otp}")
                        return otp
                    return None
                    
                elif status == 2:  # Expired
                    logger.warning("⏰ Viotp: Request đã hết hạn")
                    return "EXPIRED"
                    
                else:  # status == 0: Waiting
                    return None
            
            elif data.get("status_code") == -2:
                # Mã phiên không đúng
                return "CANCELLED"
            
            return None
                
        except Exception as e:
            logger.error(f"Lỗi check SMS Viotp: {e}")
            return None
    
    def cancel_order(self, order_id: str) -> bool:
        """Hủy đơn hàng - Viotp không có API cancel riêng
        
        Note: Viotp tự động hết hạn sau thời gian timeout
        """
        logger.info(f"ℹ️ Viotp: Không hỗ trợ cancel, đơn sẽ tự hết hạn - request_id: {order_id}")
        return True  # Giả lập thành công


# ==============================================================================
# 365OTP CLIENT
# ==============================================================================

class Otp365Client:
    """Client cho 365otp.com API - Thread-safe, tương thích với SMSPoolClient interface
    
    API Base: https://365otp.com/api/1
    Docs: https://365otp.com/documentapi
    
    Country IDs:
    - Vietnam (VN) = 10 → +84
    - Indonesia (ID) = 5 → +62
    
    Service IDs (Google/Gmail): Cần tra từ API availableservices
    """
    
    BASE_URL = "https://365otp.com/api/1"
    
    # Mapping country code to country_id và dial code
    COUNTRY_MAP = {
        "VN": {"country_id": 10, "dial_code": "+84", "price": 2800},
        "ID": {"country_id": 5, "dial_code": "+62", "price": 2300},
    }
    
    def __init__(self, api_key: str, service_id: str = "", network_id: str = "", default_country: str = "VN"):
        """
        Args:
            api_key: API key từ 365otp
            service_id: ID dịch vụ (VD: Google = cần tra từ API)
            network_id: ID nhà mạng (để trống = tất cả)
            default_country: VN hoặc ID
        """
        self.api_key = api_key
        self.service_id = service_id
        self.network_id = network_id
        self.default_country = default_country
        self._lock = threading.Lock()
        self._current_order_id = None
        self._google_service_id = None  # Cache service ID cho Google
        
    def get_balance(self) -> float:
        """Lấy số dư tài khoản"""
        try:
            response = requests.get(
                f"{self.BASE_URL}/getbalance",
                params={"apikey": self.api_key},
                timeout=15
            )
            data = response.json()
            
            # 365otp API: status == 1 là thành công
            if data.get("status") == 1:
                balance = float(data.get("balance", 0))
                logger.info(f"✅ 365OTP balance: ${balance:.2f}")
                return balance
            else:
                logger.warning(f"365OTP get balance failed: {data}")
                return 0
        except Exception as e:
            logger.error(f"Lỗi lấy balance 365OTP: {e}")
            return 0
    
    def get_services(self) -> List[Dict]:
        """Lấy danh sách dịch vụ hỗ trợ"""
        try:
            response = requests.get(
                f"{self.BASE_URL}/availableservices",
                params={"apikey": self.api_key},
                timeout=15
            )
            data = response.json()
            
            if data.get("status") == 1:
                return data.get("data", []) or []
            return []
        except Exception as e:
            logger.error(f"Lỗi lấy services 365OTP: {e}")
            return []
    
    def _find_google_service_id(self) -> str:
        """Tìm service_id cho Google/Gmail"""
        if self._google_service_id:
            return self._google_service_id
            
        services = self.get_services()
        for service in services:
            name = str(service.get("name", "")).lower()
            if "google" in name or "gmail" in name:
                self._google_service_id = str(service.get("serviceId", ""))
                return self._google_service_id
        
        # Fallback
        return self.service_id or ""
    
    def order_sms(self, country: str = "", service: str = "") -> Optional[Dict]:
        """Đặt số điện thoại để nhận SMS
        
        Args:
            country: "VN" hoặc "ID" (mặc định từ config)
            service: Service code (không dùng, giữ để tương thích)
        
        365OTP Endpoint: GET /orders?apikey=xxx&Createorder&countryid=10&serviceid=xxx&notSms=true
        Response: {status: 1, data: {id, phone, message, ...}}
        """
        try:
            # Xác định country
            country_code = country.upper() if country else self.default_country
            if country_code not in self.COUNTRY_MAP:
                country_code = "VN"
            
            country_info = self.COUNTRY_MAP[country_code]
            country_id = country_info["country_id"]
            dial_code = country_info["dial_code"]
            
            # Lấy service_id cho Google
            svc_id = self.service_id or self._find_google_service_id()
            
            if not svc_id:
                logger.error("365OTP: Không tìm thấy service_id cho Google")
                return None
            
            params = {
                "apikey": self.api_key,
                "Createorder": "",
                "countryid": country_id,
                "serviceid": svc_id,
                "notSms": "true"  # Chỉ nhận OTP, không nhận SMS khác
            }
            
            if self.network_id:
                params["networkid"] = self.network_id
            
            with self._lock:
                response = requests.get(
                    f"{self.BASE_URL}/orders",
                    params=params,
                    timeout=30
                )
                data = response.json()
            
            if data.get("status") == 1:
                result_data = data.get("data", {})
                self._current_order_id = result_data.get("id")
                
                phone = str(result_data.get("phone", ""))
                
                # Format số điện thoại với dial code
                if phone:
                    phone = ''.join(c for c in phone if c.isdigit())
                    
                    if phone.startswith("0"):
                        phone = dial_code + phone[1:]
                    elif not phone.startswith("+"):
                        phone = dial_code + phone
                
                logger.info(f"✅ 365OTP order thành công [{country_code}]: {phone}")
                logger.info(f"📱 365OTP phone formatted: {phone}")
                
                return {
                    "order_id": str(self._current_order_id),
                    "phone_number": phone,
                    "country": country_code,
                    "dial_code": dial_code,
                    "price": country_info["price"]
                }
            else:
                msg = data.get("message", "Unknown error")
                logger.warning(f"365OTP order failed: {msg}")
                return None
                
        except Exception as e:
            logger.error(f"Lỗi order SMS 365OTP: {e}")
            return None
    
    def check_sms(self, order_id: str) -> Optional[str]:
        """Kiểm tra OTP code
        
        365OTP Endpoint: GET /orderstatus?apikey=xxx&id=xxx
        Response: {status: 1=Success/0=Wait/-1=Cancel, data: {code, ...}}
        """
        try:
            response = requests.get(
                f"{self.BASE_URL}/orderstatus",
                params={
                    "apikey": self.api_key,
                    "id": order_id
                },
                timeout=10
            )
            data = response.json()
            
            status = data.get("status", 0)
            
            if status == 1:  # Success - có OTP
                result_data = data.get("data", {})
                otp = str(result_data.get("code", ""))
                
                if not otp:
                    # Parse từ message nếu cần
                    sms_content = result_data.get("message", "")
                    if sms_content:
                        import re
                        match = re.search(r'\b(\d{6})\b', sms_content)
                        if match:
                            otp = match.group(1)
                        match = re.search(r'G-(\d+)', sms_content)
                        if match:
                            otp = match.group(1)
                
                if otp:
                    logger.info(f"✅ 365OTP OTP received: {otp}")
                    return otp
                return None
                
            elif status == -1:  # Cancel/Failed
                logger.warning("❌ 365OTP: Order đã bị hủy hoặc thất bại")
                return "CANCELLED"
            
            # status == 0: Waiting
            return None
                
        except Exception as e:
            logger.error(f"Lỗi check SMS 365OTP: {e}")
            return None
    
    def cancel_order(self, order_id: str) -> bool:
        """Hủy đơn hàng - 365OTP không có API cancel trực tiếp
        
        Có thể dùng /continueorder để tiếp tục đơn
        """
        logger.info(f"ℹ️ 365OTP: Order {order_id} - đơn sẽ tự hết hạn")
        return True
    
    def continue_order(self, order_id: str) -> bool:
        """Tiếp tục đơn hàng (dùng cho retry với số khác)
        
        365OTP Endpoint: GET /continueorder?apikey=xxx&orderId=xxx
        """
        try:
            response = requests.get(
                f"{self.BASE_URL}/continueorder",
                params={
                    "apikey": self.api_key,
                    "orderId": order_id
                },
                timeout=10
            )
            data = response.json()
            
            if data.get("status") == 1:
                logger.info(f"✅ 365OTP continue order thành công: {order_id}")
                return True
            else:
                logger.warning(f"365OTP continue order failed: {data}")
                return False
        except Exception as e:
            logger.error(f"Lỗi continue order 365OTP: {e}")
            return False


# ==============================================================================
# SMS PROVIDER FACTORY
# ==============================================================================

SMS_PROVIDER_CONFIG_FILE = "config/sms_provider_config.json"

def load_sms_provider_config() -> Dict:
    """Load SMS provider config"""
    try:
        if os.path.exists(SMS_PROVIDER_CONFIG_FILE):
            with open(SMS_PROVIDER_CONFIG_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
    except Exception as e:
        logger.error(f"Lỗi load SMS provider config: {e}")
    
    # Default config
    return {
        "active_provider": "smspool",
        "providers": {
            "smspool": {"name": "SMSPool", "api_key": "", "enabled": True},
            "codesim": {"name": "Codesim", "api_key": "", "enabled": True},
            "viotp": {"name": "Viotp", "api_key": "", "enabled": False}
        }
    }

def get_active_sms_provider() -> str:
    """Lấy provider đang active"""
    config = load_sms_provider_config()
    return config.get("active_provider", "smspool")

def create_sms_client():
    """Factory: Tạo SMS client dựa trên provider đang active
    
    Returns: SMSPoolClient hoặc CodesimClient
    """
    provider_config = load_sms_provider_config()
    active_provider = provider_config.get("active_provider", "smspool")
    providers = provider_config.get("providers", {})
    
    logger.info(f"📱 SMS Provider đang active: {active_provider.upper()}")
    
    if active_provider == "codesim":
        codesim_cfg = providers.get("codesim", {})
        api_key = codesim_cfg.get("api_key", "")
        service_id = codesim_cfg.get("service_id", "")
        network_id = codesim_cfg.get("network_id", "")
        
        if not api_key:
            logger.warning("⚠️ Codesim API key chưa được cấu hình! Fallback về SMSPool")
            # Fallback về SMSPool
            smspool_cfg = providers.get("smspool", {})
            return SMSPoolClient(smspool_cfg.get("api_key", ""))
        
        logger.info(f"🔑 Sử dụng Codesim API key: {api_key[:20]}...")
        return CodesimClient(api_key, service_id, network_id)
    
    elif active_provider == "viotp":
        viotp_cfg = providers.get("viotp", {})
        api_key = viotp_cfg.get("api_key", "")
        service_id = viotp_cfg.get("service_id", "7")  # 7 = Google
        network_id = viotp_cfg.get("network_id", "")
        
        if not api_key:
            logger.warning("⚠️ Viotp API key chưa được cấu hình! Fallback về SMSPool")
            smspool_cfg = providers.get("smspool", {})
            return SMSPoolClient(smspool_cfg.get("api_key", ""))
        
        logger.info(f"🔑 Sử dụng Viotp API key: {api_key[:20]}...")
        return ViotpClient(api_key, service_id, network_id)
    
    elif active_provider == "365otp":
        otp365_cfg = providers.get("365otp", {})
        api_key = otp365_cfg.get("api_key", "")
        service_id = otp365_cfg.get("service_id", "")
        network_id = otp365_cfg.get("network_id", "")
        default_country = otp365_cfg.get("default_country", "VN")
        
        if not api_key:
            logger.warning("⚠️ 365OTP API key chưa được cấu hình! Fallback về SMSPool")
            smspool_cfg = providers.get("smspool", {})
            return SMSPoolClient(smspool_cfg.get("api_key", ""))
        
        logger.info(f"🔑 Sử dụng 365OTP API key: {api_key[:20]}...")
        return Otp365Client(api_key, service_id, network_id, default_country)
    
    else:  # Default: smspool
        smspool_cfg = providers.get("smspool", {})
        api_key = smspool_cfg.get("api_key", "")
        return SMSPoolClient(api_key)


# ==============================================================================
# GOOGLE VERIFICATION AUTOMATION
# ==============================================================================


class GoogleVerifier:
    """Playwright automation cho Google phone verification"""
    
    def __init__(self, sms_client, config: Dict, worker_id: int = 0):
        self.smspool = sms_client  # Giữ tên smspool để tương thích với code cũ
        self.config = config
        self.worker_id = worker_id
        self.browser: Optional[Browser] = None
        self.page: Optional[Page] = None
        self.playwright = None
        self.current_proxy = "NOT SET"  # Để track proxy đang dùng
        
    async def start_browser(self, proxy_info: Optional[Dict] = None):
        """Khởi động browser với proxy - ĐƠN GIẢN HÓA ĐỂ NHANH HƠN"""
        import random
        
        self.playwright = await async_playwright().start()
        
        # Tính toán vị trí cửa sổ dựa trên worker_id
        WINDOW_SIZE = 430
        GAP = 5
        
        if self.worker_id < 3:
            row, col = 0, self.worker_id
        else:
            row, col = 1, self.worker_id - 3
        
        window_x = col * (WINDOW_SIZE + GAP)
        window_y = row * (WINDOW_SIZE + GAP)
        
        # Browser launch args - ĐƠN GIẢN HÓA để kết nối proxy nhanh hơn
        launch_args = [
            '--no-sandbox',
            '--disable-dev-shm-usage',
            '--disable-blink-features=AutomationControlled',
            '--disable-infobars',
            '--disable-gpu',
            '--incognito',
            '--ignore-certificate-errors',
            '--ignore-ssl-errors',
            f'--window-position={window_x},{window_y}',
            f'--window-size={WINDOW_SIZE},{WINDOW_SIZE}',
        ]
        
        logger.info(f"[W{self.worker_id}] 🖥️ Browser position: ({window_x}, {window_y})")
        
        try:
            # KHÔNG dùng slow_mo - để browser chạy nhanh nhất có thể
            self.browser = await self.playwright.chromium.launch(
                headless=False,
                args=launch_args,
            )
        except Exception as e:
            logger.error(f"[W{self.worker_id}] ❌ Không thể khởi động browser: {e}")
            raise
        
        # Cấu hình context - ĐƠN GIẢN
        context_options = {
            'viewport': {'width': 430, 'height': 400},
            'ignore_https_errors': True,
        }
        
        # Thêm proxy vào context nếu có
        proxy_config = get_next_proxy()
        if proxy_config:
            context_options['proxy'] = proxy_config
            server = proxy_config.get('server', 'unknown')
            has_auth = 'username' in proxy_config and proxy_config.get('username')
            auth_info = f"(auth: {proxy_config.get('username', '')[:10]}...)" if has_auth else "(no auth)"
            logger.info(f"[W{self.worker_id}] 🌐 Proxy: {server} {auth_info}")
            self.current_proxy = server
        else:
            logger.info(f"[W{self.worker_id}] ⚠️ Không có proxy - chạy IP thật")
            self.current_proxy = "NO PROXY"
        
        # Tạo context
        context = await self.browser.new_context(**context_options)
        
        # Ẩn webdriver flag
        await context.add_init_script("""
            Object.defineProperty(navigator, 'webdriver', {
                get: () => undefined
            });
        """)
        
        self.page = await context.new_page()
        
        # Set timeout
        self.page.set_default_timeout(60000)
        self.page.set_default_navigation_timeout(60000)
        
    async def test_proxy_connection(self) -> bool:
        """Test kết nối proxy bằng cách check IP"""
        try:
            logger.info(f"[W{self.worker_id}] 🔍 Đang kiểm tra kết nối proxy...")
            
            # Truy cập trang check IP
            await self.page.goto("https://api.ipify.org/?format=json", wait_until="domcontentloaded", timeout=15000)
            await asyncio.sleep(1)
            
            # Lấy nội dung trang (IP)
            content = await self.page.content()
            
            # Tìm IP trong nội dung
            import re
            ip_match = re.search(r'"ip"\s*:\s*"([^"]+)"', content)
            if ip_match:
                current_ip = ip_match.group(1)
                logger.info(f"[W{self.worker_id}] ✅ IP hiện tại: {current_ip} | Proxy: {self.current_proxy}")
                return True
            else:
                logger.warning(f"[W{self.worker_id}] ⚠️ Không lấy được IP từ response")
                return False
                
        except Exception as e:
            logger.error(f"[W{self.worker_id}] ❌ Lỗi test proxy: {e}")
            return False

        
    async def close_browser(self):
        """Đóng browser"""
        try:
            if self.browser:
                await self.browser.close()
            if self.playwright:
                await self.playwright.stop()
        except:
            pass
    
    async def solve_captcha_on_page(self) -> bool:
        """Tìm và giải captcha trên trang Google login"""
        global azcaptcha_solver
        
        if not azcaptcha_solver:
            logger.error(f"[W{self.worker_id}] ❌ AZCaptcha solver chưa được khởi tạo!")
            return False
        
        try:
            logger.info(f"[W{self.worker_id}] 🔍 Đang tìm hình captcha Google...")
            
            import base64
            captcha_img = None
            
            # Selector cho Google captcha - tìm tất cả img trên trang
            all_images = await self.page.query_selector_all('img')
            logger.info(f"[W{self.worker_id}] 📸 Tìm thấy {len(all_images)} hình trên trang")
            
            for img in all_images:
                try:
                    # Lấy src của hình
                    src = await img.get_attribute('src')
                    if src:
                        # Google captcha thường có data:image hoặc challenge trong src
                        if 'data:image' in src or 'challenge' in src.lower() or 'captcha' in src.lower():
                            captcha_img = img
                            logger.info(f"[W{self.worker_id}] ✅ Tìm thấy captcha image!")
                            break
                except:
                    continue
            
            # Nếu không tìm thấy bằng src, thử tìm theo vị trí (captcha thường ở giữa trang)
            if not captcha_img:
                for img in all_images:
                    try:
                        box = await img.bounding_box()
                        if box and box['width'] > 100 and box['width'] < 400 and box['height'] > 30 and box['height'] < 150:
                            captcha_img = img
                            logger.info(f"[W{self.worker_id}] ✅ Tìm thấy captcha theo size: {box['width']}x{box['height']}")
                            break
                    except:
                        continue
            
            # Chụp hình captcha
            if captcha_img:
                screenshot = await captcha_img.screenshot()
                image_base64 = base64.b64encode(screenshot).decode('utf-8')
                logger.info(f"[W{self.worker_id}] 📸 Đã chụp hình captcha")
            else:
                logger.warning(f"[W{self.worker_id}] ⚠️ Không tìm thấy captcha img cụ thể, thử chụp khu vực captcha...")
                # Chụp khu vực giữa trang
                screenshot = await self.page.screenshot(clip={'x': 400, 'y': 250, 'width': 300, 'height': 100})
                image_base64 = base64.b64encode(screenshot).decode('utf-8')
            
            # Gửi đến AZcaptcha để giải
            logger.info(f"[W{self.worker_id}] 🔐 Gửi captcha đến AZcaptcha...")
            captcha_text = azcaptcha_solver.solve_image_captcha(image_base64)
            
            if not captcha_text:
                logger.error(f"[W{self.worker_id}] ❌ Không giải được captcha!")
                return False
            
            logger.info(f"[W{self.worker_id}] ✅ Kết quả captcha: {captcha_text}")
            
            # Tìm input để nhập captcha - Google dùng input với aria-label
            captcha_input = await self.page.query_selector('input[aria-label*="văn bản"], input[aria-label*="text"]')
            
            if not captcha_input:
                # Thử tìm input type text visible gần captcha
                captcha_input = await self.page.query_selector('input[type="text"]:not([type="email"])')
            
            if not captcha_input:
                # Fallback - tìm tất cả input text
                all_inputs = await self.page.query_selector_all('input')
                for inp in all_inputs:
                    inp_type = await inp.get_attribute('type')
                    if inp_type == 'text':
                        captcha_input = inp
                        break
            
            if not captcha_input:
                logger.error(f"[W{self.worker_id}] ❌ Không tìm thấy input captcha!")
                return False
            
            logger.info(f"[W{self.worker_id}] ✏️ Nhập captcha: {captcha_text}")
            
            # Nhập kết quả captcha - dùng timeout ngắn để không bị treo
            try:
                # Thử click trước để focus
                try:
                    await captcha_input.click(timeout=3000)
                except:
                    pass
                await asyncio.sleep(0.5)
                
                # Xóa nội dung cũ và nhập mới bằng keyboard
                await self.page.keyboard.press("Control+a")
                await self.page.keyboard.type(captcha_text, delay=50)
                logger.info(f"[W{self.worker_id}] ✅ Đã nhập captcha bằng keyboard")
            except Exception as fill_err:
                logger.warning(f"[W{self.worker_id}] ⚠️ Fill error: {fill_err}")
                # Fallback - cố gắng type trực tiếp
                try:
                    await self.page.keyboard.type(captcha_text, delay=50)
                except:
                    return False
            
            await asyncio.sleep(1)
            
            # Nhấn Enter submit
            await self.page.keyboard.press("Enter")
            logger.info(f"[W{self.worker_id}] ✅ Đã submit captcha")
            
            await asyncio.sleep(5)  # Đợi trang load
            return True
            
        except Exception as e:
            logger.error(f"[W{self.worker_id}] ❌ Lỗi giải captcha: {e}")
            import traceback
            traceback.print_exc()
            return False
    
    async def solve_recaptcha_checkbox(self) -> bool:
        """Xử lý reCAPTCHA v2 checkbox ('I'm not a robot')"""
        global azcaptcha_solver
        
        if not azcaptcha_solver:
            logger.error(f"[W{self.worker_id}] ❌ AZCaptcha solver chưa được khởi tạo!")
            return False
        
        try:
            logger.info(f"[W{self.worker_id}] 🔍 Kiểm tra reCAPTCHA v2...")
            
            # Tìm iframe reCAPTCHA
            recaptcha_iframe = await self.page.query_selector('iframe[src*="recaptcha"]')
            
            if not recaptcha_iframe:
                logger.info(f"[W{self.worker_id}] ❌ Không tìm thấy reCAPTCHA iframe")
                return False
            
            # Lấy site key từ page
            site_key = None
            try:
                # Tìm trong div.g-recaptcha
                recaptcha_div = await self.page.query_selector('div.g-recaptcha, div[data-sitekey]')
                if recaptcha_div:
                    site_key = await recaptcha_div.get_attribute('data-sitekey')
                
                # Hoặc tìm trong iframe src
                if not site_key:
                    iframe_src = await recaptcha_iframe.get_attribute('src')
                    if iframe_src and 'k=' in iframe_src:
                        import re
                        match = re.search(r'k=([^&]+)', iframe_src)
                        if match:
                            site_key = match.group(1)
            except Exception as e:
                logger.warning(f"[W{self.worker_id}] ⚠️ Không thể lấy site key: {e}")
            
            # Site key mặc định của Google login
            if not site_key:
                site_key = "6LcpP_kSAAAAALPPkOGj5GfHN8WFcVpLqlXuJjfH"  # Google accounts default
                logger.info(f"[W{self.worker_id}] 📋 Dùng site key mặc định của Google")
            
            page_url = self.page.url
            
            logger.info(f"[W{self.worker_id}] 🔐 Gửi reCAPTCHA v2 đến AZCaptcha...")
            logger.info(f"[W{self.worker_id}]    Site key: {site_key[:30]}...")
            
            # Giải reCAPTCHA v2
            token = azcaptcha_solver.solve_recaptcha_v2(site_key, page_url, timeout=180)
            
            if not token:
                logger.error(f"[W{self.worker_id}] ❌ Không giải được reCAPTCHA!")
                return False
            
            logger.info(f"[W{self.worker_id}] ✅ Đã nhận token reCAPTCHA!")
            
            # Inject token vào trang
            try:
                # Tìm textarea g-recaptcha-response và set value
                await self.page.evaluate(f'''
                    document.getElementById('g-recaptcha-response').innerHTML = "{token}";
                    document.getElementById('g-recaptcha-response').value = "{token}";
                ''')
                
                # Cố gắng trigger callback
                await self.page.evaluate('''
                    try {{
                        if (typeof ___grecaptcha_cfg !== 'undefined') {{
                            Object.keys(___grecaptcha_cfg.clients).forEach(function(key) {{
                                if (___grecaptcha_cfg.clients[key].Xw && ___grecaptcha_cfg.clients[key].Xw.Xw) {{
                                    ___grecaptcha_cfg.clients[key].Xw.Xw.callback("{token}");
                                }}
                            }});
                        }}
                    }} catch (e) {{
                        console.log("Callback error:", e);
                    }}
                ''')
                
                logger.info(f"[W{self.worker_id}] ✅ Đã inject token reCAPTCHA")
                
                # Click Next button
                await asyncio.sleep(1)
                next_btn = await self.page.query_selector('button:has-text("Next"), button:has-text("Tiếp theo")')
                if next_btn:
                    await next_btn.click()
                    logger.info(f"[W{self.worker_id}] ✅ Đã click Next")
                
                await asyncio.sleep(5)
                return True
                
            except Exception as inject_err:
                logger.error(f"[W{self.worker_id}] ❌ Lỗi inject token: {inject_err}")
                return False
            
        except Exception as e:
            logger.error(f"[W{self.worker_id}] ❌ Lỗi reCAPTCHA: {e}")
            import traceback
            traceback.print_exc()
            return False
            
    async def login_google(self, email: str, password: str) -> bool:
        """Đăng nhập Google account - SMART CAPTCHA DETECTION + RETRY"""
        try:
            logger.info(f"[W{self.worker_id}] 🔐 Đang đăng nhập: {email}")
            
            # Vào trang login - với RETRY LOGIC
            max_retries = 3
            for attempt in range(max_retries):
                try:
                    # Dùng networkidle hoặc domcontentloaded tùy attempt
                    # Lần 1-2: domcontentloaded (nhanh hơn)
                    # Lần 3: commit (chỉ cần server response)
                    wait_until = "domcontentloaded" if attempt < 2 else "commit"
                    timeout = 90000  # 90 giây - tăng lên cho proxy chậm
                    
                    logger.info(f"[W{self.worker_id}] 🌐 Đang navigate đến Google (wait_until={wait_until}, timeout={timeout//1000}s)...")
                    
                    await self.page.goto(
                        "https://accounts.google.com/signin",
                        wait_until=wait_until,
                        timeout=timeout
                    )
                    logger.info(f"[W{self.worker_id}] ✅ Đã load trang đăng nhập")
                    break
                except Exception as goto_err:
                    logger.warning(f"[W{self.worker_id}] ⚠️ Lỗi goto (lần {attempt + 1}/{max_retries}): {goto_err}")
                    if attempt < max_retries - 1:
                        await asyncio.sleep(5)  # Đợi lâu hơn giữa các retry
                        continue
                    else:
                        logger.error(f"[W{self.worker_id}] ❌ Không thể load trang đăng nhập sau {max_retries} lần thử")
                        return "NAVIGATION_FAILED"  # Trả về string đặc biệt để retry cả flow
            
            await asyncio.sleep(2)
            
            # Nhập email
            await self.page.wait_for_selector('input[type="email"]', timeout=15000)
            await asyncio.sleep(1)
            await self.page.fill('input[type="email"]', email)
            await asyncio.sleep(1)
            await self.page.click('#identifierNext')
            await asyncio.sleep(5)
            
            # SMART DETECTION: Kiểm tra có password input hay không
            # Nếu có → không có captcha
            # Nếu không có → có thể có captcha
            password_found = False
            for check_attempt in range(10):  # Thử tối đa 10 lần
                try:
                    pwd_input = await self.page.wait_for_selector('input[type="password"]', timeout=3000)
                    if pwd_input:
                        password_found = True
                        logger.info(f"[W{self.worker_id}] ✅ Tìm thấy password input - KHÔNG CÓ CAPTCHA")
                        break
                except:
                    # Không tìm thấy password → kiểm tra captcha
                    page_content = await self.page.content()
                    captcha_indicators = [
                        "hãy nhập văn bản bạn nghe hoặc nhìn thấy",
                        "type the text you hear or see",
                    ]
                    
                    has_captcha = False
                    for indicator in captcha_indicators:
                        if indicator.lower() in page_content.lower():
                            has_captcha = True
                            break
                    
                    if has_captcha:
                        logger.warning(f"[W{self.worker_id}] 🔒 CAPTCHA! Đang giải lần {check_attempt + 1}...")
                        
                        captcha_result = await self.solve_captcha_on_page()
                        if captcha_result:
                            logger.info(f"[W{self.worker_id}] ✅ Đã submit captcha, đợi trang load...")
                            await asyncio.sleep(5)
                            # Loop lại để check password input
                        else:
                            logger.warning(f"[W{self.worker_id}] ⚠️ Captcha fail, thử lại...")
                            await asyncio.sleep(2)
                    else:
                        # Không có captcha, không có password → đợi thêm
                        await asyncio.sleep(2)
            
            if not password_found:
                logger.error(f"[W{self.worker_id}] ❌ Không tìm thấy password input sau 10 lần thử!")
                return "CAPTCHA_DETECTED"
            
            # Nhập password
            await asyncio.sleep(1)
            await self.page.fill('input[type="password"]', password)
            await asyncio.sleep(1)
            await self.page.click('#passwordNext')
            
            # POLLING THÔNG MINH - Chờ cho đến khi thấy kết quả
            logger.info(f"[W{self.worker_id}] ⏳ Đang chờ sau password (polling)...")
            
            max_wait = 60  # Tối đa 60 giây
            poll_interval = 2  # Check mỗi 2 giây
            start_time = time.time()
            result_found = False
            
            while time.time() - start_time < max_wait and not result_found:
                await asyncio.sleep(poll_interval)
                
                try:
                    current_url = self.page.url
                    page_content = await self.page.content()
                    
                    # CHECK: Đã chuyển trang (không còn ở signin)
                    if "signin" not in current_url.lower() or "challenge" in current_url.lower():
                        result_found = True
                        logger.info(f"[W{self.worker_id}] ✅ Đã chuyển trang: {current_url[:50]}...")
                        break
                    
                    # CHECK: Có phone verification hoặc verify
                    if "phone" in page_content.lower() or "verify" in page_content.lower():
                        result_found = True
                        logger.info(f"[W{self.worker_id}] ✅ Phát hiện trang verify")
                        break
                    
                    # Log tiến trình
                    elapsed = int(time.time() - start_time)
                    if elapsed % 10 == 0:
                        logger.info(f"[W{self.worker_id}] ⏳ Đang chờ... ({elapsed}s/{max_wait}s)")
                        
                except Exception as poll_err:
                    logger.debug(f"[W{self.worker_id}] Poll error: {poll_err}")
                    continue
            
            # Đợi thêm 2 giây cho trang ổn định
            await asyncio.sleep(2)
            
            # Kiểm tra xem có màn hình verify phone không
            current_url = self.page.url
            page_content = await self.page.content()
            
            # KIỂM TRA LỖI ĐĂNG NHẬP TRƯỚC
            login_error_indicators = [
                "sai mật khẩu",
                "wrong password",
                "incorrect password",
                "mật khẩu không đúng",
                "couldn't sign you in",
                "không thể đăng nhập",
                "tài khoản bị vô hiệu hóa",
                "account has been disabled",
                "tài khoản bị khóa",
                "account is locked",
                "tài khoản không tồn tại",
                "couldn't find your google account",
                "email không tồn tại"
            ]
            
            for indicator in login_error_indicators:
                if indicator.lower() in page_content.lower():
                    logger.error(f"[W{self.worker_id}] ❌ LỖI ĐĂNG NHẬP: {indicator}")
                    return "LOGIN_FAILED"  # Trả về lỗi đăng nhập thay vì False
            
            # KIỂM TRA reCAPTCHA v2 (checkbox "I'm not a robot")
            recaptcha_indicators = [
                "i'm not a robot",
                "confirm you're not a robot",
                "xác nhận bạn không phải là robot",
                "recaptcha-checkbox",
            ]
            
            has_recaptcha = False
            for indicator in recaptcha_indicators:
                if indicator.lower() in page_content.lower():
                    has_recaptcha = True
                    break
            
            # Hoặc check iframe reCAPTCHA
            if not has_recaptcha:
                recaptcha_iframe = await self.page.query_selector('iframe[src*="recaptcha"]')
                if recaptcha_iframe:
                    has_recaptcha = True
            
            if has_recaptcha:
                logger.warning(f"[W{self.worker_id}] 🔒 PHÁT HIỆN reCAPTCHA v2! Đang giải...")
                recaptcha_result = await self.solve_recaptcha_checkbox()
                
                if recaptcha_result:
                    logger.info(f"[W{self.worker_id}] ✅ Đã giải reCAPTCHA thành công!")
                    await asyncio.sleep(5)
                    current_url = self.page.url
                    page_content = await self.page.content()
                else:
                    logger.error(f"[W{self.worker_id}] ❌ Không giải được reCAPTCHA - đổi proxy...")
                    return "CAPTCHA_DETECTED"
            
            # KIỂM TRA CAPTCHA TEXT (nhập chữ)
            captcha_indicators = [
                "hãy nhập văn bản bạn nghe hoặc nhìn thấy",
                "type the text you hear or see",
            ]
            
            for indicator in captcha_indicators:
                if indicator.lower() in page_content.lower():
                    logger.warning(f"[W{self.worker_id}] 🔒 PHÁT HIỆN CAPTCHA TEXT! Đang giải...")
                    
                    # Thử giải captcha
                    captcha_result = await self.solve_captcha_on_page()
                    
                    if captcha_result:
                        logger.info(f"[W{self.worker_id}] ✅ Đã giải captcha thành công!")
                        # Đợi trang load sau khi nhập captcha
                        await asyncio.sleep(5)
                        # Kiểm tra lại trang
                        current_url = self.page.url
                        page_content = await self.page.content()
                    else:
                        logger.error(f"[W{self.worker_id}] ❌ Không giải được captcha - đổi proxy...")
                        notify_admin_proxy(f"🔒 <b>CAPTCHA FAILED</b>\n📧 Email: {email}\n⚠️ Đang đổi proxy...")
                        return "CAPTCHA_DETECTED"
            
            # Kiểm tra các indicator của trang verify phone
            phone_verify_indicators = [
                "challenge" in current_url,
                "signin/v2/challenge" in current_url,
                "interstitialreturn" in current_url,
                "phone" in current_url.lower(),
                'input[type="tel"]' in page_content,
                "số điện thoại" in page_content.lower(),
                "phone number" in page_content.lower(),
                "xác minh số điện thoại" in page_content.lower(),
                "verify your phone" in page_content.lower()
            ]
            
            if any(phone_verify_indicators):
                logger.info(f"[W{self.worker_id}] 📱 Phát hiện yêu cầu verify phone")
                await asyncio.sleep(2)  # Đợi form sẵn sàng
                return True
            elif "myaccount.google.com" in current_url:
                logger.info(f"[W{self.worker_id}] ✅ Đăng nhập thành công, không cần verify")
                return False
            elif "speedbump" in current_url:
                # Trang chào mừng, bấm tiếp tục
                logger.info(f"[W{self.worker_id}] 🔘 Trang speedbump, tìm nút tiếp tục...")
                try:
                    continue_btn = await self.page.query_selector(
                        'button:has-text("Tôi hiểu"), button:has-text("Continue"), '
                        'button:has-text("Tiếp tục"), input[type="submit"]'
                    )
                    if continue_btn:
                        await continue_btn.click()
                        await asyncio.sleep(5)
                except:
                    pass
                return False  # Không cần verify nếu đã qua được
            else:
                # Kiểm tra thêm các indicator xác minh
                if "xác minh" in page_content.lower() or "verify" in page_content.lower():
                    logger.info(f"[W{self.worker_id}] 📱 Phát hiện yêu cầu xác minh từ nội dung trang")
                    await asyncio.sleep(2)
                    return True
                logger.warning(f"[W{self.worker_id}] ⚠️ URL không xác định: {current_url}")
                # Thử kiểm tra có input tel không trước khi quyết định
                tel_input = await self.page.query_selector('input[type="tel"]')
                if tel_input:
                    logger.info(f"[W{self.worker_id}] 📱 Tìm thấy input điện thoại, cần verify")
                    return True
                return True  # Default: thử verify
                
        except Exception as e:
            logger.error(f"[W{self.worker_id}] ❌ Lỗi đăng nhập: {e}")
            return False
    
    async def enter_phone_number(self, phone: str) -> bool:
        """Nhập số điện thoại vào form Google - Đã cải thiện timing + error handling"""
        try:
            # Kiểm tra browser/page còn sống không
            if not self.page or not self.browser:
                logger.error(f"[W{self.worker_id}] ❌ Browser/Page đã bị đóng trước khi nhập SĐT!")
                return False
            
            # Kiểm tra page có bị closed không
            try:
                _ = self.page.url  # Test access page
            except Exception as page_err:
                logger.error(f"[W{self.worker_id}] ❌ Page bị lỗi/đóng: {page_err}")
                return False
            
            logger.info(f"[W{self.worker_id}] 📞 Nhập SĐT: {phone}")
            
            # Đợi trang ổn định trước
            await asyncio.sleep(2)
            
            # Chờ input xuất hiện - thử nhiều selectors
            phone_input = None
            phone_selectors = [
                'input[type="tel"]',
                'input[id*="phone"]', 
                'input[name*="phone"]',
                'input[aria-label*="phone"]',
                'input[aria-label*="điện thoại"]',
                'input[placeholder*="phone"]',
                'input[placeholder*="số"]',
                '#phoneNumberId',
                'input[autocomplete="tel"]',
            ]
            
            for selector in phone_selectors:
                try:
                    el = await self.page.wait_for_selector(selector, timeout=5000, state='visible')
                    if el:
                        phone_input = el
                        logger.info(f"[W{self.worker_id}] ✅ Tìm thấy phone input: {selector}")
                        break
                except Exception as sel_err:
                    logger.debug(f"[W{self.worker_id}] Selector {selector} không tìm thấy: {sel_err}")
                    continue
            
            # Fallback: tìm input visible có thể nhập số
            if not phone_input:
                logger.warning(f"[W{self.worker_id}] ⚠️ Không tìm thấy phone selector, thử fallback...")
                try:
                    all_inputs = await self.page.query_selector_all('input:visible')
                    for inp in all_inputs:
                        inp_type = await inp.get_attribute('type') or ''
                        if inp_type in ['tel', 'text', 'number']:
                            phone_input = inp
                            logger.info(f"[W{self.worker_id}] ✅ Tìm thấy phone input qua fallback")
                            break
                except Exception as fb_err:
                    logger.error(f"[W{self.worker_id}] ❌ Fallback lỗi: {fb_err}")
            
            if not phone_input:
                logger.error(f"[W{self.worker_id}] ❌ Không tìm thấy phone input!")
                # Chụp screenshot để debug
                try:
                    await self.page.screenshot(path=f"debug_no_phone_input_w{self.worker_id}.png")
                    logger.info(f"[W{self.worker_id}] 📸 Đã chụp screenshot debug")
                except:
                    pass
                return False
            
            # Xóa nội dung cũ và nhập số mới - với error handling tốt hơn
            try:
                await phone_input.click()
                await asyncio.sleep(0.5)
                await phone_input.fill("")
                await asyncio.sleep(0.3)
                await phone_input.fill(phone)
                await asyncio.sleep(2)
            except Exception as fill_err:
                logger.error(f"[W{self.worker_id}] ❌ Lỗi khi nhập số: {fill_err}")
                return False
            
            # Click nút tiếp tục
            try:
                next_button = await self.page.query_selector(
                    'button:has-text("Tiếp theo"), button:has-text("Next"), '
                    'button:has-text("Gửi"), button:has-text("Send"), '
                    'button:has-text("Xác minh"), button:has-text("Verify")'
                )
                
                if next_button:
                    await next_button.click()
                else:
                    await self.page.keyboard.press("Enter")
            except Exception as btn_err:
                logger.warning(f"[W{self.worker_id}] ⚠️ Không bấm được nút next: {btn_err}, thử Enter")
                try:
                    await self.page.keyboard.press("Enter")
                except:
                    pass
            
            # Đợi Google xử lý
            await asyncio.sleep(8)
            try:
                await self.page.wait_for_load_state('networkidle', timeout=15000)
            except:
                pass
            await asyncio.sleep(3)
            
            # Kiểm tra lỗi số điện thoại bị spam/dùng quá nhiều lần
            try:
                page_content = await self.page.content()
            except Exception as content_err:
                logger.error(f"[W{self.worker_id}] ❌ Không lấy được nội dung trang: {content_err}")
                return False
                
            spam_indicators = [
                "Không thể sử dụng số điện thoại này",
                "xác minh không thành công quá nhiều lần",
                "This phone number cannot be used",
                "used too many times",
                "try a different phone number",
                "Số điện thoại này đã được sử dụng",
                "phone number has already been used",
                "Số điện thoại không hợp lệ",
                "Invalid phone number",
                "Vui lòng thử lại sau",
                "Please try again later"
            ]
            
            for indicator in spam_indicators:
                if indicator.lower() in page_content.lower():
                    logger.warning(f"[W{self.worker_id}] 🚫 SỐ ĐIỆN THOẠI BỊ SPAM: {phone}")
                    return "SPAM_PHONE"
            
            return True
                
        except Exception as e:
            logger.error(f"[W{self.worker_id}] ❌ Lỗi nhập SĐT: {e}")
            import traceback
            traceback.print_exc()
            return False
    
    async def enter_otp(self, otp: str) -> bool:
        """Nhập OTP code - Đã sửa selector conflict và timing"""
        try:
            logger.info(f"[W{self.worker_id}] 🔑 Nhập OTP: {otp}")
            
            # Đợi trang ổn định trước
            await asyncio.sleep(3)
            
            # QUAN TRỌNG: Selector OTP - KHÔNG dùng input[type="tel"] vì nó trùng với phone input!
            # Thử nhiều selectors khác nhau theo thứ tự ưu tiên
            otp_selectors = [
                'input[id*="code"]',
                'input[name*="code"]', 
                'input[id*="otp"]',
                'input[name*="otp"]',
                'input[aria-label*="code"]',
                'input[aria-label*="mã"]',
                'input[placeholder*="code"]',
                'input[placeholder*="mã"]',
                '#code',
                '#smsUserPin',
                '#idvPinEntry',
                'input[autocomplete="one-time-code"]'
            ]
            
            otp_input = None
            used_selector = None
            
            for selector in otp_selectors:
                try:
                    el = await self.page.query_selector(selector)
                    if el:
                        otp_input = el
                        used_selector = selector
                        logger.info(f"[W{self.worker_id}] ✅ Tìm thấy OTP input: {selector}")
                        break
                except:
                    continue
            
            # Fallback: tìm input visible đầu tiên không phải phone
            if not otp_input:
                logger.info(f"[W{self.worker_id}] 🔍 Thử tìm OTP input bằng fallback...")
                all_inputs = await self.page.query_selector_all('input:visible')
                for inp in all_inputs:
                    inp_type = await inp.get_attribute('type') or ''
                    inp_id = await inp.get_attribute('id') or ''
                    inp_name = await inp.get_attribute('name') or ''
                    # Bỏ qua các input không liên quan
                    if inp_type in ['hidden', 'submit', 'button', 'checkbox', 'radio']:
                        continue
                    # Bỏ qua input phone (có thể vẫn visible)
                    if 'phone' in inp_id.lower() or 'phone' in inp_name.lower():
                        continue
                    otp_input = inp
                    used_selector = f"Fallback input (id={inp_id}, name={inp_name})"
                    logger.info(f"[W{self.worker_id}] ✅ Tìm thấy OTP input (fallback): {used_selector}")
                    break
            
            if not otp_input:
                logger.error(f"[W{self.worker_id}] ❌ Không tìm thấy input OTP!")
                # Log HTML để debug
                page_html = await self.page.content()
                if 'input' in page_html:
                    logger.debug(f"[W{self.worker_id}] Page có input nhưng không match selector")
                return False
            
            # Xóa và nhập OTP
            await otp_input.click(click_count=3)
            await self.page.keyboard.press("Backspace")
            await asyncio.sleep(0.5)
            await otp_input.fill(otp)
            await asyncio.sleep(2)  # Tăng từ 1s lên 2s
            
            # Click verify
            verify_button = await self.page.query_selector(
                'button:has-text("Xác minh"), button:has-text("Verify"), '
                'button:has-text("Tiếp theo"), button:has-text("Next"), '
                'button:has-text("Xác nhận"), button:has-text("Confirm")'
            )
            
            if verify_button:
                await verify_button.click()
            else:
                await self.page.keyboard.press("Enter")
            
            # POLLING THÔNG MINH - Đợi cho đến khi thấy kết quả thay vì đợi cố định
            logger.info(f"[W{self.worker_id}] ⏳ Đang chờ kết quả OTP (polling)...")
            
            max_wait = 60  # Tối đa 60 giây
            poll_interval = 2  # Check mỗi 2 giây
            start_time = time.time()
            
            while time.time() - start_time < max_wait:
                await asyncio.sleep(poll_interval)
                
                try:
                    current_url = self.page.url
                    page_content = await self.page.content()
                    
                    # CHECK 1: Đã vào myaccount hoặc mail = THÀNH CÔNG
                    if "myaccount" in current_url or "mail.google" in current_url:
                        logger.info(f"[W{self.worker_id}] ✅ Đã vào trang myaccount/mail!")
                        return True
                    
                    # CHECK 2: Trang speedbump = cần bấm "Tôi hiểu"
                    if "speedbump" in current_url:
                        logger.info(f"[W{self.worker_id}] 🔘 Phát hiện trang speedbump, bấm 'Tôi hiểu'...")
                        await self.click_toi_hieu_button()
                        return True
                    
                    # CHECK 3: Thấy nút "Tôi hiểu" = bấm ngay
                    if "Tôi hiểu" in page_content or "I understand" in page_content:
                        logger.info(f"[W{self.worker_id}] 🔘 Phát hiện nút 'Tôi hiểu', bấm...")
                        await self.click_toi_hieu_button()
                        await asyncio.sleep(3)
                        return True
                    
                    # CHECK 4: Lỗi OTP - CHỈ check nếu URL vẫn ở trang nhập code
                    # VÀ PHẢI LÀ LỖI CỤ THỂ, KHÔNG MATCH VỚI "Try another way"
                    if "challenge" in current_url or "signin" in current_url:
                        # Các từ lỗi CỤ THỂ - không dùng "try again" vì match với "Try another way"
                        otp_error_exact = [
                            "wrong code",
                            "incorrect code", 
                            "mã không đúng",
                            "mã sai",
                            "code is incorrect",
                            "that code didn't work",
                            "mã xác minh không đúng",
                            "code expired",
                            "mã đã hết hạn"
                        ]
                        page_lower = page_content.lower()
                        for error_phrase in otp_error_exact:
                            if error_phrase.lower() in page_lower:
                                logger.warning(f"[W{self.worker_id}] ❌ OTP không đúng: '{error_phrase}'")
                                return False
                    
                    # Log tiến trình
                    elapsed = int(time.time() - start_time)
                    if elapsed % 10 == 0:  # Log mỗi 10s
                        logger.info(f"[W{self.worker_id}] ⏳ Đang chờ... ({elapsed}s/{max_wait}s)")
                        
                except Exception as poll_err:
                    logger.debug(f"[W{self.worker_id}] Poll error: {poll_err}")
                    continue
            
            # Hết thời gian - kiểm tra lần cuối
            logger.warning(f"[W{self.worker_id}] ⏰ Hết thời gian chờ, kiểm tra lần cuối...")
            current_url = self.page.url
            if "myaccount" in current_url or "mail.google" in current_url or "speedbump" in current_url:
                await self.click_toi_hieu_button()
                return True
                
            return True  # Assume success nếu không có lỗi rõ ràng
            
        except Exception as e:
            logger.error(f"[W{self.worker_id}] ❌ Lỗi nhập OTP: {e}")
            return False
    
    async def click_toi_hieu_button(self):
        """Bấm nút Tôi hiểu trên trang speedbump"""
        try:
            logger.info(f"[W{self.worker_id}] 🔍 Đang tìm nút 'Tôi hiểu'...")
            await asyncio.sleep(3)
            
            # Thử nhiều cách khác nhau
            button_clicked = False
            
            # Cách 1: Tìm trực tiếp bằng text với Playwright locator
            try:
                btn = self.page.get_by_role("button", name="Tôi hiểu")
                if await btn.count() > 0:
                    await btn.click()
                    logger.info(f"[W{self.worker_id}] ✅ Đã bấm nút 'Tôi hiểu' (get_by_role)")
                    button_clicked = True
            except:
                pass
            
            if not button_clicked:
                try:
                    btn = self.page.locator("button:has-text('Tôi hiểu')")
                    if await btn.count() > 0:
                        await btn.first.click()
                        logger.info(f"[W{self.worker_id}] ✅ Đã bấm nút 'Tôi hiểu' (locator)")
                        button_clicked = True
                except:
                    pass
            
            # Cách 2: JavaScript click
            if not button_clicked:
                clicked = await self.page.evaluate('''() => {
                    // Tìm tất cả button
                    const buttons = document.querySelectorAll('button');
                    for (const btn of buttons) {
                        const text = btn.innerText || btn.textContent || '';
                        if (text.trim() === 'Tôi hiểu' || text.includes('Tôi hiểu')) {
                            btn.click();
                            return 'js clicked: ' + text.trim();
                        }
                    }
                    
                    // Tìm trong span
                    const spans = document.querySelectorAll('span');
                    for (const span of spans) {
                        const text = span.innerText || span.textContent || '';
                        if (text.trim() === 'Tôi hiểu') {
                            span.click();
                            return 'js clicked span: ' + text.trim();
                        }
                    }
                    
                    return null;
                }''')
                
                if clicked:
                    logger.info(f"[W{self.worker_id}] ✅ {clicked}")
                    button_clicked = True
            
            if button_clicked:
                await asyncio.sleep(3)
            else:
                logger.info(f"[W{self.worker_id}] ℹ️ Không tìm thấy nút 'Tôi hiểu' - có thể đã qua trang này")
                
        except Exception as e:
            logger.debug(f"[W{self.worker_id}] click_toi_hieu error: {e}")
    
    async def verify_account(self, email: str, password: str, task_country_code: str = "", is_admin: bool = False) -> Dict:
        """Quy trình verify đầy đủ với RETRY LOGIC thông minh
        
        Args:
            email: Email tài khoản Google
            password: Mật khẩu
            task_country_code: Mã quốc gia từ task (VN, ID, NL, EE, ...)
            is_admin: True nếu là admin, False nếu là customer
            
        Logic:
            - Admin (SMSPool): Dùng admin_countries từ config (VD: ID 2 lần → NL 3 lần = tối đa 5)
            - Customer: Dùng quốc gia đã chọn, tối đa 2 lần
        """
        global luna_proxy_client
        
        result = {
            "status": "failed",
            "message": "",
            "phone_used": "",
            "attempts": 0,
            "proxy_used": "",
            "suggest_change_country": False,
            "failed_country": ""
        }
        
        # MAPPING MÃ QUỐC GIA -> ĐẦU SỐ ĐIỆN THOẠI
        COUNTRY_DIAL_CODES = {
            "VN": "+84", "ID": "+62", "NL": "+31", "EE": "+372", "PH": "+63",
            "MY": "+60", "TH": "+66", "IN": "+91", "PK": "+92", "BD": "+880",
            "RU": "+7", "UA": "+380", "US": "+1", "UK": "+44", "GB": "+44",
            "CA": "+1", "AU": "+61", "DE": "+49", "FR": "+33", "IT": "+39",
            "ES": "+34", "BR": "+55", "MX": "+52", "AR": "+54", "CL": "+56",
            "CO": "+57", "PE": "+51", "VE": "+58", "KR": "+82", "JP": "+81",
            "CN": "+86", "HK": "+852", "TW": "+886", "SG": "+65", "NZ": "+64",
            "ZA": "+27", "NG": "+234", "EG": "+20", "KE": "+254", "GH": "+233",
        }
        
        # XÁC ĐỊNH DANH SÁCH QUỐC GIA VÀ SỐ LẦN THỬ
        if is_admin and not task_country_code:
            # ADMIN: Chọn quốc gia dựa trên ACTIVE PROVIDER
            try:
                sms_config_path = "config/sms_provider_config.json"
                if os.path.exists(sms_config_path):
                    with open(sms_config_path, 'r', encoding='utf-8') as f:
                        sms_config = json.load(f)
                    
                    active_provider = sms_config.get("active_provider", "smspool").lower()
                    logger.info(f"[W{self.worker_id}] 📱 Active provider: {active_provider.upper()}")
                    
                    # CODESIM: Chỉ dùng số VN (+84)
                    if active_provider == "codesim":
                        countries = [
                            {"code": "VN", "name": "Vietnam", "dial_code": "+84", "max_tries": 3}
                        ]
                        logger.info(f"[W{self.worker_id}] 👑 ADMIN (Codesim) - Auto VN (+84) x3 tries")
                    
                    # VIOTP: Chỉ dùng số VN (+84)
                    elif active_provider == "viotp":
                        countries = [
                            {"code": "VN", "name": "Vietnam", "dial_code": "+84", "max_tries": 3}
                        ]
                        logger.info(f"[W{self.worker_id}] 👑 ADMIN (Viotp) - Auto VN (+84) x3 tries")
                    
                    # 365OTP: VN 2 lần → ID 2 lần (fallback)
                    elif active_provider == "365otp":
                        countries = [
                            {"code": "VN", "name": "Vietnam", "dial_code": "+84", "max_tries": 2},
                            {"code": "ID", "name": "Indonesia", "dial_code": "+62", "max_tries": 2}
                        ]
                        logger.info(f"[W{self.worker_id}] 👑 ADMIN (365OTP) - VN (2) → ID (2)")
                    
                    # SMSPOOL: Dùng admin_countries từ config
                    else:
                        smspool_config = sms_config.get("providers", {}).get("smspool", {})
                        admin_countries = smspool_config.get("admin_countries", [
                            {"code": "ID", "name": "Indonesia", "dial_code": "+62", "max_tries": 2},
                            {"code": "NL", "name": "Netherlands", "dial_code": "+31", "max_tries": 1},
                            {"code": "EE", "name": "Estonia", "dial_code": "+372", "max_tries": 1},
                            {"code": "US", "name": "United States", "dial_code": "+1", "max_tries": 1}
                        ])
                        
                        countries = []
                        for c in admin_countries:
                            countries.append({
                                "code": c.get("code"),
                                "name": c.get("name"),
                                "dial_code": c.get("dial_code") or COUNTRY_DIAL_CODES.get(c.get("code", "").upper(), ""),
                                "max_tries": c.get("max_tries", 2)
                            })
                        
                        logger.info(f"[W{self.worker_id}] 👑 ADMIN (SMSPool) - Countries: {[c['code'] for c in countries]}")
                else:
                    # Default nếu không có config - fallback về VN
                    countries = [
                        {"code": "VN", "name": "Vietnam", "dial_code": "+84", "max_tries": 3}
                    ]
                    logger.info(f"[W{self.worker_id}] 👑 ADMIN mode - Default VN (+84)")
            except Exception as e:
                logger.error(f"[W{self.worker_id}] ❌ Lỗi load admin_countries: {e}")
                countries = [
                    {"code": "VN", "name": "Vietnam", "dial_code": "+84", "max_tries": 3}
                ]
        elif task_country_code:
            # CUSTOMER: Chỉ dùng quốc gia đã chọn với tối đa 2 lần
            dial_code = COUNTRY_DIAL_CODES.get(task_country_code.upper(), "")
            countries = [{
                "code": task_country_code, 
                "name": task_country_code, 
                "dial_code": dial_code,
                "max_tries": 2  # Customer chỉ thử 2 lần với mỗi quốc gia
            }]
            logger.info(f"[W{self.worker_id}] 🌍 CUSTOMER mode - Country: {task_country_code} (max 2 tries)")
        else:
            # Fallback về config (trường hợp không xác định)
            countries = self.config.get("countries_priority", [])
            for c in countries:
                if not c.get("dial_code"):
                    c["dial_code"] = COUNTRY_DIAL_CODES.get(c.get("code", "").upper(), "")
                if not c.get("max_tries"):
                    c["max_tries"] = 2
        
        otp_timeout = self.config.get("otp_wait_timeout", 300)
        check_interval = self.config.get("otp_check_interval", 5)
        
        used_phones = set()
        total_attempts = 0
        
        # VÒNG LẶP QUA CÁC QUỐC GIA
        for country_info in countries:
            current_country_code = country_info["code"]
            current_country_name = country_info.get("name", current_country_code)
            current_dial_code = country_info.get("dial_code", "")
            max_tries_for_country = country_info.get("max_tries", 2)
            
            logger.info(f"[W{self.worker_id}] 🌍 === QUỐC GIA: {current_country_name} ({current_country_code}) - Max {max_tries_for_country} lần ===")
            
            # VÒNG LẶP THỬ CHO MỖI QUỐC GIA
            for country_attempt in range(max_tries_for_country):
                total_attempts += 1
                result["attempts"] = total_attempts
                result["failed_country"] = current_country_code
                
                logger.info(f"[W{self.worker_id}] 🔄 Thử lần {country_attempt + 1}/{max_tries_for_country} với {current_country_code}")
                
                try:
                    # Mở browser mới
                    await self.start_browser()
                    
                    # Lưu proxy đang dùng vào result
                    result["proxy_used"] = self.current_proxy
                    
                    # Đăng nhập Google ngay - BỎ BƯỚC TEST PROXY
                    logger.info(f"[W{self.worker_id}] 🔐 Bắt đầu đăng nhập Google...")
                    needs_verify = await self.login_google(email, password)
                    
                    logger.info(f"[W{self.worker_id}] 📝 Kết quả login_google: needs_verify={needs_verify}")
                    
                    # === XỬ LÝ NAVIGATION FAILED - Thử lại với browser mới ===
                    if needs_verify == "NAVIGATION_FAILED":
                        logger.warning(f"[W{self.worker_id}] 🔄 Navigation failed! Đóng browser và thử lại...")
                        await self.close_browser()
                        await asyncio.sleep(3)
                        continue  # Thử lại với browser mới
                    
                    # XỬ LÝ CAPTCHA - Thử lại
                    if needs_verify == "CAPTCHA_DETECTED":
                        logger.warning(f"[W{self.worker_id}] 🔒 CAPTCHA không giải được! Thử lại...")
                        await self.close_browser()
                        await asyncio.sleep(3)
                        continue  # Thử lại
                    
                    # Kiểm tra lỗi đăng nhập
                    if needs_verify == "LOGIN_FAILED":
                        result["status"] = "login_failed"
                        result["message"] = "❌ Đăng nhập thất bại - sai mật khẩu hoặc tài khoản bị khóa"
                        logger.error(f"[W{self.worker_id}] ❌ Account {email} đăng nhập thất bại - KHÔNG RETRY")
                        return result
                    
                    if not needs_verify:
                        result["status"] = "skipped"
                        result["message"] = "⏭️ Account không cần verify phone - KHÔNG thuê SĐT"
                        logger.info(f"[W{self.worker_id}] ⏭️ Account {email} không cần verify, bỏ qua")
                        await self.click_toi_hieu_button()
                        return result
                    
                    # ĐẶT SỐ ĐIỆN THOẠI - Dùng quốc gia hiện tại
                    logger.info(f"[W{self.worker_id}] 📱 Đặt số từ {current_country_name} ({current_country_code})")
                    order = self.smspool.order_sms(current_country_code)
                    if not order:
                        logger.warning(f"[W{self.worker_id}] ⚠️ Không thể đặt SĐT từ {current_country_name} - THỬ QUỐC GIA TIẾP THEO")
                        await self.close_browser()
                        await asyncio.sleep(2)
                        break  # BREAK ra để thử quốc gia tiếp theo, không retry cùng quốc gia
                    
                    phone_raw = order["phone_number"]
                    order_id = order["order_id"]
                    
                    # Kiểm tra số đã dùng chưa
                    if phone_raw in used_phones:
                        logger.info(f"[W{self.worker_id}] ⚠️ Số {phone_raw} đã dùng, bỏ qua")
                        self.smspool.cancel_order(order_id)
                        continue
                    
                    used_phones.add(phone_raw)
                    
                    # Thêm mã quốc gia
                    if current_dial_code and not phone_raw.startswith("+"):
                        phone_full = f"{current_dial_code}{phone_raw}"
                    else:
                        phone_full = phone_raw
                    
                    result["phone_used"] = phone_full
                    
                    logger.info(f"[W{self.worker_id}] ✅ Đã đặt SĐT: {phone_raw} → Nhập: {phone_full} (Order: {order_id})")
                    
                    # Nhập SĐT vào Google
                    phone_result = await self.enter_phone_number(phone_full)
                    
                    # Kiểm tra nếu số bị spam
                    if phone_result == "SPAM_PHONE":
                        logger.error(f"[W{self.worker_id}] 🚫 TÀI KHOẢN BỊ SPAM - DỪNG VERIFY NGAY!")
                        self.smspool.cancel_order(order_id)
                        result["status"] = "spam_phone"
                        result["message"] = f"🚫 TÀI KHOẢN BỊ SPAM: Số {phone_full} không thể dùng để xác minh vì đã verify quá nhiều lần. Cần chờ hoặc dùng tài khoản khác."
                        return result
                    
                    if not phone_result:
                        self.smspool.cancel_order(order_id)
                        continue
                    
                    # Chờ OTP với countdown
                    logger.info(f"[W{self.worker_id}] ⏳ Đang chờ OTP (tối đa {otp_timeout}s)...")
                    
                    otp = None
                    start_time = time.time()
                    last_log_time = 0
                    
                    while time.time() - start_time < otp_timeout:
                        elapsed = int(time.time() - start_time)
                        remaining = otp_timeout - elapsed
                        
                        if elapsed - last_log_time >= 30:
                            logger.info(f"[W{self.worker_id}] ⏱️ Đã chờ {elapsed}s / {otp_timeout}s (còn {remaining}s)")
                            last_log_time = elapsed
                        
                        otp = self.smspool.check_sms(order_id)
                        if otp and otp != "CANCELLED":
                            logger.info(f"[W{self.worker_id}] ✅ Nhận được OTP: {otp} (sau {elapsed}s)")
                            break
                        elif otp == "CANCELLED":
                            logger.warning(f"[W{self.worker_id}] ❌ Order đã bị hủy")
                            break
                        await asyncio.sleep(check_interval)
                    
                    # Xử lý kết quả OTP
                    if not otp or otp == "CANCELLED":
                        logger.warning(f"[W{self.worker_id}] ⏰ Hết thời gian chờ OTP - HỦY SỐ VÀ RESTART PROCESS")
                        self.smspool.cancel_order(order_id)
                        # Thoát vòng lặp country để restart toàn bộ process
                        break
                    
                    # Nhập OTP
                    if await self.enter_otp(otp):
                        result["status"] = "success"
                        result["message"] = f"Verify thành công với SĐT {phone_full}"
                        logger.info(f"[W{self.worker_id}] 🎉 VERIFY THÀNH CÔNG!")
                        # Bấm nút Tôi hiểu nếu có (sau verify OTP)
                        await self.click_toi_hieu_button()
                        verification_success = True
                        return result
                    else:
                        logger.warning(f"[W{self.worker_id}] ❌ OTP không đúng")
                        self.smspool.cancel_order(order_id)
                        continue
                    
                except Exception as e:
                    logger.error(f"[W{self.worker_id}] ❌ Lỗi trong lần thử {country_attempt + 1}: {e}")
                    
                finally:
                    await self.close_browser()
                
                # Chờ trước khi thử lại
                if country_attempt < max_tries_for_country - 1:
                    logger.info(f"[W{self.worker_id}] 🔄 Chuẩn bị thử lại (lần {country_attempt + 2})...")
                    await asyncio.sleep(3)
        
        # Nếu khách đã chọn quốc gia cụ thể và thất bại → gợi ý đổi quốc gia
        if task_country_code and not is_admin:
            result["status"] = "country_failed"
            result["message"] = (
                f"❌ Verify thất bại với số {task_country_code} sau {total_attempts} lần thử.\n\n"
                f"💡 Dùng /verify_status để xem danh sách acc thất bại và chọn quốc gia khác để thử lại."
            )
            result["suggest_change_country"] = True
            result["failed_country"] = task_country_code
            logger.info(f"[W{self.worker_id}] ⚠️ Gợi ý khách đổi quốc gia từ {task_country_code}")
        else:
            result["message"] = f"Thất bại sau {total_attempts} lần thử"
        
        return result


# ==============================================================================
# QUEUE MANAGEMENT (Thread-safe)
# ==============================================================================

def load_config() -> Dict:
    """Load cấu hình từ file"""
    try:
        with open(CONFIG_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        logger.error(f"Lỗi load config: {e}")
        return {}

def load_queue() -> list:
    """Load queue từ file - thread-safe"""
    with file_lock:
        try:
            if os.path.exists(QUEUE_FILE):
                with open(QUEUE_FILE, "r", encoding="utf-8") as f:
                    return json.load(f)
        except:
            pass
        return []

def save_queue(queue: list):
    """Save queue vào file - thread-safe"""
    with file_lock:
        os.makedirs(os.path.dirname(QUEUE_FILE), exist_ok=True)
        with open(QUEUE_FILE, "w", encoding="utf-8") as f:
            json.dump(queue, f, ensure_ascii=False, indent=2)

def claim_task() -> Optional[Dict]:
    """Claim một task pending - thread-safe"""
    with file_lock:
        try:
            if not os.path.exists(QUEUE_FILE):
                return None
            
            with open(QUEUE_FILE, "r", encoding="utf-8") as f:
                queue = json.load(f)
            
            # Tìm task pending
            for task in queue:
                if task.get("status") == "pending":
                    task["status"] = "processing"
                    with open(QUEUE_FILE, "w", encoding="utf-8") as f:
                        json.dump(queue, f, ensure_ascii=False, indent=2)
                    return task
            
            return None
        except:
            return None

def cleanup_old_tasks():
    """Đánh dấu TẤT CẢ task cũ (pending/processing) là 'cancelled' khi restart tool.
    Chỉ xử lý task MỚI được gửi sau khi tool chạy."""
    with file_lock:
        try:
            if not os.path.exists(QUEUE_FILE):
                return 0
            
            with open(QUEUE_FILE, "r", encoding="utf-8") as f:
                queue = json.load(f)
            
            cancelled_count = 0
            for task in queue:
                # Đánh dấu tất cả task pending/processing cũ là cancelled
                if task.get("status") in ["pending", "processing"]:
                    task["status"] = "cancelled"
                    task["message"] = "Đã hủy do tool restart"
                    cancelled_count += 1
            
            if cancelled_count > 0:
                with open(QUEUE_FILE, "w", encoding="utf-8") as f:
                    json.dump(queue, f, ensure_ascii=False, indent=2)
                logger.info(f"🗑️ Đã hủy {cancelled_count} task(s) cũ - Chỉ xử lý task mới")
            else:
                logger.info(f"✅ Không có task cũ cần hủy")
            
            return cancelled_count
        except Exception as e:
            logger.error(f"Lỗi cleanup old tasks: {e}")
            return 0

def update_task_status(task_id: str, status: str):
    """Cập nhật status của task - thread-safe"""
    with file_lock:
        try:
            if not os.path.exists(QUEUE_FILE):
                return
            
            with open(QUEUE_FILE, "r", encoding="utf-8") as f:
                queue = json.load(f)
            
            for task in queue:
                if task.get("id") == task_id:
                    task["status"] = status
                    break
            
            with open(QUEUE_FILE, "w", encoding="utf-8") as f:
                json.dump(queue, f, ensure_ascii=False, indent=2)
        except:
            pass

def add_result(result: Dict):
    """Thêm kết quả vào file - thread-safe"""
    with file_lock:
        results = []
        try:
            if os.path.exists(RESULTS_FILE):
                with open(RESULTS_FILE, "r", encoding="utf-8") as f:
                    results = json.load(f)
        except:
            pass
        
        results.append(result)
        
        os.makedirs(os.path.dirname(RESULTS_FILE), exist_ok=True)
        with open(RESULTS_FILE, "w", encoding="utf-8") as f:
            json.dump(results, f, ensure_ascii=False, indent=2)

def update_status(status: str, message: str, worker_id: int = 0):
    """Cập nhật status hiện tại"""
    data = {
        "status": status,
        "message": message,
        "worker_id": worker_id,
        "timestamp": datetime.now(VIETNAM_TZ).isoformat()
    }
    with file_lock:
        os.makedirs(os.path.dirname(STATUS_FILE), exist_ok=True)
        with open(STATUS_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)


# ==============================================================================
# WORKER FUNCTION
# ==============================================================================

async def worker(worker_id: int, smspool: SMSPoolClient, config: Dict):
    """Worker xử lý task - chạy trong thread riêng"""
    logger.info(f"[Worker {worker_id}] Bắt đầu...")
    
    while True:
        # Claim một task
        task = claim_task()
        
        if task:
            task_id = task["id"]
            email = task["email"]
            password = task["password"]
            admin_id = task.get("admin_id")
            
            logger.info(f"[Worker {worker_id}] 📋 Xử lý task: {task_id} - {email}")
            update_status("processing", f"W{worker_id}: {email}", worker_id)
            
            # Tạo verifier riêng cho worker này
            verifier = GoogleVerifier(smspool, config, worker_id)
            
            # Verify
            result = await verifier.verify_account(email, password)
            
            # Lưu kết quả - QUAN TRỌNG: phải bao gồm amount_to_charge và is_admin để trừ tiền
            result_data = {
                "id": task_id,
                "email": email,
                "status": result["status"],
                "message": result["message"],
                "phone_used": result.get("phone_used", ""),
                "attempts": result.get("attempts", 0),
                "admin_id": admin_id,
                "user_id": task.get("user_id"),  # ID user đã đặt đơn (để gửi thông báo)
                "worker_id": worker_id,
                "completed_at": datetime.now(VIETNAM_TZ).isoformat(),
                # ===== QUAN TRỌNG: Các field để trừ tiền =====
                "amount_to_charge": task.get("amount_to_charge", 5500),  # Copy từ task, mặc định 5500
                "is_admin": task.get("is_admin", False),  # Để biết có phải admin không (không trừ tiền)
            }
            add_result(result_data)
            
            # Cập nhật status trong queue
            update_task_status(task_id, result["status"])
            
            logger.info(f"[Worker {worker_id}] ✅ Hoàn thành task {task_id}: {result['status']}")
            
            # GỬI THÔNG BÁO TRỰC TIẾP CHO KHÁCH
            user_id_to_notify = task.get("user_id") or admin_id
            print(f"📨 [WORKER] Task {task_id}: user_id={task.get('user_id')}, admin_id={admin_id}, will notify={user_id_to_notify}")
            
            if user_id_to_notify:
                # Format message
                status_text = "THÀNH CÔNG" if result["status"] == "success" else ("BỎ QUA" if result["status"] == "skipped" else "THẤT BẠI")
                status_icon = "✅" if result["status"] == "success" else ("⏭️" if result["status"] == "skipped" else "❌")
                phone_used = result.get("phone_used", "")
                attempts = result.get("attempts", 0)
                
                notify_msg = f"📱 <b>KẾT QUẢ VERIFY PHONE</b>\n"
                notify_msg += f"─────────────────────\n\n"
                notify_msg += f"{status_icon} Task: <code>{task_id}</code>\n"
                notify_msg += f"📧 Email: <code>{email}</code>\n"
                notify_msg += f"📌 Status: <b>{status_text}</b>\n"
                if phone_used:
                    notify_msg += f"📱 SĐT: <code>{phone_used}</code>\n"
                notify_msg += f"🔄 Số lần thử: {attempts}\n"
                
                # Gửi ngay lập tức
                print(f"📨 [WORKER] Gọi send_telegram_notification với user_id={user_id_to_notify}")
                send_telegram_notification(user_id_to_notify, notify_msg)
            else:
                print(f"⚠️ [WORKER] Task {task_id} không có user_id để gửi thông báo!")
                logger.warning(f"[Worker {worker_id}] ⚠️ Task {task_id} không có user_id để gửi thông báo")
        
        else:
            # Không có task, đợi
            await asyncio.sleep(3)


async def run_workers(max_workers: int):
    """Chạy liên tục - kiểm tra queue và xử lý tasks song song"""
    config = load_config()
    if not config:
        logger.error("❌ Không thể load config!")
        return
    
    # Lấy provider đang active
    active_provider = get_active_sms_provider()
    
    # CODESIM: Giới hạn tối đa 4 luồng theo yêu cầu web mode của Codesim
    if active_provider.lower() == "codesim":
        max_workers = min(max_workers, 4)
        logger.info(f"📌 Codesim mode: Giới hạn {max_workers} luồng (theo yêu cầu API)")
    
    # Kiểm tra balance lúc khởi động - chỉ cảnh báo, không chặn
    try:
        test_client = create_sms_client()
        balance = test_client.get_balance()
        provider_name = active_provider.upper()
        if balance > 0:
            if provider_name == "SMSPOOL":
                logger.info(f"💰 Số dư {provider_name}: ${balance}")
                if balance < 0.5:
                    logger.warning("⚠️ Số dư thấp, cần nạp thêm tiền!")
            else:
                logger.info(f"💰 Số dư {provider_name}: {balance:,.0f} VND")
        else:
            logger.warning(f"⚠️ Không lấy được balance từ {provider_name} API - Tool vẫn tiếp tục chạy")
    except Exception as e:
        logger.warning(f"⚠️ Lỗi kiểm tra balance: {e} - Tool vẫn tiếp tục chạy")
    
    # Hủy tất cả task cũ từ lần chạy trước - chỉ xử lý task MỚI
    cleanup_old_tasks()
    
    # =========================================================================
    # BATCH PROCESSING - Mỗi task có SMS client riêng để tránh xung đột state
    # =========================================================================
    
    async def process_single_task(worker_id: int, task: Dict):
        """Xử lý 1 task - TẠO SMS CLIENT MỚI cho mỗi task"""
        task_id = task["id"]
        email = task["email"]
        password = task["password"]
        admin_id = task.get("admin_id")
        is_admin = task.get("is_admin", False)
        
        try:
            logger.info(f"[W{worker_id}] 🚀 BẮT ĐẦU: {email} ({'ADMIN' if is_admin else 'CUSTOMER'})")
            
            # TẠO SMS CLIENT MỚI cho mỗi task để tránh xung đột _current_otp_id
            # giữa các workers chạy song song (đặc biệt quan trọng với Codesim)
            sms_client = create_sms_client()
            logger.info(f"[W{worker_id}] 📱 Đã tạo SMS client mới cho task này")
            
            verifier = GoogleVerifier(sms_client, config, worker_id)
            task_country = task.get("country_code", "")
            
            # Gọi verify với is_admin để xác định logic retry
            result = await verifier.verify_account(
                email, password, 
                task_country_code=task_country,
                is_admin=is_admin
            )
            
            result_data = {
                "id": task_id,
                "email": email,
                "status": result["status"],
                "message": result["message"],
                "phone_used": result.get("phone_used", ""),
                "attempts": result.get("attempts", 0),
                "admin_id": admin_id,
                "user_id": task.get("user_id"),
                "is_admin": task.get("is_admin", False),
                "amount_to_charge": task.get("amount_to_charge", 0),
                "worker_id": worker_id,
                "proxy_used": result.get("proxy_used", ""),
                "suggest_change_country": result.get("suggest_change_country", False),
                "failed_country": result.get("failed_country", ""),
                "completed_at": datetime.now(VIETNAM_TZ).isoformat()
            }
            add_result(result_data)
            update_task_status(task_id, result["status"])
            
            logger.info(f"[W{worker_id}] ✅ HOÀN THÀNH: {task_id} → {result['status']}")
            
        except Exception as e:
            logger.error(f"[W{worker_id}] ❌ Lỗi: {e}")
            import traceback
            logger.error(traceback.format_exc())
            
            result_data = {
                "id": task_id,
                "email": email,
                "status": "failed",
                "message": f"Lỗi: {str(e)}",
                "admin_id": admin_id,
                "user_id": task.get("user_id"),
                "is_admin": task.get("is_admin", False),
                "amount_to_charge": 0,
                "worker_id": worker_id,
                "completed_at": datetime.now(VIETNAM_TZ).isoformat()
            }
            add_result(result_data)
            update_task_status(task_id, "failed")
    
    logger.info(f"🚀 Tool sẵn sàng - Max {max_workers} browser cùng lúc")
    
    # VÒNG LẶP CHÍNH - ĐƠN GIẢN
    while True:
        try:
            # CHECK STOP SIGNAL
            if check_stop_signal():
                logger.info("🛑 Tool đang dừng - chờ /startverify...")
                while check_stop_signal():
                    await asyncio.sleep(5)
                logger.info("✅ Tool đã được mở lại!")
                continue
            
            # Lấy các task pending
            queue = load_queue()
            pending_tasks = [t for t in queue if t.get("status") == "pending"]
            
            if pending_tasks:
                # Lấy tối đa max_workers task
                batch = pending_tasks[:max_workers]
                
                # Đánh dấu là processing
                for task in batch:
                    task["status"] = "processing"
                save_queue(queue)
                
                logger.info(f"📋 Tìm thấy {len(batch)} task(s) - Bắt đầu xử lý...")
                
                # Chạy song song
                worker_tasks = [
                    process_single_task(i, task) 
                    for i, task in enumerate(batch)
                ]
                
                await asyncio.gather(*worker_tasks)
                
                logger.info(f"✅ Hoàn thành {len(batch)} task(s)")
                
                # Garbage collection
                gc.collect()
            else:
                # Không có task, đợi
                await asyncio.sleep(3)
                
        except Exception as e:
            logger.error(f"❌ Lỗi: {e}")
            await asyncio.sleep(3)


# ==============================================================================
# MAIN
# ==============================================================================

async def test_api():
    """Test kết nối SMSPool API"""
    config = load_config()
    if not config:
        print("❌ Không thể load config!")
        return
    
    api_key = config.get("api_key")
    smspool = SMSPoolClient(api_key)
    
    print("🔍 Testing SMSPool API...")
    balance = smspool.get_balance()
    print(f"💰 Số dư: ${balance}")
    
    if balance > 0:
        print("✅ API key hoạt động!")
    else:
        print("⚠️ Không lấy được balance, kiểm tra lại API key")


def main():
    print("=" * 60)
    print("🔐 GOOGLE PHONE VERIFICATION TOOL v2")
    print("=" * 60)
    
    if len(sys.argv) > 1:
        if sys.argv[1] == "--test-api":
            asyncio.run(test_api())
            return
        elif sys.argv[1].isdigit():
            num_workers = min(int(sys.argv[1]), MAX_CONCURRENT_WORKERS)
        else:
            num_workers = 1
    else:
        # Mặc định chạy 5 worker cùng lúc (tối đa)
        num_workers = 5
    
    print(f"🚀 Đang chạy với {num_workers} worker(s)... (Ctrl+C để dừng)")
    print(f"📂 Queue file: {QUEUE_FILE}")
    print(f"📂 Results file: {RESULTS_FILE}")
    print(f"⚡ Max workers: {MAX_CONCURRENT_WORKERS}")
    
    # Khởi tạo AZCaptcha
    init_azcaptcha()
    print(f"🔐 AZCaptcha: ĐÃ KẾT NỐI (API Key: {AZCAPTCHA_API_KEY[:10]}...)")
    
    # Load proxy từ file
    load_proxies_from_file()
    if proxy_list:
        print(f"🌐 Proxy: Đã load {len(proxy_list)} proxy từ proxy.txt")
    else:
        print("⚠️ Proxy: Không có proxy - chạy IP thật")
    print("")
    
    try:
        asyncio.run(run_workers(num_workers))
    except KeyboardInterrupt:
        print("\n🛑 Đã dừng tool.")


if __name__ == "__main__":
    main()


