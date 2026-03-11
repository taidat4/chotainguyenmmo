"""
CLI Wrapper for Google Account Credit Check
Usage: python check_credit_cli.py [account_file] [output_file]

This script reads accounts from a file, checks credits via browser automation,
and writes results to output file for the Telegram bot to read.
"""
import os
import sys
import json
import time
import logging
import argparse
from datetime import datetime
from typing import List, Dict, Optional
from concurrent.futures import ProcessPoolExecutor, as_completed

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from config import (
    SMSPOOL_API_KEY, AZCAPTCHA_API_KEY,
    MAX_THREADS, THREAD_STARTUP_DELAY,
    OUTPUT_DIR
)
from clients.smspool_client import SMSPoolClient
from clients.captcha_client import AzCaptchaClient
from automation.browser import BrowserManager
from automation.google_login import GoogleLoginAutomation

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Result categories
RESULT_DIE = "Die"           # 0 credits
RESULT_LEN_ULTRA = "Lên Ultra"  # 100 credits (có thể nâng cấp)
RESULT_ULTRA = "Ultra"       # 45000 credits
RESULT_ERROR = "Error"       # Lỗi check
RESULT_WRONG_PASSWORD = "WrongPassword"  # Sai mật khẩu
RESULT_HAS_ULTRA = "HasUltra"  # Còn Ultra subscription - KHÔNG bảo hành


def check_single_account(email: str, password: str, headless: bool = True, window_index: int = 0) -> Dict:
    """
    Check credit cho 1 account
    
    Args:
        email: Email account
        password: Password
        headless: Headless mode
        window_index: Index to determine window position (0-4 for 5 windows tiled)
    
    Returns:
        Dict với keys: email, password, credits, status, message
    """
    import threading
    thread_id = threading.current_thread().name
    logger.info(f"[{thread_id}] 🚀 Starting check: {email} (window {window_index})")
    
    result = {
        "email": email,
        "password": password,
        "credits": 0,
        "status": RESULT_ERROR,
        "message": ""
    }
    
    browser = None
    try:
        # Calculate window position based on index
        # Screen layout: 5 windows in 2 rows (3 top, 2 bottom) or custom grid
        screen_width = 1920  # Assume 1920x1080 screen
        screen_height = 1080
        
        # 5 window grid: 3 columns, 2 rows
        cols = 3
        rows = 2
        win_width = screen_width // cols
        win_height = screen_height // rows
        
        col = window_index % cols
        row = window_index // cols
        x = col * win_width
        y = row * win_height
        
        position = (x, y, win_width, win_height)
        logger.info(f"[{thread_id}] 📱 Creating browser at position {position} for: {email}")
        
        # Initialize browser (Firefox standalone mode)
        browser = BrowserManager(use_standalone=True)
        driver = browser.create_browser(position=position, headless=headless)
        
        if not driver:
            result["message"] = "Không thể khởi động browser"
            logger.error(f"[{thread_id}] ❌ Failed to create browser for: {email}")
            return result

        
        # Initialize clients
        smspool = SMSPoolClient(SMSPOOL_API_KEY)
        captcha = AzCaptchaClient(AZCAPTCHA_API_KEY)
        
        # Initialize automation
        automation = GoogleLoginAutomation(
            driver=driver,
            smspool_client=smspool,
            captcha_client=captcha,
            phone_country="ID",
            phone_dial_code="+62"
        )
        
        # Try to login and check credits
        # login() returns (bool, str) where str is "CREDIT:number|label|ultra=true/false" or error message
        success, message = automation.login(email, password)
        
        # Parse credits and Ultra status from message format: "CREDIT:45000|Ultra|ultra=true"
        credits = 0
        has_ultra = False
        if success and message.startswith("CREDIT:"):
            try:
                # Format: CREDIT:45000|Ultra|ultra=true
                parts = message.replace("CREDIT:", "").split("|")
                credits = int(parts[0]) if parts else 0
                # Check for ultra=true in the message
                if len(parts) >= 3 and "ultra=true" in parts[2]:
                    has_ultra = True
            except:
                credits = 0
        
        result["credits"] = credits
        result["has_ultra"] = has_ultra
        result["message"] = message
        
        # CHECK PASSWORD ERRORS FIRST
        if not success and "Invalid password" in message:
            result["status"] = RESULT_WRONG_PASSWORD
            result["message"] = "Wrong password - please resend correct password"
            logger.warning(f"🔑 {email}: WRONG PASSWORD")
        # CHECK HAS ULTRA (not eligible for warranty even with 0 credits)
        elif has_ultra:
            result["status"] = RESULT_HAS_ULTRA
            logger.info(f"⚠️ {email}: HAS ULTRA SUBSCRIPTION ({credits} credits) - NOT ELIGIBLE")
        # Determine status based on credits
        elif credits is None or credits <= 0:
            result["status"] = RESULT_DIE
        elif credits >= 45000:
            result["status"] = RESULT_ULTRA
        elif credits >= 100:
            result["status"] = RESULT_LEN_ULTRA
        else:
            result["status"] = RESULT_DIE
            
        if result["status"] not in [RESULT_WRONG_PASSWORD, RESULT_HAS_ULTRA]:
            logger.info(f"✅ {email}: {result['status']} ({credits} credits)")

        
    except Exception as e:
        result["message"] = str(e)
        # Check if error contains password hint
        if "invalid password" in str(e).lower() or "password" in str(e).lower():
            result["status"] = RESULT_WRONG_PASSWORD
            result["message"] = "Wrong password - please resend correct password"
            logger.warning(f"🔑 {email}: WRONG PASSWORD (from exception)")
        else:
            logger.error(f"❌ {email}: Error - {e}")
    finally:
        if browser:
            try:
                browser.close()
            except:
                pass
    
    return result


def check_accounts_from_file(input_file: str, output_file: str, 
                              max_threads: int = 1, headless: bool = True) -> List[Dict]:
    """
    Check nhiều accounts từ file
    
    Args:
        input_file: File chứa accounts (format: email|password)
        output_file: File output JSON kết quả
        max_threads: Số thread chạy song song (default 1 để tránh lỗi)
        headless: Chạy ẩn browser
        
    Returns:
        List kết quả
    """
    results = []
    
    # Read accounts from input file
    if not os.path.exists(input_file):
        logger.error(f"File không tồn tại: {input_file}")
        return results
    
    accounts = []
    with open(input_file, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if '|' in line:
                parts = line.split('|', 1)
                if len(parts) == 2:
                    accounts.append({
                        "email": parts[0].strip(),
                        "password": parts[1].strip()
                    })
    
    if not accounts:
        logger.warning("Không tìm thấy account nào trong file")
        return results
    
    logger.info(f"📋 Tìm thấy {len(accounts)} accounts cần check")
    
    # Check accounts CONCURRENTLY with max 5 threads
    # Limit to 5 to prevent resource exhaustion
    actual_threads = min(max_threads, 5, len(accounts))
    logger.info(f"🚀 Chạy {actual_threads} browsers SONG SONG")
    
    # Add index to track original order
    indexed_results = [None] * len(accounts)
    
    with ProcessPoolExecutor(max_workers=actual_threads) as executor:
        # Submit ALL tasks at once - processes are fully isolated
        # Each task gets a window_index (0-4) for tiled layout
        future_to_index = {}
        for i, acc in enumerate(accounts):
            # Window index cycles 0-4 for 5 windows tiled
            window_idx = i % 5
            logger.info(f"📤 Submitting process [{i+1}/{len(accounts)}]: {acc['email']} -> window {window_idx}")
            future = executor.submit(check_single_account, acc['email'], acc['password'], headless, window_idx)
            future_to_index[future] = i
        
        logger.info(f"✅ All {len(accounts)} processes submitted, waiting for results...")
        
        # Collect results as they complete
        for future in as_completed(future_to_index):
            idx = future_to_index[future]
            try:
                result = future.result()
                indexed_results[idx] = result
                logger.info(f"✅ Hoàn thành [{idx + 1}/{len(accounts)}]: {result['email']} -> {result['status']}")
            except Exception as e:
                # Handle any exception from the future
                indexed_results[idx] = {
                    "email": accounts[idx]['email'],
                    "password": accounts[idx]['password'],
                    "credits": 0,
                    "status": RESULT_ERROR,
                    "message": str(e)
                }
                logger.error(f"❌ Lỗi thread [{idx + 1}]: {e}")
    
    # Filter out None values (should not happen, but safety)
    results = [r for r in indexed_results if r is not None]
    
    # Write results to output file
    try:
        output_data = {
            "timestamp": datetime.now().isoformat(),
            "total": len(results),
            "summary": {
                "ultra": sum(1 for r in results if r["status"] == RESULT_ULTRA),
                "len_ultra": sum(1 for r in results if r["status"] == RESULT_LEN_ULTRA),
                "die": sum(1 for r in results if r["status"] == RESULT_DIE),
                "error": sum(1 for r in results if r["status"] == RESULT_ERROR),
                "wrong_password": sum(1 for r in results if r["status"] == RESULT_WRONG_PASSWORD),
                "has_ultra": sum(1 for r in results if r["status"] == RESULT_HAS_ULTRA)
            },
            "results": results
        }
        
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(output_data, f, ensure_ascii=False, indent=2)
        
        logger.info(f"✅ Kết quả đã lưu vào: {output_file}")
        
    except Exception as e:
        logger.error(f"❌ Lỗi lưu file: {e}")
    
    return results


def main():
    parser = argparse.ArgumentParser(description='Check Google Account Credits')
    parser.add_argument('input_file', nargs='?', default='mail.txt',
                       help='File chứa accounts (format: email|password)')
    parser.add_argument('output_file', nargs='?', default='check_results.json',
                       help='File output JSON kết quả')
    parser.add_argument('--threads', '-t', type=int, default=5,
                       help='Số thread (default: 5, max: 5)')
    parser.add_argument('--visible', '-v', action='store_true',
                       help='Hiển thị browser (không headless)')
    
    args = parser.parse_args()
    
    logger.info("=" * 50)
    logger.info("🔐 Google Account Credit Checker - CLI")
    logger.info("=" * 50)
    logger.info(f"Input: {args.input_file}")
    logger.info(f"Output: {args.output_file}")
    logger.info(f"Headless: {not args.visible}")
    logger.info("=" * 50)
    
    results = check_accounts_from_file(
        input_file=args.input_file,
        output_file=args.output_file,
        max_threads=args.threads,
        headless=not args.visible
    )
    
    # Print summary (no emoji to avoid Windows encoding issues)
    print("\n" + "=" * 50)
    print("KET QUA:")
    print("=" * 50)
    
    ultra_count = sum(1 for r in results if r["status"] == RESULT_ULTRA)
    len_ultra_count = sum(1 for r in results if r["status"] == RESULT_LEN_ULTRA)
    die_count = sum(1 for r in results if r["status"] == RESULT_DIE)
    error_count = sum(1 for r in results if r["status"] == RESULT_ERROR)
    
    print(f"Ultra (45000 credits): {ultra_count}")
    print(f"Len Ultra (100 credits): {len_ultra_count}")
    print(f"Die (0 credits): {die_count}")
    print(f"Error: {error_count}")
    print("=" * 50)

    
    return 0 if error_count == 0 else 1


if __name__ == '__main__':
    sys.exit(main())
