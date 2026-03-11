# Google Auto Login Tool Configuration

# API Keys
SMSPOOL_API_KEY = "1sLOpIOabK0I4xH26MRqinpEvfNe8FnV"
AZCAPTCHA_API_KEY = "ctdhml9hmrkcwxpnqyby6xbd3vf74zjg"

# SMSPool Settings
SMSPOOL_BASE_URL = "https://api.smspool.net"
SMSPOOL_SERVICE_ID = "395"  # Google/Gmail
SMSPOOL_DEFAULT_COUNTRY = "1"  # US

# AzCaptcha Settings
AZCAPTCHA_BASE_URL = "http://azcaptcha.com"

# Phone Countries - SMSPool country ID (NOT dial code!) and dial code
# API Reference: https://api.smspool.net/country/retrieve_all
# IMPORTANT: SMSPool uses country IDs, not dial codes!
# ID=1 (US), ID=9 (Indonesia), ID=11 (Vietnam), ID=12 (Philippines)
# ID=6 is SWEDEN, NOT Indonesia!
PHONE_COUNTRIES = {
    "ID": {"code": "9", "dial": "+62", "name": "Indonesia"},      # ID=9 (NOT 6!)
    "VN": {"code": "11", "dial": "+84", "name": "Vietnam"},       # ID=11
    "PH": {"code": "12", "dial": "+63", "name": "Philippines"},   # ID=12
    "MY": {"code": "20", "dial": "+60", "name": "Malaysia"},      # ID=20
    "IN": {"code": "15", "dial": "+91", "name": "India"},         # ID=15
    "US": {"code": "1", "dial": "+1", "name": "United States"},   # ID=1
    "UK": {"code": "2", "dial": "+44", "name": "United Kingdom"}, # ID=2
    "TH": {"code": "52", "dial": "+66", "name": "Thailand"},      # ID=52
    "NL": {"code": "3", "dial": "+31", "name": "Netherlands"},    # ID=3
    "EE": {"code": "10", "dial": "+372", "name": "Estonia"},      # ID=10
}

# Threading Settings
MAX_THREADS = 20
THREAD_STARTUP_DELAY = 1.5  # seconds between thread starts

# Browser Settings
BROWSER_LOAD_TIMEOUT = 30  # seconds
LOGIN_TIMEOUT = 60  # seconds
OTP_WAIT_TIMEOUT = 180  # 3 minutes for OTP

# Google URLs
GOOGLE_LOGIN_URL = "https://labs.google/fx/tools/flow"
GOOGLE_MYACCOUNT_URL = "https://myaccount.google.com"

# Output Settings
OUTPUT_DIR = "output"
SUCCESS_FILE = "success.txt"
FAILED_FILE = "failed.txt"
