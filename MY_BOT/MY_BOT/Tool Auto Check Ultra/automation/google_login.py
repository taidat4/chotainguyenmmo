"""
Google Login Automation with Credit Check
Flow: Login → Verify → Check Credits
"""
import time
import logging
import base64
import traceback
import re
from typing import Optional, Tuple
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.common.action_chains import ActionChains

from clients.smspool_client import SMSPoolClient
from clients.captcha_client import AzCaptchaClient

logger = logging.getLogger(__name__)

GOOGLE_LOGIN_URL = "https://labs.google/fx/tools/flow"
FLOW_URL_VI = "https://labs.google/fx/vi/tools/flow"


class GoogleLoginAutomation:
    """Google Login with phone verification and credit check"""
    
    def __init__(self, driver, smspool_client: SMSPoolClient, captcha_client: AzCaptchaClient, 
                 phone_country: str = "ID", phone_dial_code: str = "+62"):
        self.driver = driver
        self.smspool_client = smspool_client
        self.captcha_client = captcha_client
        self.current_order_id = None
        self.phone_country = phone_country
        self.phone_dial_code = phone_dial_code
        logger.info(f"GoogleLogin: country={phone_country}, dial={phone_dial_code}")
    
    def _wait_and_find(self, selectors: list, timeout: int = 10):
        """Find element"""
        for selector in selectors:
            try:
                by = By.XPATH if selector.startswith("//") else By.CSS_SELECTOR
                elem = WebDriverWait(self.driver, timeout).until(
                    EC.presence_of_element_located((by, selector))
                )
                if elem:
                    return elem
            except:
                continue
        return None
    
    def _find_quick(self, selectors: list):
        """Quick find"""
        for selector in selectors:
            try:
                by = By.XPATH if selector.startswith("//") else By.CSS_SELECTOR
                elem = self.driver.find_element(by, selector)
                if elem and elem.is_displayed():
                    return elem
            except:
                continue
        return None
    
    def _safe_click(self, element) -> bool:
        """Safe click with scroll"""
        if not element:
            return False
        try:
            self.driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", element)
            time.sleep(0.5)
            try:
                element.click()
                return True
            except:
                self.driver.execute_script("arguments[0].click();", element)
                return True
        except Exception as e:
            logger.warning(f"Click error: {e}")
            return False
    
    def _safe_fill(self, element, text: str) -> bool:
        """Safe fill"""
        if not element:
            return False
        try:
            self.driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", element)
            time.sleep(0.3)
            try:
                element.click()
            except:
                self.driver.execute_script("arguments[0].focus();", element)
            time.sleep(0.3)
            element.clear()
            time.sleep(0.2)
            element.send_keys(text)
            time.sleep(0.5)
            return True
        except Exception as e:
            logger.warning(f"Fill error: {e}")
            return False
    
    def _click_create_with_flow(self) -> bool:
        """Click 'Create with Flow' button - FIXED"""
        logger.info("Looking for 'Create with Flow' button...")
        
        # Method 1: Direct button/link click
        for selector in [
            "//button[contains(text(), 'Create with Flow')]",
            "//a[contains(text(), 'Create with Flow')]",
            "//span[contains(text(), 'Create with Flow')]",
            "//div[contains(text(), 'Create with Flow')]"
        ]:
            try:
                btn = self.driver.find_element(By.XPATH, selector)
                if btn and btn.is_displayed():
                    self._safe_click(btn)
                    logger.info(f"Clicked via selector: {selector}")
                    return True
            except:
                continue
        
        # Method 2: JavaScript click all matching elements
        try:
            result = self.driver.execute_script("""
                // Try multiple approaches
                const searchTexts = ['Create with Flow', 'Tạo với Flow'];
                
                for (const searchText of searchTexts) {
                    // Method A: Find by exact text
                    const elements = document.querySelectorAll('button, a, span, div, p');
                    for (const el of elements) {
                        const text = el.innerText || el.textContent || '';
                        if (text.trim() === searchText || text.includes(searchText)) {
                            console.log('Found element:', el.tagName, text.substring(0, 50));
                            el.click();
                            return 'clicked_' + el.tagName;
                        }
                    }
                }
                
                // Method B: Find clickable ancestor
                const allText = document.body.innerText;
                if (allText.includes('Create with Flow')) {
                    const walker = document.createTreeWalker(
                        document.body,
                        NodeFilter.SHOW_TEXT,
                        null,
                        false
                    );
                    while (walker.nextNode()) {
                        if (walker.currentNode.textContent.includes('Create with Flow')) {
                            let el = walker.currentNode.parentElement;
                            for (let i = 0; i < 5 && el; i++) {
                                if (el.tagName === 'BUTTON' || el.tagName === 'A' || 
                                    el.onclick || el.getAttribute('role') === 'button') {
                                    el.click();
                                    return 'clicked_ancestor_' + el.tagName;
                                }
                                el = el.parentElement;
                            }
                        }
                    }
                }
                
                return 'not_found';
            """)
            logger.info(f"JS click result: {result}")
            if result and result.startswith('clicked'):
                return True
        except Exception as e:
            logger.error(f"JS click error: {e}")
        
        # Method 3: Click by coordinates (center of visible button)
        try:
            result = self.driver.execute_script("""
                const elements = document.querySelectorAll('*');
                for (const el of elements) {
                    const text = (el.innerText || '').trim();
                    if (text === 'Create with Flow') {
                        const rect = el.getBoundingClientRect();
                        if (rect.width > 0 && rect.height > 0) {
                            const event = new MouseEvent('click', {
                                bubbles: true,
                                cancelable: true,
                                view: window,
                                clientX: rect.x + rect.width / 2,
                                clientY: rect.y + rect.height / 2
                            });
                            el.dispatchEvent(event);
                            return 'dispatched';
                        }
                    }
                }
                return 'not_found';
            """)
            if result == 'dispatched':
                logger.info("Clicked via dispatchEvent")
                return True
        except:
            pass
        
        logger.warning("Could not find 'Create with Flow' button")
        return False
    
    def _handle_chrome_profile_dialog(self):
        """Handle Chrome profile login dialog - MUST click blue button 'Tiếp tục bằng tài khoản'"""
        try:
            # Always try to click, don't check page source first
            logger.info("Checking for Chrome profile dialog...")
            
            # Click "Tiếp tục bằng tài khoản" (blue button) - AGGRESSIVE APPROACH
            result = self.driver.execute_script("""
                // Method 1: Find button with blue background or specific text
                const allButtons = document.querySelectorAll('button');
                for (const btn of allButtons) {
                    const text = (btn.innerText || btn.textContent || '').trim();
                    const style = window.getComputedStyle(btn);
                    const bgColor = style.backgroundColor;
                    
                    // Check for blue button (RGB values for blue)
                    const isBlue = bgColor.includes('66, 133, 244') || 
                                   bgColor.includes('26, 115, 232') ||
                                   bgColor.includes('rgb(66') ||
                                   bgColor.includes('rgb(26');
                    
                    // Check for text containing "Tiếp tục bằng tài khoản" or similar
                    if (text.includes('Tiếp tục bằng tài khoản') || 
                        text.includes('Continue with') ||
                        text.includes('Tiếp tục') && text.includes('profile')) {
                        console.log('Found continue button:', text);
                        btn.click();
                        return 'clicked_text_match';
                    }
                    
                    // If blue button and not "Dùng Chrome mà không cần"
                    if (isBlue && !text.includes('Dùng Chrome') && !text.includes('without')) {
                        console.log('Found blue button:', text);
                        btn.click();
                        return 'clicked_blue';
                    }
                }
                
                // Method 2: Find first button that's not the "skip" button
                for (const btn of allButtons) {
                    const text = (btn.innerText || btn.textContent || '').trim().toLowerCase();
                    if (!text.includes('dùng chrome mà không') && 
                        !text.includes('without') &&
                        !text.includes('skip') &&
                        text.length > 0) {
                        const rect = btn.getBoundingClientRect();
                        // Check if button is visible and has reasonable size
                        if (rect.width > 100 && rect.height > 30) {
                            console.log('Clicking first valid button:', text);
                            btn.click();
                            return 'clicked_first_valid';
                        }
                    }
                }
                
                return 'not_found';
            """)
            
            if result and result.startswith('clicked'):
                logger.info(f"Chrome profile dialog handled: {result}")
                time.sleep(3)
            
        except Exception as e:
            logger.warning(f"Chrome profile dialog error: {e}")
    
    def _logout_existing_account(self):
        """Logout the currently logged in Google account"""
        try:
            logger.info("Logging out existing Google account...")
            
            # Method 1: Go to Google accounts signout page
            self.driver.get("https://accounts.google.com/Logout")
            time.sleep(3)
            
            # Method 2: Also clear cookies for google.com
            try:
                self.driver.delete_all_cookies()
                logger.info("Deleted all cookies")
            except:
                pass
            
            # Method 3: Navigate to accounts page and click signout
            try:
                self.driver.get("https://myaccount.google.com")
                time.sleep(2)
                
                # Click on avatar/profile menu
                avatar = self.driver.execute_script("""
                    const imgs = document.querySelectorAll('img');
                    for (const img of imgs) {
                        if (img.src && img.src.includes('googleusercontent')) {
                            img.click();
                            return true;
                        }
                    }
                    return false;
                """)
                
                if avatar:
                    time.sleep(1)
                    # Click "Sign out" or "Đăng xuất"
                    self.driver.execute_script("""
                        const elements = document.querySelectorAll('*');
                        for (const el of elements) {
                            const text = (el.innerText || '').trim().toLowerCase();
                            if (text === 'đăng xuất' || text === 'sign out' || text === 'sign out of all accounts') {
                                el.click();
                                return true;
                            }
                        }
                        return false;
                    """)
                    time.sleep(2)
            except:
                pass
            
            logger.info("Logout completed")
            
        except Exception as e:
            logger.warning(f"Logout error: {e}")
    
    def login(self, email: str, password: str, callback=None) -> Tuple[bool, str]:
        """Simple login flow: Open URL -> Enter email/password -> Check credits"""
        try:
            # ========== STEP 1: OPEN LOGIN PAGE ==========
            if callback:
                callback("Opening login page...")
            
            self.driver.get(GOOGLE_LOGIN_URL)
            time.sleep(3)
            
            # Click "Create with Flow" if on labs page
            if "labs.google" in self.driver.current_url:
                self._click_create_with_flow()
                time.sleep(3)
            
            # ========== STEP 2: FIND EMAIL INPUT ==========
            if callback:
                callback("Entering email...")
            
            email_input = self._wait_and_find([
                'input[type="email"]',
                '#identifierId'
            ], timeout=10)
            
            # If no email input, maybe there's existing account - click "Use another"
            if not email_input:
                page = self.driver.page_source.lower()
                if "chọn tài khoản" in page or "choose an account" in page:
                    try:
                        use_another = self.driver.find_element(
                            By.XPATH, 
                            "//*[contains(text(), 'Sử dụng một tài khoản khác') or contains(text(), 'Use another account')]"
                        )
                        use_another.click()
                        time.sleep(2)
                        email_input = self._wait_and_find(['input[type="email"]'], timeout=10)
                    except:
                        pass
            
            if not email_input:
                return False, "Cannot find email field"
            
            # Enter email
            self._safe_fill(email_input, email)
            time.sleep(1)
            
            # Click Next
            next_btn = self._find_quick(['#identifierNext', 'button[jsname="LgbsSe"]'])
            if next_btn:
                self._safe_click(next_btn)
            else:
                email_input.send_keys(Keys.RETURN)
            
            time.sleep(4)
            
            # Check account status
            if self._is_account_deleted():
                return False, "Account Deleted"
            
            # ========== STEP 3: HANDLE CAPTCHA ==========
            for _ in range(3):
                if self._has_captcha():
                    if callback:
                        callback("Solving captcha...")
                    self._solve_captcha()
                    time.sleep(3)
                if self._find_quick(['input[type="password"]']):
                    break
                time.sleep(1)
            
            # ========== STEP 4: ENTER PASSWORD ==========
            if callback:
                callback("Entering password...")
            
            password_input = self._wait_and_find(['input[type="password"]'], timeout=10)
            
            if not password_input:
                return False, "Cannot find password field"
            
            self._safe_fill(password_input, password)
            time.sleep(1)
            
            pass_btn = self._find_quick(['#passwordNext', 'button[jsname="LgbsSe"]'])
            if pass_btn:
                self._safe_click(pass_btn)
            else:
                password_input.send_keys(Keys.RETURN)
            
            time.sleep(4)
            
            # Check errors
            if self._is_account_deleted():
                return False, "Account Deleted"
            if self._has_login_error():
                return False, "Invalid password"
            
            # ========== STEP 5: PHONE VERIFICATION (if needed) ==========
            time.sleep(2)
            
            if self._needs_phone_verification():
                if callback:
                    callback(f"Phone verification - {self.phone_country}...")
                success, msg = self._do_phone_verification(callback)
                if not success:
                    return False, msg
                time.sleep(2)
            
            # ========== STEP 6: CHECK CREDITS ==========
            if callback:
                callback("Checking credits...")
            
            return self._check_credits()
            
        except Exception as e:
            logger.error(f"Login error: {traceback.format_exc()}")
            return False, f"Error: {str(e)}"
    
    def _check_credits(self) -> Tuple[bool, str]:
        """
        Handle onboarding dialogs and check credits via API.
        Flow:
        1. Dialog 1: Tick 2 checkboxes → Click "Tiếp theo"
        2. Dialog 2: Scroll down → Click "Tiếp tục" 
        3. Call API to get credits
        
        Returns: (success, "CREDIT:number|label") format for exact credit display
        """
        try:
            logger.info("=== CHECKING CREDITS ===")
            time.sleep(3)
            
            # ========== DIALOG 1: CHECKBOX DIALOG ==========
            # "Trải nghiệm và định hình các công cụ AI"
            self._handle_checkbox_dialog()
            
            # ========== DIALOG 2: PRIVACY POLICY ==========
            # "Xem chính sách quyền riêng tư" - need to scroll then click
            self._handle_privacy_dialog()
            
            # ========== DIALOG 3: FLOW UPDATE POPUP ==========
            # After privacy dialog, "Flow Update" popup appears - need to click "Bắt đầu"
            self._handle_flow_update_dialog()
            
            # ========== GET CREDITS VIA API ==========
            time.sleep(2)
            credit_data = self._get_credits_via_api()
            credits = credit_data.get("credits", 0)
            has_ultra = credit_data.get("has_ultra", False)
            tier = credit_data.get("tier", "")
            sku = credit_data.get("sku", "")
            
            logger.info(f"Credit check result: credits={credits}, has_ultra={has_ultra}, tier={tier}, sku={sku}")
            
            # ========== RETURN FORMAT: CREDIT:number|label|has_ultra ==========
            # IMPORTANT: Accounts with has_ultra=True should NOT be eligible for warranty
            # even if they have 0 credits (they still have Ultra subscription benefits)
            
            if has_ultra:
                # Has Ultra subscription - NOT eligible for warranty regardless of credits
                logger.info(f"Account has Ultra subscription! Credits: {credits}")
                return True, f"CREDIT:{credits}|HasUltra|ultra=true"
            elif credits >= 150:
                logger.info(f"High credits (no Ultra): {credits}")
                return True, f"CREDIT:{credits}|Lên Ultra|ultra=false"
            elif credits >= 50:
                logger.info(f"Can upgrade to Ultra! Credits: {credits}")
                return True, f"CREDIT:{credits}|Lên Ultra|ultra=false"
            elif credits > 0:
                logger.info(f"Low credits (eligible for warranty): {credits}")
                return True, f"CREDIT:{credits}|Low|ultra=false"
            else:
                logger.warning(f"No credits found! Credits={credits}")
                return True, f"CREDIT:0|Die|ultra=false"
            
        except Exception as e:
            logger.error(f"Credit check error: {e}")
            return True, "CREDIT:-1|Error|ultra=unknown"
    
    def _handle_checkbox_dialog(self):
        """
        Dialog 1: "Trải nghiệm và định hình các công cụ AI"
        - Tick 2 checkboxes
        - Click "Tiếp theo"
        """
        try:
            page = self.driver.page_source.lower()
            
            # Check if dialog is present
            if "trải nghiệm" not in page and "tôi muốn nhận" not in page:
                logger.info("Checkbox dialog not found, skipping")
                return
            
            logger.info("Found checkbox dialog - handling...")
            time.sleep(1)
            
            # Method 1: Click checkboxes directly via JavaScript
            self.driver.execute_script("""
                // Find and click all checkboxes with matching text
                const labels = ['Tôi muốn nhận email tiếp thị', 'Tôi muốn nhận lời mời tham gia nghiên cứu'];
                
                // Click all role=checkbox elements
                document.querySelectorAll('[role="checkbox"]').forEach(cb => {
                    if (cb.getAttribute('aria-checked') !== 'true') {
                        cb.click();
                    }
                });
                
                // Also try clicking labels/containers that contain checkbox text
                labels.forEach(labelText => {
                    document.querySelectorAll('*').forEach(el => {
                        const text = (el.innerText || '').trim();
                        if (text.includes(labelText) && text.length < 100) {
                            // Click the element and parents
                            let target = el;
                            for (let i = 0; i < 3 && target; i++) {
                                try { target.click(); } catch(e) {}
                                target = target.parentElement;
                            }
                        }
                    });
                });
            """)
            time.sleep(1)
            
            # Method 2: Use Tab+Space for custom checkboxes
            from selenium.webdriver.common.action_chains import ActionChains
            body = self.driver.find_element(By.TAG_NAME, "body")
            for i in range(8):
                body.send_keys(Keys.TAB)
                time.sleep(0.2)
                try:
                    focused = self.driver.switch_to.active_element
                    if focused:
                        role = focused.get_attribute('role')
                        if role == 'checkbox':
                            focused.send_keys(Keys.SPACE)
                            time.sleep(0.2)
                except:
                    pass
            
            time.sleep(1)
            
            # Click "Tiếp theo" button
            clicked = self.driver.execute_script("""
                const buttons = document.querySelectorAll('button, [role="button"]');
                for (const btn of buttons) {
                    const text = (btn.innerText || '').trim();
                    if (text === 'Tiếp theo' || text === 'Next') {
                        btn.click();
                        return true;
                    }
                }
                return false;
            """)
            
            if clicked:
                logger.info("Clicked 'Tiếp theo' button")
                time.sleep(2)
            else:
                # Try pressing Enter as fallback
                body.send_keys(Keys.RETURN)
                time.sleep(2)
                
        except Exception as e:
            logger.warning(f"Error handling checkbox dialog: {e}")
    
    def _handle_privacy_dialog(self):
        """
        Dialog 2: "Xem chính sách quyền riêng tư của chúng tôi"
        - Scroll down to enable button
        - Click "Tiếp tục"
        """
        try:
            page = self.driver.page_source.lower()
            
            # Check if privacy dialog is present
            if "chính sách quyền riêng tư" not in page and "privacy policy" not in page:
                logger.info("Privacy dialog not found, skipping")
                return
            
            logger.info("Found privacy dialog - scrolling and clicking...")
            time.sleep(1)
            
            # Scroll the dialog content to bottom to enable button
            self.driver.execute_script("""
                // Find the scrollable container inside dialog
                const dialogs = document.querySelectorAll('[role="dialog"], .modal, [aria-modal="true"]');
                dialogs.forEach(dialog => {
                    // Find scrollable children
                    dialog.querySelectorAll('*').forEach(el => {
                        if (el.scrollHeight > el.clientHeight) {
                            el.scrollTop = el.scrollHeight;
                        }
                    });
                });
                
                // Also try scrolling any element that looks like content container
                document.querySelectorAll('div').forEach(el => {
                    if (el.scrollHeight > el.clientHeight + 50 && el.scrollHeight < 1000) {
                        el.scrollTop = el.scrollHeight;
                    }
                });
            """)
            time.sleep(1)
            
            # Click "Tiếp tục" button
            for attempt in range(3):
                clicked = self.driver.execute_script("""
                    const buttons = document.querySelectorAll('button, [role="button"]');
                    for (const btn of buttons) {
                        const text = (btn.innerText || '').trim();
                        if (text === 'Tiếp tục' || text === 'Continue') {
                            if (!btn.disabled) {
                                btn.click();
                                return true;
                            }
                        }
                    }
                    return false;
                """)
                
                if clicked:
                    logger.info("Clicked 'Tiếp tục' button")
                    time.sleep(2)
                    return
                
                # Scroll more if button still disabled
                self.driver.execute_script("""
                    document.querySelectorAll('div').forEach(el => {
                        if (el.scrollHeight > el.clientHeight) {
                            el.scrollTop = el.scrollHeight;
                        }
                    });
                """)
                time.sleep(1)
                
        except Exception as e:
            logger.warning(f"Error handling privacy dialog: {e}")
    
    def _handle_flow_update_dialog(self):
        """
        Dialog 3: "Flow Update" popup
        - Click "Bắt đầu" (Start) button to proceed
        """
        try:
            time.sleep(2)
            page = self.driver.page_source.lower()
            
            # Check if Flow Update dialog is present
            if "update" not in page and "bắt đầu" not in page:
                logger.info("Flow Update dialog not found, skipping")
                return
            
            logger.info("Found Flow Update dialog - clicking 'Bắt đầu'...")
            
            # Click "Bắt đầu" button
            clicked = self.driver.execute_script("""
                const buttons = document.querySelectorAll('button, [role="button"]');
                for (const btn of buttons) {
                    const text = (btn.innerText || '').trim();
                    if (text === 'Bắt đầu' || text === 'Start' || text === 'Get started') {
                        btn.click();
                        return true;
                    }
                }
                return false;
            """)
            
            if clicked:
                logger.info("Clicked 'Bắt đầu' button successfully")
                time.sleep(2)
            else:
                # Fallback: Try pressing Enter or Escape
                try:
                    from selenium.webdriver.common.keys import Keys
                    body = self.driver.find_element(By.TAG_NAME, "body")
                    body.send_keys(Keys.ESCAPE)
                    time.sleep(1)
                except:
                    pass
                    
        except Exception as e:
            logger.warning(f"Error handling Flow Update dialog: {e}")
    
    def _get_credits_via_api(self) -> dict:
        """
        Get credits AND Ultra status via API.
        Returns dict: {"credits": int, "has_ultra": bool, "tier": str, "sku": str}
        
        Ultra detection:
        - has_ultra = True if sku == "WS_ULTRA" or tier != "PAYGATE_TIER_NOT_PAID"
        - Accounts with 0 credits but still has Ultra badge should NOT be eligible for warranty
        """
        import re
        
        result = {"credits": 0, "has_ultra": False, "tier": "", "sku": ""}
        
        # PRIORITY 1: Try API call first - most accurate for Ultra detection
        try:
            api_data = self.driver.execute_async_script("""
                var callback = arguments[arguments.length - 1];
                fetch('https://aisandbox-pa.googleapis.com/v1/credits?key=AIzaSyBtrm0o5ab1c-Ec8ZuLcGt3oIAA5VWt3pY', {
                    credentials: 'include'
                })
                .then(r => r.json())
                .then(data => callback(JSON.stringify(data)))
                .catch(() => callback('{}'));
            """)
            
            if api_data:
                import json as json_lib
                data = json_lib.loads(api_data)
                result["credits"] = data.get("credits", 0)
                result["tier"] = data.get("userPaygateTier", "")
                result["sku"] = data.get("sku", "")
                
                # Check Ultra status
                # Has Ultra if: sku == "WS_ULTRA" OR tier != "PAYGATE_TIER_NOT_PAID"
                has_ultra = (
                    result["sku"] == "WS_ULTRA" or 
                    (result["tier"] and result["tier"] != "PAYGATE_TIER_NOT_PAID")
                )
                result["has_ultra"] = has_ultra
                
                logger.info(f"API result: credits={result['credits']}, has_ultra={has_ultra}, tier={result['tier']}, sku={result['sku']}")
                
                if result["credits"] > 0 or result["tier"]:
                    return result
                
        except Exception as e:
            logger.warning(f"API credits fetch failed: {e}")
        
        # PRIORITY 2: Click avatar to read credits AND check for Ultra badge
        try:
            logger.info("Clicking avatar to get exact credits...")
            avatar_clicked = self._click_avatar()
            if avatar_clicked:
                time.sleep(2)
                
                page_text = self.driver.execute_script("return document.body.innerText") or ""
                
                # Check for Ultra badge in page
                has_ultra_badge = self._has_ultra_badge()
                if has_ultra_badge:
                    result["has_ultra"] = True
                    logger.info("Detected Ultra badge on page")
                
                # Vietnamese format: "42330 Tín dụng AI"
                match = re.search(r'(\d+)\s*Tín\s*dụng', page_text, re.IGNORECASE)
                if match:
                    result["credits"] = int(match.group(1))
                    logger.info(f"Got credits from avatar popup: {result['credits']}, has_ultra={result['has_ultra']}")
                    return result
                
                # English format: "42330 AI credits"
                match = re.search(r'(\d+)\s*AI\s*(credits|credit)', page_text, re.IGNORECASE)
                if match:
                    result["credits"] = int(match.group(1))
                    logger.info(f"Got credits (EN) from avatar popup: {result['credits']}, has_ultra={result['has_ultra']}")
                    return result
                    
        except Exception as e:
            logger.warning(f"Avatar popup reading failed: {e}")
        
        # PRIORITY 3: Check page text for credit number
        try:
            page_text = self.driver.execute_script("return document.body.innerText") or ""
            
            # Check for Ultra badge
            has_ultra_badge = self._has_ultra_badge()
            if has_ultra_badge:
                result["has_ultra"] = True
            
            # Vietnamese format
            match = re.search(r'(\d+)\s*Tín\s*dụng', page_text, re.IGNORECASE)
            if match:
                result["credits"] = int(match.group(1))
                logger.info(f"Found credits from page text: {result['credits']}")
                return result
            
            # English format
            match = re.search(r'(\d+)\s*(AI\s*)?(credits|credit)', page_text, re.IGNORECASE)
            if match:
                result["credits"] = int(match.group(1))
                logger.info(f"Found credits (EN) from page text: {result['credits']}")
                return result
                
        except Exception as e:
            logger.warning(f"Page text check failed: {e}")
        
        logger.warning("All credit detection methods failed, returning default result")
        return result
    
    def _click_toi_hieu(self):
        """Click 'Tôi hiểu' button if present (Google consent dialog)"""
        try:
            page = self.driver.page_source.lower()
            
            # Check if we're on speedbump page or have "Tôi hiểu" button
            if "speedbump" in self.driver.current_url or "tôi hiểu" in page:
                logger.info("Found 'Tôi hiểu' consent dialog")
                
                # Try multiple methods to click
                clicked = self.driver.execute_script("""
                    const buttons = document.querySelectorAll('button, [role="button"], span, div');
                    for (const btn of buttons) {
                        const text = (btn.innerText || '').trim();
                        if (text === 'Tôi hiểu' || text === 'I understand' || text === 'Got it') {
                            btn.click();
                            return true;
                        }
                    }
                    return false;
                """)
                
                if clicked:
                    logger.info("Clicked 'Tôi hiểu' button")
                    time.sleep(2)
                else:
                    # Fallback: Try Selenium click
                    try:
                        from selenium.webdriver.common.by import By
                        btn = self.driver.find_element(By.XPATH, "//*[text()='Tôi hiểu']")
                        btn.click()
                        logger.info("Clicked 'Tôi hiểu' via Selenium")
                        time.sleep(2)
                    except:
                        pass
                        
        except Exception as e:
            logger.warning(f"Click 'Tôi hiểu' error: {e}")
    
    def _read_credits_from_page(self) -> int:
        """Read credits from visible page content (no popup required)"""
        try:
            result = self.driver.execute_script("""
                const text = document.body.innerText;
                // Look for Vietnamese pattern: "45000 Tín dụng AI"
                let match = text.match(/(\\d+(?:[\\.,]\\d+)?)\\s*(?:Tín dụng|Tín\\s+dụng\\s+AI|credits?)/i);
                if (match) {
                    return match[1].replace(',', '').replace('.', '');
                }
                return null;
            """)
            if result:
                return int(result)
            return 0
        except:
            return 0
    
    def _handle_onboarding_dialogs(self):
        """Handle Google Labs onboarding dialogs using keyboard navigation (Tab + Space)"""
        from selenium.webdriver.common.by import By
        from selenium.webdriver.common.keys import Keys
        from selenium.webdriver.common.action_chains import ActionChains
        
        try:
            for attempt in range(10):
                time.sleep(2)
                page = self.driver.page_source
                page_lower = page.lower()
                
                # ========== DIALOG 1: "Trải nghiệm và định hình" ==========
                if "trải nghiệm" in page_lower or "tôi muốn nhận" in page_lower or "email tiếp thị" in page_lower:
                    logger.info(f"[Attempt {attempt+1}] Found onboarding dialog 1")
                    
                    # METHOD: Use Tab to navigate to checkboxes, Space to toggle
                    # This works for custom Material checkboxes
                    
                    body = self.driver.find_element(By.TAG_NAME, "body")
                    
                    # Tab through the dialog to find and check checkboxes
                    # Usually: Tab to first checkbox -> Space to check -> Tab to second -> Space -> Tab to button -> Enter
                    for i in range(10):
                        body.send_keys(Keys.TAB)
                        time.sleep(0.2)
                        
                        # Check if we're on a checkbox (has checkbox role or label text)
                        try:
                            focused = self.driver.switch_to.active_element
                            if focused:
                                role = focused.get_attribute('role')
                                text = (focused.text or focused.get_attribute('aria-label') or '').lower()
                                
                                # If it looks like a checkbox, press Space
                                if role == 'checkbox' or 'tôi muốn' in text:
                                    focused.send_keys(Keys.SPACE)
                                    logger.info(f"Pressed SPACE on element: role={role}, text={text[:30] if text else 'none'}")
                                    time.sleep(0.3)
                        except:
                            pass
                    
                    time.sleep(1)
                    
                    # Also try JavaScript click as backup
                    self.driver.execute_script("""
                        // Find and click checkboxes
                        const labels = ['Tôi muốn nhận email tiếp thị', 'Tôi muốn nhận lời mời tham gia'];
                        
                        labels.forEach(labelText => {
                            // Find all elements and click those containing our text
                            document.querySelectorAll('*').forEach(el => {
                                const text = el.innerText || '';
                                if (text.includes(labelText) && text.length < 100) {
                                    // Click this element and all its parents up to 5 levels
                                    let target = el;
                                    for (let i = 0; i < 5 && target; i++) {
                                        try { target.click(); } catch(e) {}
                                        target = target.parentElement;
                                    }
                                }
                            });
                        });
                        
                        // Click any role=checkbox
                        document.querySelectorAll('[role="checkbox"]').forEach(cb => {
                            try { cb.click(); } catch(e) {}
                        });
                    """)
                    
                    time.sleep(1)
                    
                    # Click "Tiếp theo" button
                    try:
                        # Try finding by exact text
                        buttons = self.driver.find_elements(By.XPATH, "//button | //*[@role='button'] | //span | //div")
                        for btn in buttons:
                            if btn.text and btn.text.strip() == "Tiếp theo":
                                btn.click()
                                logger.info("Clicked 'Tiếp theo' button")
                                break
                    except:
                        pass
                    
                    # JS fallback for button
                    self.driver.execute_script("""
                        document.querySelectorAll('*').forEach(el => {
                            if (el.innerText && el.innerText.trim() === 'Tiếp theo') {
                                el.click();
                            }
                        });
                    """)
                    
                    time.sleep(3)
                    continue
                
                # ========== DIALOG 2: Privacy Policy ==========
                if "chính sách quyền" in page_lower or "quyền riêng tư" in page_lower:
                    logger.info(f"[Attempt {attempt+1}] Found privacy policy - scrolling")
                    
                    # Scroll
                    self.driver.execute_script("""
                        document.querySelectorAll('*').forEach(el => {
                            if (el.scrollHeight > el.clientHeight + 20) {
                                el.scrollTop = el.scrollHeight;
                            }
                        });
                    """)
                    time.sleep(2)
                    
                    # Click "Tiếp tục"
                    self.driver.execute_script("""
                        document.querySelectorAll('*').forEach(el => {
                            if (el.innerText && el.innerText.trim() === 'Tiếp tục') {
                                el.click();
                            }
                        });
                    """)
                    time.sleep(3)
                    continue
                
                # Check done
                if "nano banana" in page_lower or "new project" in page_lower or "dự án mới" in page_lower:
                    logger.info("Onboarding complete")
                    break
                    
        except Exception as e:
            logger.warning(f"Onboarding error: {e}")
    
    
    def _click_button_by_text(self, texts: list) -> bool:
        """Click button by text content"""
        try:
            for text in texts:
                result = self.driver.execute_script(f"""
                    const buttons = document.querySelectorAll('button, a, span, div');
                    for (const btn of buttons) {{
                        const btnText = (btn.innerText || btn.textContent || '').trim();
                        if (btnText === '{text}' || btnText.includes('{text}')) {{
                            btn.click();
                            return true;
                        }}
                    }}
                    return false;
                """)
                if result:
                    logger.info(f"Clicked button: {text}")
                    return True
            return False
        except:
            return False
    
    def _click_avatar(self) -> bool:
        """Click on user avatar in top right"""
        try:
            # Try multiple selectors for avatar
            avatar_selectors = [
                "img[alt*='Avatar']",
                "img[alt*='avatar']",
                "[data-email]",
                ".gb_d",
                "//button[contains(@aria-label, 'Account')]",
                "//button[contains(@aria-label, 'Tài khoản')]",
                "//img[contains(@src, 'googleusercontent')]"
            ]
            
            avatar = self._find_quick(avatar_selectors)
            if avatar:
                self._safe_click(avatar)
                logger.info("Clicked avatar")
                return True
            
            # JS fallback - click avatar in top right
            result = self.driver.execute_script("""
                // Find avatar/account button
                const imgs = document.querySelectorAll('img');
                for (const img of imgs) {
                    const src = img.src || '';
                    const alt = img.alt || '';
                    if (src.includes('googleusercontent') || alt.toLowerCase().includes('avatar')) {
                        img.click();
                        return 'clicked_img';
                    }
                }
                
                // Find account button
                const buttons = document.querySelectorAll('button');
                for (const btn of buttons) {
                    const label = btn.getAttribute('aria-label') || '';
                    if (label.includes('Account') || label.includes('Tài khoản')) {
                        btn.click();
                        return 'clicked_btn';
                    }
                }
                
                // Click any circular image in top right
                const allImgs = document.querySelectorAll('img');
                for (const img of allImgs) {
                    const rect = img.getBoundingClientRect();
                    if (rect.right > window.innerWidth - 200 && rect.top < 100) {
                        if (rect.width > 20 && rect.width < 60) {
                            img.click();
                            return 'clicked_topright';
                        }
                    }
                }
                
                return 'not_found';
            """)
            
            if result and result.startswith('clicked'):
                logger.info(f"Avatar clicked via JS: {result}")
                return True
            
            return False
        except Exception as e:
            logger.error(f"Avatar click error: {e}")
            return False
    
    def _read_credits(self) -> int:
        """Read credits from popup menu - SIMPLIFIED VERSION"""
        try:
            # Direct JS approach - find the credit text in popup
            result = self.driver.execute_script("""
                // Get all text on page
                const bodyText = document.body.innerText;
                console.log('Page text for credits:', bodyText.substring(0, 500));
                
                // Pattern 1: "45000 Tín dụng AI" or "180 Tín dụng AI"
                let match = bodyText.match(/(\\d+)\\s*Tín\\s*dụng/i);
                if (match) {
                    console.log('Found credits:', match[1]);
                    return parseInt(match[1]);
                }
                
                // Pattern 2: Look for specific credit elements
                const allElements = document.querySelectorAll('*');
                for (const el of allElements) {
                    const text = (el.innerText || '').trim();
                    // Match "45000 Tín dụng AI" or "180 Tín dụng AI"
                    const creditMatch = text.match(/^(\\d+)\\s*Tín\\s*dụng/i);
                    if (creditMatch) {
                        console.log('Found element with credits:', text);
                        return parseInt(creditMatch[1]);
                    }
                }
                
                // Pattern 3: Look in popup/dialog context
                const popups = document.querySelectorAll('[role="dialog"], [role="menu"], .popup, .modal');
                for (const popup of popups) {
                    const text = popup.innerText || '';
                    const creditMatch = text.match(/(\\d+)\\s*Tín\\s*dụng/i);
                    if (creditMatch) {
                        console.log('Found credits in popup:', creditMatch[1]);
                        return parseInt(creditMatch[1]);
                    }
                }
                
                return -1;
            """)
            
            if result and result > 0:
                logger.info(f"Credits found via JS: {result}")
                return result
            
            # Fallback: Python regex on page source
            page = self.driver.page_source
            
            # Simple pattern for Vietnamese credits
            import re
            match = re.search(r'(\d+)\s*Tín\s*dụng', page)
            if match:
                credits = int(match.group(1))
                logger.info(f"Credits found via Python regex: {credits}")
                return credits
            
            return -1
            
        except Exception as e:
            logger.error(f"Read credits error: {e}")
            return -1
    
    def _has_ultra_badge(self) -> bool:
        """Check if ULTRA badge is visible near avatar"""
        try:
            # Check for ULTRA text on page
            result = self.driver.execute_script("""
                // Look for ULTRA text/badge
                const elements = document.querySelectorAll('*');
                for (const el of elements) {
                    const text = (el.innerText || el.textContent || '').trim();
                    if (text === 'ULTRA' || text === 'Ultra') {
                        const rect = el.getBoundingClientRect();
                        // Should be in top right area (near avatar)
                        if (rect.right > window.innerWidth - 300 && rect.top < 150) {
                            return true;
                        }
                    }
                }
                
                // Look for element with 'ultra' class or data
                const ultraElements = document.querySelectorAll('[class*="ultra"], [data-tier="ultra"]');
                if (ultraElements.length > 0) {
                    return true;
                }
                
                return false;
            """)
            
            return result == True
        except:
            return False
    
    def _is_account_deleted(self) -> bool:
        """Check if account deleted"""
        try:
            page = self.driver.page_source.lower()
            indicators = [
                "account deleted", "tài khoản đã bị xóa",
                "this account was recently deleted",
                "couldn't find your google account"
            ]
            for ind in indicators:
                if ind in page:
                    return True
            return False
        except:
            return False
    
    def _has_login_error(self) -> bool:
        """Check login error"""
        try:
            page = self.driver.page_source.lower()
            errors = ["wrong password", "sai mật khẩu", "incorrect password"]
            for err in errors:
                if err in page:
                    return True
            return False
        except:
            return False
    
    def _has_captcha(self) -> bool:
        """Check captcha"""
        try:
            page = self.driver.page_source.lower()
            if "type the text" in page or "hãy nhập văn bản" in page:
                return True
            return False
        except:
            return False
    
    def _solve_captcha(self) -> bool:
        """Solve captcha"""
        try:
            images = self.driver.find_elements(By.TAG_NAME, "img")
            for img in images:
                try:
                    size = img.size
                    if 100 < size['width'] < 400 and 30 < size['height'] < 150:
                        img_bytes = img.screenshot_as_png
                        img_base64 = base64.b64encode(img_bytes).decode('utf-8')
                        text = self.captcha_client.solve_image_captcha(img_base64)
                        if text:
                            inp = self._find_quick(['input[type="text"]'])
                            if inp:
                                self._safe_fill(inp, text)
                                inp.send_keys(Keys.RETURN)
                                return True
                except:
                    continue
            return False
        except:
            return False
    
    def _needs_phone_verification(self) -> bool:
        """Check if phone verification is ACTUALLY needed - STRICT CHECK"""
        try:
            url = self.driver.current_url.lower()
            page = self.driver.page_source.lower()
            
            # Must be on Google accounts domain
            if "accounts.google.com" not in url:
                logger.info("Not on accounts.google.com - no phone verification needed")
                return False
            
            # Must have challenge/signin in URL
            if "challenge" not in url and "signin" not in url:
                logger.info("Not on challenge/signin page - no phone verification needed")
                return False
            
            # STRICT: Must find phone input field with specific ID
            phone_input = self._find_quick([
                '#phoneNumberId',
                'input[name="phoneNumber"]',
                'input[autocomplete="tel"]'
            ])
            
            if not phone_input:
                logger.info("No phone input field found - no phone verification needed")
                return False
            
            # Double check: Must have phone-related text visible
            phone_keywords = [
                "số điện thoại của bạn",
                "xác minh đó là bạn",
                "add phone number",
                "verify it's you",
                "phone number to receive",
                "enter a phone number"
            ]
            
            has_phone_text = False
            for kw in phone_keywords:
                if kw in page:
                    has_phone_text = True
                    break
            
            if not has_phone_text:
                logger.info("No phone verification text found - skipping")
                return False
            
            logger.info("Phone verification IS needed - found phone input and text")
            return True
            
        except Exception as e:
            logger.error(f"Error checking phone verification: {e}")
            return False
    
    def _click_toi_hieu(self) -> bool:
        """Click Tôi hiểu"""
        try:
            result = self.driver.execute_script("""
                const elements = document.querySelectorAll('button, span');
                for (const el of elements) {
                    const text = (el.innerText || '').toLowerCase();
                    if (text.includes('tôi hiểu') || text.includes('i understand')) {
                        el.click();
                        return true;
                    }
                }
                return false;
            """)
            return result
        except:
            return False
    
    def _do_phone_verification(self, callback=None) -> Tuple[bool, str]:
        """Phone verification flow"""
        try:
            from config import PHONE_COUNTRIES
            
            country_info = PHONE_COUNTRIES.get(self.phone_country, {"code": "6", "dial": "+62"})
            country_code = country_info["code"]
            dial_code = country_info["dial"]
            
            logger.info(f"=== PHONE VERIFICATION ===")
            logger.info(f"Country: {self.phone_country}, Code: {country_code}, Dial: {dial_code}")
            
            # Rent number
            if callback:
                callback(f"Renting {self.phone_country} number...")
            
            order = self.smspool_client.purchase_sms(country=country_code, service="395")
            if not order:
                return False, "Cannot rent phone number"
            
            phone_raw = order.get("number", "")
            self.current_order_id = order.get("order_id")
            
            logger.info(f"SMSPool raw number: {phone_raw}")
            
            # Format phone - check if already has country code
            if str(phone_raw).startswith("+"):
                # Already has country code, use as-is
                phone_full = str(phone_raw)
            elif str(phone_raw).startswith(dial_code.replace("+", "")):
                # Starts with dial code without +, add +
                phone_full = f"+{phone_raw}"
            else:
                # Need to add dial code
                phone_clean = ''.join(c for c in str(phone_raw) if c.isdigit())
                if phone_clean.startswith("0"):
                    phone_clean = phone_clean[1:]
                phone_full = f"{dial_code}{phone_clean}"
            
            logger.info(f"Formatted phone: {phone_full}")
            
            if callback:
                callback(f"Got: {phone_full}")
            
            # Enter phone
            phone_input = self._wait_and_find([
                'input[type="tel"]',
                '#phoneNumberId'
            ], timeout=10)
            
            if not phone_input:
                self.smspool_client.cancel_sms(self.current_order_id)
                return False, "Cannot find phone input"
            
            self._safe_fill(phone_input, phone_full)
            time.sleep(2)
            
            # Click Next
            next_btn = self._find_quick([
                '#idvPreregisteredPhoneNext',
                'button[jsname="LgbsSe"]'
            ])
            if next_btn:
                self._safe_click(next_btn)
            else:
                phone_input.send_keys(Keys.RETURN)
            
            time.sleep(8)
            
            # Check spam
            page = self.driver.page_source.lower()
            if "cannot be used" in page or "không thể sử dụng" in page:
                self.smspool_client.cancel_sms(self.current_order_id)
                return False, "Phone rejected"
            
            # Wait OTP
            if callback:
                callback("Waiting for OTP...")
            
            otp = self.smspool_client.wait_for_otp(
                order_id=self.current_order_id,
                timeout=180,
                poll_interval=5
            )
            
            if not otp:
                self.smspool_client.cancel_sms(self.current_order_id)
                return False, "No OTP received"
            
            logger.info(f"OTP: {otp}")
            
            if callback:
                callback(f"OTP: {otp}")
            
            # Enter OTP
            time.sleep(3)
            otp_input = self._wait_and_find([
                'input[id*="code"]',
                'input[name*="code"]',
                '#smsUserPin'
            ], timeout=10)
            
            if not otp_input:
                return False, "Cannot find OTP input"
            
            self._safe_fill(otp_input, otp)
            time.sleep(2)
            
            # Submit
            verify_btn = self._find_quick([
                '#idvPreregisteredPhoneNext',
                'button[jsname="LgbsSe"]'
            ])
            if verify_btn:
                self._safe_click(verify_btn)
            else:
                otp_input.send_keys(Keys.RETURN)
            
            time.sleep(5)
            
            return True, "Verified"
            
        except Exception as e:
            logger.error(f"Phone error: {e}")
            if self.current_order_id:
                try:
                    self.smspool_client.cancel_sms(self.current_order_id)
                except:
                    pass
            return False, str(e)
