"""
GPM Browser Manager - Uses GPM (GoLogin Profile Manager) API or Standalone Firefox
Each account uses a fresh browser profile for complete isolation
"""
import logging
import requests
import time
from typing import Optional, Tuple, Dict, Any
from selenium import webdriver
from selenium.webdriver.chrome.service import Service as ChromeService
from selenium.webdriver.chrome.options import Options as ChromeOptions
from selenium.webdriver.firefox.service import Service as FirefoxService
from selenium.webdriver.firefox.options import Options as FirefoxOptions

logger = logging.getLogger(__name__)

# GPM API Configuration - v3
GPM_API_URL = "http://127.0.0.1:11894"


class GPMClient:
    """Client for GPM API v3"""
    
    def __init__(self, api_url: str = GPM_API_URL):
        self.api_url = api_url.rstrip('/')
    
    def get_profiles(self) -> list:
        """Get list of all profiles"""
        try:
            response = requests.get(f"{self.api_url}/api/v3/profiles", timeout=10)
            if response.status_code == 200:
                data = response.json()
                return data.get('data', [])
            return []
        except Exception as e:
            logger.error(f"Failed to get profiles: {e}")
            return []
    
    def create_profile(self, name: str) -> Optional[str]:
        """Create a new profile and return its ID"""
        try:
            payload = {
                "profile_name": name,
                "group_name": "AutoLogin",
                "raw_proxy": "",
                "startup_urls": ""
            }
            response = requests.post(
                f"{self.api_url}/api/v3/profiles",
                json=payload,
                timeout=30
            )
            if response.status_code == 200:
                data = response.json()
                profile_id = data.get('data', {}).get('id')
                logger.info(f"Created GPM profile: {name} -> {profile_id}")
                return profile_id
            logger.error(f"Create profile failed: {response.text}")
            return None
        except Exception as e:
            logger.error(f"Failed to create profile: {e}")
            return None
    
    def start_profile(self, profile_id: str) -> Optional[Dict[str, Any]]:
        """Start a profile and return connection info"""
        try:
            response = requests.get(
                f"{self.api_url}/api/v3/profiles/start/{profile_id}",
                timeout=60
            )
            if response.status_code == 200:
                data = response.json()
                if data.get('success'):
                    return data.get('data', {})
            logger.error(f"Start profile failed: {response.text}")
            return None
        except Exception as e:
            logger.error(f"Failed to start profile: {e}")
            return None
    
    def close_profile(self, profile_id: str) -> bool:
        """Close a running profile"""
        try:
            response = requests.get(
                f"{self.api_url}/api/v3/profiles/close/{profile_id}",
                timeout=10
            )
            return response.status_code == 200
        except:
            return False
    
    def delete_profile(self, profile_id: str) -> bool:
        """Delete a profile"""
        try:
            response = requests.delete(
                f"{self.api_url}/api/v3/profiles/{profile_id}",
                timeout=10
            )
            return response.status_code == 200
        except:
            return False
    
    def arrange_windows(self) -> bool:
        """Arrange all open browser windows with GPM's built-in feature"""
        try:
            response = requests.get(
                f"{self.api_url}/api/v3/profiles/arrange",
                timeout=10
            )
            if response.status_code == 200:
                logger.info("GPM windows arranged successfully")
                return True
            return False
        except Exception as e:
            logger.error(f"Failed to arrange windows: {e}")
            return False
    
    def clear_profile_data(self, profile_id: str) -> bool:
        """Clear all data (cookies, cache, history) from a profile"""
        try:
            # GPM API to clear profile data
            response = requests.get(
                f"{self.api_url}/api/v3/profiles/clear/{profile_id}",
                timeout=10
            )
            if response.status_code == 200:
                logger.info(f"Cleared data for profile: {profile_id}")
                return True
            
            # Fallback: try /api/v3/profiles/{id}/clear-data
            response = requests.post(
                f"{self.api_url}/api/v3/profiles/{profile_id}/clear-data",
                timeout=10
            )
            return response.status_code == 200
        except Exception as e:
            logger.error(f"Failed to clear profile data: {e}")
            return False



class BrowserManager:
    """Manages browser instances using GPM profiles or standalone Chrome."""
    
    def __init__(self, profile_id: str = None, use_standalone: bool = False):
        self.driver = None
        self.position = (0, 0, 400, 500)
        self.gpm = GPMClient() if not use_standalone else None
        self.profile_id = profile_id
        self._created_profile = False
        self.use_standalone = use_standalone
        self._temp_profile_dir = None
    
    def create_browser(self, position: Tuple[int, int, int, int] = None, headless: bool = False, profile_id: str = None) -> Optional[webdriver.Chrome]:
        """
        Create a browser using GPM profile or standalone Chrome.
        
        Args:
            position: Window position and size
            headless: Whether to run headless (only for standalone mode)
            profile_id: GPM profile ID (only for GPM mode)
        """
        try:
            # ========== STANDALONE MODE ==========
            if self.use_standalone:
                return self._create_standalone_browser(position, headless)
            
            # ========== GPM MODE ==========
            if profile_id:
                self.profile_id = profile_id
            
            # If no profile ID, create a new profile
            if not self.profile_id:
                self._profile_name = f"AutoLogin_{int(time.time() * 1000)}"
                self.profile_id = self.gpm.create_profile(self._profile_name)
                if not self.profile_id:
                    logger.error("Failed to create GPM profile")
                    return None
                self._created_profile = True
                logger.info(f"Created new GPM profile: {self.profile_id}")
            else:
                self._created_profile = False
                logger.info(f"Using existing GPM profile: {self.profile_id}")
            
            # Start the profile
            start_data = self.gpm.start_profile(self.profile_id)
            if not start_data:
                logger.error("Failed to start GPM profile")
                if self._created_profile:
                    self.gpm.delete_profile(self.profile_id)
                return None
            
            # Get connection info
            driver_path = start_data.get('driver_path')
            debugger_address = start_data.get('remote_debugging_address')
            
            if not debugger_address:
                logger.error("No debugger address returned from GPM")
                self.close()
                return None
            
            logger.info(f"GPM profile started: {debugger_address}")
            
            # Connect to the browser
            options = ChromeOptions()
            options.add_experimental_option("debuggerAddress", debugger_address)
            
            if driver_path:
                service = ChromeService(executable_path=driver_path)
                self.driver = webdriver.Chrome(service=service, options=options)
            else:
                self.driver = webdriver.Chrome(options=options)
            
            # Set window position and size
            if position:
                x, y, width, height = position
                self.driver.set_window_position(x, y)
                self.driver.set_window_size(width, height)
                self.position = position
            
            logger.info(f"Connected to GPM browser at {position}")
            return self.driver
            
        except Exception as e:
            logger.error(f"Failed to create browser: {e}")
            self.close()
            return None
    
    def _create_standalone_browser(self, position: Tuple[int, int, int, int] = None, headless: bool = False) -> Optional[webdriver.Firefox]:
        """Create a standalone Firefox browser with temp profile directory."""
        import tempfile
        
        try:
            # Create temp profile directory for isolation
            self._temp_profile_dir = tempfile.mkdtemp(prefix="firefox_profile_")
            logger.info(f"Created temp profile: {self._temp_profile_dir}")
            
            options = FirefoxOptions()
            
            # Use temp profile for isolation
            options.set_preference("profile", self._temp_profile_dir)
            
            # Firefox doesn't have "Sign in to browser" dialogs like Chrome!
            # Disable various prompts
            options.set_preference("browser.shell.checkDefaultBrowser", False)
            options.set_preference("browser.startup.homepage_override.mstone", "ignore")
            options.set_preference("dom.webnotifications.enabled", False)
            options.set_preference("geo.enabled", False)
            
            # Disable password manager
            options.set_preference("signon.rememberSignons", False)
            options.set_preference("signon.autofillForms", False)
            
            if headless:
                options.add_argument("--headless")
            
            # Create Firefox driver
            self.driver = webdriver.Firefox(options=options)
            
            # Set window position and size
            if position:
                x, y, width, height = position
                self.driver.set_window_position(x, y)
                self.driver.set_window_size(width, height)
                self.position = position
            else:
                self.driver.set_window_size(500, 700)
            
            logger.info(f"Created standalone Firefox browser")
            return self.driver
            
        except Exception as e:
            logger.error(f"Failed to create Firefox browser: {e}")
            self.close()
            return None
    
    def navigate(self, url: str) -> bool:
        """Navigate to URL."""
        try:
            if self.driver:
                self.driver.get(url)
                return True
            return False
        except Exception as e:
            logger.error(f"Navigate failed: {e}")
            return False
    
    def close(self):
        """Close browser and cleanup."""
        # First clear cookies/data from driver if available
        try:
            if self.driver:
                try:
                    self.driver.delete_all_cookies()
                except:
                    pass
                try:
                    self.driver.quit()
                except:
                    pass
                self.driver = None
        except:
            pass
        
        # Cleanup for standalone mode - remove temp profile dir
        if self.use_standalone and self._temp_profile_dir:
            import shutil
            try:
                shutil.rmtree(self._temp_profile_dir, ignore_errors=True)
                logger.info(f"Removed temp profile: {self._temp_profile_dir}")
            except:
                pass
            self._temp_profile_dir = None
        
        # Close and clear GPM profile data
        if not self.use_standalone and self.profile_id and self.gpm:
            try:
                # Clear all profile data for next account
                self.gpm.clear_profile_data(self.profile_id)
                # Close the profile
                self.gpm.close_profile(self.profile_id)
                logger.info(f"Closed and cleared GPM profile: {self.profile_id}")
                
                # Only delete if we created it
                if self._created_profile:
                    time.sleep(0.5)
                    self.gpm.delete_profile(self.profile_id)
                    logger.info(f"Deleted GPM profile: {self.profile_id}")
            except:
                pass
            self.profile_id = None
    
    def get_driver(self) -> Optional[webdriver.Chrome]:
        return self.driver
    
    def reposition(self, x: int, y: int, width: int, height: int):
        try:
            if self.driver:
                self.driver.set_window_position(x, y)
                self.driver.set_window_size(width, height)
                self.position = (x, y, width, height)
        except:
            pass
    
    def is_alive(self) -> bool:
        try:
            if self.driver:
                _ = self.driver.current_url
                return True
            return False
        except:
            return False
    
    def is_crashed(self) -> bool:
        return not self.is_alive() if self.driver else True
