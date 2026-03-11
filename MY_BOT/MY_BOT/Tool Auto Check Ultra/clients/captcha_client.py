"""
AzCaptcha API Client for solving reCAPTCHA and other captcha types
API Documentation: http://azcaptcha.com/api-docs
"""
import requests
import time
import logging
from typing import Optional

logger = logging.getLogger(__name__)


class AzCaptchaClient:
    """Client for AzCaptcha API to solve reCAPTCHA and other captcha types."""
    
    def __init__(self, api_key: str, base_url: str = "http://azcaptcha.com"):
        self.api_key = api_key
        self.base_url = base_url
        self.session = requests.Session()
    
    def get_balance(self) -> Optional[float]:
        """Get account balance."""
        try:
            # Try without JSON first (plain text response)
            response = self.session.get(
                f"{self.base_url}/res.php",
                params={
                    "key": self.api_key,
                    "action": "getbalance"
                }
            )
            text = response.text.strip()
            
            # Check for error responses
            if "ERROR" in text.upper():
                logger.error(f"AzCaptcha balance error: {text}")
                return None
            
            # Try to parse as float directly (plain text format)
            try:
                return float(text)
            except ValueError:
                pass
            
            # Try JSON format
            try:
                data = response.json()
                if data.get("status") == 1:
                    return float(data.get("request", 0))
            except:
                pass
            
            return None
        except Exception as e:
            logger.error(f"Failed to get balance: {e}")
            return None
    
    def solve_recaptcha_v2(self, site_key: str, page_url: str, invisible: bool = False) -> Optional[str]:
        """
        Solve reCAPTCHA v2.
        
        Args:
            site_key: The site key found on the page (data-sitekey)
            page_url: The URL of the page with the captcha
            invisible: Whether it's invisible reCAPTCHA
            
        Returns:
            The solved captcha token or None if failed
        """
        try:
            # Step 1: Submit captcha for solving
            submit_params = {
                "key": self.api_key,
                "method": "userrecaptcha",
                "googlekey": site_key,
                "pageurl": page_url,
                "json": 1
            }
            if invisible:
                submit_params["invisible"] = 1
            
            response = self.session.get(
                f"{self.base_url}/in.php",
                params=submit_params
            )
            result = response.json()
            
            if result.get("status") != 1:
                logger.error(f"Failed to submit captcha: {result}")
                return None
            
            captcha_id = result.get("request")
            logger.info(f"Captcha submitted to AzCaptcha, ID: {captcha_id}")
            
            # Step 2: Wait and poll for result
            return self._wait_for_result(captcha_id)
            
        except Exception as e:
            logger.error(f"Exception during solve_recaptcha_v2: {e}")
            return None
    
    def solve_recaptcha_v3(self, site_key: str, page_url: str, action: str = "verify", min_score: float = 0.3) -> Optional[str]:
        """
        Solve reCAPTCHA v3.
        
        Args:
            site_key: The site key found on the page
            page_url: The URL of the page with the captcha
            action: The action parameter
            min_score: Minimum required score
            
        Returns:
            The solved captcha token or None if failed
        """
        try:
            submit_params = {
                "key": self.api_key,
                "method": "userrecaptcha",
                "googlekey": site_key,
                "pageurl": page_url,
                "version": "v3",
                "action": action,
                "min_score": min_score,
                "json": 1
            }
            
            response = self.session.get(
                f"{self.base_url}/in.php",
                params=submit_params
            )
            result = response.json()
            
            if result.get("status") != 1:
                logger.error(f"Failed to submit captcha v3: {result}")
                return None
            
            captcha_id = result.get("request")
            logger.info(f"Captcha v3 submitted to AzCaptcha, ID: {captcha_id}")
            
            return self._wait_for_result(captcha_id)
            
        except Exception as e:
            logger.error(f"Exception during solve_recaptcha_v3: {e}")
            return None
    
    def solve_image_captcha(self, image_base64: str) -> Optional[str]:
        """
        Solve image-based captcha using base64.
        
        Args:
            image_base64: Base64 encoded image
            
        Returns:
            The captcha text or None if failed
        """
        try:
            submit_data = {
                "key": self.api_key,
                "method": "base64",
                "body": image_base64,
                "json": 1
            }
            
            response = self.session.post(
                f"{self.base_url}/in.php",
                data=submit_data
            )
            result = response.json()
            
            if result.get("status") != 1:
                logger.error(f"Failed to submit image captcha: {result}")
                return None
            
            captcha_id = result.get("request")
            return self._wait_for_result(captcha_id)
            
        except Exception as e:
            logger.error(f"Exception during solve_image_captcha: {e}")
            return None
    
    def _wait_for_result(self, captcha_id: str, timeout: int = 120, poll_interval: int = 5) -> Optional[str]:
        """
        Poll for captcha result.
        
        Args:
            captcha_id: The captcha ID from submission
            timeout: Maximum wait time in seconds
            poll_interval: Time between polls in seconds
            
        Returns:
            The solved captcha response or None if timeout/failed
        """
        # Initial wait of 15-20 seconds as per AzCaptcha docs
        time.sleep(15)
        
        start_time = time.time()
        
        while time.time() - start_time < timeout:
            try:
                response = self.session.get(
                    f"{self.base_url}/res.php",
                    params={
                        "key": self.api_key,
                        "action": "get",
                        "id": captcha_id,
                        "json": 1
                    }
                )
                result = response.json()
                
                if result.get("status") == 1:
                    token = result.get("request")
                    logger.info("Captcha solved successfully by AzCaptcha")
                    return token
                elif result.get("request") == "CAPCHA_NOT_READY":
                    # Still processing
                    time.sleep(poll_interval)
                else:
                    # Error
                    logger.error(f"Captcha solving failed: {result}")
                    return None
                    
            except Exception as e:
                logger.error(f"Error polling captcha result: {e}")
                time.sleep(poll_interval)
        
        logger.warning(f"Captcha timeout after {timeout} seconds")
        return None
    
    def report_bad(self, captcha_id: str) -> bool:
        """Report incorrectly solved captcha for refund."""
        try:
            response = self.session.get(
                f"{self.base_url}/res.php",
                params={
                    "key": self.api_key,
                    "action": "reportbad",
                    "id": captcha_id
                }
            )
            return "OK" in response.text
        except Exception as e:
            logger.error(f"Failed to report bad captcha: {e}")
            return False
