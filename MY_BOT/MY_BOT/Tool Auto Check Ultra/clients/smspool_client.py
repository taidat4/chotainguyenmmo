"""
SMSPool API Client for phone number rental and OTP verification
Fixed: Correct POST method, better logging, OTP parsing
"""
import requests
import time
import logging
import re
from typing import Optional, Dict, Any

logger = logging.getLogger(__name__)


class SMSPoolClient:
    """Client for SMSPool API to rent phone numbers and receive OTP codes."""
    
    def __init__(self, api_key: str, base_url: str = "https://api.smspool.net"):
        self.api_key = api_key
        self.base_url = base_url
        self.session = requests.Session()
        self.session.headers.update({
            "Content-Type": "application/x-www-form-urlencoded"
        })
        logger.info("SMSPoolClient initialized")
    
    def get_balance(self) -> Optional[float]:
        """Get account balance."""
        try:
            response = self.session.post(
                f"{self.base_url}/request/balance",
                data={"key": self.api_key},
                timeout=15
            )
            data = response.json()
            if "balance" in data:
                balance = float(data["balance"])
                logger.info(f"SMSPool balance: ${balance:.2f}")
                return balance
            return None
        except Exception as e:
            logger.error(f"Failed to get balance: {e}")
            return None
    
    def purchase_sms(self, country: str = "1", service: str = "395") -> Optional[Dict[str, Any]]:
        """
        Purchase a phone number for SMS verification.
        
        Args:
            country: Country code (e.g., '1' for US, '6' for ID, '84' for VN)
            service: Service ID ('395' for Google/Gmail)
            
        Returns:
            Dict with 'number', 'order_id', 'full_number' or None if failed
        """
        try:
            logger.info(f"Purchasing SMS: country={country}, service={service}")
            
            response = self.session.post(
                f"{self.base_url}/purchase/sms",
                data={
                    "key": self.api_key,
                    "country": country,
                    "service": service,
                    "pricing_option": "1"  # Thêm pricing option
                },
                timeout=30
            )
            
            logger.info(f"SMSPool response: {response.status_code}")
            data = response.json()
            logger.info(f"SMSPool data: {data}")
            
            if data.get("success") == 1 or "order_id" in data:
                result = {
                    "number": data.get("phonenumber", data.get("number", "")),
                    "order_id": data.get("order_id"),
                    "full_number": data.get("phonenumber", data.get("number", "")),
                    "country_code": data.get("cc", country)
                }
                logger.info(f"SMSPool purchase success: {result}")
                return result
            else:
                error_msg = data.get("message", data.get("error", "Unknown error"))
                logger.error(f"Failed to purchase SMS: {error_msg} | Full: {data}")
                return None
        except Exception as e:
            logger.error(f"Exception during purchase_sms: {e}")
            return None
    
    def check_sms(self, order_id: str) -> Optional[Dict[str, Any]]:
        """
        Check SMS status and get OTP code.
        
        Args:
            order_id: The order ID from purchase_sms
            
        Returns:
            Dict with 'status' and 'sms' (OTP code) if received
        """
        try:
            response = self.session.post(
                f"{self.base_url}/sms/check",
                data={
                    "key": self.api_key,
                    "orderid": order_id
                },
                timeout=15
            )
            data = response.json()
            
            status = data.get("status")
            sms = data.get("sms", "")
            
            logger.debug(f"Check SMS [{order_id}]: status={status}, sms={sms[:20] if sms else 'None'}...")
            
            return {
                "status": status,
                "sms": sms,
                "full_sms": data.get("full_sms", sms)
            }
        except Exception as e:
            logger.error(f"Failed to check SMS: {e}")
            return None
    
    def cancel_sms(self, order_id: str) -> bool:
        """
        Cancel/refund an SMS order.
        
        Args:
            order_id: The order ID to cancel
            
        Returns:
            True if cancelled successfully
        """
        try:
            logger.info(f"Cancelling SMS order: {order_id}")
            response = self.session.post(
                f"{self.base_url}/sms/cancel",
                data={
                    "key": self.api_key,
                    "orderid": order_id
                },
                timeout=15
            )
            data = response.json()
            success = data.get("success") == 1
            if success:
                logger.info(f"SMS order cancelled: {order_id}")
            else:
                logger.warning(f"Cancel failed: {data}")
            return success
        except Exception as e:
            logger.error(f"Failed to cancel SMS: {e}")
            return False
    
    def wait_for_otp(self, order_id: str, timeout: int = 180, poll_interval: int = 5) -> Optional[str]:
        """
        Wait for OTP code with polling.
        
        Args:
            order_id: The order ID to check
            timeout: Maximum wait time in seconds
            poll_interval: Time between polls in seconds
            
        Returns:
            OTP code string if received, None if timeout
        """
        start_time = time.time()
        logger.info(f"Waiting for OTP on order {order_id} (timeout: {timeout}s)")
        
        while time.time() - start_time < timeout:
            result = self.check_sms(order_id)
            
            if result:
                status = result.get("status")
                
                # Status codes: 1=Pending, 3=Received, 6=Cancelled
                if status == 3:
                    sms_text = result.get("sms", "") or result.get("full_sms", "")
                    
                    if sms_text:
                        # Extract OTP code from SMS
                        otp = self._extract_otp(sms_text)
                        if otp:
                            logger.info(f"OTP extracted: {otp}")
                            return otp
                        else:
                            # Fallback - return raw SMS
                            logger.info(f"OTP raw: {sms_text}")
                            return sms_text
                
                elif status == 6:
                    logger.warning("Order was cancelled/refunded")
                    return None
            
            elapsed = int(time.time() - start_time)
            if elapsed % 30 == 0:
                logger.info(f"Still waiting for OTP... ({elapsed}s/{timeout}s)")
            
            time.sleep(poll_interval)
        
        logger.warning(f"OTP timeout after {timeout} seconds")
        return None
    
    def _extract_otp(self, sms_text: str) -> Optional[str]:
        """Extract OTP code from SMS text."""
        if not sms_text:
            return None
        
        # Google format: G-123456
        match = re.search(r'G-(\d{6})', sms_text)
        if match:
            return match.group(1)
        
        # Generic 6-digit code
        match = re.search(r'\b(\d{6})\b', sms_text)
        if match:
            return match.group(1)
        
        # 5-digit code
        match = re.search(r'\b(\d{5})\b', sms_text)
        if match:
            return match.group(1)
        
        return None
