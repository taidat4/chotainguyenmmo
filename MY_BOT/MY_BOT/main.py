import logging
import html as html_module
from logging.handlers import RotatingFileHandler
import sys

# ==============================================================================
# LOGGING SETUP - PHẢI Ở ĐẦU FILE TRƯỚC MỌI THỨ KHÁC
# ==============================================================================
log_formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')

# Console handler - hiển thị log trong terminal
console_handler = logging.StreamHandler(sys.stdout)
console_handler.setFormatter(log_formatter)
console_handler.setLevel(logging.INFO)

# File handler với auto-rotation: max 5MB, giữ 1 file cũ
file_handler = RotatingFileHandler(
    "bot.log", 
    maxBytes=5*1024*1024,  # 5MB per file
    backupCount=1,
    encoding='utf-8'
)
file_handler.setFormatter(log_formatter)
file_handler.setLevel(logging.INFO)

# Setup root logger - FORCE=TRUE để override bất kỳ config trước đó
logging.basicConfig(level=logging.INFO, handlers=[console_handler, file_handler], force=True)

# Enable apscheduler logs
logging.getLogger('apscheduler').setLevel(logging.INFO)
logging.getLogger('apscheduler.scheduler').setLevel(logging.INFO)
logging.getLogger('apscheduler.executors.default').setLevel(logging.WARNING)

# Suppress noisy httpx logs
logging.getLogger('httpx').setLevel(logging.WARNING)
logging.getLogger('httpcore').setLevel(logging.WARNING)

# ==============================================================================
# OTHER IMPORTS
# ==============================================================================
import gspread
import os
import time
import random
import string
import asyncio
import json
import requests
import re
import calendar
from oauth2client.service_account import ServiceAccountCredentials
from telegram import (
    Update,
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    BotCommand,
    ReplyKeyboardMarkup,
    KeyboardButton,
    BotCommandScopeChat,
)
try:
    from telegram import MenuButtonCommands
except ImportError:
    # Fallback nếu không có MenuButtonCommands
    MenuButtonCommands = None
from telegram.ext import (
    ApplicationBuilder,
    ContextTypes,
    CommandHandler,
    CallbackQueryHandler,
    MessageHandler,
    filters,
    ConversationHandler,
    ApplicationHandlerStop,
)
from telegram.error import Conflict
from datetime import datetime, timedelta, time as dt_time, timezone
from functools import lru_cache

# Múi giờ Việt Nam (UTC+7) - Sử dụng zoneinfo (Python 3.9+) hoặc pytz fallback
try:
    from zoneinfo import ZoneInfo
    VIETNAM_TZ = ZoneInfo("Asia/Ho_Chi_Minh")
    _tz_source = "zoneinfo"
except ImportError:
    try:
        import pytz
        VIETNAM_TZ = pytz.timezone("Asia/Ho_Chi_Minh")
        _tz_source = "pytz"
    except ImportError:
        # Fallback cuối cùng: dùng offset cố định
        VIETNAM_TZ = timezone(timedelta(hours=7))
        _tz_source = "fixed_offset"

def get_vietnam_now() -> datetime:
    """
    Lấy thời gian hiện tại theo giờ Việt Nam (Asia/Ho_Chi_Minh)
    
    Sử dụng thư viện timezone chính xác:
    - Python 3.9+: zoneinfo (built-in)
    - Fallback: pytz
    - Fallback cuối: UTC+7 offset cố định
    """
    return datetime.now(VIETNAM_TZ)

# Log timezone source khi khởi động để verify
logging.info(f"⏰ Timezone source: {_tz_source} | Current VN time: {get_vietnam_now().strftime('%d/%m/%Y %H:%M:%S')}")

# ==============================================================================
# 1. CẤU HÌNH
# ==============================================================================

# Đường dẫn đến file config
CONFIG_FILE = "mbbank-main/config/config.json"

def load_config():
    """Load cấu hình từ file config.json"""
    try:
        with open(CONFIG_FILE, "r", encoding="utf-8") as f:
            config = json.load(f)
        return config
    except FileNotFoundError:
        logging.warning(f"Không tìm thấy file {CONFIG_FILE}, sử dụng giá trị mặc định")
        return {}
    except json.JSONDecodeError as e:
        logging.error(f"Lỗi đọc file config: {e}")
        return {}

# Load config
_config = load_config()

# Lấy thông tin từ config, nếu không có thì dùng giá trị mặc định
BOT_TOKEN = _config.get("botToken", "8532063081:AAFFIjXLsYOqjHdZh7S2RahT_mMfQWi5MqQ")
# Danh sách admin IDs
ADMIN_IDS = [
    8560622519,  # Admin chính
    7961536218   # Admin phụ
]
# Giữ lại ADMIN_ID để tương thích với code cũ (admin đầu tiên)
ADMIN_ID = ADMIN_IDS[0]
API_CANHAN_URL = "https://apicanhan.com/api/mbbankv3"
AMOUNT_TOLERANCE = 1000  # cho phép lệch 1k

# Trạng thái bot: False = đang chạy, True = đã dừng tạm thời
BOT_STOPPED = False

def is_admin(user_id):
    """Kiểm tra xem user có phải admin không"""
    return user_id in ADMIN_IDS

async def send_to_all_admins(bot, text, parse_mode=None):
    """Gửi thông báo cho tất cả admin"""
    for admin_id in ADMIN_IDS:
        try:
            if parse_mode:
                await bot.send_message(chat_id=admin_id, text=text, parse_mode=parse_mode)
            else:
                await bot.send_message(chat_id=admin_id, text=text)
            logging.info(f"✅ Đã gửi thông báo cho admin {admin_id}")
        except Exception as e:
            error_msg = str(e)
            # Log chi tiết lỗi để debug
            if "chat not found" in error_msg.lower() or "user is deactivated" in error_msg.lower():
                logging.warning(f"⚠️ Không thể gửi thông báo cho admin {admin_id}: Admin chưa từng chat với bot hoặc đã chặn bot")
            elif "forbidden" in error_msg.lower():
                logging.warning(f"⚠️ Không thể gửi thông báo cho admin {admin_id}: Bot bị chặn bởi admin")
            else:
                logging.error(f"❌ Lỗi gửi thông báo cho admin {admin_id}: {e}")
        # Thêm delay nhỏ giữa các lần gửi để tránh rate limit
        await asyncio.sleep(0.1)

async def cmd_stop(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """
    Admin dừng bot hoặc chức năng cụ thể.
    - /stop = Dừng toàn bộ bot
    - /stop <tên_lệnh> = Dừng chức năng đó (VD: /stop verify_phone, /stop startmenu, /stop menu)
    """
    global BOT_STOPPED
    user_id = update.effective_user.id
    
    if not is_admin(user_id):
        await update.message.reply_text("❌ Bạn không có quyền sử dụng lệnh này.")
        return
    
    # Parse tham số TRỰC TIẾP từ message text (không dùng context.args vì có thể rỗng)
    message_text = update.message.text.strip()
    parts = message_text.split()  # ["/stop", "verify_phone"] hoặc ["/stop"]
    
    logging.info(f"🔍 [STOP] User {user_id} gọi: '{message_text}' -> parts = {parts}")
    
    # Nếu có tham số (parts > 1) = dừng chức năng cụ thể
    if len(parts) > 1:
        feature_name = parts[1].lower().lstrip("/")  # Lấy phần tử thứ 2
        logging.info(f"🛑 [STOP] Dừng riêng chức năng: {feature_name}")
        
        STOPPED_FEATURES[feature_name] = True
        
        # NẾU LÀ VERIFY_PHONE - Ghi file signal để verify_phone_tool.py đọc và dừng
        if feature_name == "verify_phone":
            try:
                import os
                signal_file = "pending_orders/verify_stop_signal.json"
                os.makedirs(os.path.dirname(signal_file), exist_ok=True)
                with open(signal_file, 'w', encoding='utf-8') as f:
                    import json
                    from datetime import datetime
                    json.dump({
                        "stopped": True,
                        "stopped_at": datetime.now().isoformat(),
                        "stopped_by": user_id
                    }, f, ensure_ascii=False, indent=2)
                logging.info(f"📝 Đã ghi file stop signal cho verify_phone")
            except Exception as e:
                logging.error(f"Lỗi ghi stop signal: {e}")
        
        await update.message.reply_text(
            f"🛑 <b>Đã dừng chức năng:</b> <code>{feature_name}</code>\n\n"
            f"❌ Khách hàng không thể sử dụng lệnh /{feature_name}.\n"
            f"✅ Admin vẫn có thể sử dụng.\n\n"
            f"📌 Dùng <code>/start {feature_name}</code> để mở lại.",
            parse_mode='HTML'
        )
        logging.info(f"🛑 Admin {user_id} đã DỪNG chức năng: {feature_name}")
        return
    
    # Không có tham số = dừng toàn bộ bot
    BOT_STOPPED = True
    
    # Hiển thị hướng dẫn
    currently_stopped = [f for f, stopped in STOPPED_FEATURES.items() if stopped]
    stopped_text = "\n".join([f"• <code>{f}</code>" for f in currently_stopped]) if currently_stopped else "Không có"
    
    await update.message.reply_text(
        "🛑 <b>Bot đã tạm dừng!</b>\n\n"
        "❌ Tất cả khách hàng không thể sử dụng bất kỳ chức năng nào.\n"
        "✅ Admin vẫn có thể sử dụng đầy đủ chức năng.\n\n"
        "📌 Dùng <code>/start</code> để mở lại toàn bộ bot.\n\n"
        "<b>Dừng riêng từng chức năng:</b>\n"
        "<code>/stop &lt;tên_lệnh&gt;</code>\n"
        "VD: /stop verify_phone, /stop menu, /stop startmenu\n\n"
        f"<b>Các chức năng đang bị dừng riêng:</b>\n{stopped_text}",
        parse_mode='HTML'
    )
    logging.info(f"🛑 Admin {user_id} đã DỪNG toàn bộ bot")


# ==============================================================================
# SELLER API ON/OFF COMMANDS
# ==============================================================================

async def cmd_off_api_seller(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """
    Admin command: Tắt chức năng mua hàng cho seller qua bot.
    Seller vẫn có thể dùng: /check_balance_seller, /nap_api_seller
    Seller KHÔNG thể dùng: /mua_hang_seller
    """
    user_id = update.effective_user.id
    
    if not is_admin(user_id):
        await update.message.reply_text("❌ Bạn không có quyền sử dụng lệnh này.")
        return
    
    from seller_commands import set_seller_purchase_enabled, is_seller_purchase_enabled
    
    if not is_seller_purchase_enabled():
        await update.message.reply_text(
            "⚠️ Chức năng mua hàng seller đã TẮT từ trước rồi.",
            parse_mode='HTML'
        )
        return
    
    set_seller_purchase_enabled(False)
    
    await update.message.reply_text(
        "🔒 <b>ĐÃ TẮT CHỨC NĂNG MUA HÀNG SELLER</b>\n\n"
        "📌 Seller chỉ có thể:\n"
        "• ✅ /check_balance_seller - Xem số dư\n"
        "• ✅ /nap_api_seller - Nạp tiền\n\n"
        "❌ Seller KHÔNG thể:\n"
        "• /mua_hang_seller - Mua hàng qua bot\n\n"
        "💡 Seller sẽ được hướng dẫn kết nối API trực tiếp.\n\n"
        "📢 Dùng /onapiseller để bật lại.",
        parse_mode='HTML'
    )
    logging.info(f"🔒 Admin {user_id} đã TẮT chức năng mua hàng seller")


async def cmd_on_api_seller(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """
    Admin command: Bật lại chức năng mua hàng cho seller qua bot.
    Sẽ thông báo cho tất cả seller đã liên kết.
    """
    user_id = update.effective_user.id
    
    if not is_admin(user_id):
        await update.message.reply_text("❌ Bạn không có quyền sử dụng lệnh này.")
        return
    
    from seller_commands import set_seller_purchase_enabled, is_seller_purchase_enabled, get_all_linked_sellers
    
    if is_seller_purchase_enabled():
        await update.message.reply_text(
            "⚠️ Chức năng mua hàng seller đang BẬT rồi.",
            parse_mode='HTML'
        )
        return
    
    set_seller_purchase_enabled(True)
    
    # Thông báo cho tất cả seller
    linked_sellers = get_all_linked_sellers()
    notified_count = 0
    
    for seller_user_id in linked_sellers:
        try:
            await context.bot.send_message(
                chat_id=int(seller_user_id),
                text=(
                    "🔓 <b>THÔNG BÁO TỪ ADMIN</b>\n\n"
                    "✅ Chức năng mua hàng qua bot đã được <b>MỞ LẠI</b>!\n\n"
                    "📦 Bạn có thể dùng /mua_hang_seller để mua hàng như bình thường.\n\n"
                    "💡 Khuyến khích: Kết nối API trực tiếp để có trải nghiệm tốt hơn!"
                ),
                parse_mode='HTML'
            )
            notified_count += 1
        except Exception as e:
            logging.warning(f"Không thể thông báo seller {seller_user_id}: {e}")
    
    await update.message.reply_text(
        f"🔓 <b>ĐÃ BẬT LẠI CHỨC NĂNG MUA HÀNG SELLER</b>\n\n"
        f"📢 Đã thông báo cho <b>{notified_count}/{len(linked_sellers)}</b> seller.\n\n"
        f"📌 Seller có thể dùng:\n"
        f"• /mua_hang_seller - Mua hàng qua bot\n"
        f"• /check_balance_seller - Xem số dư\n"
        f"• /nap_api_seller - Nạp tiền\n\n"
        f"🔒 Dùng /offapiseller để tắt lại.",
        parse_mode='HTML'
    )
    logging.info(f"🔓 Admin {user_id} đã BẬT chức năng mua hàng seller, thông báo {notified_count} seller")


async def cmd_customer_start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """
    Lệnh /start cho KHÁCH HÀNG (không phải admin).
    Hiển thị lời chào và hướng dẫn xem sản phẩm.
    """
    user = update.effective_user
    user_id = user.id
    user_name = user.first_name or "bạn"
    
    # Tạo keyboard với các nút bấm (đã bỏ Nạp Tiền và Xem Số Dư theo yêu cầu)
    keyboard = [
        [InlineKeyboardButton("🛍️ Xem Sản Phẩm", callback_data="show_menu")],
        [InlineKeyboardButton("📦 Đơn Hàng", callback_data="check_order")],
    ]
    reply_markup = InlineKeyboardMarkup(keyboard)
    
    welcome_text = (
        f"👋 <b>Xin chào {user_name}!</b>\n\n"
        f"🏪 Chào mừng bạn đến với <b>Shop MMO Tiện Ích</b>!\n\n"
        f"🛒 Chúng tôi cung cấp các tài khoản premium chất lượng:\n"
        f"• ChatGPT Plus, GPT-4\n"
        f"• Veo3 Ultra Unlimited\n"
        f"• Capcut Pro, Canva Pro\n"
        f"• YouTube Premium\n"
        f"• Và nhiều sản phẩm khác...\n\n"
        f"👇 <b>Bấm nút bên dưới để bắt đầu:</b>"
    )
    
    await update.message.reply_text(
        welcome_text,
        reply_markup=reply_markup,
        parse_mode='HTML'
    )
    logging.info(f"👤 Khách hàng {user_id} ({user_name}) đã bấm /start")


async def cmd_admin_start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """
    Admin mở lại bot hoặc chức năng cụ thể.
    - /start = Mở lại toàn bộ bot (nếu admin và bot đang dừng)
    - /start <tên_lệnh> = Mở lại chức năng đó
    
    Note: Lệnh /start cũng được dùng cho khách hàng mới, 
    nên cần kiểm tra xem có phải admin không.
    """
    global BOT_STOPPED
    user_id = update.effective_user.id
    
    # Nếu KHÔNG phải admin, gọi handler cho khách hàng
    if not is_admin(user_id):
        await cmd_customer_start(update, context)
        return
    
    # Parse tham số TRỰC TIẾP từ message text
    message_text = update.message.text.strip()
    parts = message_text.split()  # ["/start", "verify_phone"] hoặc ["/start"]
    
    logging.info(f"🔍 [START] User {user_id} gọi: '{message_text}' -> parts = {parts}")
    
    # Nếu có tham số (parts > 1) = mở lại chức năng cụ thể
    if len(parts) > 1:
        feature_name = parts[1].lower().lstrip("/")  # Lấy phần tử thứ 2
        logging.info(f"✅ [START] Mở lại chức năng: {feature_name}")
        
        if feature_name not in STOPPED_FEATURES or not STOPPED_FEATURES[feature_name]:
            await update.message.reply_text(
                f"ℹ️ Chức năng <code>{feature_name}</code> không bị dừng.",
                parse_mode='HTML'
            )
            return
        
        STOPPED_FEATURES[feature_name] = False
        
        # NẾU LÀ VERIFY_PHONE - Xóa file signal để verify_phone_tool.py tiếp tục chạy
        if feature_name == "verify_phone":
            try:
                import os
                signal_file = "pending_orders/verify_stop_signal.json"
                os.makedirs(os.path.dirname(signal_file), exist_ok=True)
                with open(signal_file, 'w', encoding='utf-8') as f:
                    import json
                    json.dump({
                        "stopped": False,
                        "stopped_at": None,
                        "stopped_by": None
                    }, f, ensure_ascii=False, indent=2)
                logging.info(f"📝 Đã xóa stop signal cho verify_phone - Tool sẽ tiếp tục")
            except Exception as e:
                logging.error(f"Lỗi xóa stop signal: {e}")
        
        await update.message.reply_text(
            f"✅ <b>Đã mở lại chức năng:</b> <code>{feature_name}</code>\n\n"
            f"🟢 Khách hàng có thể sử dụng lệnh /{feature_name} bình thường.",
            parse_mode='HTML'
        )
        logging.info(f"✅ Admin {user_id} đã MỞ LẠI chức năng: {feature_name}")
        return
    
    # Không có tham số = kiểm tra có cần mở bot không
    if not BOT_STOPPED:
        # Bot đang chạy, hiển thị status
        currently_stopped = [f for f, stopped in STOPPED_FEATURES.items() if stopped]
        if currently_stopped:
            stopped_list = "\n".join([f"• <code>{f}</code>" for f in currently_stopped])
            await update.message.reply_text(
                f"ℹ️ <b>Bot đang hoạt động bình thường.</b>\n\n"
                f"<b>Các chức năng đang bị dừng:</b>\n{stopped_list}\n\n"
                f"📌 Dùng <code>/start &lt;tên&gt;</code> để mở lại chức năng.",
                parse_mode='HTML'
            )
        else:
            await update.message.reply_text(
                "ℹ️ <b>Bot đang hoạt động bình thường.</b>\n"
                "Tất cả chức năng đều đang hoạt động.",
                parse_mode='HTML'
            )
        return
    
    # Mở lại toàn bộ bot
    BOT_STOPPED = False
    await update.message.reply_text(
        "✅ <b>Bot đã hoạt động trở lại!</b>\n\n"
        "🟢 Tất cả khách hàng có thể sử dụng bình thường.",
        parse_mode='HTML'
    )
    logging.info(f"✅ Admin {user_id} đã MỞ LẠI toàn bộ bot")

# ============== FEATURE-LEVEL STOP SYSTEM ==============
# Dict lưu trữ các chức năng đang bị dừng - ĐỘNG, không cố định
STOPPED_FEATURES = {}  # {"verify_phone": True, "startmenu": True, ...}

def is_feature_stopped(feature_name: str) -> bool:
    """Kiểm tra xem một chức năng có đang bị dừng không"""
    return STOPPED_FEATURES.get(feature_name.lower(), False)

async def check_maintenance_block(update: Update, user_id: int, feature_name: str = None) -> bool:
    """
    Kiểm tra và chặn nếu đang bảo trì. Trả về True nếu cần dừng (bị chặn).
    Admin luôn bypass.
    
    Sử dụng:
        if await check_maintenance_block(update, user_id, "verify_phone"):
            return ConversationHandler.END
    """
    # Admin luôn bypass
    if is_admin(user_id):
        return False
    
    # Kiểm tra bot dừng toàn bộ
    if BOT_STOPPED:
        await update.message.reply_text(
            "🔧 <b>Bot đang bảo trì!</b>\n\n"
            "Xin lỗi bạn, bot đang tạm dừng để bảo trì.\n"
            "Vui lòng quay lại sau.\n\n"
            "📞 Liên hệ admin nếu cần hỗ trợ gấp.",
            parse_mode='HTML'
        )
        return True
    
    # Kiểm tra chức năng cụ thể
    if feature_name and is_feature_stopped(feature_name):
        await update.message.reply_text(
            f"🔧 <b>Chức năng đang bảo trì!</b>\n\n"
            f"Chức năng <code>/{feature_name}</code> đang tạm dừng để bảo trì.\n"
            f"Vui lòng quay lại sau.",
            parse_mode='HTML'
        )
        return True
    
    return False

async def cmd_status(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Xem trạng thái bot và các chức năng đang bị dừng"""
    user_id = update.effective_user.id
    if not is_admin(user_id):
        await update.message.reply_text("❌ Bạn không có quyền sử dụng lệnh này.")
        return
    
    currently_stopped = [f for f, stopped in STOPPED_FEATURES.items() if stopped]
    
    if currently_stopped:
        stopped_list = "\n".join([f"• <code>{f}</code>" for f in currently_stopped])
    else:
        stopped_list = "Không có"
    
    bot_status = "🔴 Đang dừng" if BOT_STOPPED else "🟢 Hoạt động"
    
    await update.message.reply_text(
        f"📊 <b>Trạng thái Bot:</b> {bot_status}\n\n"
        f"<b>Các chức năng đang bị dừng riêng:</b>\n{stopped_list}\n\n"
        f"<b>Lệnh:</b>\n"
        f"• <code>/stop</code> - Dừng toàn bộ\n"
        f"• <code>/stop &lt;tên&gt;</code> - Dừng 1 chức năng\n"
        f"• <code>/start</code> - Mở lại toàn bộ\n"
        f"• <code>/start &lt;tên&gt;</code> - Mở lại 1 chức năng",
        parse_mode='HTML'
    )

async def cmd_testapi(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Lệnh admin để test API và xem format giao dịch"""
    user_id = update.effective_user.id
    if not is_admin(user_id):
        await update.message.reply_text("❌ Bạn không có quyền sử dụng lệnh này.")
        return
    
    await update.message.reply_text("⏳ Đang gọi API apicanhan để lấy giao dịch...")
    
    try:
        tx_list = fetch_apicanhan_transactions()
        
        if not tx_list:
            await update.message.reply_text("❌ Không lấy được giao dịch từ API. Kiểm tra config!")
            return
        
        # Hiển thị 5 giao dịch đầu tiên
        msg = f"✅ <b>API trả về {len(tx_list)} giao dịch</b>\n\n"
        msg += "<b>5 giao dịch gần nhất:</b>\n\n"
        
        for i, tx in enumerate(tx_list[:5]):
            if isinstance(tx, dict):
                desc = tx.get("description", "N/A")
                amt = tx.get("amount", "N/A")
                tx_type = tx.get("type", "N/A")
                tx_id = tx.get("transactionID", tx.get("refNo", "N/A"))
                
                msg += f"<b>[{i+1}]</b>\n"
                msg += f"   💰 Amount: <code>{amt}</code>\n"
                msg += f"   📋 Type: <code>{tx_type}</code>\n"
                msg += f"   📝 Desc: <code>{desc[:60]}...</code>\n"
                msg += f"   🆔 ID: <code>{tx_id}</code>\n\n"
        
        # Nếu có đơn hàng đang chờ, thử match
        if pending_orders:
            msg += f"\n<b>Đang có {len(pending_orders)} đơn pending:</b>\n"
            for oc, order in list(pending_orders.items())[:3]:
                order_amt = order.get('total_int', order.get('total_amount', 0))
                msg += f"   • {oc}: {order_amt}đ\n"
        
        await update.message.reply_text(msg, parse_mode='HTML')
        
    except Exception as e:
        await update.message.reply_text(f"❌ Lỗi: {e}")

async def cmd_restart(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Lệnh admin để khởi động lại bot"""
    user_id = update.effective_user.id
    if not is_admin(user_id):
        await update.message.reply_text("❌ Bạn không có quyền sử dụng lệnh này.")
        return
    
    await update.message.reply_text("🔄 Đang khởi động lại bot...")
    logging.info(f"🔄 Bot restart được yêu cầu bởi admin {user_id}")
    
    # Lưu pending orders trước khi restart
    try:
        with open(PENDING_ORDERS_FILE, "w", encoding="utf-8") as f:
            json.dump(pending_orders, f, ensure_ascii=False, indent=2)
        save_active_orders()
    except:
        pass
    
    # Restart process
    import sys
    import os
    os.execv(sys.executable, ['python'] + sys.argv)

async def handle_maintenance_message(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Chặn tất cả tin nhắn/callback khi bot đang bảo trì (trừ admin)"""
    user_id = update.effective_user.id
    
    # Admin luôn được bỏ qua - KHÔNG chặn admin
    if is_admin(user_id):
        logging.debug(f"🔓 [MAINTENANCE] Admin {user_id} bypass - cho phép tiếp tục")
        return  # Không raise exception, cho phép handler tiếp theo chạy
    
    # Kiểm tra BOT_STOPPED trước (dừng toàn bộ)
    if BOT_STOPPED:
        # Log để debug
        if update.message:
            msg_text = update.message.text[:50] if update.message.text else "[no text]"
            logging.info(f"🔒 [MAINTENANCE] Chặn user {user_id}: '{msg_text}' - BOT_STOPPED=True")
        elif update.callback_query:
            logging.info(f"🔒 [MAINTENANCE] Chặn callback từ user {user_id}: {update.callback_query.data}")
        
        if update.callback_query:
            try:
                await update.callback_query.answer(MAINTENANCE_ALERT, show_alert=True)
            except Exception as e:
                logging.debug(f"Lỗi answer callback trong maintenance: {e}")
        elif update.message:
            await update.message.reply_text(MAINTENANCE_MESSAGE, parse_mode='HTML')
        
        # QUAN TRỌNG: Raise exception để dừng TẤT CẢ handlers khác
        raise ApplicationHandlerStop()
    
    # Kiểm tra feature-level stop - ĐỘNG cho bất kỳ command nào
    if update.message and update.message.text:
        text = update.message.text.strip()
        if text.startswith("/"):
            # Lấy tên command (không có /)
            command = text.split()[0].lower().lstrip("/")
            # Loại bỏ @botname nếu có
            if "@" in command:
                command = command.split("@")[0]
            
            if is_feature_stopped(command):
                logging.info(f"🔒 [MAINTENANCE] Chặn user {user_id}: lệnh /{command} đang bị dừng")
                await update.message.reply_text(
                    f"🔧 <b>Chức năng đang bảo trì!</b>\n\n"
                    f"Chức năng <code>/{command}</code> đang tạm dừng để bảo trì.\n"
                    f"Vui lòng quay lại sau.",
                    parse_mode='HTML'
                )
                raise ApplicationHandlerStop()




# Thông tin bank từ config (sẽ được reload mỗi lần gọi)
def get_bank_config():
    """Lấy bank config từ file - reload mỗi lần để luôn dùng config mới nhất"""
    try:
        config = load_config()
        return {
            "sessionId": config.get("sessionId", ""),
            "id_run": config.get("id_run", ""),
            "token": config.get("token", ""),
            "cookie": config.get("cookie", ""),
            "deviceid": config.get("deviceid", ""),
            "user": config.get("user", ""),
            "accountNo": config.get("accountNo", "")
        }
    except Exception as e:
        logging.error(f"Lỗi khi load bank config: {e}")
        return {}

# Giữ lại BANK_CONFIG để tương thích với code cũ, nhưng sẽ dùng get_bank_config() trong các hàm
BANK_CONFIG = get_bank_config()

def get_apicanhan_config():
    """Lấy cấu hình cho API apicanhan (key giải captcha + MB user/pass)"""
    try:
        config = load_config()
        return {
            "key": config.get("apicanhanKey", ""),
            "username": config.get("apicanhanUser", config.get("user", "")),
            "password": config.get("apicanhanPass", ""),
            "accountNo": config.get("apicanhanAccount", config.get("accountNo", "")),
        }
    except Exception as e:
        logging.error(f"Lỗi khi load apicanhan config: {e}")
        return {}

def has_valid_apicanhan_config(cfg: dict) -> bool:
    """Kiểm tra đã đủ key + user/pass/account chưa"""
    return bool(
        cfg
        and cfg.get("key")
        and cfg.get("username")
        and cfg.get("password")
        and cfg.get("accountNo")
    )

SHEET_NAME = "Danh Mục Sản Phẩm"
MENU_SHEET_NAME = "Menu"
HANG_NHAP_SHEET_NAME = "Hàng Nhập"
ZALO_ADMIN_1 = "0965268536"
ZALO_ADMIN_2 = "0393959643"
TELEGRAM_ADMIN_1 = "@dat_shopmmo_04"
TELEGRAM_ADMIN_2 = "@thinh_shopmmo04"
TELEGRAM_ADMIN_USERNAMES = [TELEGRAM_ADMIN_1, TELEGRAM_ADMIN_2]  # List of all admin usernames
TELEGRAM_ADMIN_USERNAME = " / ".join(TELEGRAM_ADMIN_USERNAMES)  # For display: "@dat_shopmmo_04 / @thinh_shopmmo04"
COMMUNITY_LINK = "https://zalo.me/g/khxedc741"
ZALO_CTV = "https://zalo.me/g/fkwiwr006"

# Standardized Maintenance Message với thông tin liên hệ admin
MAINTENANCE_MESSAGE = (
    "🔧 <b>Bot đang bảo trì!</b>\n\n"
    "Xin lỗi bạn, bot đang tạm dừng để bảo trì.\n"
    "Vui lòng quay lại sau.\n\n"
    "📞 <b>Liên hệ Admin nếu cần hỗ trợ gấp:</b>\n"
    f"• Telegram: {TELEGRAM_ADMIN_1}\n"
    f"• Telegram: {TELEGRAM_ADMIN_2}\n"
    f"• Zalo: {ZALO_ADMIN_1}\n"
    f"👉 Tham gia cộng đồng: {COMMUNITY_LINK}"
)

MAINTENANCE_ALERT = "🔧 Bot đang bảo trì! Liên hệ Admin: @dat_shopmmo_04 hoặc @thinh_shopmmo04"

DATA_FOLDER = "mybot_data"
RETENTION_DAYS = 30
QR_IMAGE_PATH = "img.png"
SERVICE_ACCOUNT_FILE = "credentials.json"

# Thư mục lưu thông báo
ANNOUNCEMENTS_FILE = "announcements.json"
USERS_FILE = "users_list.json"
NOTES_FILE = "notes.json"

# Cache cho Google Sheets
SHEETS_CACHE = {}
# TĂNG CACHE TIMEOUT để giảm số lần gọi API Google Sheets
CACHE_TIMEOUT = 60  # Cache chung 60s
CACHE_TIMEOUT_FAST = 180  # 3 phút - giảm lag menu khi có nhiều sản phẩm
CACHE_TIMEOUT_LONG = 120  # Cache dài cho worksheet list

CHOOSING_PRODUCT, ASKING_QUANTITY, WAITING_EMAIL, WAITING_BROADCAST, NOTE_WAITING_INFO, NOTE_WAITING_EXPIRY, WAITING_GIFT_MESSAGE, WAITING_GIFT_CONFIRM, WAITING_VERIFY_CREDENTIALS, WAITING_VERIFY_QUANTITY, WAITING_DEPOSIT_AMOUNT, WAITING_VERIFY_COUNTRY, WAITING_VERIFY_COUNTRY_365OTP = range(13)
pending_orders = {}
PAYMENT_LOG_FILE = "pending_orders/payment_log.json"
PENDING_ORDERS_FILE = "pending_orders/pending_orders.json"

# Active orders - đơn hàng đang chờ admin xử lý (sau khi khách gửi link/email)
active_orders = {}  # {order_code: {order_data, admin_message_id, link_retry_count...}}
ACTIVE_ORDERS_FILE = "pending_orders/active_orders.json"

# Verify phone queue files
VERIFY_QUEUE_FILE = "pending_orders/verify_queue.json"
VERIFY_RESULTS_FILE = "pending_orders/verify_results.json"
VERIFY_STATUS_FILE = "pending_orders/verify_status.json"
VERIFY_PENDING_RETRY_FILE = "pending_orders/verify_pending_retry.json"  # Lưu acc thất bại chờ retry
SMSPOOL_CONFIG_FILE = "config/smspool_config.json"

# ==============================================================================
# LOG CLEANUP CONFIGURATION
# ==============================================================================
LOG_CLEANUP_CONFIG = {
    "max_log_size_mb": 1,  # Xóa file log nếu > 1MB
    "max_json_entries": 100,  # Giữ tối đa 100 entries trong các file JSON queue
    "cleanup_files": [
        "verify_tool.log",
        "pending_orders/verify_queue.json",
        "pending_orders/verify_results.json",
    ]
}

def cleanup_large_logs():
    """Dọn dẹp các file log lớn và giới hạn dữ liệu JSON."""
    import os
    cleanup_report = []
    base_dir = os.path.dirname(os.path.abspath(__file__))
    
    for file_path in LOG_CLEANUP_CONFIG["cleanup_files"]:
        full_path = os.path.join(base_dir, file_path)
        
        if not os.path.exists(full_path):
            continue
        
        file_size_mb = os.path.getsize(full_path) / (1024 * 1024)
        
        # Xử lý file .log - xóa nếu quá lớn
        if file_path.endswith('.log'):
            if file_size_mb > LOG_CLEANUP_CONFIG["max_log_size_mb"]:
                try:
                    # Giữ lại 100 dòng cuối
                    with open(full_path, 'r', encoding='utf-8', errors='ignore') as f:
                        lines = f.readlines()
                    
                    # Ghi lại 100 dòng cuối
                    with open(full_path, 'w', encoding='utf-8') as f:
                        f.writelines(lines[-100:])
                    
                    new_size = os.path.getsize(full_path) / (1024 * 1024)
                    cleanup_report.append(f"✅ {file_path}: {file_size_mb:.2f}MB → {new_size:.2f}MB")
                    logging.info(f"🧹 Đã dọn {file_path}: {file_size_mb:.2f}MB → {new_size:.2f}MB")
                except Exception as e:
                    logging.error(f"❌ Lỗi dọn {file_path}: {e}")
        
        # Xử lý file .json - giới hạn số entries
        elif file_path.endswith('.json'):
            if file_size_mb > 0.1:  # > 100KB
                try:
                    with open(full_path, 'r', encoding='utf-8') as f:
                        data = json.load(f)
                    
                    if isinstance(data, list) and len(data) > LOG_CLEANUP_CONFIG["max_json_entries"]:
                        # Giữ lại max_json_entries entries cuối
                        new_data = data[-LOG_CLEANUP_CONFIG["max_json_entries"]:]
                        with open(full_path, 'w', encoding='utf-8') as f:
                            json.dump(new_data, f, ensure_ascii=False, indent=2)
                        
                        new_size = os.path.getsize(full_path) / (1024 * 1024)
                        cleanup_report.append(f"✅ {file_path}: {len(data)} → {len(new_data)} entries")
                        logging.info(f"🧹 Đã dọn {file_path}: {len(data)} → {len(new_data)} entries")
                    
                    elif isinstance(data, dict):
                        # Với dict, xóa hết và giữ file rỗng
                        with open(full_path, 'w', encoding='utf-8') as f:
                            json.dump({}, f, ensure_ascii=False, indent=2)
                        cleanup_report.append(f"✅ {file_path}: đã xóa {len(data)} keys")
                        logging.info(f"🧹 Đã xóa {file_path}: {len(data)} keys")
                        
                except Exception as e:
                    logging.error(f"❌ Lỗi dọn {file_path}: {e}")
    
    return cleanup_report

async def log_cleanup_job(context: ContextTypes.DEFAULT_TYPE):
    """Job chạy hàng ngày lúc 4:00 sáng để dọn log."""
    try:
        cleanup_report = cleanup_large_logs()
        if cleanup_report:
            report_text = "🧹 <b>BÁO CÁO DỌN LOG TỰ ĐỘNG</b>\n\n" + "\n".join(cleanup_report)
            await send_to_all_admins(context.bot, report_text, parse_mode='HTML')
            logging.info(f"✅ Đã chạy job dọn log tự động: {len(cleanup_report)} files")
    except Exception as e:
        logging.error(f"❌ Lỗi job dọn log: {e}")

# Giá verify phone theo quốc gia - khách hàng chọn
VERIFY_COUNTRY_PRICING = {
    "ID": {"name": "Indonesia 🇮🇩", "price": 5500, "success_rate": 70, "dial_code": "+62"},
    "NL": {"name": "Netherlands 🇳🇱", "price": 8500, "success_rate": 85, "dial_code": "+31"},
    "EE": {"name": "Estonia 🇪🇪", "price": 12000, "success_rate": 90, "dial_code": "+372"},
    "PL": {"name": "Poland 🇵🇱", "price": 11000, "success_rate": 87, "dial_code": "+48"},
    "HR": {"name": "Croatia 🇭🇷", "price": 8000, "success_rate": 80, "dial_code": "+385"},
    "BR": {"name": "Brazil 🇧🇷", "price": 8300, "success_rate": 70, "dial_code": "+55"},
    "VN": {"name": "Vietnam 🇻🇳", "price": 4000, "success_rate": 60, "dial_code": "+84"},
    "US": {"name": "USA 🇺🇸", "price": 23000, "success_rate": 95, "dial_code": "+1"},
}

# Giá verify phone mặc định (admin miễn phí)
VERIFY_PRICE_DEFAULT = 5500

# ==============================================================================
# WARRANTY (BẢO HÀNH) SYSTEM
# ==============================================================================

# File lưu lịch sử đơn hàng cho bảo hành
ORDER_HISTORY_FILE = "pending_orders/order_history.json"
WARRANTY_RETENTION_DAYS = 30  # Giữ đơn hàng 30 ngày

# File lưu các warranty claims đã xử lý - dùng để nhắc admin xóa acc khi hết hạn
WARRANTY_CLAIMS_FILE = "pending_orders/warranty_claims.json"

# File lưu config on/off các tính năng bảo hành
WARRANTY_OPTIONS_FILE = "config/warranty_options.json"

# File lưu các đơn đã hoàn tiền - KHÔNG được bảo hành lại
# Giải quyết vấn đề: đơn xóa khỏi local nhưng vẫn tồn tại trong Inventory API
WARRANTY_BLACKLIST_FILE = "pending_orders/warranty_blacklist.json"


def load_warranty_blacklist():
    """Load danh sách đơn đã hoàn tiền (không được bảo hành lại)"""
    if not os.path.exists(WARRANTY_BLACKLIST_FILE):
        return []
    try:
        with open(WARRANTY_BLACKLIST_FILE, "r", encoding="utf-8") as f:
            content = f.read().strip()
            if not content:
                return []
            return json.loads(content)
    except Exception as e:
        logging.error(f"Lỗi đọc warranty blacklist: {e}")
        return []


def save_warranty_blacklist(blacklist):
    """Lưu danh sách đơn đã hoàn tiền"""
    try:
        os.makedirs(os.path.dirname(WARRANTY_BLACKLIST_FILE), exist_ok=True)
        with open(WARRANTY_BLACKLIST_FILE, "w", encoding="utf-8") as f:
            json.dump(blacklist, f, ensure_ascii=False, indent=2)
    except Exception as e:
        logging.error(f"Lỗi lưu warranty blacklist: {e}")


def add_to_warranty_blacklist(order_code, reason="refund_completed"):
    """Thêm đơn vào blacklist - không được bảo hành lại
    
    Args:
        order_code: Mã đơn hàng
        reason: Lý do block (default: refund_completed)
    """
    blacklist = load_warranty_blacklist()
    # Normalize order code
    normalized = order_code.strip().upper()
    
    # Tránh duplicate
    existing_codes = [item.get('order_code', '').upper() for item in blacklist if isinstance(item, dict)]
    if normalized in existing_codes:
        return
    
    blacklist.append({
        "order_code": normalized,
        "reason": reason,
        "added_at": get_vietnam_now().strftime("%Y-%m-%d %H:%M:%S")
    })
    save_warranty_blacklist(blacklist)
    logging.info(f"🚫 Đã thêm {order_code} vào warranty blacklist ({reason})")


def is_order_blacklisted(order_code):
    """Kiểm tra đơn có trong blacklist không"""
    blacklist = load_warranty_blacklist()
    normalized = order_code.strip().upper()
    
    for item in blacklist:
        if isinstance(item, dict):
            if item.get('order_code', '').upper() == normalized:
                return True
        elif isinstance(item, str):
            if item.upper() == normalized:
                return True
    return False


# Default config cho warranty options
DEFAULT_WARRANTY_OPTIONS = {
    "refund_enabled": True,    # Cho phép hoàn tiền
    "replace_enabled": True,   # Cho phép đổi acc mới
}


def load_warranty_options():
    """Load trạng thái on/off các option bảo hành"""
    if not os.path.exists(WARRANTY_OPTIONS_FILE):
        return DEFAULT_WARRANTY_OPTIONS.copy()
    try:
        with open(WARRANTY_OPTIONS_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
            # Merge với default để đảm bảo có đủ keys
            result = DEFAULT_WARRANTY_OPTIONS.copy()
            result.update(data)
            return result
    except Exception as e:
        logging.error(f"Lỗi đọc warranty options: {e}")
        return DEFAULT_WARRANTY_OPTIONS.copy()


def save_warranty_options(options):
    """Lưu trạng thái on/off các option bảo hành"""
    try:
        os.makedirs(os.path.dirname(WARRANTY_OPTIONS_FILE), exist_ok=True)
        with open(WARRANTY_OPTIONS_FILE, "w", encoding="utf-8") as f:
            json.dump(options, f, ensure_ascii=False, indent=2)
    except Exception as e:
        logging.error(f"Lỗi lưu warranty options: {e}")


def is_warranty_option_enabled(option_name):
    """Kiểm tra option có được bật không
    
    Args:
        option_name: 'refund' hoặc 'replace'
    
    Returns:
        True nếu option được bật, False nếu bị tắt
    """
    options = load_warranty_options()
    key = f"{option_name}_enabled"
    return options.get(key, True)


# States cho ConversationHandler bảo hành
WARRANTY_WAITING_ORDER_CODE = 100
WARRANTY_WAITING_QR_CODE = 101
WARRANTY_WAITING_ACC_SELECTION = 102
WARRANTY_WAITING_PASSWORD_RETRY = 103  # Chờ khách gửi lại password đúng


def load_warranty_claims():
    """Load danh sách warranty claims đã xử lý"""
    if not os.path.exists(WARRANTY_CLAIMS_FILE):
        return []
    try:
        with open(WARRANTY_CLAIMS_FILE, "r", encoding="utf-8") as f:
            content = f.read().strip()
            if not content:
                return []
            return json.loads(content)
    except Exception as e:
        logging.error(f"Lỗi đọc warranty claims: {e}")
        return []


def save_warranty_claims(claims):
    """Lưu danh sách warranty claims"""
    try:
        os.makedirs(os.path.dirname(WARRANTY_CLAIMS_FILE), exist_ok=True)
        with open(WARRANTY_CLAIMS_FILE, "w", encoding="utf-8") as f:
            json.dump(claims, f, ensure_ascii=False, indent=2)
    except Exception as e:
        logging.error(f"Lỗi lưu warranty claims: {e}")


def add_warranty_claim(order_code, user_id, username, user_fullname, product_name, 
                       accounts_replaced, warranty_expiry_date):
    """Thêm một warranty claim mới vào danh sách
    
    Khi khách được bảo hành thành công, lưu thông tin để nhắc admin xóa acc khi hết hạn.
    
    Args:
        order_code: Mã đơn hàng gốc
        user_id: Telegram user ID
        username: @username
        user_fullname: Tên đầy đủ
        product_name: Tên sản phẩm
        accounts_replaced: List các email acc đã gửi bảo hành
        warranty_expiry_date: Ngày hết hạn BH (YYYY-MM-DD) - tính từ ngày mua gốc
    """
    claims = load_warranty_claims()
    
    claim = {
        "order_code": order_code,
        "user_id": user_id,
        "username": username or "N/A",
        "user_fullname": user_fullname or "N/A",
        "product_name": product_name,
        "accounts_replaced": accounts_replaced,
        "warranty_expiry_date": warranty_expiry_date,
        "claim_date": get_vietnam_now().strftime("%Y-%m-%d"),
        "reminder_sent": 0  # Đếm số lần đã nhắc admin (max 3)
    }
    
    claims.append(claim)
    save_warranty_claims(claims)
    logging.info(f"📝 Đã lưu warranty claim: {order_code} - hết hạn {warranty_expiry_date}")
    return claim

def load_order_history():
    """Load lịch sử đơn hàng từ file"""
    if not os.path.exists(ORDER_HISTORY_FILE):
        return {}
    try:
        with open(ORDER_HISTORY_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        logging.error(f"Lỗi đọc order history: {e}")
        return {}

def save_order_history(history):
    """Lưu lịch sử đơn hàng vào file"""
    try:
        os.makedirs(os.path.dirname(ORDER_HISTORY_FILE), exist_ok=True)
        with open(ORDER_HISTORY_FILE, "w", encoding="utf-8") as f:
            json.dump(history, f, ensure_ascii=False, indent=2)
    except Exception as e:
        logging.error(f"Lỗi lưu order history: {e}")

def find_next_row_col_a(ws):
    """Tìm dòng tiếp theo để ghi dựa trên CỘT A (acc gốc).
    
    Logic: Scan cột A từ trên xuống, tìm dòng đầu tiên mà cột A trống.
    Bỏ qua header (row 1). Nếu cột A có dữ liệu thì tiếp tục xuống.
    Không bị ảnh hưởng bởi Data Validation ở cột khác (D = 'CHƯA THU HỒI').
    
    Returns:
        int: Số thứ tự dòng tiếp theo để ghi (1-indexed)
    """
    try:
        col_a_values = ws.col_values(1)  # Chỉ lấy cột A
        # Tìm dòng cuối cùng có dữ liệu thực trong cột A (bỏ qua dòng trống xen kẽ)
        last_data_row = 0
        for i, val in enumerate(col_a_values):
            if val and val.strip():
                last_data_row = i + 1  # 1-indexed
        
        # Dòng tiếp theo ngay sau dòng cuối có dữ liệu
        # Nếu sheet trống (chỉ có header), ghi vào row 2
        return max(last_data_row + 1, 2)
    except Exception as e:
        logging.error(f"❌ Lỗi tìm next row col A: {e}")
        return 2  # Fallback: ghi vào row 2


def save_order_to_history(order_code, order_data, accounts_delivered=None):
    """Lưu 1 đơn hàng vào lịch sử sau khi giao thành công
    
    Args:
        order_code: Mã đơn hàng (P12345)
        order_data: Dict chứa thông tin đơn từ pending_orders (bao gồm warranty_days từ Sheet cột F)
        accounts_delivered: List các acc đã giao cho khách
    """
    history = load_order_history()
    now = get_vietnam_now()
    
    product_name = order_data.get('product_name', '')
    warranty_text = order_data.get('warranty_text', '')
    warranty_days = order_data.get('warranty_days', 0)
    
    # Tính warranty_expiry_date = ngày mua + số ngày bảo hành
    warranty_expiry_date = None
    if warranty_days > 0:
        from datetime import timedelta
        expiry_date = now + timedelta(days=warranty_days)
        warranty_expiry_date = expiry_date.strftime("%Y-%m-%d")
        logging.info(f"📝 Đơn {order_code} - BH {warranty_days} ngày, hết hạn {warranty_expiry_date}")
    else:
        logging.info(f"📝 Đơn {order_code} - Sản phẩm KHÔNG BẢO HÀNH")
    
    history[order_code] = {
        "order_code": order_code,
        "user_id": order_data.get('user_id'),
        "username": order_data.get('username', ''),
        "user_fullname": order_data.get('user_fullname', ''),
        "product_name": product_name,
        "product_id": order_data.get('product_id', ''),
        "sheet_tab_name": order_data.get('sheet_tab_name', ''),
        "quantity": order_data.get('quantity', 1),
        "total_amount": order_data.get('total_int', order_data.get('total_amount', 0)),
        "unit_price": order_data.get('unit_price', 0),
        "purchase_date": now.strftime("%Y-%m-%d"),
        "purchase_timestamp": int(now.timestamp()),
        "accounts_delivered": accounts_delivered or [],
        "warranty_days": warranty_days,  # Số ngày BH từ cột F
        "warranty_text": warranty_text,
        "warranty_expiry_date": warranty_expiry_date  # Tự động tính: purchase_date + warranty_days
    }
    
    save_order_history(history)
    if warranty_expiry_date:
        logging.info(f"📝 Đã lưu đơn {order_code} vào order history (BH đến {warranty_expiry_date})")
    else:
        logging.info(f"📝 Đã lưu đơn {order_code} vào order history (KHÔNG BẢO HÀNH)")
    
    # ========= GHI VÀO SHEET "ACC THU HỒI" NẾU CÓ BẢO HÀNH =========
    logging.info(f"🔍 [DEBUG] Kiểm tra ghi Acc thu hồi: warranty_days={warranty_days}, accounts_delivered={len(accounts_delivered) if accounts_delivered else 0}")
    
    if warranty_days > 0 and accounts_delivered:
        logging.info(f"📝 [ACC THU HỒI] Đang ghi {len(accounts_delivered)} acc với BH {warranty_days} ngày...")
        try:
            db = get_db()
            if db:
                # Mở sheet "Acc thu hồi"
                ws_thuhoi = get_worksheet_by_name(db, "Acc thu hồi")
                if ws_thuhoi:
                    from datetime import timedelta
                    
                    # Format ngày
                    purchase_date_str = now.strftime("%d/%m")
                    expiry_date = now + timedelta(days=warranty_days)
                    expiry_date_str = expiry_date.strftime("%d/%m")
                    
                    # Tìm dòng tiếp theo dựa trên CỘT A (chỉ tính dòng có acc)
                    next_row = find_next_row_col_a(ws_thuhoi)
                    
                    # Ghi từng acc vào sheet
                    for acc in accounts_delivered:
                        new_row = [
                            acc,                    # A: Acc Gốc (email|password)
                            "",                     # B: Acc Thu Hồi (để trống - điền sau khi thu hồi)
                            "",                     # C: Pass Mới (để trống - điền sau khi reset)
                            "CHƯA THU HỒI",         # D: Tình trạng
                            purchase_date_str,      # E: Ngày Mua
                            expiry_date_str,        # F: Hết Hạn
                            order_code              # G: ID Đơn Hàng
                        ]
                        ws_thuhoi.update(f'A{next_row}:G{next_row}', [new_row], value_input_option='USER_ENTERED')
                        next_row += 1
                    
                    logging.info(f"✅ Đã ghi {len(accounts_delivered)} acc vào sheet 'Acc thu hồi'")
                else:
                    logging.warning("⚠️ Không tìm thấy sheet 'Acc thu hồi'")
        except Exception as e:
            logging.error(f"❌ Lỗi ghi vào sheet 'Acc thu hồi': {e}")

def get_order_from_history(order_code):
    """Lấy thông tin đơn hàng từ lịch sử
    
    Args:
        order_code: Mã đơn hàng - chấp nhận nhiều format:
            - P12345 (đơn khách thường)
            - order_xxx (seller với underscore)
            - order xxx (seller với space - sẽ được normalize)
            - reseller_id_timestamp_xxx (seller cũ)
        
    Returns:
        Dict thông tin đơn hàng hoặc None nếu không tìm thấy hoặc đã bị blacklist
    """
    # ========== CHECK BLACKLIST TRƯỚC ==========
    # Đơn đã hoàn tiền sẽ bị block vĩnh viễn
    if is_order_blacklisted(order_code):
        logging.info(f"🚫 Đơn {order_code} đã bị blacklist (đã hoàn tiền)")
        return None
    
    history = load_order_history()
    
    # Chuẩn hóa order code: "order xxx" -> "order_xxx"
    normalized_code = order_code.strip()
    if normalized_code.lower().startswith("order "):
        # Thay space đầu tiên sau "order" thành underscore
        normalized_code = "order_" + normalized_code[6:].strip()
    
    # Thử tìm với code gốc và normalized
    result = (
        history.get(order_code.upper()) or 
        history.get(order_code.lower()) or
        history.get(normalized_code.upper()) or
        history.get(normalized_code.lower()) or
        history.get(normalized_code)
    )
    
    # Nếu tìm thấy trong file local → trả về
    if result:
        return result
    
    # Nếu mã đơn có dạng "order_xxx" hoặc "order xxx" (seller) → query Inventory API
    is_seller_order = (
        normalized_code.lower().startswith("order_") or
        normalized_code.lower().startswith("seller_") or
        "_" in order_code  # Format: reseller_20260131_123
    )
    
    if is_seller_order:
        try:
            import requests
            INVENTORY_API_URL = "https://shopmmoapikey.shop"
            
            # Thử với normalized code trước
            api_order_id = normalized_code.lower()
            response = requests.get(
                f"{INVENTORY_API_URL}/v1/orders/{api_order_id}",
                timeout=5
            )
            if response.status_code == 200:
                data = response.json()
                if data.get("success") and data.get("order"):
                    order = data["order"]
                    # Enrich seller order with sheet_tab_name nếu thiếu
                    if not order.get('sheet_tab_name'):
                        pname = (order.get('product_name') or '').lower()
                        if 'veo3' in pname or 'ultra 45' in pname:
                            order['sheet_tab_name'] = 'Veo3 Ultra 45'
                        if not order.get('warranty_days'):
                            order['warranty_days'] = 30
                    logging.info(f"📦 Tìm thấy đơn seller từ API: {order_code}")
                    return order
            
            # Nếu không tìm thấy, thử với code gốc
            if api_order_id != order_code.lower():
                response = requests.get(
                    f"{INVENTORY_API_URL}/v1/orders/{order_code.lower()}",
                    timeout=5
                )
                if response.status_code == 200:
                    data = response.json()
                    if data.get("success") and data.get("order"):
                        order = data["order"]
                        if not order.get('sheet_tab_name'):
                            pname = (order.get('product_name') or '').lower()
                            if 'veo3' in pname or 'ultra 45' in pname:
                                order['sheet_tab_name'] = 'Veo3 Ultra 45'
                            if not order.get('warranty_days'):
                                order['warranty_days'] = 30
                        logging.info(f"📦 Tìm thấy đơn seller từ API (code gốc): {order_code}")
                        return order
                        
        except Exception as e:
            logging.debug(f"Không thể query API cho {order_code}: {e}")
    
    return None

def cleanup_old_orders():
    """Xóa các đơn hàng > 31 ngày khỏi lịch sử
    Được gọi định kỳ hoặc khi khởi động bot
    """
    history = load_order_history()
    if not history:
        return 0
    
    now = get_vietnam_now()
    removed = 0
    orders_to_keep = {}
    
    for order_code, order in history.items():
        try:
            purchase_date = datetime.fromisoformat(order.get('purchase_date', ''))
            # Đảm bảo có timezone
            if purchase_date.tzinfo is None:
                purchase_date = purchase_date.replace(tzinfo=VIETNAM_TZ)
            
            days_since = (now.date() - purchase_date.date()).days
            
            # Xóa tất cả đơn > 31 ngày, bất kể warranty
            if days_since <= 31:
                orders_to_keep[order_code] = order
            else:
                removed += 1
                logging.info(f"🗑️ Xóa đơn {order_code} khỏi lịch sử (đã {days_since} ngày)")

        except Exception as e:
            # Nếu không parse được ngày, giữ lại đơn hàng
            orders_to_keep[order_code] = order
            logging.warning(f"⚠️ Không parse được ngày đơn {order_code}: {e}")
    
    if removed > 0:
        save_order_history(orders_to_keep)
        logging.info(f"✅ Đã xóa {removed} đơn hàng cũ khỏi order history")
    
    return removed

def calculate_warranty_refund(order):
    """Tính số tiền hoàn trả dựa trên ngày hết hạn bảo hành
    
    Công thức: refund = (days_remaining / total_warranty_days) * total_amount
    Trong đó total_warranty_days = từ ngày mua đến ngày hết hạn
    
    Args:
        order: Dict thông tin đơn hàng từ order history
        
    Returns:
        int: Số tiền hoàn trả (đã làm tròn)
    """
    if not order:
        return 0
    
    try:
        now = get_vietnam_now()
        total_amount = order.get('total_amount', 0)
        
        # Ưu tiên sử dụng warranty_expiry_date (format YYYY-MM-DD)
        warranty_expiry_date = order.get('warranty_expiry_date')
        
        if warranty_expiry_date:
            # Ngày hết hạn cố định
            expiry_date = datetime.strptime(warranty_expiry_date, "%Y-%m-%d")
            expiry_date = expiry_date.replace(hour=23, minute=59, second=59, tzinfo=VIETNAM_TZ)
            
            # Ngày mua
            purchase_date = datetime.fromisoformat(order.get('purchase_date', ''))
            if purchase_date.tzinfo is None:
                purchase_date = purchase_date.replace(tzinfo=VIETNAM_TZ)
            
            # Tổng số ngày bảo hành (từ mua đến hết hạn)
            total_warranty_days = (expiry_date.date() - purchase_date.date()).days
            
            # Số ngày còn lại (từ hôm nay đến hết hạn)
            days_remaining = (expiry_date.date() - now.date()).days
            
            # Kiểm tra đã hết hạn chưa
            if days_remaining <= 0:
                return 0
            
            # Tính tiền hoàn
            if total_warranty_days > 0:
                refund = int((days_remaining / total_warranty_days) * total_amount)
                # Làm tròn xuống 1000
                refund = (refund // 1000) * 1000
                return refund
        
        return 0
    except Exception as e:
        logging.error(f"Lỗi tính tiền hoàn: {e}")
        return 0


def get_verify_price(country_code: str = "ID"):
    """Lấy giá verify theo quốc gia - có thể thay đổi trong VERIFY_COUNTRY_PRICING"""
    if country_code in VERIFY_COUNTRY_PRICING:
        return VERIFY_COUNTRY_PRICING[country_code]["price"]
    return VERIFY_PRICE_DEFAULT


def save_pending_orders():
    """Lưu pending_orders vào file JSON"""
    try:
        os.makedirs(os.path.dirname(PENDING_ORDERS_FILE), exist_ok=True)
        with open(PENDING_ORDERS_FILE, "w", encoding="utf-8") as f:
            json.dump(pending_orders, f, ensure_ascii=False, indent=2)
    except Exception as e:
        logging.error(f"Lỗi lưu pending_orders: {e}")

def load_pending_orders():
    """Load pending_orders từ file JSON khi khởi động bot"""
    global pending_orders
    try:
        if os.path.exists(PENDING_ORDERS_FILE):
            with open(PENDING_ORDERS_FILE, "r", encoding="utf-8") as f:
                pending_orders = json.load(f)
            logging.info(f"✅ Đã load {len(pending_orders)} pending orders từ file")
        else:
            pending_orders = {}
    except Exception as e:
        logging.error(f"Lỗi load pending_orders: {e}")
        pending_orders = {}

# ==============================================================================
# 2. HÀM HỖ TRỢ
# ==============================================================================

# Note: Logging đã được config ở đầu file

def get_cached_data(key, fetch_func, timeout=CACHE_TIMEOUT):
    """Cache dữ liệu để giảm lag"""
    now = time.time()
    if key in SHEETS_CACHE:
        data, timestamp = SHEETS_CACHE[key]
        if now - timestamp < timeout:
            return data
    data = fetch_func()
    SHEETS_CACHE[key] = (data, now)
    return data

def clear_cache():
    """Xóa tất cả cache - gọi khi có thay đổi dữ liệu"""
    global _worksheets_cache, _worksheets_cache_time
    SHEETS_CACHE.clear()
    _worksheets_cache = None
    _worksheets_cache_time = 0
    logging.info("🗑️ Đã xóa toàn bộ cache")


def clear_cache_key(key):
    """Xóa cache theo key cụ thể
    
    Args:
        key: Tên key cần xóa (ví dụ: 'menu_data')
    """
    if key in SHEETS_CACHE:
        del SHEETS_CACHE[key]
        logging.debug(f"🗑️ Đã xóa cache key: {key}")
        return True
    return False


def get_cache_stats():
    """Lấy thông tin cache để debug hiệu suất"""
    import time as _time
    now = _time.time()
    stats = {
        'total_items': len(SHEETS_CACHE),
        'items': {}
    }
    for key, (data, timestamp) in SHEETS_CACHE.items():
        age = now - timestamp
        stats['items'][key] = {
            'age_seconds': round(age, 1),
            'is_expired': age > CACHE_TIMEOUT
        }
    return stats


# ==============================================================================
# ANNOUNCEMENT SYSTEM
# ==============================================================================

# ==============================================================================
# ACTIVE ORDERS SYSTEM (Đơn hàng đang chờ admin xử lý)
# ==============================================================================

def load_active_orders():
    """Load active orders từ file"""
    global active_orders
    if os.path.exists(ACTIVE_ORDERS_FILE):
        try:
            with open(ACTIVE_ORDERS_FILE, "r", encoding="utf-8") as f:
                active_orders = json.load(f)
        except Exception as e:
            logging.error(f"Lỗi load active orders: {e}")
            active_orders = {}
    return active_orders

def save_active_orders():
    """Lưu active orders vào file"""
    try:
        os.makedirs(os.path.dirname(ACTIVE_ORDERS_FILE), exist_ok=True)
        with open(ACTIVE_ORDERS_FILE, "w", encoding="utf-8") as f:
            json.dump(active_orders, f, ensure_ascii=False, indent=2)
    except Exception as e:
        logging.error(f"Lỗi lưu active orders: {e}")

def is_addfarm_product(product_name: str) -> bool:
    """Kiểm tra sản phẩm có phải ADD Farm không.
    Tên bắt đầu bằng 'Add Farm' (không phân biệt hoa thường)
    """
    if not product_name:
        return False
    return product_name.strip().lower().startswith("add farm")


def is_verify_product(product_name: str) -> bool:
    """Kiểm tra sản phẩm có phải loại Verify (2-optin) không.
    Tên bắt đầu bằng 'Verify' (không phân biệt hoa thường)
    Ví dụ: 'Verify Sheerid', 'Verify Netflix', 'Verify Quân Nhân'
    """
    if not product_name:
        return False
    return product_name.strip().lower().startswith("verify")

async def send_admin_message_with_keyboard(bot, text, keyboard, parse_mode='HTML'):
    """Gửi thông báo cho tất cả admin kèm keyboard"""
    from telegram import InlineKeyboardMarkup
    for admin_id in ADMIN_IDS:
        try:
            await bot.send_message(
                chat_id=admin_id, 
                text=text, 
                parse_mode=parse_mode,
                reply_markup=InlineKeyboardMarkup(keyboard) if keyboard else None
            )
            logging.info(f"✅ Đã gửi thông báo (có keyboard) cho admin {admin_id}")
        except Exception as e:
            logging.error(f"❌ Lỗi gửi thông báo cho admin {admin_id}: {e}")
        await asyncio.sleep(0.1)

def load_announcements():
    """Load danh sách thông báo"""
    if not os.path.exists(ANNOUNCEMENTS_FILE):
        return []
    try:
        with open(ANNOUNCEMENTS_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except:
        return []

def save_announcements(announcements):
    """Lưu danh sách thông báo"""
    try:
        with open(ANNOUNCEMENTS_FILE, "w", encoding="utf-8") as f:
            json.dump(announcements, f, ensure_ascii=False, indent=2)
    except Exception as e:
        logging.error(f"Lỗi lưu thông báo: {e}")

def add_user_to_list(user_id, username, full_name):
    """Thêm user vào danh sách đã truy cập"""
    users = load_users_list()
    user_key = str(user_id)
    if user_key not in users:
        users[user_key] = {
            "user_id": user_id,
            "username": username or "",
            "full_name": full_name,
            "first_seen": get_vietnam_now().isoformat(),
            "last_seen": get_vietnam_now().isoformat()
        }
    else:
        users[user_key]["last_seen"] = get_vietnam_now().isoformat()
        if username:
            users[user_key]["username"] = username
        if full_name:
            users[user_key]["full_name"] = full_name
    save_users_list(users)

def load_users_list():
    """Load danh sách user đã truy cập"""
    if not os.path.exists(USERS_FILE):
        return {}
    try:
        with open(USERS_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except:
        return {}

def save_users_list(users):
    """Lưu danh sách user"""
    try:
        with open(USERS_FILE, "w", encoding="utf-8") as f:
            json.dump(users, f, ensure_ascii=False, indent=2)
    except Exception as e:
        logging.error(f"Lỗi lưu danh sách user: {e}")

# ==============================================================================
# BALANCE/WALLET SYSTEM
# ==============================================================================

def get_user_balance(user_id) -> int:
    """Lấy số dư của user (đơn vị: VNĐ)"""
    users = load_users_list()
    user_key = str(user_id)
    if user_key in users:
        return users[user_key].get("balance", 0)
    return 0

def set_user_balance(user_id, amount: int):
    """Đặt số dư cho user"""
    users = load_users_list()
    user_key = str(user_id)
    if user_key not in users:
        users[user_key] = {"user_id": user_id}
    users[user_key]["balance"] = max(0, int(amount))  # Không cho phép số dư âm
    save_users_list(users)
    logging.info(f"💰 Set balance cho user {user_id}: {amount}đ")

def add_user_balance(user_id, amount: int) -> int:
    """Cộng tiền vào số dư của user. Trả về số dư mới."""
    current = get_user_balance(user_id)
    new_balance = current + int(amount)
    set_user_balance(user_id, new_balance)
    logging.info(f"💰 Cộng {amount}đ cho user {user_id}. Số dư mới: {new_balance}đ")
    return new_balance

def subtract_user_balance(user_id, amount: int) -> tuple:
    """Trừ tiền từ số dư của user. Trả về (success, new_balance)."""
    current = get_user_balance(user_id)
    if current < amount:
        logging.warning(f"⚠️ User {user_id} không đủ số dư. Cần: {amount}đ, Có: {current}đ")
        return False, current
    new_balance = current - int(amount)
    set_user_balance(user_id, new_balance)
    logging.info(f"💰 Trừ {amount}đ từ user {user_id}. Số dư mới: {new_balance}đ")
    return True, new_balance

def format_balance(amount: int) -> str:
    """Format số tiền đẹp: 470000 -> 470.000 VNĐ"""
    return f"{amount:,}".replace(",", ".") + " VNĐ"

# ==============================================================================
# LANGUAGE SELECTION SYSTEM
# ==============================================================================

DEFAULT_LANGUAGE = "vi"  # Mặc định tiếng Việt

def get_user_language(user_id):
    """Lấy ngôn ngữ đã chọn của user (mặc định: vi)"""
    users = load_users_list()
    user_key = str(user_id)
    if user_key in users:
        return users[user_key].get("language", DEFAULT_LANGUAGE)
    return DEFAULT_LANGUAGE

def set_user_language(user_id, language):
    """Lưu ngôn ngữ đã chọn của user"""
    users = load_users_list()
    user_key = str(user_id)
    if user_key not in users:
        users[user_key] = {"user_id": user_id}
    users[user_key]["language"] = language
    save_users_list(users)

# Các bản dịch cơ bản
TRANSLATIONS = {
    "vi": {
        "greeting": "Xin chào <b>{name}</b>! 👋\n\nMình có thể giúp gì cho bạn?\n\n💡 <b>Bạn muốn làm gì tiếp theo?</b>",
        "what_next": "💡 <b>Bạn muốn làm gì tiếp theo?</b>\n\n🛍️ Bấm nút <b>Sản phẩm</b> để xem menu\n📦 Bấm nút <b>Đơn hàng</b> để tra cứu\n💬 Bấm nút <b>Hỗ trợ</b> để liên hệ admin",
        "language_changed": "✅ Đã chuyển sang <b>Tiếng Việt</b>!",
        "select_language": "🌐 Chọn ngôn ngữ:"
    },
    "en": {
        "greeting": "Hello <b>{name}</b>! 👋\n\nHow can I help you?\n\n💡 <b>What would you like to do next?</b>",
        "what_next": "💡 <b>What would you like to do next?</b>\n\n🛍️ Press <b>Products</b> to view menu\n📦 Press <b>Orders</b> to check orders\n💬 Press <b>Support</b> to contact admin",
        "language_changed": "✅ Switched to <b>English</b>!",
        "select_language": "🌐 Select language:"
    }
}

def get_text(user_id, key, **kwargs):
    """Lấy text theo ngôn ngữ của user"""
    lang = get_user_language(user_id)
    text = TRANSLATIONS.get(lang, TRANSLATIONS["vi"]).get(key, TRANSLATIONS["vi"].get(key, key))
    if kwargs:
        text = text.format(**kwargs)
    return text

def get_language_keyboard():
    """Tạo inline keyboard chọn ngôn ngữ"""
    keyboard = [
        [
            InlineKeyboardButton("🇻🇳 Tiếng Việt", callback_data="lang_vi"),
            InlineKeyboardButton("🇺🇸 English", callback_data="lang_en")
        ]
    ]
    return InlineKeyboardMarkup(keyboard)

async def handle_language_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Xử lý khi user chọn ngôn ngữ"""
    global BOT_STOPPED
    query = update.callback_query
    user_id = query.from_user.id
    
    # Kiểm tra bảo trì - Admin bypass
    if not is_admin(user_id) and BOT_STOPPED:
        await query.answer(MAINTENANCE_ALERT, show_alert=True)
        return
    
    await query.answer()
    callback_data = query.data
    
    if callback_data == "lang_vi":
        set_user_language(user_id, "vi")
        msg = "✅ Đã chuyển sang <b>Tiếng Việt</b>!"
    elif callback_data == "lang_en":
        set_user_language(user_id, "en")
        msg = "✅ Switched to <b>English</b>!"
    else:
        return
    
    await query.edit_message_text(
        msg,
        parse_mode='HTML'
    )
    
    logging.info(f"User {user_id} đã chọn ngôn ngữ: {callback_data.replace('lang_', '')}")

async def send_greeting_with_language(update: Update, context: ContextTypes.DEFAULT_TYPE, user):
    """Gửi lời chào kèm nút chọn ngôn ngữ"""
    user_id = user.id
    lang = get_user_language(user_id)
    
    greeting_text = get_text(user_id, "greeting", name=user.full_name)
    
    # Tạo inline keyboard với nút ngôn ngữ
    keyboard = [
        [
            InlineKeyboardButton("🇻🇳 Tiếng Việt", callback_data="lang_vi"),
            InlineKeyboardButton("🇺🇸 English", callback_data="lang_en")
        ]
    ]
    
    await update.message.reply_text(
        f"🌐 <b>Select language:</b>\n\n{greeting_text}",
        reply_markup=InlineKeyboardMarkup(keyboard),
        parse_mode='HTML'
    )
    
    # Gửi reply keyboard riêng
    await update.message.reply_text(
        "⬇️",
        reply_markup=get_reply_keyboard(update.effective_user.id if update and update.effective_user else None)
    )

def get_active_announcements():
    """Lấy thông báo đang active"""
    announcements = load_announcements()
    now = get_vietnam_now()
    active = []
    for ann in announcements:
        if not ann.get("active", True):
            continue
        expires = ann.get("expires")
        if expires:
            try:
                exp_date = datetime.fromisoformat(expires)
                if exp_date < now:
                    continue
            except:
                pass
        active.append(ann)
    return active

# ==============================================================================
# NOTE REMINDER SYSTEM (ADMIN)
# ==============================================================================

def load_notes():
    if not os.path.exists(NOTES_FILE):
        return []
    try:
        with open(NOTES_FILE, "r", encoding="utf-8") as f:
            content = f.read().strip()
            if not content:  # File trống
                return []
            return json.loads(content)
    except json.JSONDecodeError:
        # File hỏng hoặc không hợp lệ - khởi tạo lại
        logging.warning(f"⚠️ File {NOTES_FILE} không hợp lệ, tạo lại file mới")
        save_notes([])
        return []
    except Exception as e:
        logging.error(f"Lỗi đọc file note: {e}")
        return []


def save_notes(notes):
    try:
        with open(NOTES_FILE, "w", encoding="utf-8") as f:
            json.dump(notes, f, ensure_ascii=False, indent=2)
    except Exception as e:
        logging.error(f"Lỗi lưu note: {e}")


def remove_note(note_id: str):
    notes = load_notes()
    new_notes = [n for n in notes if n.get("id") != note_id]
    if len(new_notes) != len(notes):
        save_notes(new_notes)


def _parse_note_date(date_text: str):
    """Parse dd/mm/yyyy (hoặc dd-mm-yyyy). Trả về datetime theo múi giờ VN hoặc None."""
    if not date_text:
        return None
    match = re.search(r"(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})", date_text.strip())
    if not match:
        return None
    d, m, y = match.groups()
    try:
        day = int(d)
        month = int(m)
        year = int(y)
        if year < 100:
            year += 2000
        return datetime(year, month, day, tzinfo=VIETNAM_TZ)
    except Exception:
        return None


# ==============================================================================
# PRODUCT TYPE DETECTION (SHEERID / CHECKOUT)
# ==============================================================================

def is_sheerid_product(product_id: str) -> bool:
    """Kiểm tra sản phẩm có phải dạng SheerID Verify không.
    ID bắt đầu bằng 2 số 0 và có 3 ký tự (ví dụ: 001, 002, 003)
    HOẶC ID có đúng 3 ký tự và bắt đầu bằng "00" theo sau là số 1-9
    """
    if not product_id:
        return False
    product_id = str(product_id).strip()
    import re
    # Pattern 1: ID có đúng 3 ký tự, bắt đầu bằng 00, theo sau là 1-9
    # Ví dụ: 001, 002, 003, 009
    if re.match(r'^00[1-9]$', product_id):
        logging.debug(f"is_sheerid_product: ID '{product_id}' matched pattern ^00[1-9]$")
        return True
    # Pattern 2: ID bắt đầu bằng 00 nhưng KHÔNG bắt đầu bằng 000 (để không match Checkout)
    # và có độ dài 3
    if len(product_id) == 3 and product_id.startswith('00') and not product_id.startswith('000'):
        logging.debug(f"is_sheerid_product: ID '{product_id}' matched length=3, starts with 00")
        return True
    return False


def is_checkout_product(product_id: str) -> bool:
    """Kiểm tra sản phẩm có phải dạng Checkout không.
    ID bắt đầu bằng 3 số 0 và có 4 ký tự (ví dụ: 0001, 0002, 0003)
    HOẶC ID có độ dài 4+ và bắt đầu bằng "000"
    """
    if not product_id:
        return False
    product_id = str(product_id).strip()
    import re
    # Pattern 1: ID có đúng 4 ký tự, bắt đầu bằng 000, theo sau là 1-9
    # Ví dụ: 0001, 0002, 0003, 0009
    if re.match(r'^000[1-9]$', product_id):
        logging.debug(f"is_checkout_product: ID '{product_id}' matched pattern ^000[1-9]$")
        return True
    # Pattern 2: ID bắt đầu bằng 000 và có độ dài 4+
    if len(product_id) >= 4 and product_id.startswith('000'):
        logging.debug(f"is_checkout_product: ID '{product_id}' matched length>=4, starts with 000")
        return True
    return False



def get_product_type_from_id(product_id: str) -> str:
    """Xác định loại sản phẩm dựa vào ID.
    Returns:
        'slot' - Sản phẩm dạng Slot (tên bắt đầu bằng 'Slot')
        'sheerid' - Sản phẩm SheerID Verify (ID: 001, 002, 003...)
        'checkout' - Sản phẩm Checkout (ID: 0001, 0002, 0003...)
        'normal' - Sản phẩm thường
    """
    if is_checkout_product(product_id):
        return 'checkout'
    if is_sheerid_product(product_id):
        return 'sheerid'
    return 'normal'


async def note_reminder_job(context: ContextTypes.DEFAULT_TYPE):
    """Job nhắc admin về note đã đặt.
    Nhắc liên tục 3 lần trong 3 phút (mỗi phút 1 lần), sau đó tự động xóa note.
    """
    job = context.job
    note = job.data if job else None
    if not note:
        return
    
    note_id = note.get("id")
    reminder_count = note.get('_reminder_count', 0)
    
    reminder_text = (
        f"🔔 <b>NHẮC NHỞ HẾT HẠN</b> (Lần {reminder_count + 1}/3)\n\n"
        f"📝 {note.get('info', 'Không có nội dung')}\n"
        f"⏰ Hết hạn vào: {note.get('expiry_date', 'N/A')}\n"
        f"👤 Ghi chú bởi admin: {note.get('created_by', 'N/A')}"
    )
    
    try:
        await send_to_all_admins(context.bot, reminder_text, parse_mode='HTML')
    except Exception as e:
        logging.error(f"Lỗi gửi nhắc nhở note: {e}")
    
    # Tăng số lần đã nhắc
    reminder_count += 1
    
    if reminder_count >= 3:
        # Đã nhắc đủ 3 lần -> Xóa note
        if note_id:
            remove_note(note_id)
            logging.info(f"✅ Đã nhắc đủ 3 lần và xóa note {note_id}")
    else:
        # Chưa đủ 3 lần -> Đặt lịch nhắc tiếp sau 1 phút
        note['_reminder_count'] = reminder_count
        try:
            # Lên lịch nhắc tiếp sau 60 giây
            context.job_queue.run_once(
                note_reminder_job,
                when=60,  # 1 phút
                data=note,
                name=f"{note_id}_reminder_{reminder_count + 1}"
            )
            logging.info(f"📅 Đã lên lịch nhắc note {note_id} lần {reminder_count + 1}/3 sau 1 phút")
        except Exception as e:
            logging.error(f"Lỗi lên lịch nhắc tiếp: {e}")
            # Nếu không lên lịch được, xóa note luôn
            if note_id:
                remove_note(note_id)


def schedule_note_job(application, note: dict):
    """Đặt job run_once để nhắc admin lúc 11h ngày hết hạn."""
    if not application or not application.job_queue:
        logging.warning("JobQueue không khả dụng - không thể đặt nhắc nhở note.")
        return False
    try:
        remind_at = datetime.fromisoformat(note["remind_at"])
    except Exception as e:
        logging.error(f"Lỗi parse remind_at cho note: {e}")
        return False
    delay_seconds = (remind_at - get_vietnam_now()).total_seconds()
    if delay_seconds < 0:
        delay_seconds = 0
    # Hủy job cũ (nếu có) để tránh trùng
    try:
        existing_jobs = application.job_queue.get_jobs_by_name(note["id"])
        for job in existing_jobs:
            job.schedule_removal()
    except Exception:
        pass
    application.job_queue.run_once(
        note_reminder_job,
        when=delay_seconds,
        data=note,
        name=note["id"]
    )
    logging.info(f"✅ Đã lên lịch nhắc nhở note {note.get('id')} lúc {note.get('remind_at')}")
    return True


def restore_note_jobs(application):
    """Khôi phục các job note từ file khi khởi động bot."""
    notes = load_notes()
    if not notes:
        return
    now = get_vietnam_now()
    restored = 0
    for note in notes:
        try:
            remind_at = datetime.fromisoformat(note.get("remind_at"))
        except Exception:
            continue
        # Nếu đã quá hạn, nhắc ngay
        if remind_at < now:
            remind_at = now
            note["remind_at"] = remind_at.isoformat()
        if schedule_note_job(application, note):
            restored += 1
    logging.info(f"🔄 Khôi phục {restored}/{len(notes)} nhắc nhở note.")

# ==============================================================================
# GOOGLE SHEETS FUNCTIONS (OPTIMIZED)
# ==============================================================================

# ==============================================================================
# ASYNC WRAPPER - GIẢI QUYẾT LAG DO BLOCKING API CALLS
# ==============================================================================

async def run_blocking(func, *args, **kwargs):
    """
    Chạy blocking function (như gspread API) trong thread pool 
    để KHÔNG BLOCK event loop của Telegram bot.
    
    Đây là giải pháp chính để bot phản hồi nhanh như các bot khác.
    """
    import functools
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, functools.partial(func, *args, **kwargs))


async def get_menu_data_async():
    """
    Async version của get_menu_data_cached - KHÔNG BLOCK event loop.
    Sử dụng hàm này trong các handler thay vì get_menu_data_cached().
    """
    return await run_blocking(get_menu_data_cached)


async def preload_cache():
    """Preload menu data vào cache khi bot start để khách đầu tiên không phải chờ"""
    try:
        await run_blocking(get_menu_data_cached)
        logging.info("✅ Đã preload menu data vào cache - bot sẵn sàng phản hồi nhanh")
    except Exception as e:
        logging.error(f"❌ Lỗi preload cache: {e}")

# ==============================================================================

_db_client = None

def get_db():
    """Lấy Google Sheets client với cache"""
    global _db_client
    if _db_client is None:
        scope = [
            "https://spreadsheets.google.com/feeds",
            'https://www.googleapis.com/auth/spreadsheets',
            "https://www.googleapis.com/auth/drive.file",
            "https://www.googleapis.com/auth/drive"
        ]
        if not os.path.exists(SERVICE_ACCOUNT_FILE):
            raise FileNotFoundError(f"Không tìm thấy file {SERVICE_ACCOUNT_FILE}")
        creds = ServiceAccountCredentials.from_json_keyfile_name(SERVICE_ACCOUNT_FILE, scope)
        client = gspread.authorize(creds)
        _db_client = client.open(SHEET_NAME)
    return _db_client

# Cache danh sách worksheet để không phải gọi API mỗi lần
_worksheets_cache = None
_worksheets_cache_time = 0

def get_all_worksheets_cached(db, timeout=120):
    """Lấy tất cả worksheets với cache dài hạn"""
    global _worksheets_cache, _worksheets_cache_time
    import time as _time
    now = _time.time()
    if _worksheets_cache is not None and (now - _worksheets_cache_time) < timeout:
        return _worksheets_cache
    _worksheets_cache = db.worksheets()
    _worksheets_cache_time = now
    return _worksheets_cache

def get_worksheet_by_name(db, name):
    """Tìm worksheet theo tên với cache - TỐI ƯU: dùng cache danh sách"""
    cache_key = f"worksheet_{name}"
    def fetch():
        # Sử dụng cache danh sách worksheet thay vì gọi API mỗi lần
        all_sheets = get_all_worksheets_cached(db, timeout=CACHE_TIMEOUT_LONG)
        for sheet in all_sheets:
            if sheet.title.lower().strip() == name.lower().strip():
                return sheet
        return None
    return get_cached_data(cache_key, fetch, timeout=CACHE_TIMEOUT)

def get_menu_data_cached():
    """Lấy menu với cache (bao gồm cột E - Bảo hành, cột F - Số Ngày)
    
    Cột E (ngày hết hạn BH) được tự động cập nhật bởi scheduled task vào 23:59 hằng ngày.
    """
    def fetch():
        try:
            db = get_db()
            ws_menu = db.worksheet(MENU_SHEET_NAME)
            all_rows = ws_menu.get_all_values()
            # Cấu trúc: ID | Tên Sản Phẩm | Giá | Tên Tab Sheet Thật | Bảo hành | Số Ngày
            products = []
            for row in all_rows[1:]:  # Bỏ header
                if len(row) >= 4:
                    # Đọc cột E (Bảo hành) - chỉ để hiển thị tham khảo
                    warranty_text = row[4].strip() if len(row) > 4 else ""
                    
                    # Đọc cột F (Số Ngày) - MASTER SETTING cho warranty
                    warranty_days_text = row[5].strip() if len(row) > 5 else ""
                    
                    # Parse warranty_days từ cột F: "30 Ngày", "30 ngày", "30"
                    warranty_days = 0
                    if warranty_days_text:
                        import re
                        if 'không' in warranty_days_text.lower():
                            warranty_days = 0
                        else:
                            # Tìm số trong text
                            days_match = re.search(r'(\d+)', warranty_days_text)
                            if days_match:
                                warranty_days = int(days_match.group(1))
                    
                    # Nếu có warranty_days > 0 nhưng không có text ở cột E, 
                    # tự động tính ngày hết hạn tham khảo
                    warranty_expiry_display = warranty_text
                    if warranty_days > 0 and not warranty_text:
                        now = get_vietnam_now()
                        from datetime import timedelta
                        ref_expiry = now + timedelta(days=warranty_days)
                        warranty_expiry_display = f"BH đến {ref_expiry.strftime('%d/%m')}"
                    
                    products.append({
                        'id': row[0].strip() if len(row) > 0 else "",
                        'name': row[1].strip() if len(row) > 1 else "",
                        'price_str': row[2].strip() if len(row) > 2 else "",
                        'sheet_tab': row[3].strip() if len(row) > 3 else "",
                        'warranty_days': warranty_days,  # Số ngày BH từ cột F
                        'warranty_text': warranty_expiry_display,  # Text hiển thị
                        'warranty_expiry_date': None  # Sẽ được tính khi mua hàng
                    })
            return products
        except Exception as e:
            logging.error(f"Lỗi load menu: {e}")
            return []
    return get_cached_data("menu_data", fetch, timeout=180)  # 3 phút cache - GIẢM LAG ĐÁNG KỂ


# ============================================================================
# AUTO UPDATE WARRANTY DATE IN SHEET COLUMN E
# ============================================================================

_last_warranty_update = 0  # Timestamp lần update cuối

def update_warranty_column_e():
    """
    Tự động cập nhật cột E (Bảo hành) trong Sheet MENU
    Công thức: Cột E = Hôm nay + Cột F (Số Ngày)
    
    Ví dụ: Nếu hôm nay là 29/01 và cột F = "30 Ngày"
           → Cột E sẽ được ghi: "BH đến 28/02"
    """
    global _last_warranty_update
    import re
    
    now = get_vietnam_now()
    
    # Chỉ update tối đa 1 lần mỗi 30 phút để GIẢM LAG (warranty chỉ thay đổi 1 lần/ngày)
    if now.timestamp() - _last_warranty_update < 1800:  # 30 phút
        return
    
    try:
        db = get_db()
        ws_menu = db.worksheet(MENU_SHEET_NAME)
        all_rows = ws_menu.get_all_values()
        
        if len(all_rows) <= 1:
            return
        
        updates = []  # List các ô cần update
        
        for idx, row in enumerate(all_rows[1:], start=2):  # Bắt đầu từ row 2 (bỏ header)
            if len(row) < 6:
                continue
            
            # Đọc cột F (Số Ngày)
            warranty_days_text = row[5].strip() if len(row) > 5 else ""
            if not warranty_days_text:
                continue
            
            # Parse số ngày
            warranty_days = 0
            if 'không' in warranty_days_text.lower():
                warranty_days = 0
            else:
                days_match = re.search(r'(\d+)', warranty_days_text)
                if days_match:
                    warranty_days = int(days_match.group(1))
            
            if warranty_days <= 0:
                continue
            
            # Tính ngày hết hạn = Hôm nay + warranty_days
            from datetime import timedelta
            expiry_date = now + timedelta(days=warranty_days)
            new_warranty_text = f"BH đến {expiry_date.strftime('%d/%m')}"
            
            # So sánh với giá trị hiện tại để tránh ghi không cần thiết
            current_value = row[4].strip() if len(row) > 4 else ""
            if current_value != new_warranty_text:
                # Cột E = cột thứ 5 = index 5 trong A1 notation
                cell_address = f"E{idx}"
                updates.append({
                    'range': cell_address,
                    'values': [[new_warranty_text]]
                })
        
        # Batch update nếu có thay đổi
        if updates:
            ws_menu.batch_update(updates)
            logging.info(f"📅 Đã cập nhật {len(updates)} ngày BH trong Sheet MENU")
            _last_warranty_update = now.timestamp()
            
            # Clear cache menu để load lại data mới
            clear_cache_key("menu_data")
        
    except Exception as e:
        logging.error(f"❌ Lỗi update warranty column E: {e}")


async def cmd_update_baohanh(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """
    Admin command: Force update cột E (Bảo hành) ngay lập tức
    Dùng để test mà không cần chờ đến 23:59
    
    Cú pháp: /updatebaohanh [+N] 
    - /updatebaohanh      → Cập nhật với ngày hôm nay
    - /updatebaohanh +1   → Cập nhật như đã sang ngày mai
    - /updatebaohanh +7   → Cập nhật như đã qua 1 tuần
    """
    user_id = update.effective_user.id
    if not is_admin(user_id):
        await update.message.reply_text("❌ Bạn không có quyền sử dụng lệnh này.")
        return
    
    # Parse số ngày offset từ argument
    days_offset = 0
    if context.args:
        try:
            arg = context.args[0]
            if arg.startswith('+'):
                days_offset = int(arg[1:])
            else:
                days_offset = int(arg)
        except ValueError:
            await update.message.reply_text("❌ Cú pháp sai. Ví dụ: /updatebaohanh +1")
            return
    
    await update.message.reply_text(
        f"⏳ Đang cập nhật cột Bảo hành...\n"
        f"📅 Offset: +{days_offset} ngày" if days_offset > 0 else "⏳ Đang cập nhật cột Bảo hành..."
    )
    
    try:
        global _last_warranty_update
        _last_warranty_update = 0  # Reset để force update
        
        # Nếu có offset, tạm thời override hàm get_vietnam_now
        if days_offset > 0:
            original_now = get_vietnam_now()
            fake_now = original_now + timedelta(days=days_offset)
            
            # Gọi update CẢ 2 sheet với ngày giả lập
            update_warranty_column_e_with_date(fake_now)
            reseller_count = update_reseller_warranty_with_date(fake_now)
            
            await update.message.reply_text(
                f"✅ Đã cập nhật Bảo hành với ngày giả lập!\n\n"
                f"📅 Ngày thật: {original_now.strftime('%d/%m/%Y')}\n"
                f"🔮 Ngày giả lập: {fake_now.strftime('%d/%m/%Y')}\n\n"
                f"📋 Sheet MENU: Đã cập nhật\n"
                f"📋 Sheet Kho hàng reseller: Đã cập nhật {reseller_count} sản phẩm"
            )
        else:
            # Gọi update CẢ 2 sheet với ngày hiện tại
            update_warranty_column_e()
            reseller_count = update_reseller_warranty_column_e()
            
            await update.message.reply_text(
                f"✅ Đã cập nhật cột Bảo hành thành công!\n\n"
                f"📅 Ngày: {get_vietnam_now().strftime('%d/%m/%Y')}\n"
                f"📋 Sheet MENU: Đã cập nhật\n"
                f"📋 Sheet Kho hàng reseller: Đã cập nhật {reseller_count} sản phẩm"
            )
        
        logging.info(f"🔧 Admin {user_id} đã force update warranty column E (offset: +{days_offset} ngày)")
        
    except Exception as e:
        logging.error(f"❌ Lỗi cmd_update_baohanh: {e}")
        await update.message.reply_text(f"❌ Lỗi: {e}")


async def cmd_off_baohanh(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """
    Admin command: Toggle on/off các option bảo hành
    
    Cú pháp: /offbaohanh [số]
    - /offbaohanh     → Hiển thị menu và trạng thái hiện tại
    - /offbaohanh 1   → Toggle option Hoàn tiền
    - /offbaohanh 2   → Toggle option Đổi acc mới
    - /offbaohanh 0   → Bật tất cả
    """
    user_id = update.effective_user.id
    if not is_admin(user_id):
        await update.message.reply_text("❌ Bạn không có quyền sử dụng lệnh này.")
        return
    
    options = load_warranty_options()
    
    # Nếu có argument, toggle option tương ứng
    if context.args:
        try:
            choice = int(context.args[0])
            
            if choice == 0:
                # Bật tất cả
                options['refund_enabled'] = True
                options['replace_enabled'] = True
                save_warranty_options(options)
                await update.message.reply_text(
                    "✅ Đã BẬT tất cả tính năng bảo hành!\n\n"
                    "💸 Hoàn tiền: ✅ BẬT\n"
                    "🔄 Đổi acc mới: ✅ BẬT"
                )
                logging.info(f"🔧 Admin {user_id} đã BẬT tất cả warranty options")
                return
                
            elif choice == 1:
                # Toggle Hoàn tiền
                options['refund_enabled'] = not options['refund_enabled']
                save_warranty_options(options)
                status = "✅ BẬT" if options['refund_enabled'] else "❌ TẮT"
                await update.message.reply_text(
                    f"💸 <b>Hoàn tiền</b>: {status}\n\n"
                    f"Khách hàng {'CÓ THỂ' if options['refund_enabled'] else 'KHÔNG THỂ'} chọn hoàn tiền khi bảo hành.",
                    parse_mode='HTML'
                )
                logging.info(f"🔧 Admin {user_id} đã {'BẬT' if options['refund_enabled'] else 'TẮT'} warranty refund")
                return
                
            elif choice == 2:
                # Toggle Đổi acc mới
                options['replace_enabled'] = not options['replace_enabled']
                save_warranty_options(options)
                status = "✅ BẬT" if options['replace_enabled'] else "❌ TẮT"
                await update.message.reply_text(
                    f"🔄 <b>Đổi acc mới</b>: {status}\n\n"
                    f"Khách hàng {'CÓ THỂ' if options['replace_enabled'] else 'KHÔNG THỂ'} chọn đổi acc mới khi bảo hành.",
                    parse_mode='HTML'
                )
                logging.info(f"🔧 Admin {user_id} đã {'BẬT' if options['replace_enabled'] else 'TẮT'} warranty replace")
                return
            else:
                await update.message.reply_text("❌ Số không hợp lệ. Chọn 0, 1 hoặc 2.")
                return
                
        except ValueError:
            await update.message.reply_text("❌ Cú pháp sai. Ví dụ: /offbaohanh 1")
            return
    
    # Hiển thị menu trạng thái hiện tại
    refund_status = "✅ BẬT" if options['refund_enabled'] else "❌ TẮT"
    replace_status = "✅ BẬT" if options['replace_enabled'] else "❌ TẮT"
    
    await update.message.reply_text(
        f"⚙️ <b>QUẢN LÝ TÙY CHỌN BẢO HÀNH</b>\n\n"
        f"Trạng thái hiện tại:\n"
        f"<b>1.</b> 💸 Hoàn tiền: {refund_status}\n"
        f"<b>2.</b> 🔄 Đổi acc mới: {replace_status}\n\n"
        f"━━━━━━━━━━━━━━━━━━━━\n"
        f"📝 <b>Cách sử dụng:</b>\n"
        f"• /offbaohanh 1 → Toggle Hoàn tiền\n"
        f"• /offbaohanh 2 → Toggle Đổi acc mới\n"
        f"• /offbaohanh 0 → Bật tất cả",
        parse_mode='HTML'
    )


async def cmd_blacklist_baohanh(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """
    Admin command: Thêm mã đơn vào blacklist thủ công
    Dùng cho các đơn đã hoàn tiền TRƯỚC KHI có code blacklist
    
    Cú pháp: /blacklistbh <mã đơn> [lý do]
    """
    user_id = update.effective_user.id
    if not is_admin(user_id):
        await update.message.reply_text("❌ Bạn không có quyền sử dụng lệnh này.")
        return
    
    if not context.args:
        blacklist = load_warranty_blacklist()
        if not blacklist:
            await update.message.reply_text(
                "📋 <b>BLACKLIST TRỐNG</b>\n\n"
                "Cú pháp: /blacklistbh <mã đơn>\n"
                "Ví dụ: /blacklistbh W30VRJCO6",
                parse_mode='HTML'
            )
            return
        
        items = [f"• <code>{(item.get('order_code') if isinstance(item, dict) else item)}</code>" 
                 for item in blacklist[-20:]]
        
        await update.message.reply_text(
            f"🚫 <b>BLACKLIST</b> ({len(blacklist)} đơn)\n\n" + "\n".join(items),
            parse_mode='HTML'
        )
        return
    
    order_code = context.args[0].strip().upper()
    reason = " ".join(context.args[1:]) if len(context.args) > 1 else "manual_add"
    
    if is_order_blacklisted(order_code):
        await update.message.reply_text(f"⚠️ Đơn <code>{order_code}</code> đã có trong blacklist!", parse_mode='HTML')
        return
    
    add_to_warranty_blacklist(order_code, reason)
    await update.message.reply_text(
        f"✅ Đã thêm <code>{order_code}</code> vào blacklist.\nĐơn này không thể dùng /baohanh nữa.",
        parse_mode='HTML'
    )


def update_warranty_column_e_with_date(custom_date: datetime):
    """
    Cập nhật cột E với ngày tùy chỉnh (dùng để test)
    """
    import re
    
    try:
        db = get_db()
        ws_menu = db.worksheet(MENU_SHEET_NAME)
        all_rows = ws_menu.get_all_values()
        
        if len(all_rows) <= 1:
            return
        
        updates = []
        
        for idx, row in enumerate(all_rows[1:], start=2):
            if len(row) < 6:
                continue
            
            warranty_days_text = row[5].strip() if len(row) > 5 else ""
            if not warranty_days_text:
                continue
            
            warranty_days = 0
            if 'không' in warranty_days_text.lower():
                warranty_days = 0
            else:
                days_match = re.search(r'(\d+)', warranty_days_text)
                if days_match:
                    warranty_days = int(days_match.group(1))
            
            if warranty_days <= 0:
                continue
            
            expiry_date = custom_date + timedelta(days=warranty_days)
            new_warranty_text = f"BH đến {expiry_date.strftime('%d/%m')}"
            
            current_value = row[4].strip() if len(row) > 4 else ""
            if current_value != new_warranty_text:
                cell_address = f"E{idx}"
                updates.append({
                    'range': cell_address,
                    'values': [[new_warranty_text]]
                })
        
        if updates:
            ws_menu.batch_update(updates)
            logging.info(f"📅 [TEST] Đã cập nhật {len(updates)} ngày BH với date {custom_date.strftime('%d/%m/%Y')}")
            clear_cache_key("menu_data")
        
    except Exception as e:
        logging.error(f"❌ Lỗi update_warranty_column_e_with_date: {e}")


# ==============================================================================
# RESELLER WARRANTY UPDATE - Sheet "Kho hàng reseller"
# ==============================================================================
RESELLER_SHEET_NAME = "Kho hàng reseller"

def update_reseller_warranty_column_e():
    """
    Cập nhật cột E (Bảo hành) trong sheet 'Kho hàng reseller'
    dựa trên cột F (Số Ngày).
    
    Logic tương tự update_warranty_column_e() nhưng cho sheet reseller.
    """
    import re
    
    now = get_vietnam_now()
    
    try:
        db = get_db()
        ws_reseller = db.worksheet(RESELLER_SHEET_NAME)
        all_rows = ws_reseller.get_all_values()
        
        if len(all_rows) <= 1:
            logging.info("📋 Sheet Kho hàng reseller không có dữ liệu")
            return 0
        
        updates = []
        
        for idx, row in enumerate(all_rows[1:], start=2):
            if len(row) < 6:
                continue
            
            # Đọc cột F (Số Ngày)
            warranty_days_text = row[5].strip() if len(row) > 5 else ""
            if not warranty_days_text:
                continue
            
            # Parse số ngày
            warranty_days = 0
            if 'không' in warranty_days_text.lower():
                warranty_days = 0
            else:
                days_match = re.search(r'(\d+)', warranty_days_text)
                if days_match:
                    warranty_days = int(days_match.group(1))
            
            if warranty_days <= 0:
                continue
            
            # Tính ngày hết hạn = Hôm nay + warranty_days
            from datetime import timedelta
            expiry_date = now + timedelta(days=warranty_days)
            new_warranty_text = f"BH đến {expiry_date.strftime('%d/%m')}"
            
            # So sánh với giá trị hiện tại
            current_value = row[4].strip() if len(row) > 4 else ""
            if current_value != new_warranty_text:
                cell_address = f"E{idx}"
                updates.append({
                    'range': cell_address,
                    'values': [[new_warranty_text]]
                })
        
        if updates:
            ws_reseller.batch_update(updates)
            logging.info(f"📅 [RESELLER] Đã cập nhật {len(updates)} ngày BH trong Sheet Kho hàng reseller")
        
        return len(updates)
        
    except Exception as e:
        logging.error(f"❌ Lỗi update_reseller_warranty_column_e: {e}")
        return 0


def update_reseller_warranty_with_date(custom_date: datetime):
    """
    Cập nhật cột E trong sheet 'Kho hàng reseller' với ngày tùy chỉnh (test)
    """
    import re
    
    try:
        db = get_db()
        ws_reseller = db.worksheet(RESELLER_SHEET_NAME)
        all_rows = ws_reseller.get_all_values()
        
        if len(all_rows) <= 1:
            return 0
        
        updates = []
        
        for idx, row in enumerate(all_rows[1:], start=2):
            if len(row) < 6:
                continue
            
            warranty_days_text = row[5].strip() if len(row) > 5 else ""
            if not warranty_days_text:
                continue
            
            warranty_days = 0
            if 'không' in warranty_days_text.lower():
                warranty_days = 0
            else:
                days_match = re.search(r'(\d+)', warranty_days_text)
                if days_match:
                    warranty_days = int(days_match.group(1))
            
            if warranty_days <= 0:
                continue
            
            expiry_date = custom_date + timedelta(days=warranty_days)
            new_warranty_text = f"BH đến {expiry_date.strftime('%d/%m')}"
            
            current_value = row[4].strip() if len(row) > 4 else ""
            if current_value != new_warranty_text:
                cell_address = f"E{idx}"
                updates.append({
                    'range': cell_address,
                    'values': [[new_warranty_text]]
                })
        
        if updates:
            ws_reseller.batch_update(updates)
            logging.info(f"📅 [RESELLER TEST] Đã cập nhật {len(updates)} ngày BH với date {custom_date.strftime('%d/%m/%Y')}")
        
        return len(updates)
        
    except Exception as e:
        logging.error(f"❌ Lỗi update_reseller_warranty_with_date: {e}")
        return 0


async def schedule_daily_warranty_update():
    """
    Scheduled task: Tự động update cột E vào 23:59 hằng ngày (VN time)
    
    QUAN TRỌNG: 
    - Chạy NGAY KHI BOT KHỞI ĐỘNG để đảm bảo warranty luôn cập nhật
    - Sau đó lên lịch chạy lúc 23:59 mỗi ngày
    
    Khi đến 23:59, bot sẽ ghi ngày mới vào cột E dựa trên cột F.
    Ví dụ: 23:59 ngày 29/01 → Cột E = "BH đến 28/02" (nếu cột F = 30 Ngày)
    """
    # ========== CHẠY NGAY KHI KHỞI ĐỘNG ==========
    try:
        logging.info("🚀 [STARTUP] Đang update warranty column E ngay khi khởi động...")
        
        global _last_warranty_update
        _last_warranty_update = 0  # Reset để force update
        
        # Update sheet MENU
        update_warranty_column_e()
        logging.info("✅ [STARTUP] Hoàn tất update warranty column E (Sheet MENU)!")
        
        # Update sheet Kho hàng reseller
        reseller_count = update_reseller_warranty_column_e()
        logging.info(f"✅ [STARTUP] Hoàn tất update warranty column E (Sheet Kho hàng reseller): {reseller_count} sản phẩm")
        
    except Exception as e:
        logging.error(f"❌ [STARTUP] Lỗi update warranty khi khởi động: {e}")
    
    # ========== LÊN LỊCH CHẠY LÚC 23:59 HÀNG NGÀY ==========
    while True:
        try:
            now = get_vietnam_now()
            
            # Tính thời gian đến 23:59 hôm nay hoặc ngày mai
            target_time = now.replace(hour=23, minute=59, second=0, microsecond=0)
            
            # Nếu đã qua 23:59 hôm nay, chờ đến 23:59 ngày mai
            if now >= target_time:
                from datetime import timedelta
                target_time = target_time + timedelta(days=1)
            
            # Tính số giây cần chờ
            wait_seconds = (target_time - now).total_seconds()
            
            logging.info(f"⏰ Đã lên lịch update warranty lúc 23:59 VN ({target_time.strftime('%d/%m/%Y %H:%M')})")
            logging.info(f"⏳ Chờ {wait_seconds/3600:.1f} giờ...")
            
            # Chờ đến 23:59
            await asyncio.sleep(wait_seconds)
            
            # Thực hiện update CẢ 2 SHEET
            logging.info("🔄 Bắt đầu update warranty column E (scheduled 23:59)...")
            
            # Force update bằng cách reset timestamp
            _last_warranty_update = 0
            
            # Update sheet MENU
            update_warranty_column_e()
            logging.info("✅ Hoàn tất update warranty column E (Sheet MENU)!")
            
            # Update sheet Kho hàng reseller
            reseller_count = update_reseller_warranty_column_e()
            logging.info(f"✅ Hoàn tất update warranty column E (Sheet Kho hàng reseller): {reseller_count} sản phẩm")
            
            # Chờ 2 phút để tránh trigger lại ngay (tăng từ 1 phút lên 2 phút)
            await asyncio.sleep(120)
            
        except asyncio.CancelledError:
            logging.info("⏹️ Scheduled warranty update đã bị cancel")
            break
        except Exception as e:
            logging.error(f"❌ Lỗi scheduled warranty update: {e}")
            # Chờ 1 giờ rồi thử lại
            await asyncio.sleep(3600)


async def check_expired_warranty_claims(context):
    """
    Scheduled job: Kiểm tra warranty claims đã hết hạn và nhắc admin xóa acc.
    
    Chạy lúc 11:00, 11:05, 11:10 hàng ngày (3 lần cách 5 phút).
    Với mỗi claim đã hết hạn và chưa nhắc đủ 3 lần → gửi thông báo admin.
    """
    try:
        claims = load_warranty_claims()
        today = get_vietnam_now().date()
        updated = False
        
        for claim in claims:
            # Kiểm tra đã hết hạn chưa (ngày SAU ngày hết hạn mới nhắc)
            expiry_str = claim.get('warranty_expiry_date', '')
            if not expiry_str:
                continue
            
            try:
                expiry_date = datetime.strptime(expiry_str, "%Y-%m-%d").date()
            except:
                continue
            
            # Chỉ nhắc khi ĐÃ HẾT HẠN (today > expiry_date) và chưa nhắc đủ 3 lần
            reminder_sent = claim.get('reminder_sent', 0)
            if today > expiry_date and reminder_sent < 3:
                order_code = claim.get('order_code', 'N/A')
                username = claim.get('username', 'N/A')
                user_fullname = claim.get('user_fullname', 'N/A')
                product_name = claim.get('product_name', 'N/A')
                accounts = claim.get('accounts_replaced', [])
                
                # Format danh sách acc
                acc_list = "\n".join([f"• {email}" for email in accounts[:10]])
                if len(accounts) > 10:
                    acc_list += f"\n... và {len(accounts) - 10} acc khác"
                
                # Gửi thông báo cho tất cả admin
                reminder_num = reminder_sent + 1
                for admin_id in ADMIN_IDS:
                    try:
                        await context.bot.send_message(
                            chat_id=admin_id,
                            text=(
                                f"🔔 <b>BẢO HÀNH HẾT HẠN - CẦN XÓA ACC</b> (Lần {reminder_num}/3)\n\n"
                                f"📦 Mã đơn: <code>{order_code}</code>\n"
                                f"👤 Khách: {user_fullname} (@{username})\n"
                                f"🛒 Sản phẩm: {product_name}\n"
                                f"📅 Hết hạn: {expiry_date.strftime('%d/%m/%Y')}\n\n"
                                f"📧 <b>Acc đã gửi BH:</b>\n{acc_list}\n\n"
                                f"⚠️ <i>Vui lòng xóa các acc trên để khách phải mua mới!</i>"
                            ),
                            parse_mode='HTML'
                        )
                    except Exception as e:
                        logging.error(f"Lỗi gửi warranty reminder cho admin {admin_id}: {e}")
                
                # Cập nhật reminder_sent
                claim['reminder_sent'] = reminder_num
                updated = True
                logging.info(f"📢 Đã nhắc admin xóa acc warranty claim {order_code} (lần {reminder_num}/3)")
        
        # Lưu lại nếu có thay đổi
        if updated:
            save_warranty_claims(claims)
            
    except Exception as e:
        logging.error(f"❌ Lỗi check_expired_warranty_claims: {e}")


# ============== FARM ACCOUNT RECOVERY ==============

async def run_farm_recovery_job(context):
    """
    Scheduled job: Tự động thu hồi acc farm khi hết bảo hành.
    Chạy lúc 10:00 hàng ngày.
    """
    try:
        logging.info("🔄 Bắt đầu job thu hồi acc farm...")
        
        import subprocess
        import sys
        from pathlib import Path
        
        # Path đến recovery tool
        recovery_script = Path(__file__).parent / "Quan Ly Farm" / "recovery_tool.py"
        
        if not recovery_script.exists():
            logging.warning(f"⚠️ Không tìm thấy {recovery_script}")
            return
        
        # Chạy recovery tool trong background (subprocess)
        process = subprocess.Popen(
            [sys.executable, str(recovery_script)],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            cwd=str(recovery_script.parent)
        )
        
        logging.info(f"✅ Đã khởi chạy farm recovery tool (PID: {process.pid})")
        
        # Notify admin
        for admin_id in ADMIN_IDS:
            try:
                await context.bot.send_message(
                    chat_id=admin_id,
                    text="🔄 <b>AUTO FARM RECOVERY</b>\n\n"
                         "Đang chạy tự động thu hồi acc hết bảo hành...\n"
                         "Kết quả sẽ được ghi vào Sheet 'Acc thu hồi'.",
                    parse_mode='HTML'
                )
            except Exception as e:
                logging.error(f"Lỗi notify admin {admin_id}: {e}")
                
    except Exception as e:
        logging.error(f"❌ Lỗi run_farm_recovery_job: {e}")


async def cmd_thuhoiacc(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """
    Lệnh admin: /thuhoiacc
    Chạy thu hồi acc TRONG NỀN - bot vẫn phản hồi lệnh khác bình thường
    """
    user_id = update.effective_user.id
    
    if not is_admin(user_id):
        await update.message.reply_text("⛔ Bạn không có quyền sử dụng lệnh này!")
        return
    
    await update.message.reply_text(
        "🔄 <b>ĐÃ BẮT ĐẦU THU HỒI ACC (CHẠY NỀN)</b>\n\n"
        "✅ Bot vẫn hoạt động bình thường trong khi thu hồi\n"
        "⏳ Kết quả sẽ được gửi khi hoàn tất\n"
        "📊 Theo dõi tiến độ trong log",
        parse_mode='HTML'
    )
    
    # Lưu chat_id để gửi kết quả sau
    chat_id = update.effective_chat.id
    
    async def run_recovery_background():
        """Chạy recovery trong nền, gửi kết quả khi xong"""
        try:
            import sys
            from pathlib import Path
            import html as html_module
            
            recovery_dir = Path(__file__).parent / "Quan Ly Farm"
            if str(recovery_dir) not in sys.path:
                sys.path.insert(0, str(recovery_dir))
            
            logging.info(f"🔄 Admin {user_id} trigger thu hồi acc (chạy nền)")
            
            # Chạy recovery trong thread pool (không block event loop)
            def do_recovery():
                import recovery_tool
                import importlib
                importlib.reload(recovery_tool)
                return recovery_tool.run_recovery(headless=False, max_workers=5)
            
            res = await asyncio.to_thread(do_recovery)
            
            # Gửi kết quả
            if not res or res.get('total', 0) == 0:
                await context.bot.send_message(
                    chat_id=chat_id,
                    text="✅ <b>KẾT QUẢ THU HỒI ACC</b>\n\n"
                         "ℹ️ Không có acc nào cần thu hồi\n"
                         "(Chưa hết hạn hoặc đã thu hồi rồi)",
                    parse_mode='HTML'
                )
            else:
                await context.bot.send_message(
                    chat_id=chat_id,
                    text=f"✅ <b>KẾT QUẢ THU HỒI ACC</b>\n\n"
                         f"📊 Tổng: {res.get('total', 0)} acc\n"
                         f"✅ Thành công: {res.get('success', 0)}\n"
                         f"❌ Thất bại: {res.get('failed', 0)}\n\n"
                         f"📋 Chi tiết xem trong Sheet 'Acc thu hồi'",
                    parse_mode='HTML'
                )
                
        except Exception as e:
            logging.error(f"❌ Lỗi recovery background: {e}")
            try:
                import html
                await context.bot.send_message(
                    chat_id=chat_id,
                    text=f"❌ <b>LỖI THU HỒI ACC</b>\n\n⚠️ {html.escape(str(e)[:500])}",
                    parse_mode='HTML'
                )
            except:
                pass
    
    # Tạo task chạy nền - KHÔNG await để bot tiếp tục xử lý lệnh khác
    asyncio.create_task(run_recovery_background())


async def cmd_cleanlogs(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """
    Lệnh admin: /cleanlogs
    Dọn dẹp toàn bộ: file .log + browser_data + __pycache__
    """
    user_id = update.effective_user.id
    
    if not is_admin(user_id):
        await update.message.reply_text("⛔ Bạn không có quyền sử dụng lệnh này!")
        return
    
    import glob
    import shutil
    
    bot_dir = os.path.dirname(os.path.abspath(__file__))
    deleted = []
    total_freed = 0
    errors = []
    
    # === 1. Truncate tất cả file .log ===
    log_files = []
    for pattern in ['**/*.log', '**/*.log.*']:
        log_files.extend(glob.glob(os.path.join(bot_dir, pattern), recursive=True))
    
    for log_file in log_files:
        try:
            size = os.path.getsize(log_file)
            if size > 0:
                size_mb = round(size / (1024 * 1024), 2)
                with open(log_file, 'w') as f:
                    f.write('')
                deleted.append(f"📄 {os.path.basename(log_file)} ({size_mb}MB)")
                total_freed += size
        except Exception as e:
            errors.append(f"❌ {os.path.basename(log_file)}: {str(e)[:50]}")
    
    # === 2. Xóa browser_data (cache Firefox từ recovery tool) ===
    browser_data_dirs = glob.glob(os.path.join(bot_dir, '**/browser_data'), recursive=True)
    for bd_dir in browser_data_dirs:
        try:
            size = sum(f.stat().st_size for f in Path(bd_dir).rglob('*') if f.is_file())
            if size > 0:
                size_mb = round(size / (1024 * 1024), 2)
                # Xóa nội dung bên trong, giữ folder
                for item in Path(bd_dir).iterdir():
                    if item.is_dir():
                        shutil.rmtree(item, ignore_errors=True)
                    else:
                        item.unlink(missing_ok=True)
                deleted.append(f"🌐 browser_data ({size_mb}MB)")
                total_freed += size
        except Exception as e:
            errors.append(f"❌ browser_data: {str(e)[:50]}")
    
    # === 3. Xóa __pycache__ ===
    pycache_dirs = glob.glob(os.path.join(bot_dir, '**/__pycache__'), recursive=True)
    for pc_dir in pycache_dirs:
        try:
            size = sum(f.stat().st_size for f in Path(pc_dir).rglob('*') if f.is_file())
            size_mb = round(size / (1024 * 1024), 2)
            shutil.rmtree(pc_dir, ignore_errors=True)
            deleted.append(f"🗂️ __pycache__ ({size_mb}MB)")
            total_freed += size
        except:
            pass
    
    total_freed_mb = round(total_freed / (1024 * 1024), 2)
    
    if not deleted and not errors:
        await update.message.reply_text("✅ Không có gì cần dọn dẹp!")
        return
    
    result = f"✅ <b>ĐÃ DỌN DẸP</b>\n\n"
    result += f"📊 Giải phóng: <b>{total_freed_mb}MB</b>\n\n"
    result += "\n".join(deleted)
    if errors:
        result += "\n\n" + "\n".join(errors)
    
    await update.message.reply_text(result, parse_mode='HTML')


async def cmd_addadmin(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """
    Lệnh admin: /addadmin admin@domain.shop|password
    Tự nhận biết domain, email, password và thêm vào farm_accounts.json
    Hỗ trợ nhiều dòng cùng lúc.
    """
    user_id = update.effective_user.id
    
    if not is_admin(user_id):
        await update.message.reply_text("⛔ Bạn không có quyền sử dụng lệnh này!")
        return
    
    # Lấy text sau lệnh /addadmin (giữ nguyên dấu xuống dòng)
    raw_text = update.message.text or ''
    # Bỏ phần /addadmin ở đầu
    text = raw_text.split('\n', 1)
    if len(text) > 1:
        # Dòng đầu có thể chứa /addadmin + acc đầu tiên
        first_line = text[0].replace('/addadmin', '').strip()
        rest = text[1].strip()
        text = (first_line + '\n' + rest).strip() if first_line else rest
    else:
        text = text[0].replace('/addadmin', '').strip()
    if not text:
        await update.message.reply_text(
            "📝 <b>Cách dùng:</b>\n\n"
            "<code>/addadmin admin@domain.shop|password</code>\n\n"
            "Hoặc thêm nhiều acc cùng lúc:\n"
            "<code>/addadmin\n"
            "admin@domain1.shop|pass1\n"
            "admin@domain2.shop|pass2</code>\n\n"
            "Bot sẽ tự nhận biết domain, email và password.",
            parse_mode='HTML'
        )
        return
    
    # Parse từng dòng
    from pathlib import Path
    import json
    
    farm_file = Path(__file__).parent / "Quan Ly Farm" / "farm_accounts.json"
    
    # Load file hiện tại
    try:
        with open(farm_file, 'r', encoding='utf-8') as f:
            farm_accounts = json.load(f)
    except:
        farm_accounts = []
    
    existing_domains = [acc.get('domain', '').lower() for acc in farm_accounts]
    
    lines = text.strip().split('\n')
    added = []
    skipped = []
    errors = []
    
    for line in lines:
        line = line.strip()
        if not line:
            continue
        
        # Parse format: email|password
        if '|' not in line:
            errors.append(f"❌ <code>{line}</code> → Thiếu dấu | ngăn cách email và password")
            continue
        
        parts = line.split('|', 1)
        email = parts[0].strip()
        password = parts[1].strip()
        
        # Validate email
        if '@' not in email:
            errors.append(f"❌ <code>{line}</code> → Email không hợp lệ")
            continue
        
        # Tự nhận biết domain từ email
        domain = email.split('@')[1].strip()
        
        if not domain:
            errors.append(f"❌ <code>{line}</code> → Không xác định được domain")
            continue
        
        # Kiểm tra trùng domain
        if domain.lower() in existing_domains:
            skipped.append(f"⚠️ <code>{domain}</code> → Đã tồn tại")
            continue
        
        # Thêm vào danh sách
        new_account = {
            "domain": domain,
            "admin_email": email,
            "admin_password": password
        }
        farm_accounts.append(new_account)
        existing_domains.append(domain.lower())
        added.append(f"✅ <code>{domain}</code> → {email}")
    
    # Lưu file
    if added:
        try:
            with open(farm_file, 'w', encoding='utf-8') as f:
                json.dump(farm_accounts, f, indent=4, ensure_ascii=False)
        except Exception as e:
            await update.message.reply_text(f"❌ Lỗi ghi file: {e}")
            return
    
    # Tạo kết quả
    msg_parts = []
    if added:
        msg_parts.append(f"<b>✅ Đã thêm {len(added)} admin:</b>\n" + '\n'.join(added))
    if skipped:
        msg_parts.append(f"<b>⚠️ Bỏ qua {len(skipped)} (đã tồn tại):</b>\n" + '\n'.join(skipped))
    if errors:
        msg_parts.append(f"<b>❌ Lỗi {len(errors)}:</b>\n" + '\n'.join(errors))
    
    if not msg_parts:
        msg_parts.append("❌ Không có dữ liệu hợp lệ!")
    
    result_msg = '\n\n'.join(msg_parts) + f"\n\n📊 Tổng admin hiện tại: {len(farm_accounts)}"
    await update.message.reply_text(result_msg, parse_mode='HTML')


async def cmd_listadmin(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Lệnh admin: /listadmin - Xem danh sách admin accounts"""
    user_id = update.effective_user.id
    
    if not is_admin(user_id):
        await update.message.reply_text("⛔ Bạn không có quyền sử dụng lệnh này!")
        return
    
    from pathlib import Path
    import json
    
    farm_file = Path(__file__).parent / "Quan Ly Farm" / "farm_accounts.json"
    
    try:
        with open(farm_file, 'r', encoding='utf-8') as f:
            farm_accounts = json.load(f)
    except:
        await update.message.reply_text("❌ Không đọc được farm_accounts.json!")
        return
    
    if not farm_accounts:
        await update.message.reply_text("📋 Chưa có admin nào!")
        return
    
    lines = [f"📋 <b>DANH SÁCH ADMIN ({len(farm_accounts)}):</b>\n"]
    for i, acc in enumerate(farm_accounts, 1):
        domain = acc.get('domain', '?')
        email = acc.get('admin_email', '?')
        lines.append(f"{i}. <code>{domain}</code> → {email}")
    
    # Telegram giới hạn 4096 ký tự
    msg = '\n'.join(lines)
    if len(msg) > 4000:
        # Chia nhỏ
        chunks = []
        chunk = ""
        for line in lines:
            if len(chunk) + len(line) + 1 > 4000:
                chunks.append(chunk)
                chunk = line
            else:
                chunk += '\n' + line if chunk else line
        if chunk:
            chunks.append(chunk)
        
        for chunk in chunks:
            await update.message.reply_text(chunk, parse_mode='HTML')
    else:
        await update.message.reply_text(msg, parse_mode='HTML')


async def cmd_removeadmin(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Lệnh admin: /removeadmin domain.shop - Xóa admin theo domain"""
    user_id = update.effective_user.id
    
    if not is_admin(user_id):
        await update.message.reply_text("⛔ Bạn không có quyền sử dụng lệnh này!")
        return
    
    text = ' '.join(context.args) if context.args else ''
    if not text:
        await update.message.reply_text(
            "📝 <b>Cách dùng:</b>\n"
            "<code>/removeadmin domain.shop</code>",
            parse_mode='HTML'
        )
        return
    
    from pathlib import Path
    import json
    
    farm_file = Path(__file__).parent / "Quan Ly Farm" / "farm_accounts.json"
    
    try:
        with open(farm_file, 'r', encoding='utf-8') as f:
            farm_accounts = json.load(f)
    except:
        await update.message.reply_text("❌ Không đọc được farm_accounts.json!")
        return
    
    domain_to_remove = text.strip().lower()
    original_count = len(farm_accounts)
    farm_accounts = [acc for acc in farm_accounts if acc.get('domain', '').lower() != domain_to_remove]
    
    removed = original_count - len(farm_accounts)
    if removed > 0:
        with open(farm_file, 'w', encoding='utf-8') as f:
            json.dump(farm_accounts, f, indent=4, ensure_ascii=False)
        await update.message.reply_text(
            f"✅ Đã xóa <code>{domain_to_remove}</code> ({removed} entry)\n"
            f"📊 Còn lại: {len(farm_accounts)} admin",
            parse_mode='HTML'
        )
    else:
        await update.message.reply_text(f"❌ Không tìm thấy domain <code>{domain_to_remove}</code>", parse_mode='HTML')


# Danh sách các sheet hệ thống cần bỏ qua khi quét doanh thu
SYSTEM_SHEETS = [
    "menu",
    "hàng nhập", 
    "tổng doanh thu",
    "chốt doanh thu tháng",
    "dashboard",
    "list da dịch vụ giá bán",
    "list de dịch vụ giá ctv",
]

def get_all_product_sheets_cached():
    """
    Lấy TẤT CẢ các sheet sản phẩm trong Google Sheet.
    Bỏ qua các sheet hệ thống (Menu, Hàng Nhập, Tổng Doanh Thu, ...)
    TỐI ƯU: Sử dụng cache danh sách worksheet
    """
    cache_key = "all_product_sheets"
    def fetch():
        try:
            db = get_db()
            # Sử dụng cache danh sách worksheet thay vì gọi API trực tiếp
            all_sheets = get_all_worksheets_cached(db, timeout=CACHE_TIMEOUT_LONG)
            product_sheets = []
            for sheet in all_sheets:
                sheet_name = sheet.title.strip()
                # Bỏ qua các sheet hệ thống
                if sheet_name.lower() in SYSTEM_SHEETS:
                    continue
                product_sheets.append({
                    'sheet_tab': sheet_name,
                    'worksheet': sheet
                })
            logging.info(f"📋 Tìm thấy {len(product_sheets)} sheet sản phẩm để quét doanh thu")
            return product_sheets
        except Exception as e:
            logging.error(f"Lỗi lấy danh sách sheet sản phẩm: {e}")
            return []
    return get_cached_data(cache_key, fetch, timeout=CACHE_TIMEOUT_LONG)

def get_stock_count_cached(sheet_tab_name):
    """Đếm số lượng hàng tồn kho với cache"""
    cache_key = f"stock_{sheet_tab_name}"
    def fetch():
        try:
            if not sheet_tab_name:
                return 0
            db = get_db()
            ws_kho = get_worksheet_by_name(db, sheet_tab_name)
            if not ws_kho:
                return 0
            all_rows = ws_kho.get_all_values()
            count = 0
            for r in all_rows[1:]:
                if len(r) >= 2 and r[0].strip() != "" and r[1].strip().upper() == "CHƯA BÁN":
                    count += 1
            return count
        except Exception as e:
            logging.error(f"Lỗi đếm stock: {e}")
            return 0
    return get_cached_data(cache_key, fetch, timeout=CACHE_TIMEOUT_FAST)  # 15s cho stock

def extract_price(price_str):
    try:
        digits = "".join(filter(str.isdigit, str(price_str)))
        return int(digits) if digits else 0
    except Exception:
        return 0


def parse_money_with_k(text: str) -> int:
    """Chuyển '20k', '200k', '300000' thành số nguyên (đồng)."""
    if not text:
        return 0
    txt = str(text).lower().replace(".", "").replace(",", "").strip()
    base = extract_price(txt)
    if "k" in txt:
        base *= 1000
    return base


def format_money(amount: int) -> str:
    return f"{amount:,} đ"


def build_progress_bar(percent: float, width: int = 10) -> str:
    """Thanh % dạng cột đơn giản: như nến trading."""
    pct = max(0.0, min(100.0, float(percent)))
    filled = int(pct // (100 / width))
    return "🟩" * filled + "⬜" * (width - filled)


def date_matches_today(d_str: str, now: datetime) -> bool:
    if not d_str:
        return False
    s = d_str.strip()
    if not s:
        return False
    d = now.day
    m = now.month
    y = now.year
    candidates = {
        f"{d}/{m}",
        f"{d}/{m}/{y}",
        now.strftime("%d/%m"),
        now.strftime("%d/%m/%Y"),
    }
    return s in candidates


def date_in_current_month(d_str: str, now: datetime) -> bool:
    if not d_str:
        return False
    s = d_str.strip()
    parts = re.split(r"[/-]", s)
    if len(parts) < 2:
        return False
    try:
        month = int(parts[1])
        year = int(parts[2]) if len(parts) >= 3 else now.year
    except ValueError:
        return False
    return month == now.month and year == now.year


async def _legacy_send_daily_revenue_report(context: ContextTypes.DEFAULT_TYPE):
    """
    Tự động tính tổng tiền các sản phẩm đã bán trong ngày và gửi báo cáo cho admin.
    - Quét tất cả sản phẩm trong sheet menu
    - Với mỗi sản phẩm, mở sheet kho tương ứng
    - Đếm số dòng có trạng thái 'ĐÃ BÁN' và ngày (cột C) = hôm nay
    - Doanh thu từng sản phẩm = SL bán * giá trong menu
    - Gửi tổng hợp cho tất cả ADMIN_IDS
    """
    try:
        now = get_vietnam_now()
        today_str = now.strftime("%d/%m/%Y")

        db = get_db()
        products = get_menu_data_cached()

        if not products:
            logging.warning("⚠️ Không có dữ liệu sản phẩm trong menu, bỏ qua báo cáo doanh thu.")
            return

        total_revenue = 0
        total_items = 0
        lines = [
            f"📊 <b>BÁO CÁO DOANH THU NGÀY {today_str}</b>\\n",
            "🕒 Thời gian tính: 00:00 - 22:00 (theo giờ máy chủ)\\n",
        ]

        for p in products:
            sheet_tab = (p.get("sheet_tab") or "").strip()
            product_name = (p.get("name") or "").strip()
            price_str = p.get("price_str") or ""
            price_int = extract_price(price_str)

            if not sheet_tab or price_int <= 0:
                continue

            try:
                ws_product = get_worksheet_by_name(db, sheet_tab)
                if not ws_product:
                    continue

                all_rows = ws_product.get_all_values()
                sold_count = 0

                # Cấu trúc: A: ACC, B: TRẠNG THÁI, C: NGÀY BÁN
                for row in all_rows[1:]:
                    if len(row) < 3:
                        continue
                    status = row[1].strip().upper()
                    sold_date = row[2].strip()
                    if status == "ĐÃ BÁN" and sold_date == today_str:
                        sold_count += 1

                if sold_count <= 0:
                    continue

                revenue = sold_count * price_int
                total_revenue += revenue
                total_items += sold_count

                lines.append(
                    f"📦 <b>{product_name}</b> ({sheet_tab})\\n"
                    f"   └ SL bán: <b>{sold_count}</b> | Giá: <b>{price_int:,} đ</b> | Doanh thu: <b>{revenue:,} đ</b>"
                )
            except Exception as e:
                logging.error(f"❌ Lỗi khi tính doanh thu cho sheet {sheet_tab}: {e}", exc_info=True)

        if total_items == 0:
            report_text = (
                f"📊 <b>BÁO CÁO DOANH THU NGÀY {today_str}</b>\\n\\n"
                f"Hiện chưa ghi nhận sản phẩm nào được bán trong ngày."
            )
        else:
            lines.append("\\n💰 <b>TỔNG DOANH THU:</b> {0:,} đ".format(total_revenue))
            lines.append(f"📦 Tổng số item đã bán: <b>{total_items}</b>")
            report_text = "\\n".join(lines)

        await send_to_all_admins(context.bot, report_text, parse_mode="HTML")
        logging.info("✅ Đã gửi báo cáo doanh thu hằng ngày cho tất cả admin.")
    except Exception as e:
        logging.error(f"❌ Lỗi send_daily_revenue_report: {e}", exc_info=True)


async def send_daily_revenue_report(context: ContextTypes.DEFAULT_TYPE):
    """
    Báo cáo:
    - Doanh thu NGÀY (0h -> 22h) với mốc 2.000.000đ
    - Doanh thu THÁNG hiện tại với mốc 20.000.000đ
    Cách tính:
    - Quét tất cả sheet sản phẩm (từ Menu -> sheet_tab)
      + Lọc các dòng có B='ĐÃ BÁN'
      + Doanh thu = cộng cột D (Chốt Lãi)
      + Chi phí giá nhập nội bộ = tổng các 'Trừ/Cộng ...' ở cột E
    - Sheet 'Hàng Nhập': cộng cột C (Tiền nhập hàng)
    - Tổng lãi = Doanh thu - Chi phí (Giá nhập + Hàng Nhập)
    """
    try:
        now = get_vietnam_now()
        today_label = now.strftime("%d/%m/%Y")

        # Dùng helper NGÀY, mặc định gửi cho tất cả admin
        await send_daily_revenue_for_date(context, now)
    except Exception as e:
        logging.error(f"❌ Lỗi send_daily_revenue_report: {e}", exc_info=True)


def _is_same_day_string(day_str: str, target: datetime) -> bool:
    """
    So sánh cột Ngày/Tháng[/Năm] với 1 ngày cụ thể.
    - Hỗ trợ cả định dạng: 17/12 và 17/12/2025
    - Nếu không có năm, mặc định dùng năm của `target`
    """
    if not day_str:
        return False
    s = day_str.strip()
    parts = re.split(r"[/-]", s)
    if len(parts) < 2:
        return False
    try:
        d = int(parts[0])
        m = int(parts[1])
        y = int(parts[2]) if len(parts) >= 3 else target.year
    except ValueError:
        return False
    return d == target.day and m == target.month and y == target.year


async def send_daily_revenue_for_date(
    context: ContextTypes.DEFAULT_TYPE,
    target_date: datetime,
    to_chat_id: int | None = None,
    notify_admins: bool = True,
) -> None:
    """
    Tính và gửi báo cáo DOANH THU NGÀY cho 1 ngày bất kỳ (dùng cột C = ngày/tháng).
    - Bán ra bao nhiêu sản phẩm
    - Doanh thu ngày
    - Chi phí (Giá nhập + Hàng Nhập)
    - Tổng lãi
    - Tiến độ ngày (nến) + dòng tiền dưới
    - notify_admins: nếu True sẽ gửi cho toàn bộ admin
    """
    try:
        db = get_db()
        # SỬA: Lấy TẤT CẢ sheet sản phẩm thay vì chỉ từ Menu
        product_sheets = get_all_product_sheets_cached()

        if not product_sheets:
            logging.warning("⚠️ Không tìm thấy sheet sản phẩm nào, bỏ qua báo cáo doanh thu.")
            msg = "⚠️ Không tìm thấy sheet sản phẩm nào trong Google Sheet, không thể tạo báo cáo."
            if to_chat_id:
                await context.bot.send_message(chat_id=to_chat_id, text=msg)
            return

        day_items = 0
        day_revenue = 0
        day_cost_internal = 0

        # Duyệt qua TẤT CẢ các sheet sản phẩm
        for sheet_info in product_sheets:
            sheet_tab = sheet_info.get("sheet_tab", "")
            ws_product = sheet_info.get("worksheet")

            if not sheet_tab or not ws_product:
                continue

            try:
                all_rows = ws_product.get_all_values()

                for row in all_rows[1:]:
                    if len(row) < 4:
                        continue
                    status = row[1].strip().upper()
                    if status != "ĐÃ BÁN":
                        continue

                    day_str = row[2].strip() if len(row) > 2 else ""
                    chot_lai_str = row[3].strip() if len(row) > 3 else ""
                    gia_nhap_str = row[4].strip() if len(row) > 4 else ""

                    if not _is_same_day_string(day_str, target_date):
                        continue

                    chot_lai_val = parse_money_with_k(chot_lai_str or "0")

                    cost_e = 0
                    txt_e = gia_nhap_str.lower()
                    if txt_e:
                        base = parse_money_with_k(txt_e)
                        if "trừ" in txt_e:
                            cost_e = base
                        elif "cộng" in txt_e:
                            cost_e = -base

                    day_items += 1
                    day_revenue += chot_lai_val
                    day_cost_internal += cost_e

            except Exception as e:
                logging.error(f"❌ Lỗi khi duyệt sheet {sheet_tab} để tính doanh thu ngày: {e}", exc_info=True)

        # Lưu ý: Hàng Nhập KHÔNG trừ vào lãi NGÀY, chỉ trừ vào lãi THÁNG.
        DAILY_TARGET = 2_000_000
        day_cost_total = day_cost_internal
        # Lãi ngày = Doanh thu (cột D) - Chi phí nội bộ (cột E), có thể âm nếu bị lỗ
        day_profit = day_revenue - day_cost_total
        day_percent = (day_revenue / DAILY_TARGET * 100) if DAILY_TARGET > 0 else 0
        day_bar = build_progress_bar(day_percent)

        date_label = target_date.strftime("%d/%m/%Y")
        # Hiển thị lãi là số tuyệt đối (bỏ dấu âm nếu có)
        display_day_profit = abs(day_profit)
        lines: list[str] = []
        lines.append(f"📊 <b>BÁO CÁO DOANH THU NGÀY {date_label}</b>")
        lines.append("🕒 Khoảng thời gian: 00:00 - 22:00\n")

        if day_items == 0:
            lines.append("❗ Ngày này chưa ghi nhận sản phẩm nào được bán.")
        else:
            lines.append(f"📦 Bán ra trong ngày: <b>{day_items}</b> sản phẩm")
            lines.append(
                f"💰 Doanh thu NGÀY: <b>{format_money(day_revenue)}</b> "
                f"({day_percent:.1f}% / {format_money(DAILY_TARGET)})"
            )
            lines.append(f"📉 Chi phí (Giá nhập - cột E): <b>{format_money(day_cost_total)}</b>")
            lines.append(f"✅ Tổng LÃI NGÀY: <b>{format_money(display_day_profit)}</b>")
            lines.append(f"📈 Tiến độ ngày: {day_bar}")
            lines.append(f"   {format_money(day_revenue)} / {format_money(DAILY_TARGET)}")

        report_text = "\n".join(lines)

        # Gửi cho toàn bộ admin nếu cần
        if notify_admins:
            await send_to_all_admins(context.bot, report_text, parse_mode="HTML")
        # Gửi riêng cho người gọi (nếu khác admin hoặc muốn nhận riêng)
        if to_chat_id is not None and (not notify_admins or to_chat_id not in ADMIN_IDS):
            await context.bot.send_message(chat_id=to_chat_id, text=report_text, parse_mode="HTML")

        logging.info(f"✅ Đã gửi báo cáo doanh thu NGÀY cho {date_label}.")
    except Exception as e:
        logging.error(f"❌ Lỗi send_daily_revenue_for_date: {e}", exc_info=True)
        if to_chat_id:
            try:
                await context.bot.send_message(
                    chat_id=to_chat_id,
                    text="❌ Có lỗi khi tạo báo cáo ngày, vui lòng thử lại hoặc liên hệ admin.",
                )
            except Exception:
                pass


async def send_monthly_revenue_report(
    context: ContextTypes.DEFAULT_TYPE,
    target_date: datetime | None = None,
    to_chat_id: int | None = None,
    notify_admins: bool = True,
) -> None:
    """
    Báo cáo doanh thu THÁNG cho tháng chứa target_date (mặc định: tháng hiện tại).
    """
    try:
        now = target_date or get_vietnam_now()
        db = get_db()
        # SỬA: Lấy TẤT CẢ sheet sản phẩm thay vì chỉ từ Menu
        product_sheets = get_all_product_sheets_cached()

        if not product_sheets:
            logging.warning("⚠️ Không tìm thấy sheet sản phẩm nào, bỏ qua báo cáo doanh thu tháng.")
            msg = "⚠️ Không tìm thấy sheet sản phẩm nào trong Google Sheet, không thể tạo báo cáo tháng."
            if to_chat_id:
                await context.bot.send_message(chat_id=to_chat_id, text=msg)
            return

        month_items = 0
        month_revenue = 0
        month_cost_internal = 0

        # Duyệt qua TẤT CẢ các sheet sản phẩm
        for sheet_info in product_sheets:
            sheet_tab = sheet_info.get("sheet_tab", "")
            ws_product = sheet_info.get("worksheet")

            if not sheet_tab or not ws_product:
                continue

            try:
                all_rows = ws_product.get_all_values()

                for row in all_rows[1:]:
                    if len(row) < 4:
                        continue
                    status = row[1].strip().upper()
                    if status != "ĐÃ BÁN":
                        continue

                    day_str = row[2].strip() if len(row) > 2 else ""
                    chot_lai_str = row[3].strip() if len(row) > 3 else ""
                    gia_nhap_str = row[4].strip() if len(row) > 4 else ""

                    if not date_in_current_month(day_str, now):
                        continue

                    chot_lai_val = parse_money_with_k(chot_lai_str or "0")

                    cost_e = 0
                    txt_e = gia_nhap_str.lower()
                    if txt_e:
                        base = parse_money_with_k(txt_e)
                        if "trừ" in txt_e:
                            cost_e = base
                        elif "cộng" in txt_e:
                            cost_e = -base

                    month_items += 1
                    month_revenue += chot_lai_val
                    month_cost_internal += cost_e

            except Exception as e:
                logging.error(f"❌ Lỗi khi duyệt sheet {sheet_tab} để tính doanh thu tháng: {e}", exc_info=True)

        month_cost_hangnhap = 0
        try:
            ws_hn = db.worksheet(HANG_NHAP_SHEET_NAME)
            all_rows = ws_hn.get_all_values()
            for row in all_rows[1:]:
                if len(row) < 3:
                    continue
                date_str = row[0].strip()
                cost_str = row[2].strip()
                cost_val = parse_money_with_k(cost_str)
                if cost_val <= 0:
                    continue
                if date_in_current_month(date_str, now):
                    month_cost_hangnhap += cost_val
        except Exception as e:
            logging.error(f"❌ Lỗi đọc sheet Hàng Nhập (theo tháng): {e}", exc_info=True)

        MONTHLY_TARGET = 20_000_000
        month_cost_total = month_cost_internal + month_cost_hangnhap
        # Lãi tháng = Doanh thu - Chi phí (có thể âm nếu lỗ)
        month_profit = month_revenue - month_cost_total
        display_month_profit = abs(month_profit)
        month_percent = (month_revenue / MONTHLY_TARGET * 100) if MONTHLY_TARGET > 0 else 0
        month_bar = build_progress_bar(month_percent)

        lines: list[str] = []
        lines.append(f"📆 <b>BÁO CÁO DOANH THU THÁNG {now.strftime('%m/%Y')}</b>\n")
        if month_items == 0:
            lines.append("❗ Tháng này chưa ghi nhận sản phẩm nào được bán.")
        else:
            lines.append(f"📦 Bán ra trong THÁNG: <b>{month_items}</b> sản phẩm")
            lines.append(
                f"💰 Doanh thu THÁNG: <b>{format_money(month_revenue)}</b> "
                f"({month_percent:.1f}% / {format_money(MONTHLY_TARGET)})"
            )
            lines.append(f"📉 Chi phí (Giá nhập + Hàng Nhập) THÁNG: <b>{format_money(month_cost_total)}</b>")
            lines.append(f"✅ <b>TỔNG LÃI THÁNG:</b> {format_money(display_month_profit)}")
            lines.append(f"📈 Tiến độ tháng: {month_bar}")
            lines.append(f"   {format_money(month_revenue)} / {format_money(MONTHLY_TARGET)}")

        report_text = "\n".join(lines)
        if notify_admins:
            await send_to_all_admins(context.bot, report_text, parse_mode="HTML")
        if to_chat_id is not None and (not notify_admins or to_chat_id not in ADMIN_IDS):
            await context.bot.send_message(chat_id=to_chat_id, text=report_text, parse_mode="HTML")

        logging.info(f"✅ Đã gửi báo cáo doanh thu THÁNG cho {now.strftime('%m/%Y')}.")
    except Exception as e:
        logging.error(f"❌ Lỗi send_monthly_revenue_report: {e}", exc_info=True)
        if to_chat_id:
            try:
                await context.bot.send_message(
                    chat_id=to_chat_id,
                    text="❌ Có lỗi khi tạo báo cáo tháng, vui lòng thử lại hoặc liên hệ admin.",
                )
            except Exception:
                pass


# ==============================================================================
# 5.x REMINDER JOBS
# ==============================================================================

async def morning_reminder(context: ContextTypes.DEFAULT_TYPE) -> None:
    """Nhắc admin dậy làm việc lúc 08:00 mỗi ngày."""
    text = (
        "☀️ <b>8:00 rồi sếp ơi!</b>\n\n"
        "Dậy thôi nào—công việc đang xếp hàng, deadline đang nhìn chằm chằm 😆\n\n"
        "Rửa mặt cho tỉnh, uống ngụm nước, rồi mình “vào việc” cho ngầu nhé!"
    )
    await send_to_all_admins(context.bot, text, parse_mode="HTML")


async def lunch_reminder(context: ContextTypes.DEFAULT_TYPE) -> None:
    """Nhắc admin ăn cơm trưa lúc 11:30 mỗi ngày."""
    text = (
        "🍚 <b>11:30 rồi sếp!</b>\n\n"
        "Đến giờ nạp năng lượng: ăn cơm trưa đi sếp không là chiều dễ “tụt pin” lắm đó 🤣\n\n"
        "Ăn xong mình chiến tiếp cho khỏe!"
    )
    await send_to_all_admins(context.bot, text, parse_mode="HTML")


async def sleep_reminder(context: ContextTypes.DEFAULT_TYPE) -> None:
    """Nhắc admin đi ngủ lúc 23:59 mỗi ngày."""
    text = (
        "🌙 <b>23:59 rồi sếp ơi!</b>\n\n"
        "Ngủ thôi—mai còn làm “trùm cuối” tiếp.\n\n"
        "Thức thêm là mắt thành “gấu trúc full HD” đó nha 😴🐼"
    )
    await send_to_all_admins(context.bot, text, parse_mode="HTML")

def generate_order_id(warranty_days=None):
    """Tạo mã đơn hàng với warranty prefix (KHÔNG có dấu gạch ngang)
    
    Format:
    - W30XXXXXX: Bảo hành 30 ngày
    - W15XXXXXX: Bảo hành 15 ngày  
    - W10XXXXXX: Bảo hành 10 ngày
    - NXXXXXX: Không bảo hành
    - XXXXXX: Không xác định (backward compatibility)
    """
    random_part = ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
    
    if warranty_days is None:
        return random_part
    elif warranty_days == 0:
        return f"N{random_part}"
    else:
        return f"W{warranty_days}{random_part}"



def get_qr_code_url(amount, order_code, account_no=None):
    """Tạo URL QR code với nội dung chuyển khoản và số tiền"""
    if account_no is None:
        config = get_bank_config()
        account_no = config.get("accountNo", "0393959643")
    # Format: MB-{accountNo}-compact2.jpg?amount={amount}&addInfo={order_code}
    amount_int = int(amount.replace(".", "").replace(",", ""))
    qr_url = f"https://img.vietqr.io/image/MB-{account_no}-compact2.jpg?amount={amount_int}&addInfo={order_code}"
    return qr_url

def build_bank_headers():
    """Header giống y request trong Chrome - reload config mỗi lần"""
    config = get_bank_config()
    return {
        "Accept": "application/json, text/plain, */*",
        "Accept-Encoding": "gzip, deflate, br, zstd",
        "Accept-Language": "vi,en;q=0.9",
        "App": "MB_WEB",
        "Authorization": f"Basic {config['token']}",
        "Content-Type": "application/json; charset=UTF-8",
        "Cookie": config['cookie'],
        "Deviceid": config['deviceid'],
        "Origin": "https://online.mbbank.com.vn",
        "Referer": "https://online.mbbank.com.vn/information-account/source-account",
        "Sec-Ch-Ua": '"Chromium";v="142", "Google Chrome";v="142", "Not_A Brand";v="99"',
        "Sec-Ch-Ua-Mobile": "?0",
        "Sec-Ch-Ua-Platform": '"Windows"',
        "Sec-Fetch-Dest": "empty",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Site": "same-origin",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36",
        "X-Request-Id": config['id_run'],
        "Refno": config['id_run'],
    }

def build_bank_payload(from_date: str, to_date: str):
    """from_date, to_date dạng DD/MM/YYYY - reload config mỗi lần"""
    config = get_bank_config()
    return {
        "accountNo": config['accountNo'],
        "deviceIdCommon": config['deviceid'],
        "fromDate": from_date,
        "toDate": to_date,
        "refNo": config['id_run'],
        "sessionId": config['sessionId'],
    }

def fetch_apicanhan_transactions():
    """Gọi API apicanhan (có sẵn giải captcha) để lấy lịch sử giao dịch MB"""
    cfg = get_apicanhan_config()
    if not has_valid_apicanhan_config(cfg):
        logging.debug("Thiếu thông tin apicanhan config, bỏ qua gọi API.")
        return []

    params = {
        "key": cfg["key"],
        "username": cfg["username"],
        "password": cfg["password"],
        "accountNo": cfg["accountNo"],
    }

    try:
        resp = requests.get(API_CANHAN_URL, params=params, timeout=30)
        resp.raise_for_status()
        data = resp.json()

        if data.get("status") != "success":
            error_msg = data.get("message", "Unknown error")
            logging.warning(f"⚠️ API apicanhan trả về lỗi: {error_msg}")
            return []

        # Response format từ apicanhan: {status: "success", message: "...", transactions: [...]}
        tx_list = data.get("transactions", [])

        if not isinstance(tx_list, list):
            logging.warning(f"transactions không phải list: {type(tx_list)}")
            return []

        logging.info(f"✅ API apicanhan trả về {len(tx_list)} giao dịch")
        
        # Chỉ log debug nếu cần thiết (bỏ log chi tiết từng giao dịch)
        
        return tx_list
    except requests.exceptions.RequestException as e:
        logging.error(f"❌ Lỗi request đến API apicanhan: {e}")
        return []
    except Exception as e:
        logging.error(f"❌ Lỗi xử lý response từ API apicanhan: {e}", exc_info=True)
        return []

def match_payment_in_transactions(order_code: str, expected_amount: float, tx_list):
    """Tìm giao dịch khớp mã đơn & số tiền trong danh sách trả về từ apicanhan"""
    order_code_upper = str(order_code).upper()
    
    # Log một số giao dịch đầu tiên để debug
    if tx_list:
        logging.debug(f"🔍 Đang tìm mã đơn '{order_code_upper}' trong {len(tx_list)} giao dịch, số tiền mong đợi: {expected_amount}")
        for i, tx in enumerate(tx_list[:5]):
            if isinstance(tx, dict):
                desc = tx.get("description", "N/A")
                amt = tx.get("amount", "N/A")
                tx_type = tx.get("type", "N/A")
                logging.debug(f"   [{i}] Type={tx_type}, Amount={amt}, Desc={desc[:80]}...")
    
    for idx, tx in enumerate(tx_list[:20]):  # Check 20 giao dịch mới nhất
        if not isinstance(tx, dict):
            continue

        # Format từ apicanhan: description = "CUSTOMER <MÃ_ĐƠN> Ma giao dịch..."
        description = tx.get("description", "")
        desc_upper = description.upper()
        
        # Tìm mã đơn hàng trong description
        found_order_code = False
        
        # Cách 1: Tìm "CUSTOMER <MÃ_ĐƠN>"
        customer_pattern = f"CUSTOMER {order_code_upper}"
        if customer_pattern in desc_upper:
            found_order_code = True
            logging.info(f"✅ Tìm thấy pattern 'CUSTOMER {order_code_upper}' trong description")
        
        # Cách 2: Tìm mã đơn hàng đứng độc lập (với word boundary)
        if not found_order_code and order_code_upper in desc_upper:
            pattern = r'\b' + re.escape(order_code_upper) + r'\b'
            if re.search(pattern, desc_upper):
                found_order_code = True
                logging.info(f"✅ Tìm thấy mã đơn {order_code_upper} (word boundary) trong description")
        
        # Cách 3: Tìm mã đơn cách bằng dấu chấm (MB Bank format: MBVCB.xxx.RGX816.yyy)
        if not found_order_code and order_code_upper in desc_upper:
            # Thử tìm với dấu chấm trước/sau
            dot_pattern = r'[\.\s]' + re.escape(order_code_upper) + r'[\.\s]'
            if re.search(dot_pattern, desc_upper):
                found_order_code = True
                logging.info(f"✅ Tìm thấy mã đơn {order_code_upper} (dot separated) trong description")
            # Thử tìm ở đầu hoặc cuối với dấu chấm
            elif desc_upper.startswith(order_code_upper + ".") or desc_upper.startswith(order_code_upper + " "):
                found_order_code = True
                logging.info(f"✅ Tìm thấy mã đơn {order_code_upper} ở đầu description")
            elif desc_upper.endswith("." + order_code_upper) or desc_upper.endswith(" " + order_code_upper):
                found_order_code = True
                logging.info(f"✅ Tìm thấy mã đơn {order_code_upper} ở cuối description")
        
        # Cách 4: Fallback - chỉ cần chứa mã đơn (ít nghiêm ngặt hơn)
        if not found_order_code and order_code_upper in desc_upper:
            found_order_code = True
            logging.info(f"✅ Tìm thấy mã đơn {order_code_upper} (contains match) trong description: {description[:100]}")
        
        if not found_order_code:
            continue

        # Lấy amount từ transaction
        amount_raw = tx.get("amount", "0")
        try:
            # amount có thể là string "2000" hoặc số
            amount_clean = re.sub(r"[^\d.]", "", str(amount_raw)).replace(",", ".")
            amount_value = float(amount_clean) if amount_clean else 0.0
        except Exception:
            amount_value = 0.0

        if amount_value <= 0:
            logging.debug(f"⚠️ Bỏ qua giao dịch do amount <= 0: {amount_raw}")
            continue

        # Kiểm tra type - chỉ lấy giao dịch nhận tiền (IN)
        tx_type = str(tx.get("type", "")).upper()
        if tx_type and tx_type not in ("IN", "CREDIT", "+", ""):
            logging.debug(f"⚠️ Bỏ qua giao dịch do type không phải IN: {tx_type}")
            continue

        # Kiểm tra số tiền khớp
        diff = abs(amount_value - float(expected_amount))
        if diff < AMOUNT_TOLERANCE:
            logging.info(f"✅✅✅ Tìm thấy thanh toán qua apicanhan!")
            logging.info(f"   Order: {order_code}")
            logging.info(f"   Amount: {amount_value} (Expected: {expected_amount}, Diff: {diff})")
            logging.info(f"   Description: {description}")
            logging.info(f"   Transaction ID: {tx.get('transactionID', 'N/A')}")
            return True, tx
        else:
            logging.debug(f"⚠️ Amount mismatch: order {order_code} expected {expected_amount}, got {amount_value} (diff: {diff})")

    return False, None

async def check_payment_from_bank(order_code, expected_amount):
    """Kiểm tra thanh toán từ API mbbank - sử dụng code mới cải thiện"""
    try:
        # Reload config mỗi lần để luôn dùng config mới nhất
        config = get_bank_config()
        
        if not config.get("sessionId") or not config.get("accountNo"):
            logging.warning("Thiếu thông tin bank config")
            return False, None
        
        # Kiểm tra config có đầy đủ không
        missing_keys = [k for k in ['sessionId', 'token', 'cookie', 'deviceid', 'accountNo', 'id_run'] if not config.get(k)]
        if missing_keys:
            logging.warning(f"Thiếu các key trong bank config: {missing_keys}")
            return False, None
        
        # Lấy khoảng ngày: 1 ngày gần nhất
        today = get_vietnam_now()
        from_date = (today - timedelta(days=1)).strftime("%d/%m/%Y")
        to_date = today.strftime("%d/%m/%Y")
        
        url = 'https://online.mbbank.com.vn/api/retail-transactionms/transactionms/get-account-transaction-history'
        
        headers = build_bank_headers()
        payload = build_bank_payload(from_date, to_date)
        
        response = requests.post(url, json=payload, headers=headers, timeout=20)
        
        # Xử lý lỗi 401 Unauthorized
        if response.status_code == 401:
            logging.warning(f"⚠️ API returned status code 401: Unauthorized")
            logging.warning(f"⚠️ Session có thể đã hết hạn hoặc token/cookie không đúng")
            logging.warning(f"⚠️ Vui lòng lấy session mới từ browser khi đang đăng nhập")
            return False, None
        
        if response.status_code == 200:
            try:
                data = response.json()
                
                # Kiểm tra session có valid không
                if isinstance(data.get("result"), dict):
                    result = data.get("result")
                    if result.get("ok") == False or result.get("responseCode") == "GW200":
                        error_msg = result.get("message", "Session Invalid")
                        logging.error(f"❌ Session Invalid! API trả về: {error_msg}")
                        logging.error(f"❌ Cần cập nhật lại sessionId, cookie, token trong config.json")
                        logging.error(f"❌ Hãy cập nhật lại session trong mbbank-main/config/config.json")
                        return False, None
                
                # Thử nhiều cách tìm transaction list (theo code mới cải thiện)
                tx_list = (
                    data.get("transactionInfos")
                    or data.get("transactionHistoryList")
                    or data.get("transactions")
                    or data.get("data")
                    or (data.get("result") if isinstance(data.get("result"), list) else None)
                    or (data.get("result", {}).get("transactionHistoryList") if isinstance(data.get("result"), dict) else None)
                    or []
                )
                
                if not isinstance(tx_list, list) or len(tx_list) == 0:
                    # Kiểm tra xem có phải do session invalid không
                    if data.get("transactionHistoryList") is None and isinstance(data.get("result"), dict):
                        result = data.get("result")
                        if result.get("ok") == False:
                            logging.error(f"❌ Session Invalid! {result.get('message', 'Unknown error')}")
                            return False, None
                    
                    logging.debug(f"Không tìm thấy transaction list. Response keys: {list(data.keys()) if isinstance(data, dict) else 'Not a dict'}")
                    return False, None
                
                # Kiểm tra các giao dịch gần đây
                logging.info(f"✅ Checking {len(tx_list)} transactions for order {order_code}")
                for idx, transaction in enumerate(tx_list[:10]):  # Check 10 giao dịch gần nhất
                    try:
                        if not isinstance(transaction, dict):
                            continue
                            
                        # Kiểm tra nội dung chuyển khoản - thử nhiều key (theo code mới)
                        description = (
                            transaction.get("descriptionVI")
                            or transaction.get("addDescription", '')
                            or transaction.get("description", '')
                            or transaction.get("remark", '')
                            or transaction.get("content", '')
                            or transaction.get("note", '')
                            or ''
                        )
                        
                        # Lấy số tiền - ưu tiên creditAmount
                        credit_amount = (
                            transaction.get("creditAmount")
                            or transaction.get("amount", 0)
                            or 0
                        )
                        
                        # Log transaction để debug (chỉ 3 đầu)
                        if idx < 3:
                            logging.debug(f"Transaction {idx}: description='{description}', credit_amount={credit_amount}")
                        
                        # Chuyển đổi số tiền
                        if isinstance(credit_amount, str):
                            credit_amount_clean = re.sub(r'[^\d.]', '', credit_amount.replace(',', '.'))
                            credit_amount = float(credit_amount_clean) if credit_amount_clean else 0.0
                        else:
                            credit_amount = float(credit_amount) if credit_amount else 0.0
                        
                        # Chỉ xử lý giao dịch nhận tiền
                        if credit_amount <= 0:
                            continue
                        
                        # Chuyển đổi expected_amount
                        expected_amount_clean = expected_amount.replace(".", "").replace(",", "")
                        expected_amount_float = float(expected_amount_clean) if expected_amount_clean else 0.0
                        
                        # Kiểm tra nội dung và số tiền
                        description_upper = description.upper()
                        order_code_upper = order_code.upper()
                        
                        # Tìm mã đơn hàng trong nội dung (format: "CUSTOMER <MÃ_ĐƠN>" hoặc chỉ có mã đơn)
                        # Ví dụ: "CUSTOMER W7RIFC Ma giao dich..." -> tìm "W7RIFC"
                        found_order_code = False
                        
                        # Cách 1: Tìm "CUSTOMER <MÃ_ĐƠN>"
                        customer_pattern = f"CUSTOMER {order_code_upper}"
                        if customer_pattern in description_upper:
                            found_order_code = True
                            logging.debug(f"Tìm thấy pattern 'CUSTOMER {order_code_upper}' trong description")
                        
                        # Cách 2: Tìm mã đơn hàng đứng độc lập (không có "CUSTOMER")
                        if not found_order_code and order_code_upper in description_upper:
                            # Kiểm tra xem mã đơn có đứng độc lập không (có khoảng trắng hoặc ở đầu/cuối)
                            import re
                            # Tìm mã đơn hàng với word boundary
                            pattern = r'\b' + re.escape(order_code_upper) + r'\b'
                            if re.search(pattern, description_upper):
                                found_order_code = True
                                logging.debug(f"Tìm thấy mã đơn {order_code_upper} trong description")
                        
                        # Kiểm tra nội dung chứa mã đơn hàng và số tiền khớp
                        if found_order_code:
                            amount_diff = abs(credit_amount - expected_amount_float)
                            if amount_diff < 1000:  # Cho phép sai số 1000 VNĐ
                                logging.info(f"✅✅✅ Tìm thấy thanh toán! Order: {order_code}, Amount: {credit_amount}, Expected: {expected_amount_float}, Description: {description}")
                                return True, transaction
                            else:
                                logging.debug(f"⚠️ Amount mismatch for order {order_code}: {credit_amount} vs {expected_amount_float} (diff: {amount_diff})")
                                
                    except Exception as e:
                        logging.error(f"Lỗi xử lý transaction {idx}: {e}")
                        continue
                
                logging.debug(f"Không tìm thấy thanh toán cho order {order_code} trong {len(tx_list)} transactions")
                return False, None
                    
            except json.JSONDecodeError as e:
                logging.error(f"Lỗi parse JSON response: {e}, Response text: {response.text[:200]}")
                return False, None
            except Exception as e:
                logging.error(f"Lỗi xử lý response: {e}")
                return False, None
        else:
            logging.warning(f"API returned status code {response.status_code}: {response.text[:200]}")
            return False, None
        
        return False, None
    except requests.exceptions.RequestException as e:
        logging.error(f"Lỗi request đến bank API: {e}")
        return False, None
    except Exception as e:
        logging.error(f"Lỗi check payment từ bank: {e}", exc_info=True)
        return False, None

def check_payment_from_file(order_code):
    """Kiểm tra thanh toán từ file payment_log.json (được ghi bởi Node.js script)"""
    try:
        if not os.path.exists(PAYMENT_LOG_FILE):
            return False, None
        
        with open(PAYMENT_LOG_FILE, "r", encoding="utf-8") as f:
            payment_log = json.load(f)
        
        if order_code in payment_log:
            payment_info = payment_log[order_code]
            # Xóa khỏi log sau khi đã đọc
            del payment_log[order_code]
            with open(PAYMENT_LOG_FILE, "w", encoding="utf-8") as f:
                json.dump(payment_log, f, ensure_ascii=False, indent=2)
            return True, payment_info
        return False, None
    except Exception as e:
        logging.error(f"Lỗi đọc payment log: {e}")
        return False, None

def format_countdown(seconds_left):
    """Format thời gian đếm ngược thành MM:SS"""
    if seconds_left <= 0:
        return "00:00"
    minutes = seconds_left // 60
    seconds = seconds_left % 60
    return f"{minutes:02d}:{seconds:02d}"

async def update_order_message(order_code, context, expired=False):
    """Cập nhật message đơn hàng với đồng hồ đếm ngược"""
    if order_code not in pending_orders:
        return
    
    order = pending_orders[order_code]
    if "message_id" not in order or "chat_id" not in order:
        return
    
    try:
        # Xử lý created_at có thể là ISO string hoặc timestamp số
        created_at = order.get("created_at", time.time())
        if isinstance(created_at, str):
            try:
                from datetime import datetime
                dt = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
                created_at = dt.timestamp()
            except:
                created_at = time.time() - 60  # Fallback
        
        elapsed_time = time.time() - created_at
        time_left = 300 - elapsed_time  # 5 phút = 300 giây
        
        config = get_bank_config()
        account_no = config.get("accountNo", "0393959643")
        
        if expired or time_left <= 0:
            # Hết thời gian - hiển thị nút "Tiếp tục đơn hàng" và "Hủy Đơn Hàng"
            caption = (
                f"🧾 <b>XÁC NHẬN ĐƠN HÀNG</b>\n"
                f"📦 {order['product_name']} x {order['quantity']}\n"
                f"💰 <b>{order['total']} VNĐ</b>\n"
                f"📸 Quét QR hoặc CK:\n"
                f"🏦 STK: <code>{account_no}</code>\n"
                f"📝 Nội dung: <code>{order_code}</code>\n"
                f"💵 Số tiền: <b>{order['total']} VNĐ</b>\n\n"
                f"⏰ <b>Thời gian đã hết</b>\n"
                f"<i>Bạn có muốn tiếp tục đợi thanh toán không?</i>"
            )
            keyboard = [
                [InlineKeyboardButton("⏰ Tiếp tục đơn hàng", callback_data=f'extend_order_{order_code}')],
                [InlineKeyboardButton("❌ Hủy đơn hàng", callback_data=f'cancel_{order_code}')]
            ]
        else:
            # Còn thời gian - hiển thị đồng hồ đếm ngược
            countdown_str = format_countdown(int(time_left))
            caption = (
                f"🧾 <b>XÁC NHẬN ĐƠN HÀNG</b>\n"
                f"📦 {order['product_name']} x {order['quantity']}\n"
                f"💰 <b>{order['total']} VNĐ</b>\n"
                f"📸 Quét QR hoặc CK:\n"
                f"🏦 STK: <code>{account_no}</code>\n"
                f"📝 Nội dung: <code>{order_code}</code>\n"
                f"💵 Số tiền: <b>{order['total']} VNĐ</b>\n\n"
                f"⏰ <b>Thời gian còn lại: {countdown_str}</b>\n"
                f"<i>Hệ thống đang tự động kiểm tra thanh toán...</i>"
            )
            keyboard = [
                [InlineKeyboardButton("❌ Hủy đơn hàng", callback_data=f'cancel_{order_code}')]
            ]
        
        try:
            await context.bot.edit_message_caption(
                chat_id=order["chat_id"],
                message_id=order["message_id"],
                caption=caption,
                parse_mode='HTML',
                reply_markup=InlineKeyboardMarkup(keyboard)
            )
        except Exception as e:
            # Nếu không thể edit (message không thay đổi hoặc đã bị xóa), bỏ qua
            if "Message is not modified" not in str(e) and "message to edit not found" not in str(e).lower():
                logging.debug(f"Không thể cập nhật message đơn {order_code}: {e}")
    except Exception as e:
        logging.debug(f"Lỗi cập nhật message đơn {order_code}: {e}")

async def auto_check_payment(order_code, total_str, total_int, context):
    """Tự động kiểm tra thanh toán - gọi API mỗi 5 giây và cập nhật đồng hồ đếm ngược"""
    max_checks = 180  # Check trong 3 phút (180 lần x 1 giây = 180 giây)
    check_count = 0
    last_api_call_time = 0
    API_CALL_INTERVAL = 5  # Gọi API mỗi 5 giây một lần
    last_message_update = 0
    MESSAGE_UPDATE_INTERVAL = 1  # Cập nhật message mỗi 1 giây để đồng hồ đếm ngược từng giây
    
    while check_count < max_checks and order_code in pending_orders:
        await asyncio.sleep(1)  # Check mỗi 1 giây
        check_count += 1
        
        if order_code not in pending_orders:
            logging.info(f"Đơn {order_code} đã được xử lý hoặc hủy")
            break

        current_time = time.time()
        
        # Cập nhật đồng hồ đếm ngược mỗi giây
        if current_time - last_message_update >= MESSAGE_UPDATE_INTERVAL:
            # Xử lý created_at có thể là ISO string hoặc timestamp số
            created_at = pending_orders[order_code].get("created_at", current_time)
            if isinstance(created_at, str):
                try:
                    from datetime import datetime
                    dt = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
                    created_at = dt.timestamp()
                except:
                    created_at = current_time - 60  # Fallback: coi như đơn mới 1 phút
            
            elapsed_time = current_time - created_at
            time_left = 180 - elapsed_time  # 3 phút = 180 giây
            
            if time_left <= 0:
                # Hết thời gian - cập nhật message với nút "Tiếp tục đơn hàng"
                await update_order_message(order_code, context, expired=True)
                # Không tự động hủy đơn, đợi người dùng chọn
                break
            else:
                await update_order_message(order_code, context, expired=False)
            last_message_update = current_time

        # Gọi API apicanhan mỗi 5 giây
        time_since_last_api = current_time - last_api_call_time
        
        if time_since_last_api >= API_CALL_INTERVAL:
            # 1) Ưu tiên: Gọi API apicanhan (tự động login + giải captcha)
            try:
                api_cfg = get_apicanhan_config()
                if has_valid_apicanhan_config(api_cfg):
                    tx_list = fetch_apicanhan_transactions()
                    last_api_call_time = current_time
                    
                    if tx_list:
                        # Check customer order payment
                        is_paid, payment_info = match_payment_in_transactions(order_code, float(total_int), tx_list)
                        if is_paid:
                            logging.info(f"✅✅ Đã nhận thanh toán qua apicanhan cho đơn {order_code}, đang xử lý...")
                            success, message = await deliver_order_logic(order_code, context)
                            if success:
                                logging.info(f"✅ Đã xử lý đơn hàng {order_code} thành công (apicanhan)")
                                break
                            else:
                                logging.warning(f"⚠️ Xử lý đơn hàng {order_code} thất bại: {message}")
                    else:
                        logging.debug(f"API apicanhan không trả về giao dịch nào cho đơn {order_code}")
                else:
                    logging.debug("Chưa cấu hình apicanhan (apicanhanKey/username/password/accountNo).")
            except Exception as e:
                logging.error(f"Lỗi khi gọi apicanhan cho đơn {order_code}: {e}", exc_info=True)

        # 2) Fallback: đọc payment từ file log (Node.js detector)
        try:
            is_paid, payment_info = check_payment_from_file(order_code)
            
            if is_paid:
                # Thanh toán thành công, xử lý đơn hàng
                logging.info(f"✅ Đã nhận thanh toán cho đơn {order_code} từ payment log, đang xử lý...")
                success, message = await deliver_order_logic(order_code, context)
                if success:
                    logging.info(f"✅ Đã xử lý đơn hàng {order_code} thành công")
                    break
                else:
                    logging.warning(f"⚠️ Xử lý đơn hàng {order_code} thất bại: {message}")
        except Exception as e:
            logging.error(f"Lỗi trong auto_check_payment cho đơn {order_code}: {e}", exc_info=True)

def clean_old_data():
    if not os.path.exists(DATA_FOLDER):
        os.makedirs(DATA_FOLDER)
        return
    now = time.time()
    cutoff = now - (RETENTION_DAYS * 86400)
    for user_folder in os.listdir(DATA_FOLDER):
        folder_path = os.path.join(DATA_FOLDER, user_folder)
        if os.path.isdir(folder_path):
            for filename in os.listdir(folder_path):
                file_path = os.path.join(folder_path, filename)
                if os.path.getmtime(file_path) < cutoff:
                    os.remove(file_path)
            if not os.listdir(folder_path):
                os.rmdir(folder_path)

def save_order_local(username, user_id, product, acc_info, order_code):
    try:
        safe_username = username if username else str(user_id)
        safe_username = "".join(
            c for c in safe_username if c.isalnum() or c in (' ', '_', '-')
        ).strip()
        user_path = os.path.join(DATA_FOLDER, safe_username)
        if not os.path.exists(user_path):
            os.makedirs(user_path)
        file_name = f"Order_{order_code}.txt"
        file_path = os.path.join(user_path, file_name)
        timestamp = get_vietnam_now().strftime("%d/%m/%Y %H:%M:%S")
        content = (
            f"=== HÓA ĐƠN ===\nMÃ: {order_code}\nTIME: {timestamp}\n"
            f"SP: {product}\nACC:\n{acc_info}\n"
        )
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(content)
    except Exception as e:
        logging.error(f"Lỗi lưu file: {e}")

# ==============================================================================
# CORE DELIVERY LOGIC
# ==============================================================================

async def deliver_order_logic(order_code, app_context):
    """Logic giao hàng tự động"""
    if order_code not in pending_orders:
        return False, "Đơn hàng không tồn tại hoặc đã xử lý."
    
    order = pending_orders[order_code]
    
    # ===== QUAN TRỌNG: Tránh race condition - đánh dấu đang xử lý =====
    if order.get('_processing'):
        logging.warning(f"⚠️ Đơn {order_code} đang được xử lý, bỏ qua...")
        return False, "Đơn hàng đang được xử lý"
    
    # Đánh dấu đang xử lý NGAY LẬP TỨC
    order['_processing'] = True
    pending_orders[order_code] = order
    try:
        with open(PENDING_ORDERS_FILE, "w", encoding="utf-8") as f:
            json.dump(pending_orders, f, ensure_ascii=False, indent=2)
    except:
        pass
    # ===== End race condition guard =====
    
    customer_chat_id = order['user_id']
    product_name = order.get('product_name', '')
    is_slot_product = product_name.strip().startswith("Slot")
    
    # ============= XỬ LÝ ĐƠN VERIFY PHONE =============
    if order.get('product_type') == 'verify_phone':
        try:
            quantity = order.get('quantity', 0)
            
            # Thanh toán xong → Yêu cầu khách gửi email|password
            # Đánh dấu đơn đang chờ nhập credentials
            order['waiting_for_credentials'] = True
            order['credentials_waiting_start'] = time.time()
            pending_orders[order_code] = order
            save_pending_orders()
            
            # Yêu cầu khách gửi email|password
            await app_context.bot.send_message(
                chat_id=customer_chat_id,
                text=(
                    f"🎉 <b>THANH TOÁN THÀNH CÔNG!</b>\n\n"
                    f"📦 Mã đơn: <code>{order_code}</code>\n"
                    f"📧 Số account: <b>{quantity}</b>\n\n"
                    f"📝 <b>Bây giờ vui lòng gửi email|password</b> của {quantity} tài khoản cần verify:\n\n"
                    f"🔹 Format: <code>email|password</code>\n"
                    f"💡 Mỗi dòng 1 tài khoản\n\n"
                    f"📝 Ví dụ:\n"
                    f"<code>account1@gmail.com|pass123\naccount2@gmail.com|pass456</code>\n\n"
                    f"⏰ <b>Thời gian chờ:</b> 10 phút"
                ),
                parse_mode='HTML'
            )
            
            # Thông báo cho admin
            await send_to_all_admins(
                app_context.bot,
                f"✅ <b>ĐƠN VERIFY ĐÃ THANH TOÁN!</b>\n\n"
                f"📦 Mã đơn: <code>{order_code}</code>\n"
                f"👤 Khách: {order.get('user_fullname', 'N/A')}\n"
                f"📧 Số account: {quantity}\n"
                f"💰 Tổng tiền: {order.get('total_amount', 0):,}đ\n\n"
                f"⏳ Đang chờ khách gửi email|password...",
                parse_mode='HTML'
            )
            
            logging.info(f"📱 Đơn verify {order_code} đã thanh toán - chờ {quantity} credentials")
            
            return True, "Đang chờ email|password"
            
        except Exception as e:
            logging.error(f"Lỗi xử lý đơn verify phone {order_code}: {e}")
            return False, f"Lỗi xử lý đơn verify: {e}"
    
    # ============= XỬ LÝ CÁC LOẠI ĐƠN KHÁC =============
    try:
        db = get_db()
        ws_product = get_worksheet_by_name(db, order['sheet_tab_name'])
        if not ws_product: 
            return False, "Lỗi Sheet không tìm thấy."
        
        today_str = get_vietnam_now().strftime("%d/%m/%Y")
        
        # Xác định loại sản phẩm dựa vào ID và tên
        product_id = order.get('product_id', '')
        product_name_lower = product_name.strip().lower()
        product_type = get_product_type_from_id(product_id)
        
        # QUAN TRỌNG: Kiểm tra Verify TRƯỚC (vì tên như "Verify Sheerid" chứa cả 2 từ)
        # Sản phẩm Verify có tên bắt đầu = "Verify" sẽ có flow 2-optin riêng
        if is_verify_product(product_name):
            product_type = 'verify'
        # Fallback: kiểm tra theo TÊN sản phẩm nếu ID không match và không phải Verify
        elif product_type == 'normal':
            if "sheerid" in product_name_lower or "checkout" in product_name_lower:
                # Không áp dụng cho sản phẩm đã được đánh dấu Verify
                if "sheerid" in product_name_lower:
                    product_type = 'sheerid'
                elif "checkout" in product_name_lower:
                    product_type = 'checkout'
        
        # Override: nếu tên sản phẩm bắt đầu bằng "Slot" thì là slot
        if product_name.strip().startswith("Slot"):
            product_type = 'slot'

        
        if product_type == 'slot':
            # Sản phẩm Slot: yêu cầu email và ghi vào sheet
            # Lưu thông tin order để sau khi nhận email sẽ ghi vào sheet
            order['waiting_for_email'] = True
            order['waiting_type'] = 'email'
            order['sheet_worksheet'] = ws_product.title  # Lưu tên sheet để dùng sau
            order['delivery_date'] = today_str
            
            # Yêu cầu khách gửi email
            await app_context.bot.send_message(
                chat_id=customer_chat_id,
                text=(f"🎉 <b>THANH TOÁN THÀNH CÔNG!</b>\n"
                      f"Mã đơn: <b>{order_code}</b>\n"
                      f"📦 SP: {order['product_name']} | SL: {order['quantity']}\n"
                      f"➖➖➖➖➖➖➖➖\n\n"
                      f"📧 <b>Vui lòng gửi email của bạn để chúng tôi thêm slot vào farm</b>\n\n"
                      f"💬 Chỉ cần gõ email của bạn và gửi cho bot là được!\n\n"
                      f"⏰ <b>Thời gian chờ: 5 phút</b>"),
                parse_mode='HTML'
            )
            
            # Lưu thời gian bắt đầu chờ email
            order['email_waiting_start'] = time.time()
            
            # Lưu lại pending_orders để chờ email
            pending_orders[order_code] = order
            try:
                with open(PENDING_ORDERS_FILE, "w", encoding="utf-8") as f:
                    json.dump(pending_orders, f, ensure_ascii=False, indent=2)
            except:
                pass
            
            # Thông báo cho tất cả Admin - CHỈ thông báo đã thanh toán, CHƯA hối thúc
            # Sẽ hối thúc khi khách gửi email và bot ghi vào sheet
            try:
                admin_success_msg = (
                    f"🎉 <b>KHÁCH HÀNG ĐÃ THANH TOÁN THÀNH CÔNG!</b>\n\n"
                    f"🆔 Mã đơn: <b>{order_code}</b>\n"
                    f"📦 Sản phẩm: <b>{order['product_name']}</b>\n"
                    f"🔢 Số lượng: {order['quantity']}\n"
                    f"💰 Giá tiền: <b>{order['total']} VNĐ</b>\n\n"
                    f"⏳ <i>Đang chờ khách hàng gửi email...</i>"
                )
                logging.info(f"📤 Đang gửi thông báo đơn thanh toán thành công (Slot) {order_code} cho {len(ADMIN_IDS)} admin...")
                await send_to_all_admins(app_context.bot, admin_success_msg, parse_mode='HTML')
                logging.info(f"✅ Đã gửi thông báo đơn thanh toán thành công (Slot) {order_code} cho tất cả admin")
            except Exception as e:
                logging.error(f"❌ Lỗi khi gửi thông báo đơn thanh toán thành công (Slot) cho admin: {e}", exc_info=True)

            
            # Tạo task tự động hủy nếu quá 5 phút chưa nhận email
            asyncio.create_task(auto_cancel_slot_order_no_email(order_code, customer_chat_id, app_context))
            
            return True, "Đang chờ email từ khách hàng"
        
        elif product_type == 'sheerid':
            # Sản phẩm SheerID Verify: yêu cầu khách gửi link SheerID
            order['waiting_for_link'] = True
            order['waiting_type'] = 'sheerid'
            order['sheet_worksheet'] = ws_product.title
            order['delivery_date'] = today_str
            
            # Yêu cầu khách gửi link SheerID
            await app_context.bot.send_message(
                chat_id=customer_chat_id,
                text=(f"🎉 <b>THANH TOÁN THÀNH CÔNG!</b>\n"
                      f"Mã đơn: <b>{order_code}</b>\n"
                      f"📦 SP: {order['product_name']} | SL: {order['quantity']}\n"
                      f"➖➖➖➖➖➖➖➖\n\n"
                      f"🔗 <b>Vui lòng gửi link SheerID của bạn để chúng tôi xác minh</b>\n\n"
                      f"💬 Chỉ cần gửi link SheerID cho bot là được!"),
                parse_mode='HTML'
            )
            
            # Lưu thời gian bắt đầu chờ
            order['link_waiting_start'] = time.time()
            
            # Lưu lại pending_orders
            pending_orders[order_code] = order
            try:
                with open(PENDING_ORDERS_FILE, "w", encoding="utf-8") as f:
                    json.dump(pending_orders, f, ensure_ascii=False, indent=2)
            except:
                pass
            
            # Thông báo cho Admin - CHỈ thông báo đã thanh toán, CHƯA hối thúc
            # Sẽ hối thúc khi khách gửi link SheerID và bot ghi vào sheet
            try:
                admin_msg = (
                    f"🎉 <b>KHÁCH HÀNG ĐÃ THANH TOÁN THÀNH CÔNG!</b>\n\n"
                    f"🆔 Mã đơn: <b>{order_code}</b>\n"
                    f"📦 Sản phẩm: <b>{order['product_name']}</b>\n"
                    f"🔢 Số lượng: {order['quantity']}\n"
                    f"💰 Giá tiền: <b>{order['total']} VNĐ</b>\n"
                    f"🔗 Loại đơn: <b>SHEERID VERIFY</b>\n\n"
                    f"⏳ <i>Đang chờ khách hàng gửi link SheerID...</i>"
                )
                logging.info(f"📤 Đang gửi thông báo đơn SheerID {order_code} cho {len(ADMIN_IDS)} admin...")
                await send_to_all_admins(app_context.bot, admin_msg, parse_mode='HTML')
                logging.info(f"✅ Đã gửi thông báo đơn SheerID {order_code} cho tất cả admin")
            except Exception as e:
                logging.error(f"❌ Lỗi khi gửi thông báo đơn SheerID cho admin: {e}", exc_info=True)

            
            # Tạo task tự động hủy nếu quá 5 phút chưa nhận link
            asyncio.create_task(auto_cancel_link_order_no_response(order_code, customer_chat_id, app_context, 'sheerid'))
            
            return True, "Đang chờ link SheerID từ khách hàng"
        
        elif product_type == 'checkout':
            # Sản phẩm Checkout: yêu cầu khách gửi link Checkout
            order['waiting_for_link'] = True
            order['waiting_type'] = 'checkout'
            order['sheet_worksheet'] = ws_product.title
            order['delivery_date'] = today_str
            
            # Yêu cầu khách gửi link Checkout
            await app_context.bot.send_message(
                chat_id=customer_chat_id,
                text=(f"🎉 <b>THANH TOÁN THÀNH CÔNG!</b>\n"
                      f"Mã đơn: <b>{order_code}</b>\n"
                      f"📦 SP: {order['product_name']} | SL: {order['quantity']}\n"
                      f"➖➖➖➖➖➖➖➖\n\n"
                      f"🔗 <b>Vui lòng gửi link Checkout của bạn để chúng tôi xử lý</b>\n\n"
                      f"💬 Chỉ cần gửi link Checkout cho bot là được!"),
                parse_mode='HTML'
            )
            
            # Lưu thời gian bắt đầu chờ
            order['link_waiting_start'] = time.time()
            
            # Lưu lại pending_orders
            pending_orders[order_code] = order
            try:
                with open(PENDING_ORDERS_FILE, "w", encoding="utf-8") as f:
                    json.dump(pending_orders, f, ensure_ascii=False, indent=2)
            except:
                pass
            
            # Thông báo cho Admin - CHỈ thông báo đã thanh toán, CHƯA hối thúc
            # Sẽ hối thúc khi khách gửi link Checkout và bot ghi vào sheet
            try:
                admin_msg = (
                    f"🎉 <b>KHÁCH HÀNG ĐÃ THANH TOÁN THÀNH CÔNG!</b>\n\n"
                    f"🆔 Mã đơn: <b>{order_code}</b>\n"
                    f"📦 Sản phẩm: <b>{order['product_name']}</b>\n"
                    f"🔢 Số lượng: {order['quantity']}\n"
                    f"💰 Giá tiền: <b>{order['total']} VNĐ</b>\n"
                    f"🛒 Loại đơn: <b>CHECKOUT</b>\n\n"
                    f"⏳ <i>Đang chờ khách hàng gửi link Checkout...</i>"
                )
                logging.info(f"📤 Đang gửi thông báo đơn Checkout {order_code} cho {len(ADMIN_IDS)} admin...")
                await send_to_all_admins(app_context.bot, admin_msg, parse_mode='HTML')
                logging.info(f"✅ Đã gửi thông báo đơn Checkout {order_code} cho tất cả admin")
            except Exception as e:
                logging.error(f"❌ Lỗi khi gửi thông báo đơn Checkout cho admin: {e}", exc_info=True)

            
            # Tạo task tự động hủy nếu quá 5 phút chưa nhận link
            asyncio.create_task(auto_cancel_link_order_no_response(order_code, customer_chat_id, app_context, 'checkout'))
            
            return True, "Đang chờ link Checkout từ khách hàng"
        
        elif product_type == 'verify':
            # Sản phẩm Verify (2-Optin): cho khách chọn gửi Link HOẶC Email/Password
            order['order_type'] = 'verify'
            order['sheet_worksheet'] = ws_product.title
            order['delivery_date'] = today_str
            
            # Lưu vào pending_orders
            pending_orders[order_code] = order
            try:
                with open(PENDING_ORDERS_FILE, "w", encoding="utf-8") as f:
                    json.dump(pending_orders, f, ensure_ascii=False, indent=2)
            except:
                pass
            
            # Gửi thông báo thành công + 2 NÚT CHỌN cho khách
            keyboard_verify = [
                [
                    InlineKeyboardButton("🔗 Link SheerID", callback_data=f"verify_link_{order_code}"),
                    InlineKeyboardButton("📧 Nhập Email/Pass", callback_data=f"verify_emailpass_{order_code}")
                ]
            ]
            
            await app_context.bot.send_message(
                chat_id=customer_chat_id,
                text=(f"🎉 <b>THANH TOÁN THÀNH CÔNG!</b>\n"
                      f"Mã đơn: <b>{order_code}</b>\n"
                      f"📦 SP: {product_name} | SL: {order['quantity']}\n"
                      f"➖➖➖➖➖➖➖➖\n\n"
                      f"📋 <b>Bạn muốn verify bằng phương thức nào?</b>\n\n"
                      f"🔗 <b>Link SheerID</b>: Gửi link để admin xác minh\n"
                      f"📧 <b>Email/Pass</b>: Gửi thông tin đăng nhập để admin xử lý"),
                parse_mode='HTML',
                reply_markup=InlineKeyboardMarkup(keyboard_verify)
            )
            
            # Thông báo cho Admin
            try:
                admin_msg = (
                    f"🎉 <b>KHÁCH HÀNG ĐÃ THANH TOÁN - VERIFY PRODUCT!</b>\n\n"
                    f"🆔 Mã đơn: <b>{order_code}</b>\n"
                    f"👤 Khách: {order.get('fullname', 'N/A')} (ID: {customer_chat_id})\n"
                    f"📦 <b>{product_name}</b> x {order['quantity']}\n"
                    f"💰 <b>{order['total']} VNĐ</b>\n"
                    f"✅ Loại đơn: <b>VERIFY (2-OPTIN)</b>\n\n"
                    f"⏳ <i>Đang chờ khách chọn phương thức verify...</i>"
                )
                logging.info(f"📤 Đang gửi thông báo đơn Verify {order_code} cho {len(ADMIN_IDS)} admin...")
                await send_to_all_admins(app_context.bot, admin_msg, parse_mode='HTML')
                logging.info(f"✅ Đã gửi thông báo đơn Verify {order_code} cho tất cả admin")
            except Exception as e:
                logging.error(f"❌ Lỗi khi gửi thông báo đơn Verify cho admin: {e}", exc_info=True)
            
            return True, "Đang chờ khách chọn phương thức verify"
        
        elif is_addfarm_product(product_name):
            # Sản phẩm ADD Farm: luồng đặc biệt - yêu cầu Gmail trước
            order['waiting_customer_done'] = False
            order['order_type'] = 'addfarm'
            order['sheet_worksheet'] = ws_product.title
            order['delivery_date'] = today_str
            order['waiting_for_addfarm_gmail'] = True  # Flag chờ khách gửi Gmail
            
            # Lưu vào pending_orders (giữ ở đây cho đến khi nhận Gmail)
            pending_orders[order_code] = order
            try:
                with open(PENDING_ORDERS_FILE, "w", encoding="utf-8") as f:
                    json.dump(pending_orders, f, ensure_ascii=False, indent=2)
            except:
                pass
            
            # Gửi thông báo thanh toán thành công + yêu cầu Gmail
            await app_context.bot.send_message(
                chat_id=customer_chat_id,
                text=(f"🎉 <b>THANH TOÁN THÀNH CÔNG!</b>\n"
                      f"Mã đơn: <b>{order_code}</b>\n"
                      f"📦 SP: {order['product_name']} | SL: {order['quantity']}\n"
                      f"➖➖➖➖➖➖➖➖\n\n"
                      f"📧 <b>Vui lòng gửi Gmail cần Add Farm cho bot ngay bây giờ!</b>\n\n"
                      f"💡 Ví dụ: <code>example@gmail.com</code>\n"
                      f"⏰ <b>Thời gian chờ: 10 phút</b>"),
                parse_mode='HTML'
            )
            
            # Thông báo cho Admin (chưa có nút, chờ Gmail)
            admin_msg = (
                f"🎉 <b>KHÁCH HÀNG ĐÃ THANH TOÁN - ADD FARM!</b>\n\n"
                f"🆔 Mã đơn: <b>{order_code}</b>\n"
                f"👤 Khách: {order.get('fullname', 'N/A')} (ID: {customer_chat_id})\n"
                f"📦 <b>{product_name}</b> x {order['quantity']}\n"
                f"💰 <b>{order['total']} VNĐ</b>\n"
                f"🌐 Loại đơn: <b>ADD FARM</b>\n\n"
                f"⏳ <i>Đang chờ khách gửi Gmail...</i>"
            )
            await send_to_all_admins(app_context.bot, admin_msg, parse_mode='HTML')
            logging.info(f"📤 Đã gửi thông báo đơn ADD Farm {order_code} - chờ Gmail từ khách")
            
            return True, "Đang chờ khách gửi Gmail cho ADD Farm"
        
        else:

            # Sản phẩm thường: lấy acc từ sheet và gửi cho khách
            all_rows = ws_product.get_all_values()
            
            available_rows_indices = []
            for i, row in enumerate(all_rows):
                if i == 0: 
                    continue
                if len(row) >= 2:
                    acc_data = row[0].strip()
                    status = row[1].strip().upper()
                    if acc_data != "" and status == "CHƯA BÁN":
                        available_rows_indices.append(i)
            
            logging.info(f"📦 Đơn {order_code}: Tìm thấy {len(available_rows_indices)} acc, cần {order['quantity']}")
            
            if len(available_rows_indices) < order['quantity']:
                # Xóa đơn khỏi pending để không spam
                del pending_orders[order_code]
                try:
                    with open(PENDING_ORDERS_FILE, "w", encoding="utf-8") as f:
                        json.dump(pending_orders, f, ensure_ascii=False, indent=2)
                except:
                    pass
                await send_to_all_admins(
                    app_context.bot,
                    f"⚠️ KHO HẾT HÀNG! Đơn {order_code} cần {order['quantity']} acc nhưng chỉ có {len(available_rows_indices)}."
                )
                return False, "Kho không đủ hàng."
        
        rows_to_sell_indices = available_rows_indices[:order['quantity']]
        acc_list_text = ""
        cells_to_update = []
        for idx in rows_to_sell_indices:
            acc_info = all_rows[idx][0]
            # Escape HTML để tránh lỗi parse
            acc_info_escaped = acc_info.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
            acc_list_text += f"🔹 <code>{acc_info_escaped}</code>\n"
            row_num = idx + 1
            cells_to_update.append(gspread.Cell(row_num, 2, "ĐÃ BÁN"))
            cells_to_update.append(gspread.Cell(row_num, 3, today_str))
            cells_to_update.append(gspread.Cell(row_num, 6, str(order_code)))
        
        # Thu thập danh sách acc đã giao để lưu vào order history
        accounts_delivered = [all_rows[idx][0] for idx in rows_to_sell_indices]
        
        if cells_to_update:
            ws_product.update_cells(cells_to_update)
        
        # XÓA ĐƠN NGAY SAU KHI UPDATE SHEET để tránh xử lý lại
        del pending_orders[order_code]
        try:
            with open(PENDING_ORDERS_FILE, "w", encoding="utf-8") as f:
                json.dump(pending_orders, f, ensure_ascii=False, indent=2)
        except:
            pass
        save_order_local(order['username'], customer_chat_id, order['product_name'], acc_list_text, order_code)
        
        # Lưu đơn hàng vào order history để phục vụ bảo hành
        save_order_to_history(order_code, order, accounts_delivered)
        
        # Lấy thông tin warranty từ order
        warranty_days = order.get('warranty_days', 30)
        if warranty_days == 0:
            warranty_msg = "❌ Sản phẩm này <b>KHÔNG BẢO HÀNH</b>"
        else:
            warranty_msg = f"🛡️ Sản phẩm được <b>BẢO HÀNH {warranty_days} NGÀY</b> kể từ ngày mua"
        
        await app_context.bot.send_message(
            chat_id=customer_chat_id,
            text=(f"🎉 <b>THANH TOÁN THÀNH CÔNG!</b>\n"
                  f"Mã đơn: <b>{order_code}</b>\n"
                  f"📦 SP: {order['product_name']} | SL: {order['quantity']}\n"
                  f"➖➖➖➖➖➖➖➖\n\n"
                  f"{warranty_msg}\n\n"
                  f"💡 <b>Lưu ý:</b> Hãy lưu lại mã đơn <code>{order_code}</code> "
                  f"để sử dụng chức năng Bảo Hành nếu cần!"),
            parse_mode='HTML'
        )

        msg_buffer = ""
        for line in acc_list_text.split('\n'):
            if len(msg_buffer) + len(line) > 3800:
                await app_context.bot.send_message(chat_id=customer_chat_id, text=msg_buffer, parse_mode='HTML')
                msg_buffer = ""
            msg_buffer += line + "\n"
        if msg_buffer:
            await app_context.bot.send_message(chat_id=customer_chat_id, text=msg_buffer, parse_mode='HTML')
        
        # Gửi thông báo giống hệt cho tất cả Admin
        try:
            # Thông báo đầu tiên - giống khách hàng
            admin_msg_1 = (
                f"🎉 <b>Khách hàng đã thanh toán thành công!</b>\n"
                f"Mã đơn: <b>{order_code}</b>\n"
                f"📦 SP: {order['product_name']} | SL: {order['quantity']}\n"
                f"➖➖➖➖➖➖➖➖"
            )
            await send_to_all_admins(app_context.bot, admin_msg_1, parse_mode='HTML')
            
            # Gửi danh sách tài khoản cho admin - giống khách hàng
            admin_msg_buffer = ""
            for line in acc_list_text.split('\n'):
                if len(admin_msg_buffer) + len(line) > 3800:
                    await send_to_all_admins(app_context.bot, admin_msg_buffer, parse_mode='HTML')
                    admin_msg_buffer = ""
                admin_msg_buffer += line + "\n"
            if admin_msg_buffer:
                await send_to_all_admins(app_context.bot, admin_msg_buffer, parse_mode='HTML')
            
            logging.info(f"✅ Đã gửi thông báo đơn hoàn thành {order_code} (giống khách hàng) cho tất cả admin")
        except Exception as e:
            logging.error(f"❌ Lỗi khi gửi thông báo đơn hoàn thành cho admin: {e}", exc_info=True)
            
        keyboard_new = [[InlineKeyboardButton("🔄 Mua đơn mới", callback_data='show_menu')]]
        await app_context.bot.send_message(
            chat_id=customer_chat_id,
            text="💌 <i>Cảm ơn bạn đã ủng hộ Shop!</i>",
            parse_mode='HTML',
            reply_markup=InlineKeyboardMarkup(keyboard_new)
        )
        # Hiển thị lại Reply Keyboard sau khi giao hàng
        await app_context.bot.send_message(
            chat_id=customer_chat_id,
            text="💡 <b>Bạn muốn làm gì tiếp theo?</b>",
            reply_markup=get_reply_keyboard(customer_chat_id),
            parse_mode='HTML'
        )
        
        # Xóa message QR code khi đơn hàng hoàn thành
        try:
            if "message_id" in order and "chat_id" in order and order["message_id"] and order["chat_id"]:
                await app_context.bot.delete_message(
                    chat_id=order["chat_id"],
                    message_id=order["message_id"]
                )
                logging.info(f"✅ Đã xóa message QR code cho đơn {order_code}")
        except Exception as e:
            # Nếu không xóa được (message đã bị xóa hoặc không tồn tại), bỏ qua
            error_msg = str(e)
            if "message to delete not found" not in error_msg.lower() and "message can't be deleted" not in error_msg.lower():
                logging.debug(f"Không thể xóa message QR code cho đơn {order_code}: {e}")
        
        # Đảm bảo đơn đã được xóa (có thể đã xóa sớm hơn)
        if order_code in pending_orders:
            del pending_orders[order_code]
            try:
                with open(PENDING_ORDERS_FILE, "w", encoding="utf-8") as f:
                    json.dump(pending_orders, f, ensure_ascii=False, indent=2)
            except:
                pass
        
        return True, "Thành công"
    except Exception as e:
        logging.error(e)
        # Reset cờ processing nếu có lỗi
        if order_code in pending_orders:
            pending_orders[order_code]['_processing'] = False
            try:
                with open(PENDING_ORDERS_FILE, "w", encoding="utf-8") as f:
                    json.dump(pending_orders, f, ensure_ascii=False, indent=2)
            except:
                pass
        return False, f"Lỗi hệ thống: {e}"

async def auto_cancel_slot_order_no_email(order_code, user_id, context):
    """Tự động hủy đơn hàng Slot sau 5 phút nếu chưa nhận email"""
    try:
        await asyncio.sleep(300)  # Chờ 5 phút (300 giây)
        
        if order_code in pending_orders:
            order = pending_orders[order_code]
            # Kiểm tra xem đơn hàng vẫn còn đang chờ email không
            if order.get('waiting_for_email') == True:
                # Kiểm tra thời gian chờ
                email_waiting_start = order.get('email_waiting_start', time.time())
                if (time.time() - email_waiting_start) >= 300:  # Đã quá 5 phút
                    del pending_orders[order_code]
                    
                    # Cập nhật file pending orders
                    try:
                        with open(PENDING_ORDERS_FILE, "w", encoding="utf-8") as f:
                            json.dump(pending_orders, f, ensure_ascii=False, indent=2)
                    except:
                        pass
                    
                    try:
                        await context.bot.send_message(
                            chat_id=user_id,
                            text=(
                                f"⏰ <b>ĐƠN HÀNG ĐÃ HẾT HẠN</b>\n\n"
                                f"Mã đơn: <b>{order_code}</b>\n"
                                f"📦 {order['product_name']} x {order['quantity']}\n\n"
                                f"💡 Đơn hàng đã hết thời gian chờ email (5 phút).\n"
                                f"Vui lòng liên hệ admin để được hỗ trợ:\n"
                                f"📞 Zalo: {ZALO_ADMIN_1} hoặc {ZALO_ADMIN_2}\n"
                                f"💬 Telegram: {TELEGRAM_ADMIN_USERNAME}"
                            ),
                            parse_mode='HTML',
                            reply_markup=get_reply_keyboard(user_id)
                        )
                        
                        # Thông báo cho admin
                        admin_msg = (
                            f"⚠️ <b>ĐƠN HÀNG SLOT HẾT HẠN CHỜ EMAIL</b>\n"
                            f"🆔 Mã đơn: <b>{order_code}</b>\n"
                            f"👤 Khách hàng: {order['fullname']} (ID: {user_id})\n"
                            f"📦 {order['product_name']} x {order['quantity']}\n"
                            f"💰 <b>{order['total']} VNĐ</b>\n\n"
                            f"⏰ Đã quá 5 phút nhưng khách chưa gửi email."
                        )
                        await send_to_all_admins(context.bot, admin_msg, parse_mode='HTML')
                    except Exception as e:
                        logging.error(f"Lỗi khi gửi thông báo hết hạn cho đơn Slot: {e}")
    except Exception as e:
        logging.error(f"Lỗi auto_cancel_slot_order_no_email: {e}")


async def auto_cancel_link_order_no_response(order_code, user_id, context, order_type):
    """Tự động hủy đơn hàng SheerID/Checkout sau 5 phút nếu chưa nhận link
    
    Args:
        order_code: Mã đơn hàng
        user_id: ID của user
        context: Context từ Telegram
        order_type: 'sheerid' hoặc 'checkout'
    """
    try:
        await asyncio.sleep(300)  # Chờ 5 phút (300 giây)
        
        if order_code in pending_orders:
            order = pending_orders[order_code]
            # Kiểm tra xem đơn hàng vẫn còn đang chờ link không
            if order.get('waiting_for_link') == True and order.get('waiting_type') == order_type:
                # Kiểm tra thời gian chờ
                link_waiting_start = order.get('link_waiting_start', time.time())
                if (time.time() - link_waiting_start) >= 300:  # Đã quá 5 phút
                    del pending_orders[order_code]
                    
                    # Cập nhật file pending orders
                    try:
                        with open(PENDING_ORDERS_FILE, "w", encoding="utf-8") as f:
                            json.dump(pending_orders, f, ensure_ascii=False, indent=2)
                    except:
                        pass
                    
                    # Xác định loại link để hiển thị tin nhắn phù hợp
                    link_type_text = "link SheerID" if order_type == 'sheerid' else "link Checkout"
                    link_type_upper = "SHEERID" if order_type == 'sheerid' else "CHECKOUT"
                    
                    try:
                        await context.bot.send_message(
                            chat_id=user_id,
                            text=(
                                f"⏰ <b>ĐƠN HÀNG ĐÃ HẾT HẠN</b>\n\n"
                                f"Mã đơn: <b>{order_code}</b>\n"
                                f"📦 {order['product_name']} x {order['quantity']}\n\n"
                                f"💡 Đơn hàng đã hết thời gian chờ {link_type_text} (5 phút).\n"
                                f"Vui lòng liên hệ admin để được hỗ trợ:\n"
                                f"📞 Zalo: {ZALO_ADMIN_1} hoặc {ZALO_ADMIN_2}\n"
                                f"💬 Telegram: {TELEGRAM_ADMIN_USERNAME}"
                            ),
                            parse_mode='HTML',
                            reply_markup=get_reply_keyboard(user_id)
                        )
                        
                        # Thông báo cho admin
                        admin_msg = (
                            f"⚠️ <b>ĐƠN HÀNG {link_type_upper} HẾT HẠN CHỜ LINK</b>\n"
                            f"🆔 Mã đơn: <b>{order_code}</b>\n"
                            f"👤 Khách hàng: {order.get('fullname', 'N/A')} (ID: {user_id})\n"
                            f"📦 {order['product_name']} x {order['quantity']}\n"
                            f"💰 <b>{order['total']} VNĐ</b>\n\n"
                            f"⏰ Đã quá 5 phút nhưng khách chưa gửi {link_type_text}."
                        )
                        await send_to_all_admins(context.bot, admin_msg, parse_mode='HTML')
                    except Exception as e:
                        logging.error(f"Lỗi khi gửi thông báo hết hạn cho đơn {order_type}: {e}")
    except Exception as e:
        logging.error(f"Lỗi auto_cancel_link_order_no_response ({order_type}): {e}")

async def auto_cancel_unpaid_order(order_code, user_id, context):

    """Tự động hủy đơn hàng sau 5 phút nếu chưa thanh toán"""
    try:
        await asyncio.sleep(300)  # Chờ 5 phút
        
        if order_code in pending_orders:
            order = pending_orders[order_code]
            if order.get('created_at') and (time.time() - order['created_at']) >= 300:
                del pending_orders[order_code]
                
                # Cập nhật file pending orders
                try:
                    with open(PENDING_ORDERS_FILE, "w", encoding="utf-8") as f:
                        json.dump(pending_orders, f, ensure_ascii=False, indent=2)
                except:
                    pass
                
                try:
                    await context.bot.send_message(
                        chat_id=user_id,
                        text=(
                            f"⏰ <b>ĐƠN HÀNG ĐÃ HẾT HẠN</b>\n\n"
                            f"Mã đơn: <b>{order_code}</b>\n"
                            f"📦 {order['product_name']} x {order['quantity']}\n\n"
                            f"💡 Đơn hàng đã hết thời gian chờ thanh toán (5 phút).\n"
                            f"Nếu bạn đã thanh toán, vui lòng liên hệ admin để được hỗ trợ:\n"
                            f"📞 Zalo: {ZALO_ADMIN_1} hoặc {ZALO_ADMIN_2}\n"
                            f"💬 Telegram: {TELEGRAM_ADMIN_USERNAME}"
                        ),
                        parse_mode='HTML'
                    )
                except:
                    pass
                
                try:
                    await send_to_all_admins(
                        context.bot,
                        (
                            f"⏰ <b>ĐƠN HÀNG HẾT HẠN</b>\n"
                            f"🆔 Mã đơn: {order_code}\n"
                            f"👤 {order['fullname']} (ID: {user_id})\n"
                            f"📦 {order['product_name']} x {order['quantity']}\n"
                            f"💰 {order['total']} đ\n\n"
                            f"💡 Đơn hàng đã tự động hủy sau 5 phút không thanh toán."
                        ),
                        parse_mode='HTML'
                    )
                except:
                    pass
    except Exception as e:
        logging.error(f"Lỗi auto_cancel_unpaid_order: {e}")

# ==============================================================================
# 3. MÀN HÌNH CHÍNH & MENU
# ==============================================================================

def get_reply_keyboard(user_id=None):
    """Tạo Reply Keyboard với các nút: Sản phẩm, Đơn hàng, Nạp Tiền, Xem Số Dư, Hỗ trợ, Reseller, Bảo Hành
    Nếu user_id là admin, thêm nút Restart Bot
    """
    keyboard = [
        [
            KeyboardButton("🛍️ Sản phẩm"),
            KeyboardButton("📦 Đơn hàng")
        ],
        [
            KeyboardButton("💰 Nạp Tiền"),
            KeyboardButton("💳 Xem Số Dư")
        ],
        [
            KeyboardButton("🏪 Reseller"),
            KeyboardButton("🛡️ Bảo Hành")
        ],
        [
            KeyboardButton("💬 Hỗ trợ")
        ]
    ]
    
    # Thêm nút admin nếu là admin
    if user_id and is_admin(user_id):
        keyboard.append([
            KeyboardButton("🔄 Restart Bot"),
            KeyboardButton("🧹 Dọn Log")
        ])
    
    return ReplyKeyboardMarkup(
        keyboard=keyboard,
        resize_keyboard=True,
        one_time_keyboard=False,
        input_field_placeholder="Chọn một tùy chọn..."
    )


async def send_main_menu_panel(chat_id: int, user_fullname: str, context: ContextTypes.DEFAULT_TYPE, user_id: int = None):
    announcements = get_active_announcements()
    announcement_text = ""
    if announcements:
        for ann in announcements:
            announcement_text += f"\n📢 <b>{ann.get('title', 'Thông báo')}</b>\n{ann.get('message', '')}\n\n"
    welcome_msg = (
        f"Chào mừng <b>{user_fullname}</b> đến với Shop MMO Tiện Ích 🤖✨\n\n"
        f"{announcement_text}"
        f"• Mua hàng tự động nhanh gọn – xử lý trong vài giây.\n"
        f"• Hỗ trợ & liên hệ admin qua ZALO: {ZALO_ADMIN_1} && {ZALO_ADMIN_2}\n"
        f"• Liên hệ qua Telegram: {TELEGRAM_ADMIN_1} & {TELEGRAM_ADMIN_2}\n\n"
        f"👉 Tham gia cộng đồng: {COMMUNITY_LINK}\n\n"
        f"• Siêu ưu đãi cho CTV: {ZALO_CTV}\n"
        f"• Hỗ trợ xử lý tự động 24/7.\n\n"
        f"💡 <b>Bạn muốn làm gì tiếp theo?</b>"
    )
    # Gửi với Reply Keyboard
    await context.bot.send_message(
        chat_id=chat_id,
        text=welcome_msg,
        reply_markup=get_reply_keyboard(user_id),
        parse_mode='HTML',
        disable_web_page_preview=True
    )
    if user_id:
        add_user_to_list(user_id, None, user_fullname)

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    global BOT_STOPPED
    
    if update.message:
        chat_id = update.message.chat_id
        user_fullname = update.message.from_user.full_name
        user_id = update.message.from_user.id
        username = update.message.from_user.username
    elif update.callback_query:
        chat_id = update.callback_query.message.chat_id
        user_fullname = update.callback_query.from_user.full_name
        user_id = update.callback_query.from_user.id
        username = update.callback_query.from_user.username
    else:
        return
    
    # Nếu bot đang dừng và user là admin → khởi động lại bot
    if BOT_STOPPED and is_admin(user_id):
        BOT_STOPPED = False
        logging.info(f"✅ Bot đã được khởi động lại bởi admin {user_id}")
        await update.message.reply_text(
            "✅ <b>Bot đã hoạt động trở lại bình thường!</b>\n\n"
            "🔄 Tất cả chức năng đã được kích hoạt.",
            parse_mode='HTML'
        )
        # Tiếp tục logic bình thường
        add_user_to_list(user_id, username, user_fullname)
        await send_main_menu_panel(chat_id, user_fullname, context, user_id)
        return ConversationHandler.END
    
    # Nếu bot đang dừng và user không phải admin → thông báo bảo trì
    if BOT_STOPPED:
        if update.message:
            await update.message.reply_text(MAINTENANCE_MESSAGE, parse_mode='HTML')
        elif update.callback_query:
            await update.callback_query.answer(MAINTENANCE_ALERT, show_alert=True)
        return ConversationHandler.END
    
    # Bot đang chạy bình thường → logic cũ
    add_user_to_list(user_id, username, user_fullname)
    await send_main_menu_panel(chat_id, user_fullname, context, user_id)
    return ConversationHandler.END

async def show_menu_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Hiển thị menu y hệt ảnh 1 - chỉ có header và các button riêng"""
    global BOT_STOPPED
    query = update.callback_query
    
    # Kiểm tra bảo trì - Admin bypass
    user_id = query.from_user.id if query else update.effective_user.id
    if not is_admin(user_id) and BOT_STOPPED:
        if query:
            await query.answer(MAINTENANCE_ALERT, show_alert=True)
        return ConversationHandler.END
    
    if query:
        try:
            await query.answer()
        except Exception as e:
            logging.debug(f"Lỗi answer callback trong show_menu_handler: {e}")
        # Lưu user vào danh sách khi tương tác
        user = query.from_user
        add_user_to_list(user.id, user.username, user.full_name)
    
    # Reset conversation state để tránh bị stuck - QUAN TRỌNG!
    context.user_data.clear()
    logging.info("show_menu_handler: Đã clear user_data và reset state")
    
    loading_msg = await context.bot.send_message(
        chat_id=query.message.chat_id,
        text="⏳ Đang tải menu và kiểm tra kho hàng..."
    )
    
    try:
        products = get_menu_data_cached()
        keyboard = []
        
        for product in products:
            product_name = product['name']
            sheet_tab = product['sheet_tab']
            price_str = product['price_str']
            
            if not product_name or not sheet_tab:
                continue
            
            stock_count = get_stock_count_cached(sheet_tab)
            price = extract_price(price_str)
            
            # Format giá như ảnh 1: "40.000₫/ Tháng"
            if price > 0:
                price_display = f"{price:,}₫/ Tháng".replace(",", ".")
            else:
                price_display = price_str if price_str else "Liên hệ"
            
            # Status như ảnh 1: ✔ hoặc X
            # Nếu sản phẩm bắt đầu bằng "Slot": luôn hiển thị dấu tích xanh
            # Nếu sản phẩm có ID SheerID (001, 002...) hoặc Checkout (0001, 0002...): luôn hiển thị ✅ Sẵn sàng
            product_id = product.get('id', '')
            product_name_lower = product_name.strip().lower()
            
            # Kiểm tra theo ID
            is_sheerid = is_sheerid_product(product_id)
            is_checkout = is_checkout_product(product_id)
            
            # Kiểm tra theo TÊN sản phẩm (ưu tiên - vì ID có thể bị mất số 0)
            # Sản phẩm SheerID: tên chứa "sheerid" hoặc "sheer id" hoặc "verify"
            if "sheerid" in product_name_lower or "sheer id" in product_name_lower:
                is_sheerid = True
            elif "verify" in product_name_lower:
                is_sheerid = True
                
            # Sản phẩm Checkout: tên chứa "checkout" hoặc "check out"
            if "checkout" in product_name_lower or "check out" in product_name_lower:
                is_checkout = True
            
            # Debug log để kiểm tra
            logging.info(f"🔍 Menu Product Check: ID='{product_id}', Name='{product_name}', name_lower='{product_name_lower}', is_sheerid={is_sheerid}, is_checkout={is_checkout}, 'sheerid' in name: {'sheerid' in product_name_lower}, 'checkout' in name: {'checkout' in product_name_lower}")
            
            if product_name.strip().startswith("Slot") or is_addfarm_product(product_name):
                # Sản phẩm Slot và ADD Farm - luôn hiển thị Sẵn Nhiều (đây là hàng order)
                status_text = "✅ Sẵn Nhiều"
            elif is_sheerid or is_checkout:
                # Sản phẩm theo đơn hàng (SheerID/Checkout) - luôn sẵn sàng
                status_text = "✅ Sẵn sàng"
            elif stock_count > 0:
                status_text = f"✅ Sẵn {stock_count}"
            else:
                status_text = "❌ Hết hàng"

            
            # Button text y hệt ảnh 1: "Tên SP | Giá  Status"
            btn_text = f"{product_name} | {price_display}  {status_text}"
            callback_data = f"select|{product['id']}"
            keyboard.append([InlineKeyboardButton(btn_text, callback_data=callback_data)])
        
        keyboard.append([InlineKeyboardButton("🔙 Quay lại trang chủ", callback_data='back_to_home')])
        
        # Message text y hệt ảnh 1 - CHỈ có header
        msg = "<b>DANH MỤC SẢN PHẨM</b>\n\nMời bạn chọn món đồ ưng ý nhé:"
        
        try:
            await context.bot.delete_message(
                chat_id=query.message.chat_id if query else loading_msg.chat_id,
                message_id=loading_msg.message_id
            )
        except Exception as e:
            logging.debug(f"Không thể xóa loading message: {e}")
        
        chat_id = query.message.chat_id if query else loading_msg.chat_id
        
        try:
            sent_msg = await context.bot.send_message(
                chat_id=chat_id,
            text=msg,
            reply_markup=InlineKeyboardMarkup(keyboard),
            parse_mode='HTML'
        )
            logging.info(f"Đã gửi menu với {len(keyboard)} sản phẩm, state sẽ là CHOOSING_PRODUCT")
        except Exception as e:
            logging.error(f"Lỗi gửi menu message: {e}")
            return ConversationHandler.END
        
        # Đảm bảo return CHOOSING_PRODUCT để conversation vào đúng state
        logging.info("show_menu_handler: Trả về CHOOSING_PRODUCT state")
        # Clear user_data một lần nữa để đảm bảo
        context.user_data.clear()
        return CHOOSING_PRODUCT
        
    except Exception as e:
        logging.error(f"Lỗi trong show_menu_handler: {e}", exc_info=True)
        try:
            await context.bot.edit_message_text(
                chat_id=query.message.chat_id,
                message_id=loading_msg.message_id,
                text="⚠️ Lỗi tải menu. Vui lòng thử lại sau."
            )
        except:
            pass
        return ConversationHandler.END

# ==============================================================================
# 4. LOGIC MUA HÀNG
# ==============================================================================

async def ask_quantity(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Xử lý khi user chọn sản phẩm"""
    global BOT_STOPPED
    query = update.callback_query
    
    # Kiểm tra bảo trì - Admin bypass
    user_id = query.from_user.id
    if not is_admin(user_id) and BOT_STOPPED:
        await query.answer(MAINTENANCE_ALERT, show_alert=True)
        return ConversationHandler.END
    
    await query.answer()
    
    if query.data == 'back_to_home':
        await start(update, context)
        return ConversationHandler.END
    
    selected_id = query.data.split('|')[1]
    
    try:
        products = get_menu_data_cached()
        target_product = next((p for p in products if p['id'] == selected_id), None)
        
        if not target_product:
            await context.bot.send_message(
                chat_id=query.message.chat_id,
                text="⚠️ Sản phẩm không tồn tại."
            )
            return ConversationHandler.END
        # Chặn đặt mua nếu hết hàng (trừ Slot, SheerID, Checkout, ADD Farm - đây là đơn theo yêu cầu)
        stock_count = get_stock_count_cached(target_product.get('sheet_tab'))
        product_name_check = target_product.get('name', '').strip()
        product_name_lower = product_name_check.lower()
        is_slot = product_name_check.lower().startswith("slot")
        is_addfarm = is_addfarm_product(product_name_check)  # Kiểm tra sản phẩm ADD Farm
        product_id = target_product.get('id', '')
        
        # Kiểm tra theo ID
        is_order_based = is_sheerid_product(product_id) or is_checkout_product(product_id)
        # Kiểm tra thêm theo TÊN sản phẩm (fallback nếu ID bị mất số 0)
        if not is_order_based:
            if "sheerid" in product_name_lower or "verify link" in product_name_lower or ("verify" in product_name_lower and "link" in product_name_lower):
                is_order_based = True
            elif "checkout" in product_name_lower:
                is_order_based = True
        
        # Slot và ADD Farm luôn cho mua (không check hết hàng)
        if not is_slot and not is_addfarm and not is_order_based and stock_count <= 0:

            out_msg = "❌ Sản phẩm đã hết hàng, admin sẽ cập nhật sớm nhất. Vui lòng chọn sản phẩm khác."
            try:
                await query.answer(out_msg, show_alert=True)
            except Exception:
                pass
            await context.bot.send_message(chat_id=query.message.chat_id, text=out_msg)
            return CHOOSING_PRODUCT

        
        context.user_data['selected_product_name'] = target_product['name']
        context.user_data['selected_price'] = target_product['price_str']
        context.user_data['target_sheet_name'] = target_product['sheet_tab']
        context.user_data['selected_product_id'] = target_product['id']  # Lưu ID sản phẩm
        context.user_data['warranty_days'] = target_product.get('warranty_days', 30)  # Lấy warranty từ API
        context.user_data['warranty_text'] = target_product.get('warranty_text', '')
        
        
        await context.bot.send_message(
            chat_id=query.message.chat_id,
            text=(
                f"Bạn chọn: <b>{target_product['name']}</b>\n\n"
                f"Vui lòng nhập <b>SỐ LƯỢNG</b> cần mua:"
            ),
            parse_mode='HTML'
        )
        
        return ASKING_QUANTITY
        
    except Exception as e:
        logging.error(e)
        return ConversationHandler.END

async def process_order_request(update: Update, context: ContextTypes.DEFAULT_TYPE):
    global BOT_STOPPED
    user_qty_text = update.message.text
    user = update.effective_user
    
    # Kiểm tra bảo trì - Admin bypass
    if not is_admin(user.id) and BOT_STOPPED:
        await update.message.reply_text(MAINTENANCE_MESSAGE, parse_mode='HTML')
        return ConversationHandler.END
    
    if not user_qty_text.isdigit() or int(user_qty_text) <= 0:
        await update.message.reply_text("⚠️ Nhập số dương.")
        return ASKING_QUANTITY
    
    quantity = int(user_qty_text)
    product_name = context.user_data.get('selected_product_name')
    sheet_tab_name = context.user_data.get('target_sheet_name')
    unit_price = extract_price(context.user_data.get('selected_price'))
    total_str = "{:,.0f}".format(unit_price * quantity).replace(",", ".")
    warranty_days = context.user_data.get('warranty_days', 30)  # Lấy warranty từ product data
    warranty_text = context.user_data.get('warranty_text', '')
    
    # DEBUG: Log warranty info
    logging.info(f"🔍 DEBUG WARRANTY: product={product_name}, warranty_days={warranty_days}, warranty_text='{warranty_text}'")
    
    order_code = generate_order_id(warranty_days)  # Tạo mã đơn với warranty prefix
    logging.info(f"🔍 DEBUG ORDER CODE: {order_code}")
    
    # Kiểm tra lại tồn kho trước khi tạo đơn
    # Bỏ qua Slot, SheerID, Checkout vì đây là đơn theo yêu cầu
    product_id = context.user_data.get('selected_product_id', '')
    product_name_lower = product_name.strip().lower() if product_name else ''
    is_slot_product = product_name_lower.startswith("slot") if product_name else False
    
    # Kiểm tra theo ID
    is_order_based = is_sheerid_product(product_id) or is_checkout_product(product_id)
    # Kiểm tra thêm theo TÊN sản phẩm (fallback nếu ID bị mất số 0)
    if not is_order_based:
        if "sheerid" in product_name_lower or "verify link" in product_name_lower or ("verify" in product_name_lower and "link" in product_name_lower):
            is_order_based = True
        elif "checkout" in product_name_lower:
            is_order_based = True
    
    current_stock = get_stock_count_cached(sheet_tab_name) if sheet_tab_name else 0
    
    if not is_slot_product and not is_order_based:

        if current_stock <= 0:
            await update.message.reply_text(
                "❌ Sản phẩm đã hết hàng, admin sẽ cập nhật sớm nhất. Vui lòng chọn sản phẩm khác.",
                reply_markup=get_reply_keyboard(update.effective_user.id if update and update.effective_user else None)
            )
            return ConversationHandler.END
        if quantity > current_stock:
            await update.message.reply_text(
                f"⚠️ Chỉ còn {current_stock} sản phẩm. Vui lòng nhập số lượng nhỏ hơn hoặc chọn sản phẩm khác.",
                reply_markup=get_reply_keyboard(update.effective_user.id if update and update.effective_user else None)
            )
            return ASKING_QUANTITY

    
    pending_orders[order_code] = {
        "order_code": order_code,
        "product_id": context.user_data.get('selected_product_id', ''),  # ID sản phẩm để phát hiện loại
        "product_name": product_name,
        "sheet_tab_name": sheet_tab_name,
        "quantity": quantity,
        "total": total_str,
        "total_int": unit_price * quantity,
        "unit_price": unit_price,  # Thêm giá đơn vị
        "user_id": user.id,
        "username": user.username or "NoUsername",
        "fullname": user.full_name,
        "created_at": time.time(),
        "message_id": None,  # Sẽ được set sau khi gửi message
        "chat_id": None,  # Sẽ được set sau khi gửi message
        "warranty_days": warranty_days,  # Số ngày bảo hành
        "warranty_text": warranty_text  # Text bảo hành từ Sheet
    }


    
    # Tạo task tự động xóa đơn hàng sau 3 phút nếu chưa thanh toán
    asyncio.create_task(auto_cancel_unpaid_order(order_code, user.id, context))
    
    # Tạo task tự động check payment từ bank
    asyncio.create_task(auto_check_payment(order_code, total_str, unit_price * quantity, context))
    
    try:
        # Tạo QR code URL với nội dung và số tiền
        qr_url = get_qr_code_url(total_str, order_code)
        config = get_bank_config()
        account_no = config.get("accountNo", "0393959643")
        
        countdown_str = format_countdown(180)  # 3 phút = 180 giây
        caption = (
            f"🧾 <b>XÁC NHẬN ĐƠN HÀNG</b>\n"
            f"📦 {product_name} x {quantity}\n"
            f"💰 <b>{total_str} VNĐ</b>\n"
            f"📸 Quét QR hoặc CK:\n"
            f"🏦 STK: <code>{account_no}</code>\n"
            f"📝 Nội dung: <code>{order_code}</code>\n"
            f"💵 Số tiền: <b>{total_str} VNĐ</b>\n\n"
            f"⏰ <b>Thời gian còn lại: {countdown_str}</b>\n"
            f"<i>Hệ thống đang tự động kiểm tra thanh toán...</i>"
        )
        keyboard = [
            [InlineKeyboardButton("❌ Hủy đơn hàng", callback_data=f'cancel_{order_code}')]
        ]
        
        sent_message = None
        # Sử dụng QR code URL động
        try:
            qr_response = requests.get(qr_url, timeout=5)
            if qr_response.status_code == 200:
                from io import BytesIO
                qr_image = BytesIO(qr_response.content)
                qr_image.name = "qr.jpg"
                sent_message = await update.message.reply_photo(
                    photo=qr_image,
                    caption=caption,
                    parse_mode='HTML',
                    reply_markup=InlineKeyboardMarkup(keyboard)
                )
            else:
                # Fallback về file QR cũ nếu không tải được QR động
                if os.path.exists(QR_IMAGE_PATH):
                    sent_message = await update.message.reply_photo(
                        photo=open(QR_IMAGE_PATH, "rb"),
                        caption=caption,
                        parse_mode='HTML',
                        reply_markup=InlineKeyboardMarkup(keyboard)
                    )
                else:
                    sent_message = await update.message.reply_text(
                        caption,
                        parse_mode='HTML',
                        reply_markup=InlineKeyboardMarkup(keyboard)
                    )
        except Exception as e:
            logging.error(f"Lỗi tải QR code: {e}")
            # Fallback về file QR cũ
            if os.path.exists(QR_IMAGE_PATH):
                sent_message = await update.message.reply_photo(
                    photo=open(QR_IMAGE_PATH, "rb"),
                    caption=caption,
                    parse_mode='HTML',
                    reply_markup=InlineKeyboardMarkup(keyboard)
                )
            else:
                sent_message = await update.message.reply_text(
                    caption,
                    parse_mode='HTML',
                    reply_markup=InlineKeyboardMarkup(keyboard)
                )
        
        # Lưu message_id và chat_id để có thể cập nhật đồng hồ đếm ngược
        if sent_message:
            pending_orders[order_code]["message_id"] = sent_message.message_id
            pending_orders[order_code]["chat_id"] = sent_message.chat_id
    except Exception as e:
        await update.message.reply_text(f"⚠️ Lỗi: {e}")
    
    # Thông báo cho tất cả Admin
    try:
        admin_msg = (
            f"🔔 <b>ĐƠN MỚI (Chờ thanh toán)!</b>\n"
            f"👤 {user.full_name}\n"
            f"🆔 Mã: <b>{order_code}</b>\n"
            f"📦 {product_name} | SL: {quantity}\n"
            f"💰 <b>{total_str} đ</b>"
        )
        logging.info(f"📤 Đang gửi thông báo đơn mới {order_code} cho {len(ADMIN_IDS)} admin...")
        await send_to_all_admins(context.bot, admin_msg, parse_mode='HTML')
        logging.info(f"✅ Đã gửi thông báo đơn mới {order_code} cho tất cả admin")
    except Exception as e:
        logging.error(f"❌ Lỗi khi gửi thông báo đơn mới cho admin: {e}", exc_info=True)
    
    return ConversationHandler.END

async def check_payment_status(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Kiểm tra trạng thái thanh toán khi khách bấm nút xác nhận"""
    global BOT_STOPPED
    query = update.callback_query
    user_id = query.from_user.id
    
    # Kiểm tra bảo trì - Admin bypass
    if not is_admin(user_id) and BOT_STOPPED:
        await query.answer(MAINTENANCE_ALERT, show_alert=True)
        return
    
    # Gọi answer ngay để tránh timeout
    await query.answer("⏳ Đang kiểm tra thanh toán...", show_alert=False)
    
    order_code = query.data.split('_')[-1]
    user = query.from_user
    
    logging.info(f"🔍 User {user.id} bấm xác nhận thanh toán cho đơn {order_code}")
    
    # Kiểm tra xem đơn hàng đã được xử lý chưa (đã có file Order_xxx.txt)
    user_id = str(user.id)
    safe_username = user.username if user.username else user_id
    safe_username = "".join(c for c in safe_username if c.isalnum() or c in (' ', '_', '-')).strip()
    user_path = os.path.join(DATA_FOLDER, safe_username)
    file_path = os.path.join(user_path, f"Order_{order_code}.txt")
    
    # Nếu đơn hàng không còn trong pending_orders và có file → đã thanh toán thành công
    if order_code not in pending_orders and os.path.exists(file_path):
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                content = f.read()
            
            # Cập nhật caption với thông báo đã thanh toán
            new_caption = (
                f"✅ <b>ĐÃ XÁC NHẬN THANH TOÁN!</b>\n\n"
                f"🧾 <b>XÁC NHẬN ĐƠN HÀNG</b>\n"
            )
            
            # Lấy thông tin đơn hàng từ file
            lines = content.split('\n')
            for line in lines:
                if 'SP:' in line:
                    new_caption += f"📦 {line.replace('SP:', '').strip()}\n"
                elif 'TIME:' in line:
                    new_caption += f"🕐 {line.replace('TIME:', '').strip()}\n"
            
            new_caption += f"\n🎉 <b>Đơn hàng đã được xử lý thành công!</b>\n"
            new_caption += f"📦 Thông tin tài khoản đã được gửi đến bạn."
            
            # Cập nhật message
            try:
                if query.message.photo:
                    await query.edit_message_caption(
                        caption=new_caption,
                        parse_mode='HTML'
                    )
                else:
                    await query.edit_message_text(
                        text=new_caption,
                        parse_mode='HTML'
                    )
            except Exception as e:
                error_msg = str(e)
                # Không log như lỗi nếu chỉ là message không thay đổi
                if "Message is not modified" in error_msg:
                    logging.debug(f"Message không thay đổi (đã cập nhật trước đó): {error_msg}")
                else:
                    logging.error(f"Lỗi edit message: {e}")
                    try:
                        await context.bot.send_message(
                            chat_id=query.message.chat_id,
                            text=new_caption,
                            parse_mode='HTML'
                        )
                    except:
                        pass
        except Exception as e:
            logging.error(f"Lỗi đọc file đơn hàng: {e}")
            # Không cần gọi query.answer() nữa vì đã gọi ở đầu hàm
    elif order_code in pending_orders:
        # Đơn hàng vẫn chờ thanh toán - chỉ kiểm tra từ file payment log
        # KHÔNG gọi API trực tiếp vì session thường hết hạn nhanh
        order = pending_orders[order_code]
        
        # Chỉ kiểm tra từ file payment log (payment detector sẽ ghi vào đây)
        is_paid, payment_info = check_payment_from_file(order_code)
        
        if not is_paid:
            logging.info(f"📋 Chưa tìm thấy payment trong log cho đơn {order_code}")
            logging.info(f"💡 Payment detector đang chạy sẽ tự động detect và ghi vào payment_log.json")
            logging.info(f"💡 Hoặc admin có thể dùng /confirm_order {order_code} để xác nhận thủ công")
        
        if is_paid:
            # Đã thanh toán, xử lý đơn hàng
            success, message = await deliver_order_logic(order_code, context)
            if success:
                # Thông báo cho tất cả Admin - giống hệt như khách hàng
                # (Thông báo sẽ được gửi trong deliver_order_logic)
                
                # Cập nhật message với thông báo thành công
                success_msg = (
                    f"✅ <b>ĐÃ XÁC NHẬN THANH TOÁN!</b>\n\n"
                    f"🆔 Mã đơn: <code>{order_code}</code>\n"
                    f"💰 Số tiền: <b>{order['total']} VNĐ</b>\n\n"
                    f"🎉 <b>Đơn hàng đã được xử lý thành công!</b>\n"
                    f"📦 Thông tin tài khoản đã được gửi đến bạn."
                )
                try:
                    if query.message.photo:
                        await query.edit_message_caption(
                            caption=success_msg,
                            parse_mode='HTML'
                        )
                    else:
                        await query.edit_message_text(
                            text=success_msg,
                            parse_mode='HTML'
                        )
                except Exception as e:
                    error_msg = str(e)
                    if "Message is not modified" not in error_msg:
                        logging.debug(f"Lỗi edit message (không nghiêm trọng): {e}")
                return
        
        # Chưa thanh toán - hiển thị thông báo hệ thống đang tự động kiểm tra
        elapsed_time = time.time() - order["created_at"]
        time_left = 180 - elapsed_time  # 3 phút = 180 giây
        countdown_str = format_countdown(int(time_left)) if time_left > 0 else "00:00"
        
        config = get_bank_config()
        account_no = config.get("accountNo", "0393959643")
        detail_msg = (
            f"⏳ <b>ĐANG CHỜ THANH TOÁN</b>\n\n"
            f"🆔 Mã đơn: <code>{order_code}</code>\n"
            f"💰 Số tiền: <b>{order['total']} VNĐ</b>\n"
            f"🏦 STK: <code>{account_no}</code>\n"
            f"📝 Nội dung: <code>{order_code}</code>\n\n"
            f"⏰ <b>Thời gian còn lại: {countdown_str}</b>\n\n"
            f"💡 <b>Hệ thống đang tự động kiểm tra thanh toán mỗi 5 giây...</b>\n"
            f"Vui lòng đợi hệ thống xác nhận tự động.\n\n"
            f"📞 <b>Nếu đã thanh toán nhưng chưa được xác nhận, vui lòng liên hệ admin:</b>\n"
            f"Zalo: {ZALO_ADMIN_1} hoặc {ZALO_ADMIN_2}\n"
            f"💬 Telegram: {TELEGRAM_ADMIN_USERNAME}"
        )
        
        # Chỉ giữ nút hủy đơn hàng
        keyboard = [
            [InlineKeyboardButton("❌ Hủy đơn hàng", callback_data=f'cancel_{order_code}')]
        ]
        
        try:
            if query.message.photo:
                await query.edit_message_caption(
                    caption=detail_msg,
                    parse_mode='HTML',
                    reply_markup=InlineKeyboardMarkup(keyboard)
                )
            else:
                await query.edit_message_text(
                    text=detail_msg,
                    parse_mode='HTML',
                    reply_markup=InlineKeyboardMarkup(keyboard)
                )
        except Exception as e:
            error_msg = str(e)
            # Không log như lỗi nếu chỉ là message không thay đổi
            if "Message is not modified" in error_msg:
                logging.debug(f"Message không thay đổi (đã cập nhật trước đó): {error_msg}")
            else:
                logging.error(f"Lỗi cập nhật message: {e}")
                try:
                    await context.bot.send_message(
                        chat_id=query.message.chat_id,
                        text=detail_msg,
                        parse_mode='HTML',
                        reply_markup=InlineKeyboardMarkup(keyboard)
                    )
                except:
                    pass
    else:
        # Đơn hàng không tồn tại
        # Không cần gọi query.answer() nữa vì đã gọi ở đầu hàm
        try:
            error_msg = "⚠️ <b>KHÔNG TÌM THẤY ĐƠN HÀNG</b>\n\nMã đơn không tồn tại hoặc đã hết hạn."
            if query.message.photo:
                await query.edit_message_caption(
                    caption=error_msg,
                    parse_mode='HTML'
                )
            else:
                await query.edit_message_text(
                    text=error_msg,
                    parse_mode='HTML'
                )
        except Exception as e:
            error_msg_str = str(e)
            # Không log như lỗi nếu chỉ là message không thay đổi
            if "Message is not modified" in error_msg_str:
                logging.debug(f"Message không thay đổi (đã cập nhật trước đó): {error_msg_str}")
            else:
                logging.error(f"Lỗi cập nhật message: {e}")
                try:
                    await context.bot.send_message(
                        chat_id=query.message.chat_id,
                        text=error_msg,
                        parse_mode='HTML'
                    )
                except:
                    pass

async def extend_order(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Xử lý khi khách bấm nút 'Tiếp tục đơn hàng' sau khi hết thời gian"""
    global BOT_STOPPED
    query = update.callback_query
    user_id = query.from_user.id
    
    # Kiểm tra bảo trì - Admin bypass
    if not is_admin(user_id) and BOT_STOPPED:
        await query.answer(MAINTENANCE_ALERT, show_alert=True)
        return
    
    await query.answer("⏰ Đang gia hạn đơn hàng...", show_alert=False)
    
    order_code = query.data.split('_')[-1]
    
    if order_code not in pending_orders:
        try:
            await query.edit_message_caption(caption="⚠️ Đơn hàng này không tồn tại hoặc đã xử lý.")
        except Exception as e:
            if "Message is not modified" not in str(e):
                logging.debug(f"Lỗi edit message: {e}")
        return
    
    # Gia hạn đơn hàng thêm 1 phút
    order = pending_orders[order_code]
    order["created_at"] = time.time()  # Reset thời gian
    
    # Khởi động lại task kiểm tra thanh toán
    asyncio.create_task(auto_check_payment(order_code, order['total'], order['total_int'], context))
    
    # Cập nhật message với đồng hồ đếm ngược mới
    await update_order_message(order_code, context, expired=False)
    
    logging.info(f"✅ Đã gia hạn đơn hàng {order_code} thêm 1 phút")

async def cancel_order_customer(update: Update, context: ContextTypes.DEFAULT_TYPE):
    global BOT_STOPPED
    query = update.callback_query
    user_id = query.from_user.id
    
    # Kiểm tra bảo trì - Admin bypass
    if not is_admin(user_id) and BOT_STOPPED:
        await query.answer(MAINTENANCE_ALERT, show_alert=True)
        return
    
    await query.answer()
    order_code = query.data.split('_')[1]
    if order_code in pending_orders:
        order = pending_orders[order_code]  # Lấy thông tin trước khi xóa
        del pending_orders[order_code]
        # Cập nhật file pending orders
        try:
            with open(PENDING_ORDERS_FILE, "w", encoding="utf-8") as f:
                json.dump(pending_orders, f, ensure_ascii=False, indent=2)
        except:
            pass
        try:
            await query.edit_message_caption(caption=f"🚫 Đơn hàng {order_code} đã bị hủy.")
        except Exception as e:
            if "Message is not modified" not in str(e):
                logging.debug(f"Lỗi edit message (không nghiêm trọng): {e}")
        
        # THÊM: Thông báo cho admin khi khách hủy đơn
        try:
            admin_cancel_msg = (
                f"🚫 <b>KHÁCH HÀNG ĐÃ HỦY ĐƠN!</b>\n\n"
                f"🆔 Mã đơn: <b>{order_code}</b>\n"
                f"👤 Khách: {order.get('fullname', 'N/A')} (ID: {order.get('user_id', 'N/A')})\n"
                f"📦 {order.get('product_name', 'N/A')} x {order.get('quantity', 0)}\n"
                f"💰 {order.get('total', '0')} VNĐ"
            )
            await send_to_all_admins(context.bot, admin_cancel_msg, parse_mode='HTML')
            logging.info(f"✅ Đã gửi thông báo hủy đơn {order_code} cho admin")
        except Exception as e:
            logging.error(f"Lỗi gửi thông báo hủy đơn cho admin: {e}")
    else:
        try:
            await query.edit_message_caption(caption="⚠️ Đơn hàng này không tồn tại hoặc đã xử lý.")
        except Exception as e:
            if "Message is not modified" not in str(e):
                logging.debug(f"Lỗi edit message (không nghiêm trọng): {e}")

async def check_order(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    await cmd_donhang(update, context)

async def show_order_detail(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    order_code = query.data.split('|')[1]
    user = query.from_user
    user_id = str(user.id)
    safe_username = user.username if user.username else user_id
    safe_username = "".join(c for c in safe_username if c.isalnum() or c in (' ', '_', '-')).strip()
    user_path = os.path.join(DATA_FOLDER, safe_username)
    file_path = os.path.join(user_path, f"Order_{order_code}.txt")
    
    if not os.path.exists(file_path):
        keyboard = [[InlineKeyboardButton("🔙 Quay lại", callback_data='check_order')]]
        await context.bot.send_message(
            chat_id=query.message.chat_id,
            text="⚠️ Không tìm thấy dữ liệu đơn hàng.",
            reply_markup=InlineKeyboardMarkup(keyboard)
        )
        return
    
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read()
        keyboard = [[InlineKeyboardButton("🔙 Quay lại", callback_data='check_order')]]
        await context.bot.send_message(
            chat_id=query.message.chat_id,
            text=f"📦 <b>CHI TIẾT ĐƠN {order_code}</b>\n\n{content}",
            parse_mode='HTML',
            reply_markup=InlineKeyboardMarkup(keyboard)
        )
    except Exception as e:
        logging.error(e)
        await context.bot.send_message(chat_id=query.message.chat_id, text=f"⚠️ Lỗi đọc file: {e}")

# ==============================================================================
# 5. CÁC LỆNH
# ==============================================================================

async def cmd_startmenu(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Lệnh /startmenu - hiển thị menu y hệt ảnh 1"""
    global BOT_STOPPED
    user_id = update.effective_user.id
    
    # Kiểm tra bảo trì - Admin bypass, khách hàng bị chặn
    if not is_admin(user_id):
        # Kiểm tra bot dừng toàn bộ
        if BOT_STOPPED:
            await update.message.reply_text(MAINTENANCE_MESSAGE, parse_mode='HTML')
            return ConversationHandler.END
        
        # Kiểm tra chức năng startmenu/menu bị dừng riêng
        if is_feature_stopped("startmenu") or is_feature_stopped("menu"):
            await update.message.reply_text(
                "🔧 <b>Chức năng đang bảo trì!</b>\n\n"
                "Chức năng xem sản phẩm đang tạm dừng để bảo trì.\n"
                "Vui lòng quay lại sau.",
                parse_mode='HTML'
            )
            return ConversationHandler.END
    user = update.effective_user
    add_user_to_list(user.id, user.username, user.full_name)
    
    # Reset conversation state để tránh bị stuck
    if context.user_data:
        context.user_data.clear()
    
    # Gửi với Reply Keyboard để luôn hiển thị menu
    msg = await context.bot.send_message(
        chat_id=update.message.chat_id, 
        text="⏳ Đang tải menu...",
        reply_markup=get_reply_keyboard(update.effective_user.id if update and update.effective_user else None)
    )
    
    try:
        products = get_menu_data_cached()
        keyboard = []
        
        for product in products:
            product_name = product['name']
            sheet_tab = product['sheet_tab']
            price_str = product['price_str']
            
            if not product_name or not sheet_tab:
                continue
            
            stock_count = get_stock_count_cached(sheet_tab)
            price = extract_price(price_str)
            
            if price > 0:
                price_display = f"{price:,}₫/ Tháng".replace(",", ".")
            else:
                price_display = price_str if price_str else "Liên hệ"
            
            # Nếu sản phẩm bắt đầu bằng "Slot": luôn hiển thị dấu tích xanh
            if product_name.strip().startswith("Slot"):
                status_text = f"✅ Sẵn {stock_count if stock_count > 0 else 'Nhiều'}"
            elif stock_count > 0:
                status_text = f"✅ Sẵn {stock_count}"
            else:
                status_text = "❌ Hết hàng"
            
            btn_text = f"{product_name} | {price_display}  {status_text}"
            callback_data = f"select|{product['id']}"
            keyboard.append([InlineKeyboardButton(btn_text, callback_data=callback_data)])
        
        keyboard.append([InlineKeyboardButton("🔙 Quay lại trang chủ", callback_data='back_to_home')])
        msg_text = "<b>DANH MỤC SẢN PHẨM</b>\n\nMời bạn chọn món đồ ưng ý nhé:"
        
        await context.bot.delete_message(chat_id=update.message.chat_id, message_id=msg.message_id)
        await context.bot.send_message(
            chat_id=update.message.chat_id,
            text=msg_text,
            reply_markup=InlineKeyboardMarkup(keyboard),
            parse_mode='HTML'
        )
        # Hiển thị lại Reply Keyboard
        await context.bot.send_message(
            chat_id=update.message.chat_id,
            text="💡 <b>Bạn muốn làm gì tiếp theo?</b>",
            reply_markup=get_reply_keyboard(update.effective_user.id if update and update.effective_user else None),
            parse_mode='HTML'
        )
        
        return CHOOSING_PRODUCT
        
    except Exception as e:
        logging.error(f"Lỗi trong cmd_startmenu: {e}", exc_info=True)
        try:
            await context.bot.edit_message_text(
                chat_id=update.message.chat_id,
                message_id=msg.message_id,
                text="⚠️ Lỗi tải menu. Vui lòng thử lại sau."
            )
        except:
            pass
        return ConversationHandler.END

async def cmd_donhang(update: Update, context: ContextTypes.DEFAULT_TYPE):
    global BOT_STOPPED
    user = update.effective_user
    user_id = user.id
    
    # Kiểm tra bảo trì - Admin bypass
    if not is_admin(user_id) and BOT_STOPPED:
        await update.message.reply_text(MAINTENANCE_MESSAGE, parse_mode='HTML')
        return
    
    add_user_to_list(user.id, user.username, user.full_name)
    user_id = str(user.id)
    await context.bot.send_message(
        chat_id=update.effective_message.chat_id, 
        text="🔍 Đang tra cứu...", 
        parse_mode='HTML',
        reply_markup=get_reply_keyboard(update.effective_user.id if update and update.effective_user else None)
    )
    
    try:
        safe_username = user.username if user.username else user_id
        safe_username = "".join(c for c in safe_username if c.isalnum() or c in (' ', '_', '-')).strip()
        user_path = os.path.join(DATA_FOLDER, safe_username)
        orders_meta = []
        
        if os.path.exists(user_path):
            files = sorted(os.listdir(user_path))
            for file in files:
                if file.endswith(".txt") and file.startswith("Order_"):
                    code = file.replace("Order_", "").replace(".txt", "")
                    with open(os.path.join(user_path, file), "r", encoding="utf-8") as f:
                        content = f.read()
                        lines = content.split('\n')
                        time_val = lines[2].replace("TIME:", "").strip() if len(lines)>2 else "?"
                        prod = lines[3].replace("SP:", "").strip() if len(lines)>3 else "?"
                        orders_meta.append({"code": code, "time": time_val, "product": prod})
        
        if orders_meta:
            lines = ["✅ <b>LỊCH SỬ MUA HÀNG:</b>\n"]
            keyboard = []
            for o in orders_meta:
                lines.append(f"🆔 <b>{o['code']}</b> | {o['product']} | {o['time']}")
                keyboard.append([InlineKeyboardButton(f"Xem {o['code']}", callback_data=f"order_detail|{o['code']}")])
            msg = "\n".join(lines)
            keyboard.append([InlineKeyboardButton("🔙 Trang chủ", callback_data='back_to_home')])
            await context.bot.send_message(chat_id=update.message.chat_id, text=msg, parse_mode='HTML', reply_markup=InlineKeyboardMarkup(keyboard))
            # Hiển thị lại Reply Keyboard
            await context.bot.send_message(
                chat_id=update.message.chat_id,
                text="💡 <b>Bạn muốn làm gì tiếp theo?</b>",
                reply_markup=get_reply_keyboard(update.effective_user.id if update and update.effective_user else None),
                parse_mode='HTML'
            )
        else:
            await context.bot.send_message(
                chat_id=update.message.chat_id, 
                text="❌ Chưa có đơn hàng.", 
                reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("🔙 Trang chủ", callback_data='back_to_home')]])
            )
            # Hiển thị lại Reply Keyboard
            await context.bot.send_message(
                chat_id=update.message.chat_id,
                text="💡 <b>Bạn muốn làm gì tiếp theo?</b>",
                reply_markup=get_reply_keyboard(update.effective_user.id if update and update.effective_user else None),
                parse_mode='HTML'
            )
    except Exception as e:
        logging.error(e)

async def cmd_hotro(update: Update, context: ContextTypes.DEFAULT_TYPE):
    global BOT_STOPPED
    user = update.effective_user
    user_id = user.id
    
    # Kiểm tra bảo trì - Admin bypass
    if not is_admin(user_id) and BOT_STOPPED:
        await update.message.reply_text(MAINTENANCE_MESSAGE, parse_mode='HTML')
        return
    
    add_user_to_list(user.id, user.username, user.full_name)
    text = (
        f"📞 <b>Hỗ trợ nhanh 24/7:</b>\n\n"
        f"• Telegram 1: {TELEGRAM_ADMIN_1}\n"
        f"• Telegram 2: {TELEGRAM_ADMIN_2}\n"
        f"• Zalo Admin 1: {ZALO_ADMIN_1}\n"
        f"• Zalo Admin 2: {ZALO_ADMIN_2}\n"
        f"👉 Tham gia cộng đồng: {COMMUNITY_LINK}"
    )
    await update.message.reply_text(
        text, 
        parse_mode='HTML', 
        disable_web_page_preview=True,
        reply_markup=get_reply_keyboard(update.effective_user.id if update and update.effective_user else None)
    )

# ==============================================================================
# 6. ADMIN COMMANDS
# ==============================================================================

async def cmd_monthly_report(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """
    /baocao [dd/mm[/yyyy]]
    - Nếu không truyền gì: báo cáo doanh thu NGÀY hôm nay.
    - Nếu truyền ngày: báo cáo doanh thu cho ngày đó.
    Chỉ dành cho admin.
    """
    global BOT_STOPPED
    if BOT_STOPPED:
        await handle_maintenance_message(update, context)
        return
    if not is_admin(update.effective_user.id):
        await update.message.reply_text("❌ Chỉ admin mới dùng được lệnh này.")
        return
    # Parse ngày từ args (nếu có)
    if context.args:
        date_text = " ".join(context.args).strip()
        m = re.match(r"^(\d{1,2})/(\d{1,2})(?:/(\d{4}))?$", date_text)
        if not m:
            await update.message.reply_text(
                "⚠️ Sai định dạng ngày.\n"
                "👉 Dùng: /baocao hoặc /baocao dd/mm hoặc /baocao dd/mm/yyyy\n"
                "Ví dụ: /baocao 15/12/2025"
            )
            return
        d = int(m.group(1))
        mo = int(m.group(2))
        y = int(m.group(3)) if m.group(3) else get_vietnam_now().year
        try:
            target_date = datetime(year=y, month=mo, day=d)
        except ValueError:
            await update.message.reply_text("⚠️ Ngày không hợp lệ, vui lòng kiểm tra lại.")
            return
    else:
        target_date = get_vietnam_now()

    await update.message.reply_text(
        f"⏳ Đang tổng hợp doanh thu NGÀY {target_date.strftime('%d/%m/%Y')}, vui lòng chờ vài giây..."
    )
    # Gửi cho tất cả admin + trả về chat hiện tại (nếu chat không nằm trong ADMIN_IDS)
    await send_daily_revenue_for_date(
        context,
        target_date,
        to_chat_id=update.effective_chat.id,
        notify_admins=True,
    )


async def cmd_month_report(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """
    /baocaothang
    - Báo cáo doanh thu THÁNG hiện tại.
    Chỉ dành cho admin.
    """
    global BOT_STOPPED
    if BOT_STOPPED:
        await handle_maintenance_message(update, context)
        return
    if not is_admin(update.effective_user.id):
        await update.message.reply_text("❌ Chỉ admin mới dùng được lệnh này.")
        return
    now = get_vietnam_now()
    await update.message.reply_text(
        f"⏳ Đang tổng hợp doanh thu THÁNG {now.strftime('%m/%Y')}, vui lòng chờ vài giây..."
    )
    await send_monthly_revenue_report(
        context,
        target_date=now,
        to_chat_id=update.effective_chat.id,
        notify_admins=True,
    )

# ==============================================================================
# ADMIN BALANCE COMMANDS
# ==============================================================================

async def cmd_addmoney(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Cộng tiền cho user (admin only) - /addmoney <user_id> <amount>"""
    if not is_admin(update.effective_user.id):
        await update.message.reply_text("❌ Chỉ admin mới dùng được lệnh này.")
        return
    
    if len(context.args) < 2:
        await update.message.reply_text(
            "💰 <b>Cộng tiền cho user</b>\n\n"
            "📝 Cách dùng: /addmoney <user_id> <số_tiền>\n\n"
            "Ví dụ:\n"
            "<code>/addmoney 123456789 50000</code>\n"
            "<code>/addmoney 123456789 100k</code>",
            parse_mode='HTML'
        )
        return
    
    try:
        user_id = int(context.args[0])
        amount_str = context.args[1].lower().replace(",", "").replace(".", "")
        
        if amount_str.endswith("k"):
            amount = int(float(amount_str[:-1]) * 1000)
        elif amount_str.endswith("m"):
            amount = int(float(amount_str[:-1]) * 1000000)
        else:
            amount = int(amount_str)
        
        if amount <= 0:
            await update.message.reply_text("⚠️ Số tiền phải lớn hơn 0!")
            return
        
        old_balance = get_user_balance(user_id)
        new_balance = add_user_balance(user_id, amount)
        
        users = load_users_list()
        user_info = users.get(str(user_id), {})
        username = user_info.get("username", "N/A")
        fullname = user_info.get("full_name", "N/A")
        
        await update.message.reply_text(
            f"✅ <b>ĐÃ CỘNG TIỀN THÀNH CÔNG!</b>\n\n"
            f"👤 User: {fullname} (@{username})\n"
            f"🆔 ID: <code>{user_id}</code>\n\n"
            f"💰 Cộng thêm: <b>+{format_balance(amount)}</b>\n"
            f"📊 Số dư cũ: {format_balance(old_balance)}\n"
            f"📊 Số dư mới: <b>{format_balance(new_balance)}</b>",
            parse_mode='HTML'
        )
        
        try:
            await context.bot.send_message(
                chat_id=user_id,
                text=(
                    f"💰 <b>SỐ DƯ TÀI KHOẢN ĐÃ ĐƯỢC CỘNG!</b>\n\n"
                    f"➕ Số tiền: <b>+{format_balance(amount)}</b>\n"
                    f"📊 Số dư mới: <b>{format_balance(new_balance)}</b>"
                ),
                parse_mode='HTML'
            )
        except Exception as e:
            logging.warning(f"Không thể gửi thông báo cho user {user_id}: {e}")
        
    except ValueError:
        await update.message.reply_text("⚠️ User ID hoặc số tiền không hợp lệ!")
    except Exception as e:
        await update.message.reply_text(f"❌ Lỗi: {e}")

async def cmd_removemoney(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Trừ tiền của user (admin only) - /removemoney <user_id> <amount>"""
    if not is_admin(update.effective_user.id):
        await update.message.reply_text("❌ Chỉ admin mới dùng được lệnh này.")
        return
    
    if len(context.args) < 2:
        await update.message.reply_text(
            "💸 <b>Trừ tiền của user</b>\n\n"
            "📝 Cách dùng: /removemoney <user_id> <số_tiền>\n\n"
            "Ví dụ:\n"
            "<code>/removemoney 123456789 50000</code>\n"
            "<code>/removemoney 123456789 100k</code>",
            parse_mode='HTML'
        )
        return
    
    try:
        user_id = int(context.args[0])
        amount_str = context.args[1].lower().replace(",", "").replace(".", "")
        
        if amount_str.endswith("k"):
            amount = int(float(amount_str[:-1]) * 1000)
        elif amount_str.endswith("m"):
            amount = int(float(amount_str[:-1]) * 1000000)
        else:
            amount = int(amount_str)
        
        if amount <= 0:
            await update.message.reply_text("⚠️ Số tiền phải lớn hơn 0!")
            return
        
        old_balance = get_user_balance(user_id)
        users = load_users_list()
        user_info = users.get(str(user_id), {})
        username = user_info.get("username", "N/A")
        fullname = user_info.get("full_name", "N/A")
        
        success, new_balance = subtract_user_balance(user_id, amount)
        
        if success:
            await update.message.reply_text(
                f"✅ <b>ĐÃ TRỪ TIỀN THÀNH CÔNG!</b>\n\n"
                f"👤 User: {fullname} (@{username})\n"
                f"🆔 ID: <code>{user_id}</code>\n\n"
                f"💸 Trừ: <b>-{format_balance(amount)}</b>\n"
                f"📊 Số dư cũ: {format_balance(old_balance)}\n"
                f"📊 Số dư mới: <b>{format_balance(new_balance)}</b>",
                parse_mode='HTML'
            )
            
            try:
                await context.bot.send_message(
                    chat_id=user_id,
                    text=(
                        f"💸 <b>SỐ DƯ TÀI KHOẢN ĐÃ ĐƯỢC TRỪ!</b>\n\n"
                        f"➖ Số tiền: <b>-{format_balance(amount)}</b>\n"
                        f"📊 Số dư mới: <b>{format_balance(new_balance)}</b>"
                    ),
                    parse_mode='HTML'
                )
            except Exception as e:
                logging.warning(f"Không thể gửi thông báo cho user {user_id}: {e}")
        else:
            await update.message.reply_text(
                f"⚠️ <b>KHÔNG ĐỦ SỐ DƯ!</b>\n\n"
                f"👤 User: {fullname} (@{username})\n"
                f"🆔 ID: <code>{user_id}</code>\n\n"
                f"💰 Số dư hiện tại: {format_balance(old_balance)}\n"
                f"💸 Cần trừ: {format_balance(amount)}",
                parse_mode='HTML'
            )
        
    except ValueError:
        await update.message.reply_text("⚠️ User ID hoặc số tiền không hợp lệ!")
    except Exception as e:
        await update.message.reply_text(f"❌ Lỗi: {e}")

async def cmd_setmoney(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Đặt số dư cho user (admin only) - /setmoney <user_id> <amount>"""
    if not is_admin(update.effective_user.id):
        await update.message.reply_text("❌ Chỉ admin mới dùng được lệnh này.")
        return
    
    if len(context.args) < 2:
        await update.message.reply_text(
            "💰 <b>Đặt số dư cho user</b>\n\n"
            "📝 Cách dùng: /setmoney <user_id> <số_tiền>\n\n"
            "Ví dụ:\n"
            "<code>/setmoney 123456789 500000</code>",
            parse_mode='HTML'
        )
        return
    
    try:
        user_id = int(context.args[0])
        amount_str = context.args[1].lower().replace(",", "").replace(".", "")
        
        if amount_str.endswith("k"):
            amount = int(float(amount_str[:-1]) * 1000)
        elif amount_str.endswith("m"):
            amount = int(float(amount_str[:-1]) * 1000000)
        else:
            amount = int(amount_str)
        
        old_balance = get_user_balance(user_id)
        set_user_balance(user_id, amount)
        new_balance = get_user_balance(user_id)
        
        users = load_users_list()
        user_info = users.get(str(user_id), {})
        username = user_info.get("username", "N/A")
        fullname = user_info.get("full_name", "N/A")
        
        await update.message.reply_text(
            f"✅ <b>ĐÃ ĐẶT SỐ DƯ!</b>\n\n"
            f"👤 User: {fullname} (@{username})\n"
            f"🆔 ID: <code>{user_id}</code>\n\n"
            f"📊 Số dư cũ: {format_balance(old_balance)}\n"
            f"📊 Số dư mới: <b>{format_balance(new_balance)}</b>",
            parse_mode='HTML'
        )
        
    except ValueError:
        await update.message.reply_text("⚠️ User ID hoặc số tiền không hợp lệ!")
    except Exception as e:
        await update.message.reply_text(f"❌ Lỗi: {e}")

# ==============================================================================
# CUSTOMER BALANCE COMMANDS
# ==============================================================================

async def cmd_check_balance(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Xem số dư tài khoản"""
    global BOT_STOPPED
    user_id = update.effective_user.id
    user = update.effective_user
    
    # Kiểm tra bảo trì - Admin bypass
    if not is_admin(user_id) and BOT_STOPPED:
        await update.message.reply_text(MAINTENANCE_MESSAGE, parse_mode='HTML')
        return
    
    balance = get_user_balance(user_id)
    
    await update.message.reply_text(
        f"💳 <b>SỐ DƯ TÀI KHOẢN</b>\n\n"
        f"👤 Họ tên: <b>{user.full_name}</b>\n"
        f"🆔 User ID: <code>{user_id}</code>\n\n"
        f"💰 Số dư: <b>{format_balance(balance)}</b>\n\n"
        f"💡 Dùng nút <b>💰 Nạp Tiền</b> để nạp thêm.\n"
        f"📱 Số dư có thể dùng cho dịch vụ <b>Verify Phone</b>.",
        parse_mode='HTML',
        reply_markup=get_reply_keyboard(update.effective_user.id if update and update.effective_user else None)
    )

async def cmd_deposit(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Bắt đầu flow nạp tiền"""
    global BOT_STOPPED
    user_id = update.effective_user.id
    user = update.effective_user
    
    # Kiểm tra bảo trì - Admin bypass
    if not is_admin(user_id) and BOT_STOPPED:
        await update.message.reply_text(MAINTENANCE_MESSAGE, parse_mode='HTML')
        return ConversationHandler.END
    
    context.user_data['deposit_user_id'] = user_id
    context.user_data['deposit_username'] = user.username or user.full_name
    context.user_data['deposit_fullname'] = user.full_name
    
    current_balance = get_user_balance(user_id)
    
    await update.message.reply_text(
        f"💰 <b>NẠP TIỀN VÀO TÀI KHOẢN</b>\n\n"
        f"💳 Số dư hiện tại: <b>{format_balance(current_balance)}</b>\n\n"
        f"📝 Vui lòng nhập <b>số tiền</b> bạn muốn nạp:\n\n"
        f"💡 Ví dụ:\n"
        f"• <code>50000</code> (nạp 50.000đ)\n"
        f"• <code>100k</code> (nạp 100.000đ)\n\n"
        f"⚠️ Số tiền tối thiểu: <b>5.500đ</b>\n\n"
        f"❌ Gửi /cancel để hủy",
        parse_mode='HTML'
    )
    return WAITING_DEPOSIT_AMOUNT

async def handle_deposit_amount(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Xử lý số tiền nạp và hiển thị QR thanh toán"""
    user_id = update.effective_user.id
    user = update.effective_user
    
    text = update.message.text.strip().lower().replace(",", "").replace(".", "")
    
    try:
        if text.endswith("k"):
            amount = int(float(text[:-1]) * 1000)
        elif text.endswith("m"):
            amount = int(float(text[:-1]) * 1000000)
        else:
            amount = int(text)
        
        if amount < 5500:
            await update.message.reply_text(
                "⚠️ <b>Số tiền tối thiểu là 5.500đ!</b>\n\nVui lòng nhập lại:",
                parse_mode='HTML'
            )
            return WAITING_DEPOSIT_AMOUNT
        
        if amount > 10000000:
            await update.message.reply_text(
                "⚠️ <b>Số tiền tối đa là 10.000.000đ!</b>\n\nVui lòng nhập lại:",
                parse_mode='HTML'
            )
            return WAITING_DEPOSIT_AMOUNT
            
    except ValueError:
        await update.message.reply_text(
            "⚠️ <b>Số tiền không hợp lệ!</b>\n\nVui lòng nhập lại (ví dụ: 50000 hoặc 100k):",
            parse_mode='HTML'
        )
        return WAITING_DEPOSIT_AMOUNT
    
    now = get_vietnam_now()
    order_code = f"NAP{now.strftime('%d%m%H%M%S')}{random.randint(10, 99)}"
    
    order_data = {
        "order_code": order_code,
        "user_id": user_id,
        "username": user.username or user.full_name,
        "user_fullname": user.full_name,
        "product_name": f"Nạp tiền {format_balance(amount)}",
        "product_type": "deposit",
        "quantity": 1,
        "price": amount,
        "total_amount": amount,
        "status": "pending_payment",
        "created_at": now.isoformat()
    }
    
    pending_orders[order_code] = order_data
    save_pending_orders()
    
    bank_cfg = get_bank_config()
    account_no = bank_cfg.get("accountNo", "")
    account_name = "NGUYEN TAI THINH"
    bank_name = "MB Bank"
    
    qr_url = f"https://img.vietqr.io/image/MB-{account_no}-compact2.png?amount={amount}&addInfo={order_code}&accountName={account_name}"
    
    current_balance = get_user_balance(user_id)
    amount_formatted = f"{amount:,}".replace(",", ".")
    new_balance_est = current_balance + amount
    
    payment_msg = (
        f"💰 <b>NẠP TIỀN VÀO TÀI KHOẢN</b>\n\n"
        f"🆔 Mã: <code>{order_code}</code>\n"
        f"💵 Số tiền: <b>{amount_formatted} VNĐ</b>\n\n"
        f"📊 Số dư hiện tại: {format_balance(current_balance)}\n"
        f"📊 Sau khi nạp: <b>{format_balance(new_balance_est)}</b>\n\n"
        f"━━━━━━━━━━━━━━━━\n"
        f"🏦 Ngân hàng: <b>{bank_name}</b>\n"
        f"💳 STK: <code>{account_no}</code>\n"
        f"👤 Chủ TK: <b>{account_name}</b>\n"
        f"📝 Nội dung CK: <code>{order_code}</code>\n\n"
        f"⏰ Đơn hàng sẽ tự động hủy sau <b>10 phút</b>."
    )
    
    keyboard = [[InlineKeyboardButton("❌ Hủy đơn hàng", callback_data=f"cancel_deposit|{order_code}")]]
    
    await update.message.reply_photo(
        photo=qr_url,
        caption=payment_msg,
        parse_mode='HTML',
        reply_markup=InlineKeyboardMarkup(keyboard)
    )
    
    await send_to_all_admins(
        context.bot,
        f"💰 <b>ĐƠN NẠP TIỀN MỚI</b>\n\n"
        f"🆔 Mã: <code>{order_code}</code>\n"
        f"👤 Khách: {user.full_name}\n"
        f"💵 Số tiền: <b>{amount_formatted} VNĐ</b>",
        parse_mode='HTML'
    )
    
    asyncio.create_task(auto_cancel_deposit_order(order_code, user_id, context))
    
    return ConversationHandler.END

async def auto_cancel_deposit_order(order_code, user_id, context):
    """Tự động hủy đơn nạp tiền sau 10 phút"""
    try:
        await asyncio.sleep(600)
        
        if order_code in pending_orders:
            order = pending_orders[order_code]
            if order.get('product_type') == 'deposit' and order.get('status') == 'pending_payment':
                del pending_orders[order_code]
                save_pending_orders()
                
                try:
                    await context.bot.send_message(
                        chat_id=user_id,
                        text=(
                            f"⏰ <b>ĐƠN NẠP TIỀN ĐÃ HẾT HẠN</b>\n\n"
                            f"Mã: <code>{order_code}</code>\n"
                            f"💡 Vui lòng bấm <b>💰 Nạp Tiền</b> để tạo đơn mới."
                        ),
                        parse_mode='HTML'
                    )
                except:
                    pass
    except Exception as e:
        logging.error(f"Lỗi auto_cancel_deposit_order: {e}")

async def cancel_deposit_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Xử lý khi khách bấm nút hủy đơn nạp tiền"""
    global BOT_STOPPED
    query = update.callback_query
    user_id = query.from_user.id
    
    # Kiểm tra bảo trì - Admin bypass
    if not is_admin(user_id) and BOT_STOPPED:
        await query.answer(MAINTENANCE_ALERT, show_alert=True)
        return
    
    await query.answer()
    
    data = query.data
    if not data.startswith("cancel_deposit|"):
        return
    
    order_code = data.split("|")[1]
    
    if order_code not in pending_orders:
        await query.edit_message_caption(
            caption="⚠️ Đơn nạp tiền không tồn tại hoặc đã được xử lý.",
            parse_mode='HTML'
        )
        return
    
    order = pending_orders[order_code]
    if order.get('product_type') != 'deposit':
        return
    
    # Xóa đơn hàng
    del pending_orders[order_code]
    save_pending_orders()
    
    await query.edit_message_caption(
        caption=(
            f"❌ <b>ĐÃ HỦY ĐƠN NẠP TIỀN</b>\n\n"
            f"🆔 Mã: <code>{order_code}</code>\n\n"
            f"💡 Bấm <b>💰 Nạp Tiền</b> để tạo đơn mới."
        ),
        parse_mode='HTML'
    )


# NOTE: check_deposit_payments_job đã được định nghĩa ở line 5019 với lazy-fetch đầy đủ
# Không cần hàm duplicate ở đây


async def cmd_time(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Hiển thị thời gian thực theo giờ Việt Nam (chỉ admin)."""
    global BOT_STOPPED
    if BOT_STOPPED:
        await handle_maintenance_message(update, context)
        return
    if not is_admin(update.effective_user.id):
        await update.message.reply_text("❌ Chỉ admin mới dùng được lệnh này.")
        return
    now = get_vietnam_now()
    await update.message.reply_text(
        f"🕐 <b>Thời gian hiện tại (Việt Nam UTC+7):</b>\n\n"
        f"📅 Ngày: <b>{now.strftime('%d/%m/%Y')}</b>\n"
        f"⏰ Giờ: <b>{now.strftime('%H:%M:%S')}</b>\n\n"
        f"🗓️ Thứ: <b>{['Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy', 'Chủ Nhật'][now.weekday()]}</b>",
        parse_mode='HTML'
    )


async def cmd_stop(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Dừng bot tạm thời (chỉ admin)."""
    global BOT_STOPPED
    # Nếu bot đã dừng rồi thì chỉ nhắc lại
    if BOT_STOPPED:
        await update.message.reply_text(
            "🔧 Bot hiện đang ở trạng thái bảo trì.\n"
            "💡 Dùng lệnh <b>/start</b> bằng tài khoản admin để khởi động lại.",
            parse_mode='HTML'
        )
        return
    if not is_admin(update.effective_user.id):
        await update.message.reply_text("❌ Chỉ admin mới dùng được lệnh này.")
        return
    
    BOT_STOPPED = True
    logging.info(f"🛑 Bot đã được dừng tạm thời bởi admin {update.effective_user.id}")
    await update.message.reply_text(
        "🛑 <b>Bot đã được dừng tạm thời</b>\n\n"
        "⚠️ Tất cả khách hàng sẽ nhận thông báo bảo trì khi nhắn tin.\n"
        "💡 Dùng lệnh <b>/start</b> để khởi động lại bot.",
        parse_mode='HTML'
    )


async def handle_maintenance_message(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Xử lý tin nhắn từ khách hàng khi bot đang bảo trì."""
    global BOT_STOPPED
    
    # Nếu bot không dừng, không làm gì (để các handler khác xử lý)
    if not BOT_STOPPED:
        return None

    # Nếu là admin + đang gửi lệnh /start → cho phép qua để bật lại bot
    if update.message and update.message.text and update.message.text.startswith("/start") and is_admin(update.effective_user.id):
        return None

    # Tất cả user khác (kể cả admin) nhận thông báo bảo trì
    try:
        if update.message:
            await update.message.reply_text(MAINTENANCE_MESSAGE, parse_mode='HTML')
        elif update.callback_query:
            await update.callback_query.answer(MAINTENANCE_ALERT, show_alert=True)
    except Exception as e:
        logging.error(f"Lỗi khi gửi thông báo bảo trì: {e}")
    
    return None  # Không chặn các handler khác, nhưng sẽ không xử lý tiếp


async def cmd_test_morning(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Test nhắc buổi sáng ngay lập tức (chỉ admin)."""
    global BOT_STOPPED
    if BOT_STOPPED:
        await handle_maintenance_message(update, context)
        return
    if not is_admin(update.effective_user.id):
        await update.message.reply_text("❌ Chỉ admin mới dùng được lệnh này.")
        return
    await update.message.reply_text("⏳ Đang test nhắc buổi sáng cho admin...")
    await morning_reminder(context)


async def cmd_test_lunch(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Test nhắc ăn trưa ngay lập tức (chỉ admin)."""
    global BOT_STOPPED
    if BOT_STOPPED:
        await handle_maintenance_message(update, context)
        return
    if not is_admin(update.effective_user.id):
        await update.message.reply_text("❌ Chỉ admin mới dùng được lệnh này.")
        return
    await update.message.reply_text("⏳ Đang test nhắc ăn trưa cho admin...")
    await lunch_reminder(context)


async def cmd_test_sleep(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Test nhắc đi ngủ ngay lập tức (chỉ admin)."""
    global BOT_STOPPED
    if BOT_STOPPED:
        await handle_maintenance_message(update, context)
        return
    if not is_admin(update.effective_user.id):
        await update.message.reply_text("❌ Chỉ admin mới dùng được lệnh này.")
        return
    await update.message.reply_text("⏳ Đang test nhắc đi ngủ cho admin...")
    await sleep_reminder(context)


async def cmd_announce(update: Update, context: ContextTypes.DEFAULT_TYPE):
    global BOT_STOPPED
    if BOT_STOPPED:
        await handle_maintenance_message(update, context)
        return
    if not is_admin(update.effective_user.id):
        await update.message.reply_text("❌ Chỉ admin mới dùng được lệnh này.")
        return
    if not context.args:
        await update.message.reply_text(
            "📢 <b>Cách dùng:</b>\n"
            "/announce Tiêu đề | Nội dung thông báo\n\n"
            "Ví dụ:\n"
            "/announce Khuyến mãi | Giảm 50% cho tất cả sản phẩm!",
            parse_mode='HTML'
        )
        return
    text = " ".join(context.args)
    if "|" not in text:
        await update.message.reply_text("⚠️ Sai format. Dùng: /announce Tiêu đề | Nội dung")
        return
    title, message = text.split("|", 1)
    title = title.strip()
    message = message.strip()
    announcements = load_announcements()
    new_ann = {
        "id": str(int(time.time())),
        "title": title,
        "message": message,
        "created": get_vietnam_now().isoformat(),
        "active": True
    }
    announcements.append(new_ann)
    save_announcements(announcements)
    await update.message.reply_text(
        f"✅ <b>Đã thêm thông báo:</b>\n"
        f"📢 {title}\n{message}",
        parse_mode='HTML'
    )

# ==============================================================================
# ADMIN BALANCE COMMANDS
# ==============================================================================

async def cmd_addmoney(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Cộng tiền cho user (admin only) - /addmoney <user_id> <amount>"""
    if not is_admin(update.effective_user.id):
        await update.message.reply_text("❌ Chỉ admin mới dùng được lệnh này.")
        return
    
    if len(context.args) < 2:
        await update.message.reply_text(
            "💰 <b>Cộng tiền cho user</b>\n\n"
            "📝 Cách dùng: <code>/addmoney [user_id] [số_tiền]</code>\n\n"
            "Ví dụ:\n"
            "<code>/addmoney 123456789 50000</code>\n"
            "<code>/addmoney 123456789 100k</code>",
            parse_mode='HTML'
        )
        return
    
    try:
        user_id = int(context.args[0])
        amount_str = context.args[1].lower().replace(",", "").replace(".", "")
        
        # Hỗ trợ format: 50k, 100k, 1m, etc.
        if amount_str.endswith("k"):
            amount = int(float(amount_str[:-1]) * 1000)
        elif amount_str.endswith("m"):
            amount = int(float(amount_str[:-1]) * 1000000)
        else:
            amount = int(amount_str)
        
        if amount <= 0:
            await update.message.reply_text("⚠️ Số tiền phải lớn hơn 0!")
            return
        
        old_balance = get_user_balance(user_id)
        new_balance = add_user_balance(user_id, amount)
        
        # Lấy thông tin user
        users = load_users_list()
        user_info = users.get(str(user_id), {})
        username = user_info.get("username", "N/A")
        fullname = user_info.get("full_name", "N/A")
        
        await update.message.reply_text(
            f"✅ <b>ĐÃ CỘNG TIỀN THÀNH CÔNG!</b>\n\n"
            f"👤 User: {fullname} (@{username})\n"
            f"🆔 ID: <code>{user_id}</code>\n\n"
            f"💰 Cộng thêm: <b>+{format_balance(amount)}</b>\n"
            f"📊 Số dư cũ: {format_balance(old_balance)}\n"
            f"📊 Số dư mới: <b>{format_balance(new_balance)}</b>",
            parse_mode='HTML'
        )
        
        # Thông báo cho user
        try:
            await context.bot.send_message(
                chat_id=user_id,
                text=(
                    f"💰 <b>SỐ DƯ TÀI KHOẢN ĐÃ ĐƯỢC CỘNG!</b>\n\n"
                    f"➕ Số tiền: <b>+{format_balance(amount)}</b>\n"
                    f"📊 Số dư mới: <b>{format_balance(new_balance)}</b>\n\n"
                    f"💡 Dùng nút <b>💳 Xem Số Dư</b> để kiểm tra."
                ),
                parse_mode='HTML'
            )
        except Exception as e:
            logging.warning(f"Không thể gửi thông báo cho user {user_id}: {e}")
        
    except ValueError:
        await update.message.reply_text("⚠️ User ID hoặc số tiền không hợp lệ!")
    except Exception as e:
        await update.message.reply_text(f"❌ Lỗi: {e}")

async def cmd_removemoney(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Trừ tiền của user (admin only) - /removemoney <user_id> <amount>"""
    if not is_admin(update.effective_user.id):
        await update.message.reply_text("❌ Chỉ admin mới dùng được lệnh này.")
        return
    
    if len(context.args) < 2:
        await update.message.reply_text(
            "💸 <b>Trừ tiền của user</b>\n\n"
            "📝 Cách dùng: <code>/removemoney [user_id] [số_tiền]</code>\n\n"
            "Ví dụ:\n"
            "<code>/removemoney 123456789 50000</code>\n"
            "<code>/removemoney 123456789 100k</code>",
            parse_mode='HTML'
        )
        return
    
    try:
        user_id = int(context.args[0])
        amount_str = context.args[1].lower().replace(",", "").replace(".", "")
        
        # Hỗ trợ format: 50k, 100k, 1m, etc.
        if amount_str.endswith("k"):
            amount = int(float(amount_str[:-1]) * 1000)
        elif amount_str.endswith("m"):
            amount = int(float(amount_str[:-1]) * 1000000)
        else:
            amount = int(amount_str)
        
        if amount <= 0:
            await update.message.reply_text("⚠️ Số tiền phải lớn hơn 0!")
            return
        
        old_balance = get_user_balance(user_id)
        
        # Lấy thông tin user
        users = load_users_list()
        user_info = users.get(str(user_id), {})
        username = user_info.get("username", "N/A")
        fullname = user_info.get("full_name", "N/A")
        
        success, new_balance = subtract_user_balance(user_id, amount)
        
        if success:
            await update.message.reply_text(
                f"✅ <b>ĐÃ TRỪ TIỀN THÀNH CÔNG!</b>\n\n"
                f"👤 User: {fullname} (@{username})\n"
                f"🆔 ID: <code>{user_id}</code>\n\n"
                f"💸 Trừ: <b>-{format_balance(amount)}</b>\n"
                f"📊 Số dư cũ: {format_balance(old_balance)}\n"
                f"📊 Số dư mới: <b>{format_balance(new_balance)}</b>",
                parse_mode='HTML'
            )
            
            # Thông báo cho user
            try:
                await context.bot.send_message(
                    chat_id=user_id,
                    text=(
                        f"💸 <b>SỐ DƯ TÀI KHOẢN ĐÃ ĐƯỢC TRỪ!</b>\n\n"
                        f"➖ Số tiền: <b>-{format_balance(amount)}</b>\n"
                        f"📊 Số dư mới: <b>{format_balance(new_balance)}</b>\n\n"
                        f"💡 Dùng nút <b>💳 Xem Số Dư</b> để kiểm tra."
                    ),
                    parse_mode='HTML'
                )
            except Exception as e:
                logging.warning(f"Không thể gửi thông báo cho user {user_id}: {e}")
        else:
            await update.message.reply_text(
                f"⚠️ <b>KHÔNG ĐỦ SỐ DƯ!</b>\n\n"
                f"👤 User: {fullname} (@{username})\n"
                f"🆔 ID: <code>{user_id}</code>\n\n"
                f"💰 Số dư hiện tại: {format_balance(old_balance)}\n"
                f"💸 Cần trừ: {format_balance(amount)}",
                parse_mode='HTML'
            )
        
    except ValueError:
        await update.message.reply_text("⚠️ User ID hoặc số tiền không hợp lệ!")
    except Exception as e:
        await update.message.reply_text(f"❌ Lỗi: {e}")

async def cmd_setmoney(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Đặt số dư cho user (admin only) - /setmoney <user_id> <amount>"""
    if not is_admin(update.effective_user.id):
        await update.message.reply_text("❌ Chỉ admin mới dùng được lệnh này.")
        return
    
    if len(context.args) < 2:
        await update.message.reply_text(
            "💰 <b>Đặt số dư cho user</b>\n\n"
            "📝 Cách dùng: /setmoney <user_id> <số_tiền>\n\n"
            "Ví dụ:\n"
            "<code>/setmoney 123456789 500000</code>",
            parse_mode='HTML'
        )
        return
    
    try:
        user_id = int(context.args[0])
        amount_str = context.args[1].lower().replace(",", "").replace(".", "")
        
        if amount_str.endswith("k"):
            amount = int(float(amount_str[:-1]) * 1000)
        elif amount_str.endswith("m"):
            amount = int(float(amount_str[:-1]) * 1000000)
        else:
            amount = int(amount_str)
        
        old_balance = get_user_balance(user_id)
        set_user_balance(user_id, amount)
        new_balance = get_user_balance(user_id)
        
        users = load_users_list()
        user_info = users.get(str(user_id), {})
        username = user_info.get("username", "N/A")
        fullname = user_info.get("full_name", "N/A")
        
        await update.message.reply_text(
            f"✅ <b>ĐÃ ĐẶT SỐ DƯ!</b>\n\n"
            f"👤 User: {fullname} (@{username})\n"
            f"🆔 ID: <code>{user_id}</code>\n\n"
            f"📊 Số dư cũ: {format_balance(old_balance)}\n"
            f"📊 Số dư mới: <b>{format_balance(new_balance)}</b>",
            parse_mode='HTML'
        )
        
    except ValueError:
        await update.message.reply_text("⚠️ User ID hoặc số tiền không hợp lệ!")
    except Exception as e:
        await update.message.reply_text(f"❌ Lỗi: {e}")

# ==============================================================================
# CUSTOMER BALANCE COMMANDS
# ==============================================================================

async def cmd_check_balance(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Xem số dư tài khoản"""
    user_id = update.effective_user.id
    user = update.effective_user
    
    balance = get_user_balance(user_id)
    
    await update.message.reply_text(
        f"💳 <b>SỐ DƯ TÀI KHOẢN</b>\n\n"
        f"👤 Họ tên: <b>{user.full_name}</b>\n"
        f"🆔 User ID: <code>{user_id}</code>\n\n"
        f"💰 Số dư: <b>{format_balance(balance)}</b>\n\n"
        f"💡 Dùng nút <b>💰 Nạp Tiền</b> để nạp thêm.\n"
        f"📱 Số dư có thể dùng cho dịch vụ <b>Verify Phone</b>.",
        parse_mode='HTML',
        reply_markup=get_reply_keyboard(update.effective_user.id if update and update.effective_user else None)
    )

async def cmd_deposit(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Đạt hàng nạp tiền"""
    global BOT_STOPPED
    user_id = update.effective_user.id
    user = update.effective_user
    
    # Kiểm tra bảo trì - Admin bypass
    if not is_admin(user_id) and BOT_STOPPED:
        await update.message.reply_text(MAINTENANCE_MESSAGE, parse_mode='HTML')
        return ConversationHandler.END
    
    # Lưu thông tin user vào context
    context.user_data['deposit_user_id'] = user_id
    context.user_data['deposit_username'] = user.username or user.full_name
    context.user_data['deposit_fullname'] = user.full_name
    
    current_balance = get_user_balance(user_id)
    
    await update.message.reply_text(
        f"💰 <b>NẠP TIỀN VÀO TÀI KHOẢN</b>\n\n"
        f"💳 Số dư hiện tại: <b>{format_balance(current_balance)}</b>\n\n"
        f"📝 Vui lòng nhập <b>số tiền</b> bạn muốn nạp:\n\n"
        f"💡 Ví dụ:\n"
        f"• <code>50000</code> (nạp 50.000đ)\n"
        f"• <code>100k</code> (nạp 100.000đ)\n"
        f"• <code>500k</code> (nạp 500.000đ)\n\n"
        f"⚠️ Số tiền tối thiểu: <b>5.500đ</b>\n\n"
        f"❌ Gửi /cancel để hủy",
        parse_mode='HTML'
    )
    return WAITING_DEPOSIT_AMOUNT

async def handle_deposit_amount(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Xử lý số tiền nạp và hiển thị QR thanh toán"""
    user_id = update.effective_user.id
    user = update.effective_user
    
    text = update.message.text.strip().lower().replace(",", "").replace(".", "")
    
    try:
        # Parse số tiền
        if text.endswith("k"):
            amount = int(float(text[:-1]) * 1000)
        elif text.endswith("m"):
            amount = int(float(text[:-1]) * 1000000)
        else:
            amount = int(text)
        
        if amount < 5500:
            await update.message.reply_text(
                "⚠️ <b>Số tiền tối thiểu là 5.500đ!</b>\n\n"
                "Vui lòng nhập lại số tiền:",
                parse_mode='HTML'
            )
            return WAITING_DEPOSIT_AMOUNT
        
        if amount > 10000000:
            await update.message.reply_text(
                "⚠️ <b>Số tiền tối đa là 10.000.000đ!</b>\n\n"
                "Vui lòng nhập lại số tiền hoặc chia thành nhiều lần nạp:",
                parse_mode='HTML'
            )
            return WAITING_DEPOSIT_AMOUNT
            
    except ValueError:
        await update.message.reply_text(
            "⚠️ <b>Số tiền không hợp lệ!</b>\n\n"
            "Vui lòng nhập lại (ví dụ: 50000 hoặc 100k):",
            parse_mode='HTML'
        )
        return WAITING_DEPOSIT_AMOUNT
    
    # Tạo mã đơn nạp tiền
    now = get_vietnam_now()
    order_code = f"NAP{now.strftime('%d%m%H%M%S')}{random.randint(10, 99)}"
    
    # Lưu đơn nạp tiền vào pending_orders
    order_data = {
        "order_code": order_code,
        "user_id": user_id,
        "username": user.username or user.full_name,
        "user_fullname": user.full_name,
        "product_name": f"Nạp tiền {format_balance(amount)}",
        "product_type": "deposit",
        "quantity": 1,
        "price": amount,
        "total_amount": amount,
        "status": "pending_payment",
        "created_at": time.time(),  # Lưu timestamp số thay vì ISO string
        "created_at_display": now.isoformat()  # Giữ ISO để hiển thị
    }
    
    pending_orders[order_code] = order_data
    save_pending_orders()
    
    # Lấy thông tin bank
    bank_cfg = get_bank_config()
    account_no = bank_cfg.get("accountNo", "")
    account_name = "NGUYEN TAI THINH"
    bank_name = "MB Bank"
    transfer_content = order_code
    
    # Tạo QR VietQR
    qr_url = f"https://img.vietqr.io/image/MB-{account_no}-compact2.png?amount={amount}&addInfo={transfer_content}&accountName={account_name}"
    
    current_balance = get_user_balance(user_id)
    amount_formatted = f"{amount:,}".replace(",", ".")
    new_balance_est = current_balance + amount
    
    payment_msg = (
        f"💰 <b>NẠP TIỀN VÀO TÀI KHOẢN</b>\n\n"
        f"🆔 Mã giao dịch: <code>{order_code}</code>\n"
        f"💵 Số tiền nạp: <b>{amount_formatted} VNĐ</b>\n\n"
        f"📊 Số dư hiện tại: {format_balance(current_balance)}\n"
        f"📊 Sau khi nạp: <b>{format_balance(new_balance_est)}</b>\n\n"
        f"━━━━━━━━━━━━━━━━\n"
        f"🏦 <b>THÔNG TIN CHUYỂN KHOẢN</b>\n\n"
        f"🏦 Ngân hàng: <b>{bank_name}</b>\n"
        f"💳 STK: <code>{account_no}</code>\n"
        f"👤 Chủ TK: <b>{account_name}</b>\n"
        f"💵 Số tiền: <b>{amount_formatted} VNĐ</b>\n"
        f"📝 Nội dung CK: <code>{transfer_content}</code>\n\n"
        f"⚠️ <b>LƯU Ý:</b> Vui lòng chuyển khoản <b>ĐÚNG SỐ TIỀN</b> và <b>NỘI DUNG</b>!\n"
        f"⏰ Đơn hàng sẽ tự động hủy sau <b>10 phút</b> nếu chưa thanh toán."
    )
    
    keyboard = [[InlineKeyboardButton("❌ Hủy đơn hàng", callback_data=f"cancel_deposit|{order_code}")]]
    
    # Gửi ảnh QR
    await update.message.reply_photo(
        photo=qr_url,
        caption=payment_msg,
        parse_mode='HTML',
        reply_markup=InlineKeyboardMarkup(keyboard)
    )
    
    # Thông báo cho admin
    await send_to_all_admins(
        context.bot,
        f"💰 <b>ĐƠN NẠP TIỀN MỚI</b>\n\n"
        f"🆔 Mã: <code>{order_code}</code>\n"
        f"👤 Khách: {user.full_name} (@{user.username})\n"
        f"💵 Số tiền: <b>{amount_formatted} VNĐ</b>\n"
        f"⏰ Thời gian: {now.strftime('%H:%M %d/%m/%Y')}",
        parse_mode='HTML'
    )
    
    # Tự động hủy sau 5 phút
    asyncio.create_task(auto_cancel_deposit_order(order_code, user_id, context))
    
    return ConversationHandler.END

async def auto_cancel_deposit_order(order_code, user_id, context):
    """Tự động hủy đơn nạp tiền sau 5 phút nếu chưa thanh toán"""
    try:
        await asyncio.sleep(300)  # Chờ 5 phút
        
        if order_code in pending_orders:
            order = pending_orders[order_code]
            if order.get('product_type') == 'deposit' and order.get('status') == 'pending_payment':
                del pending_orders[order_code]
                save_pending_orders()
                
                try:
                    await context.bot.send_message(
                        chat_id=user_id,
                        text=(
                            f"⏰ <b>ĐƠN NẠP TIỀN ĐÃ HẾT HẠN</b>\n\n"
                            f"Mã: <code>{order_code}</code>\n"
                            f"💵 Số tiền: {format_balance(order.get('total_amount', 0))}\n\n"
                            f"💡 Vui lòng bấm <b>💰 Nạp Tiền</b> để tạo đơn mới.\n"
                            f"📞 Liên hệ admin nếu đã chuyển khoản."
                        ),
                        parse_mode='HTML'
                    )
                except:
                    pass
    except Exception as e:
        logging.error(f"Lỗi auto_cancel_deposit_order: {e}")

async def check_deposit_payment_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Xử lý khi khách bấm nút xác nhận đã chuyển khoản nạp tiền"""
    global BOT_STOPPED
    query = update.callback_query
    user_id = query.from_user.id
    
    # Kiểm tra bảo trì - Admin bypass
    if not is_admin(user_id) and BOT_STOPPED:
        await query.answer(MAINTENANCE_ALERT, show_alert=True)
        return
    
    await query.answer()
    
    data = query.data
    if not data.startswith("check_deposit|"):
        return
    
    order_code = data.split("|")[1]
    
    if order_code not in pending_orders:
        await query.edit_message_caption(
            caption="⚠️ Đơn nạp tiền không tồn tại hoặc đã được xử lý.",
            parse_mode='HTML'
        )
        return
    
    order = pending_orders[order_code]
    if order.get('product_type') != 'deposit':
        return
    
    await query.edit_message_caption(
        caption=(
            f"⏳ <b>ĐANG KIỂM TRA THANH TOÁN...</b>\n\n"
            f"🆔 Mã: <code>{order_code}</code>\n"
            f"💵 Số tiền: {format_balance(order.get('total_amount', 0))}\n\n"
            f"Vui lòng chờ trong giây lát..."
        ),
        parse_mode='HTML'
    )
    
    # Kiểm tra thanh toán
    expected_amount = order.get('total_amount', 0)
    
    try:
        tx_list = fetch_apicanhan_transactions()
        is_paid, payment_info = match_payment_in_transactions(order_code, expected_amount, tx_list)
    except Exception as e:
        logging.error(f"Lỗi kiểm tra thanh toán nạp tiền: {e}")
        is_paid = False
    
    if is_paid:
        # Cộng tiền cho user
        user_id = order.get('user_id')
        new_balance = add_user_balance(user_id, expected_amount)
        
        # Xóa đơn khỏi pending
        del pending_orders[order_code]
        save_pending_orders()
        
        await query.edit_message_caption(
            caption=(
                f"✅ <b>NẠP TIỀN THÀNH CÔNG!</b>\n\n"
                f"🆔 Mã: <code>{order_code}</code>\n"
                f"💵 Số tiền: <b>+{format_balance(expected_amount)}</b>\n\n"
                f"📊 Số dư mới: <b>{format_balance(new_balance)}</b>\n\n"
                f"💡 Dùng số dư để verify phone!\\n"
                f"📱 Gửi /verify_phone để bắt đầu."
            ),
            parse_mode='HTML'
        )
        
        # Thông báo admin (có Telegram ID)
        await send_to_all_admins(
            context.bot,
            f"✅ <b>KHÁCH ĐÃ NẠP TIỀN</b>\n\n"
            f"🆔 Mã: <code>{order_code}</code>\n"
            f"👤 Khách: {order.get('user_fullname', 'N/A')}\n"
            f"📱 Telegram ID: <code>{user_id}</code>\n"
            f"💵 Số tiền: <b>{format_balance(expected_amount)}</b>\n"
            f"📊 Số dư mới: {format_balance(new_balance)}",
            parse_mode='HTML'
        )
        
        logging.info(f"✅ Đã nạp {expected_amount}đ cho user {user_id}, số dư mới: {new_balance}đ")
    else:
        keyboard = [[InlineKeyboardButton("🔄 Kiểm tra lại", callback_data=f"check_deposit|{order_code}")]]
        await query.edit_message_caption(
            caption=(
                f"❌ <b>CHƯA TÌM THẤY THANH TOÁN</b>\n\n"
                f"🆔 Mã: <code>{order_code}</code>\n"
                f"💵 Số tiền: {format_balance(expected_amount)}\n\n"
                f"⚠️ Vui lòng kiểm tra:\n"
                f"• Đã chuyển đúng số tiền?\n"
                f"• Nội dung CK có đúng <code>{order_code}</code>?\n\n"
                f"💡 Bấm nút bên dưới để kiểm tra lại."
            ),
            reply_markup=InlineKeyboardMarkup(keyboard),
            parse_mode='HTML'
        )


# === INVENTORY API DEPOSIT HELPER ===
# Track processed NAPAPI transactions to avoid duplicates
_processed_napapi_txns = set()

async def check_napapi_deposit(description: str, amount: int, bank_txn_id: str, bot):
    """
    Check and credit deposits made through Inventory API.
    Content format: NAPAPI RS123456789 DEP123ABC
    """
    global _processed_napapi_txns
    
    # Skip if already processed
    if bank_txn_id in _processed_napapi_txns:
        return
    
    try:
        import requests
        import re
        
        # Extract token from description (DEP followed by hex)
        # Description is already normalized (uppercase, no spaces/underscores)
        token_match = re.search(r'DEP([A-F0-9]{16})', description)
        if not token_match:
            return
        
        token = f"DEP{token_match.group(1)}"
        
        # Call Inventory API to verify this deposit
        # The API endpoint expects the token and will credit if valid
        INVENTORY_API_URL = "http://147.124.205.237:8000"  # VPS API
        ADMIN_TOKEN = "INV_ADMIN_2026_xK9mP4qR7sT2vW5y"
        
        # First, try to complete the pending deposit
        response = requests.post(
            f"{INVENTORY_API_URL}/v1/admin/pending-deposits/{token}/complete",
            headers={"Authorization": f"Bearer {ADMIN_TOKEN}"},
            timeout=10
        )
        
        if response.status_code == 200:
            result = response.json()
            if result.get("success"):
                _processed_napapi_txns.add(bank_txn_id)
                logging.info(f"✅ [NAPAPI] Deposit credited via API: {token} - {amount:,} VND")
                
                # Notify admin
                for admin_id in ADMIN_IDS:
                    try:
                        await bot.send_message(
                            chat_id=admin_id,
                            text=(
                                f"✅ <b>SELLER API ĐÃ NẠP TIỀN (TỰ ĐỘNG)</b>\n\n"
                                f"🏪 Token: <code>{token}</code>\n"
                                f"💵 Số tiền: <b>{amount:,} VND</b>\n"
                                f"🏦 Mã GD: <code>{bank_txn_id}</code>\n\n"
                                f"✅ Đã tự động cộng vào tài khoản seller!"
                            ),
                            parse_mode='HTML'
                        )
                    except:
                        pass
        elif response.status_code == 404:
            # Token not found - might be old or manual
            logging.debug(f"NAPAPI token not found: {token}")
        else:
            logging.warning(f"NAPAPI verify failed: {response.status_code} - {response.text[:200]}")
            
    except requests.exceptions.ConnectionError:
        logging.debug("NAPAPI: Cannot connect to Inventory API")
    except Exception as e:
        logging.debug(f"NAPAPI deposit check error: {e}")


async def check_deposit_payments_job(context: ContextTypes.DEFAULT_TYPE):
    """Job chạy định kỳ kiểm tra thanh toán cho đơn nạp tiền (customer + seller)
    
    LAZY-FETCH: Chỉ gọi API khi có đơn deposit (customer hoặc seller) đang chờ thanh toán
    và đơn còn mới (trong vòng 1 giờ)
    """
    tx_list = None
    current_time = time.time()
    MAX_ORDER_AGE = 3600  # 1 giờ - bỏ qua đơn cũ hơn
    
    try:
        # === CHECK IF THERE ARE ANY PENDING DEPOSITS ===
        # Only fetch transactions if needed
        has_pending_customer = False
        has_pending_seller = False
        pending_customer_count = 0
        pending_seller_count = 0
        
        # Check customer deposits - CHỈ ĐƠN TRONG VÒNG 1 GIỜ
        for order_code, order in list(pending_orders.items()):
            created_at = order.get('created_at', 0)
            
            # Xử lý cả trường hợp created_at là ISO string (đơn cũ) hoặc timestamp số (đơn mới)
            if isinstance(created_at, str):
                try:
                    # Parse ISO format và chuyển về timestamp
                    from datetime import datetime
                    dt = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
                    created_at = dt.timestamp()
                except:
                    created_at = 0
            
            order_age = current_time - created_at
            
            # Bỏ qua đơn quá cũ (hơn 1 giờ)
            if order_age > MAX_ORDER_AGE:
                continue
                
            if (order.get('product_type') == 'deposit' and 
                order.get('status') == 'pending_payment'):
                has_pending_customer = True
                pending_customer_count += 1
        
        # Check seller deposits - CHỈ ĐƠN TRONG VÒNG 1 GIỜ
        try:
            from seller_commands import load_pending_seller_deposits
            pending_seller = load_pending_seller_deposits()
            for d in pending_seller.values():
                created_at = d.get("created_at", 0)
                
                # Xử lý cả trường hợp created_at là ISO string hoặc timestamp số
                if isinstance(created_at, str):
                    try:
                        from datetime import datetime
                        dt = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
                        created_at = dt.timestamp()
                    except:
                        created_at = 0
                
                order_age = current_time - created_at
                
                # Bỏ qua đơn quá cũ (hơn 1 giờ)
                if order_age > MAX_ORDER_AGE:
                    continue
                    
                if d.get("status") == "pending":
                    has_pending_seller = True
                    pending_seller_count += 1
        except:
            pass
        
        # LAZY-FETCH: Skip nếu không có đơn nào
        if not has_pending_customer and not has_pending_seller:
            return  # Không gọi API, return ngay
        
        # Log có pending deposits
        if has_pending_customer or has_pending_seller:
            logging.info(f"🔍 Có {pending_customer_count} đơn nạp tiền customer và {pending_seller_count} đơn seller pending")
        
        # === FETCH TRANSACTIONS (only when needed) ===
        try:
            api_cfg = get_apicanhan_config()
            if has_valid_apicanhan_config(api_cfg):
                tx_list = fetch_apicanhan_transactions()
        except Exception as e:
            logging.debug(f"Lỗi fetch transactions: {e}")
        
        # === SELLER DEPOSITS CHECK (NAPSELLER) ===
        # Only runs if has_pending_seller is True (checked above)
        try:
            from seller_commands import check_seller_payment
            
            if has_pending_seller and tx_list:
                logging.debug(f"Checking {len(tx_list)} transactions for seller deposits...")
                for tx in tx_list[:20]:
                    if isinstance(tx, dict):
                        description = (
                            tx.get("addDescription", "") or 
                            tx.get("description", "") or 
                            tx.get("remark", "") or ""
                        )
                        if "NAPSELLER" in description.upper():
                            amount = float(tx.get("creditAmount", 0) or tx.get("amount", 0) or 0)
                            bank_txn_id = (
                                tx.get("refNo", "") or 
                                tx.get("transactionId", "") or 
                                tx.get("transactionNumber", "") or
                                str(tx.get("postingDate", ""))
                            )
                            
                            if amount > 0:
                                matched, reseller_id, user_id = await check_seller_payment(
                                    description, int(amount), bank_txn_id, context.bot
                                )
                                if matched:
                                    logging.info(f"✅ [AUTO] Seller deposit: {reseller_id} +{int(amount)}")
        except ImportError:
            pass
        except Exception as seller_err:
            logging.debug(f"Seller deposit check: {seller_err}")
        
        # === INVENTORY API DEPOSITS CHECK (NAPAPI) ===
        # Check for deposits made through Inventory API (content format: NAPAPI RS123 DEP...)
        try:
            if tx_list:
                for tx in tx_list[:20]:
                    if isinstance(tx, dict):
                        description = (
                            tx.get("addDescription", "") or 
                            tx.get("description", "") or 
                            tx.get("remark", "") or ""
                        ).upper().replace(" ", "").replace("_", "")  # Normalize
                        
                        if "NAPAPI" in description:
                            amount = float(tx.get("creditAmount", 0) or tx.get("amount", 0) or 0)
                            bank_txn_id = (
                                tx.get("refNo", "") or 
                                tx.get("transactionId", "") or 
                                tx.get("transactionNumber", "") or
                                str(tx.get("postingDate", ""))
                            )
                            
                            if amount > 0:
                                # Call Inventory API to verify and credit
                                await check_napapi_deposit(description, int(amount), bank_txn_id, context.bot)
        except Exception as napapi_err:
            logging.debug(f"NAPAPI deposit check: {napapi_err}")
        
        # === CUSTOMER DEPOSITS CHECK ===
        # Tìm các đơn nạp tiền customer đang chờ thanh toán
        deposit_orders = []
        for order_code, order in list(pending_orders.items()):
            if (order.get('product_type') == 'deposit' and 
                order.get('status') == 'pending_payment'):
                deposit_orders.append((order_code, order))
        
        if not deposit_orders or not tx_list:
            return
        # Kiểm tra từng đơn
        logging.info(f"🔍 Kiểm tra {len(deposit_orders)} đơn nạp tiền với {len(tx_list)} giao dịch")
        for order_code, order in deposit_orders:
            try:
                expected_amount = float(order.get('total_amount', 0))
                logging.debug(f"  → Đang kiểm tra đơn {order_code}, số tiền: {expected_amount}")
                
                is_paid, payment_info = match_payment_in_transactions(order_code, expected_amount, tx_list)
                
                if is_paid:
                    user_id = order.get('user_id')
                    new_balance = add_user_balance(user_id, int(expected_amount))
                    
                    # Xóa đơn
                    del pending_orders[order_code]
                    save_pending_orders()
                    
                    # Thông báo cho khách
                    try:
                        await context.bot.send_message(
                            chat_id=user_id,
                            text=(
                                f"✅ <b>NẠP TIỀN THÀNH CÔNG!</b>\n\n"
                                f"🆔 Mã: <code>{order_code}</code>\n"
                                f"💵 Số tiền: <b>+{format_balance(int(expected_amount))}</b>\n\n"
                                f"📊 Số dư mới: <b>{format_balance(new_balance)}</b>\n\n"
                                f"💡 Dùng số dư để verify phone!\n"
                                f"📱 Gửi /verify_phone để bắt đầu."
                            ),
                            parse_mode='HTML'
                        )
                    except Exception as e:
                        logging.warning(f"Không thể gửi thông báo nạp tiền cho user {user_id}: {e}")
                    
                    # Thông báo admin
                    await send_to_all_admins(
                        context.bot,
                        f"✅ <b>KHÁCH ĐÃ NẠP TIỀN (TỰ ĐỘNG)</b>\n\n"
                        f"🆔 Mã: <code>{order_code}</code>\n"
                        f"👤 Khách: {order.get('user_fullname', 'N/A')}\n"
                        f"💵 Số tiền: <b>{format_balance(int(expected_amount))}</b>\n"
                        f"📊 Số dư mới: {format_balance(new_balance)}",
                        parse_mode='HTML'
                    )
                    
                    logging.info(f"✅ [AUTO] Đã nạp {expected_amount}đ cho user {user_id}")
                    
            except Exception as e:
                logging.error(f"Lỗi kiểm tra thanh toán deposit {order_code}: {e}")
                continue
                
    except Exception as e:
        logging.debug(f"check_deposit_payments_job error: {e}")

async def note_start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Bắt đầu ghi chú khách hàng để nhắc nhở hết hạn."""
    global BOT_STOPPED
    if BOT_STOPPED:
        await handle_maintenance_message(update, context)
        return ConversationHandler.END
    if not is_admin(update.effective_user.id):
        await update.message.reply_text("❌ Chỉ admin mới dùng được lệnh này.")
        return ConversationHandler.END
    await update.message.reply_text(
        "📝 Nhập thông tin khách + sản phẩm + ngày mua.\n",
        parse_mode='HTML'
    )
    return NOTE_WAITING_INFO


async def note_receive_info(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Nhận thông tin đơn để lưu note."""
    if not is_admin(update.effective_user.id):
        await update.message.reply_text("❌ Chỉ admin mới dùng được lệnh này.")
        return ConversationHandler.END
    info_text = (update.message.text or "").strip()
    if not info_text:
        await update.message.reply_text("⚠️ Nội dung trống, vui lòng nhập lại.")
        return NOTE_WAITING_INFO
    context.user_data["note_info"] = info_text
    await update.message.reply_text(
        "⏰ Nhập ngày hết hạn (định dạng dd/mm/yyyy). Bot sẽ nhắc lúc 11:00 ngày đó.\n",
        parse_mode='HTML'
    )
    return NOTE_WAITING_EXPIRY


async def note_receive_expiry(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Nhận ngày hết hạn và lên lịch nhắc nhở."""
    if not is_admin(update.effective_user.id):
        await update.message.reply_text("❌ Chỉ admin mới dùng được lệnh này.")
        return ConversationHandler.END
    expiry_text = (update.message.text or "").strip()
    expiry_date = _parse_note_date(expiry_text)
    if not expiry_date:
        await update.message.reply_text(
            "⚠️ Sai định dạng ngày. Vui lòng nhập lại theo dạng dd/mm/yyyy (vd: 23/12/2025)."
        )
        return NOTE_WAITING_EXPIRY
    remind_at = expiry_date.replace(hour=11, minute=0, second=0, microsecond=0)
    now = get_vietnam_now()
    if remind_at <= now:
        await update.message.reply_text("⚠️ Thời gian nhắc phải ở tương lai. Nhập lại ngày hết hạn.")
        return NOTE_WAITING_EXPIRY
    info_text = context.user_data.get("note_info", "Không có nội dung")
    note_id = f"note_{int(time.time())}_{random.randint(1000, 9999)}"
    note = {
        "id": note_id,
        "info": info_text,
        "expiry_date": expiry_text,
        "remind_at": remind_at.isoformat(),
        "created_by": update.effective_user.id,
    }
    notes = load_notes()
    notes.append(note)
    save_notes(notes)
    scheduled = schedule_note_job(context.application, note)
    confirm_msg = (
        f"✅ Đã lưu note và sẽ nhắc lúc 11:00 ngày {expiry_text}.\n"
        f"📝 Nội dung: {info_text}"
    )
    if not scheduled:
        confirm_msg += "\n⚠️ Lưu ý: JobQueue không khả dụng, vui lòng kiểm tra cấu hình."
    await update.message.reply_text(confirm_msg)
    context.user_data.pop("note_info", None)
    return ConversationHandler.END


async def cmd_gift(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Bắt đầu gửi quà tặng cho tất cả khách hàng"""
    if not is_admin(update.effective_user.id):
        await update.message.reply_text("❌ Chỉ admin mới dùng được lệnh này.")
        return ConversationHandler.END
    
    await update.message.reply_text(
        "🎁 <b>GỬI QUÀ TẶNG ĐẶC BIỆT</b>\n\n"
        "Vui lòng gửi nội dung quà tặng:\n\n"
        "💡 <i>Bạn có thể gửi TEXT hoặc ẢNH (kèm caption)</i>\n"
        "💡 <i>Nội dung trong dấu \"...\" sẽ được đặt trong khung</i>\n"
        "💡 <i>Gõ /cancel để hủy</i>",
        parse_mode='HTML'
    )
    return WAITING_GIFT_MESSAGE

async def handle_gift_message(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Xử lý nội dung quà tặng - hỗ trợ cả text và ảnh"""
    if not is_admin(update.effective_user.id):
        return ConversationHandler.END
    
    # Kiểm tra xem có phải gửi ảnh không
    if update.message.photo:
        # Lấy ảnh có chất lượng cao nhất
        photo = update.message.photo[-1]
        photo_file_id = photo.file_id
        caption = update.message.caption or ""
        
        # Lưu thông tin ảnh vào context
        context.user_data['gift_photo_id'] = photo_file_id
        context.user_data['gift_caption'] = caption
        context.user_data['gift_type'] = 'photo'
        
        # Tạo preview message
        formatted_caption = f"📣 <b>Admin Đã Gửi Món Quà Yêu Thương Đến Bạn</b>\n\n{escape_html(caption)}" if caption else "📣 <b>Admin Đã Gửi Món Quà Yêu Thương Đến Bạn</b>"
        context.user_data['gift_formatted_caption'] = formatted_caption
        
        # Gửi preview
        await update.message.reply_text("📝 <b>XEM TRƯỚC NỘI DUNG SẼ GỬI:</b>", parse_mode='HTML')
        await context.bot.send_photo(
            chat_id=update.effective_chat.id,
            photo=photo_file_id,
            caption=formatted_caption,
            parse_mode='HTML'
        )
    else:
        # Xử lý text như cũ
        gift_content = update.message.text
        if not gift_content or len(gift_content.strip()) < 1:
            await update.message.reply_text("⚠️ Nội dung không được để trống. Vui lòng nhập lại hoặc /cancel để hủy.")
            return WAITING_GIFT_MESSAGE

        # Tìm nội dung trong dấu ngoặc kép
        import re
        match = re.search(r'"([\s\S]*)"', gift_content)

        if match:
            # Nếu có nội dung trong dấu ngoặc kép
            content_in_quotes = match.group(1).strip()
            content_outside_quotes = re.sub(r'"[\s\S]*"', '', gift_content).strip()

            # Escape HTML cho các phần nội dung
            escaped_outside = escape_html(content_outside_quotes) if content_outside_quotes else ""
            escaped_quotes = escape_html(content_in_quotes)

            formatted_message = f"📣 <b>Admin Đã Gửi Món Quà Yêu Thương Đến Bạn</b>\n\n"
            if escaped_outside:
                formatted_message += f"{escaped_outside}\n\n"
            
            # Hiển thị nội dung trong khung code (nền xám/đơn sắc)
            formatted_message += f"<pre>{escaped_quotes}</pre>"
        else:
            # Nếu không có dấu ngoặc kép, hoạt động như broadcast
            formatted_message = f"📣 <b>Admin Đã Gửi Món Quà Yêu Thương Đến Bạn</b>\n\n{escape_html(gift_content)}"
        
        context.user_data['gift_to_send'] = formatted_message
        context.user_data['gift_type'] = 'text'

        # Gửi tiêu đề xem trước
        await update.message.reply_text(
            "📝 <b>XEM TRƯỚC NỘI DUNG SẼ GỬI:</b>",
            parse_mode='HTML'
        )
        
        # Gửi nội dung quà tặng (sử dụng HTML thay vì MarkdownV2)
        preview_msg = await update.message.reply_text(
            formatted_message,
            parse_mode='HTML'
        )
    
    # Gửi nút xác nhận
    await update.message.reply_text(
        "Bạn có chắc muốn gửi tin này đến TẤT CẢ khách hàng không?",
        reply_markup=InlineKeyboardMarkup([
            [InlineKeyboardButton("✅ Có, gửi ngay", callback_data="confirm_send_gift")],
            [InlineKeyboardButton("❌ Hủy", callback_data="cancel_send_gift")]
        ])
    )
    return WAITING_GIFT_CONFIRM

async def confirm_send_gift(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Xác nhận và gửi quà tặng đi - hỗ trợ cả text và ảnh"""
    query = update.callback_query
    await query.answer()

    if query.data == "cancel_send_gift":
        await query.edit_message_text("❌ Đã hủy gửi quà tặng.")
        context.user_data.clear()
        return ConversationHandler.END

    gift_type = context.user_data.get('gift_type', 'text')
    
    # Kiểm tra dữ liệu gift
    if gift_type == 'photo':
        photo_id = context.user_data.get('gift_photo_id')
        if not photo_id:
            await query.edit_message_text("❌ Lỗi: Không tìm thấy ảnh. Vui lòng thử lại với /gift.")
            return ConversationHandler.END
        formatted_caption = context.user_data.get('gift_formatted_caption', '')
    else:
        gift_message = context.user_data.get('gift_to_send')
        if not gift_message:
            await query.edit_message_text("❌ Lỗi: Không tìm thấy nội dung quà. Vui lòng thử lại với /gift.")
            return ConversationHandler.END

    user_ids = get_all_user_ids()
    total_users = len(user_ids)
    if total_users == 0:
        await query.edit_message_text("⚠️ Không có khách hàng nào trong danh sách để gửi.")
        return ConversationHandler.END

    await query.edit_message_text(f"⏳ Bắt đầu gửi quà cho {total_users} khách hàng... Vui lòng chờ.")

    success_count = 0
    fail_count = 0
    blocked_count = 0
    
    for user_id in user_ids:
        try:
            if gift_type == 'photo':
                # Gửi ảnh với caption
                await context.bot.send_photo(
                    chat_id=user_id,
                    photo=photo_id,
                    caption=formatted_caption,
                    parse_mode='HTML'
                )
            else:
                # Gửi text như cũ
                max_message_length = 4096
                if len(gift_message) <= max_message_length:
                    await context.bot.send_message(chat_id=user_id, text=gift_message, parse_mode='HTML')
                else:
                    # Chia nhỏ tin nhắn thành các phần
                    chunk_size = 4000
                    parts = []
                    for i in range(0, len(gift_message), chunk_size):
                        parts.append(gift_message[i:i + chunk_size])
                    
                    for part in parts:
                        await context.bot.send_message(chat_id=user_id, text=part, parse_mode='HTML')
                        await asyncio.sleep(0.05)
            
            success_count += 1
            await asyncio.sleep(0.05)  # Delay nhỏ để tránh spam
        except Exception as e:
            error_msg = str(e).lower()
            if "chat not found" in error_msg or "user is deactivated" in error_msg:
                blocked_count += 1
            elif "forbidden" in error_msg:
                blocked_count += 1
            else:
                fail_count += 1
                logging.warning(f"Lỗi gửi quà cho user {user_id}: {e}")

    await query.message.reply_text(
        f"✅ <b>HOÀN TẤT GỬI QUÀ</b>\n\n"
        f"✅ Gửi thành công: <b>{success_count}</b>\n"
        f"❌ Gửi thất bại: <b>{fail_count}</b>\n"
        f"🚫 Bị chặn/không tìm thấy: <b>{blocked_count}</b>",
        parse_mode='HTML'
    )
    context.user_data.clear()
    return ConversationHandler.END

def get_all_user_ids():
    """Lấy danh sách tất cả user IDs từ users_list.json (loại bỏ key 'users')"""
    users = load_users_list()
    user_ids = []
    for key, value in users.items():
        if key == "users":  # Bỏ qua key "users" (là array)
            continue
        try:
            # Nếu value là dict có user_id
            if isinstance(value, dict) and "user_id" in value:
                user_ids.append(value["user_id"])
            # Hoặc key chính là user_id
            elif key.isdigit():
                user_ids.append(int(key))
        except (ValueError, TypeError):
            continue
    # Loại bỏ admin IDs khỏi danh sách
    user_ids = [uid for uid in user_ids if uid not in ADMIN_IDS]
    return list(set(user_ids))  # Loại bỏ trùng lặp

async def cmd_broadcast(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Command để bắt đầu broadcast - có thể dùng với args hoặc conversation"""
    global BOT_STOPPED
    if BOT_STOPPED:
        await handle_maintenance_message(update, context)
        return ConversationHandler.END
    if not is_admin(update.effective_user.id):
        await update.message.reply_text("❌ Chỉ admin mới dùng được lệnh này.")
        return ConversationHandler.END
    
    # Nếu có args, gửi ngay (backward compatible)
    if context.args:
        message = " ".join(context.args)
        asyncio.create_task(send_broadcast_message(update, context, message))
        return ConversationHandler.END
    
    # Nếu không có args, bắt đầu conversation
    await update.message.reply_text(
        "📢 <b>GỬI THÔNG BÁO CHO TẤT CẢ KHÁCH HÀNG</b>\n\n"
        "Vui lòng gửi nội dung thông báo:\n\n"
        "💡 <i>Bạn có thể gửi TEXT hoặc ẢNH (kèm caption)</i>\n"
        "💡 <i>Bạn có thể dùng HTML formatting (bold, italic, etc.)</i>\n"
        "💡 <i>Hoặc gõ /cancel để hủy</i>",
        parse_mode='HTML'
    )
    return WAITING_BROADCAST

async def handle_broadcast_message(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Xử lý nội dung thông báo từ admin - hỗ trợ cả text và ảnh"""
    global BOT_STOPPED
    if BOT_STOPPED:
        await handle_maintenance_message(update, context)
        return ConversationHandler.END
    if not is_admin(update.effective_user.id):
        await update.message.reply_text("❌ Chỉ admin mới dùng được lệnh này.")
        return ConversationHandler.END
    
    # Kiểm tra xem có phải gửi ảnh không
    if update.message.photo:
        # Lấy ảnh có chất lượng cao nhất
        photo = update.message.photo[-1]
        photo_file_id = photo.file_id
        caption = update.message.caption or ""
        
        asyncio.create_task(send_broadcast_photo(update, context, photo_file_id, caption))
        return ConversationHandler.END
    else:
        message = update.message.text
        if not message or len(message.strip()) < 1:
            await update.message.reply_text("⚠️ Nội dung thông báo không được để trống. Vui lòng nhập lại hoặc /cancel để hủy.")
            return WAITING_BROADCAST
        
        asyncio.create_task(send_broadcast_message(update, context, message))
        return ConversationHandler.END

def escape_html(text: str) -> str:
    """Escape các ký tự HTML đặc biệt để tránh lỗi khi gửi tin nhắn dài"""
    if not text:
        return text
    return (text.replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace('"', "&quot;")
                .replace("'", "&apos;"))

async def send_broadcast_message(update: Update, context: ContextTypes.DEFAULT_TYPE, message: str):
    """Gửi thông báo đến tất cả user"""
    user_ids = get_all_user_ids()
    total_users = len(user_ids)
    
    if total_users == 0:
        await update.message.reply_text("⚠️ Không có khách hàng nào trong danh sách.")
        return
    
    # Escape HTML trong message để tránh lỗi khi gửi nội dung dài
    escaped_message = escape_html(message)
    
    # Xác nhận trước khi gửi
    confirm_msg = await update.message.reply_text(
        f"📤 <b>XÁC NHẬN GỬI THÔNG BÁO</b>\n\n"
        f"📊 Số lượng khách hàng: <b>{total_users}</b>\n\n"
        f"📝 Nội dung:\n{message}\n\n"
        f"⏳ Đang gửi...",
        parse_mode='HTML'
    )
    
    sent = 0
    failed = 0
    blocked = 0
    
    for user_id in user_ids:
        try:
            # Header cho tin nhắn
            header = "📤 Admin Đã Nhắn Nhủ Yêu Thương Đến Bạn\n\n📝 Nội Dung:\n"
            header_len = len(header)
            
            # Telegram giới hạn 4096 ký tự mỗi tin nhắn
            max_message_length = 4096 - header_len - 10  # Trừ thêm 10 để an toàn
            
            # Nếu tin nhắn ngắn, gửi một lần
            if len(escaped_message) <= max_message_length:
                await context.bot.send_message(
                    chat_id=user_id,
                    text=header + escaped_message,
                    parse_mode='HTML'  # Sử dụng HTML parse mode
                )
            else:
                # Gửi header trước
                await context.bot.send_message(
                    chat_id=user_id,
                    text=header,
                    parse_mode='HTML'  # Sử dụng HTML parse mode
                )
                # Chia nhỏ nội dung và gửi từng phần
                chunk_size = 4000  # Chia nhỏ hơn một chút để an toàn
                for i in range(0, len(escaped_message), chunk_size):
                    chunk = escaped_message[i:i + chunk_size]
                    await context.bot.send_message(
                        chat_id=user_id,
                        text=chunk,
                        parse_mode='HTML'  # Sử dụng HTML parse mode
                    )
                    await asyncio.sleep(0.05)  # Delay nhỏ giữa các tin nhắn
            
            sent += 1
            # Delay nhỏ để tránh rate limit
            await asyncio.sleep(0.05)
        except Exception as e:
            error_msg = str(e).lower()
            if "chat not found" in error_msg or "user is deactivated" in error_msg:
                blocked += 1
            elif "forbidden" in error_msg:
                blocked += 1
            else:
                failed += 1
                logging.error(f"Failed to send broadcast to {user_id}: {e}")
    
    # Cập nhật kết quả
    result_msg = (
        f"✅ <b>HOÀN THÀNH GỬI THÔNG BÁO</b>\n\n"
        f"📊 Tổng số khách hàng: <b>{total_users}</b>\n"
        f"✅ Đã gửi thành công: <b>{sent}</b>\n"
        f"❌ Lỗi gửi: <b>{failed}</b>\n"
        f"🚫 Bị chặn/không tìm thấy: <b>{blocked}</b>"
    )
    
    try:
        await confirm_msg.edit_text(result_msg, parse_mode='HTML')
    except:
        await update.message.reply_text(result_msg, parse_mode='HTML')
    
    # Thông báo cho admin khác
    # Hiển thị đầy đủ nội dung, nếu quá dài thì chia nhỏ
    admin_header = (
        f"📢 <b>ADMIN ĐÃ GỬI THÔNG BÁO</b>\n\n"
        f"👤 Admin: {update.effective_user.full_name} (ID: {update.effective_user.id})\n"
        f"📊 Đã gửi đến: <b>{sent}/{total_users}</b> khách hàng\n"
        f"📝 Nội dung:\n"
    )
    
    # Telegram giới hạn 4096 ký tự, trừ header đi
    max_admin_length = 4096 - len(admin_header) - 10
    
    if len(escaped_message) <= max_admin_length:
        admin_notification = admin_header + escaped_message
        await send_to_all_admins(context.bot, admin_notification, parse_mode='HTML')
    else:
        # Gửi header trước
        await send_to_all_admins(context.bot, admin_header, parse_mode='HTML')
        # Chia nhỏ và gửi từng phần
        chunk_size = 4000
        for i in range(0, len(escaped_message), chunk_size):
            chunk = escaped_message[i:i + chunk_size]
            await send_to_all_admins(context.bot, chunk, parse_mode='HTML')
            await asyncio.sleep(0.1)

async def send_broadcast_photo(update: Update, context: ContextTypes.DEFAULT_TYPE, photo_file_id: str, caption: str = ""):
    """Gửi ảnh thông báo đến tất cả user"""
    user_ids = get_all_user_ids()
    total_users = len(user_ids)
    
    if total_users == 0:
        await update.message.reply_text("⚠️ Không có khách hàng nào trong danh sách.")
        return
    
    # Tạo caption với header
    formatted_caption = f"📤 Admin Đã Nhắn Nhủ Yêu Thương Đến Bạn\n\n{escape_html(caption)}" if caption else "📤 Admin Đã Nhắn Nhủ Yêu Thương Đến Bạn"
    
    # Xác nhận trước khi gửi
    confirm_msg = await update.message.reply_text(
        f"📤 <b>XÁC NHẬN GỬI ẢNH THÔNG BÁO</b>\n\n"
        f"📊 Số lượng khách hàng: <b>{total_users}</b>\n"
        f"📝 Caption: {caption if caption else '(không có)'}\n\n"
        f"⏳ Đang gửi...",
        parse_mode='HTML'
    )
    
    sent = 0
    failed = 0
    blocked = 0
    
    for user_id in user_ids:
        try:
            await context.bot.send_photo(
                chat_id=user_id,
                photo=photo_file_id,
                caption=formatted_caption,
                parse_mode='HTML'
            )
            sent += 1
            await asyncio.sleep(0.05)  # Delay nhỏ để tránh rate limit
        except Exception as e:
            error_msg = str(e).lower()
            if "chat not found" in error_msg or "user is deactivated" in error_msg:
                blocked += 1
            elif "forbidden" in error_msg:
                blocked += 1
            else:
                failed += 1
                logging.error(f"Failed to send broadcast photo to {user_id}: {e}")
    
    # Cập nhật kết quả
    result_msg = (
        f"✅ <b>HOÀN THÀNH GỬI ẢNH THÔNG BÁO</b>\n\n"
        f"📊 Tổng số khách hàng: <b>{total_users}</b>\n"
        f"✅ Đã gửi thành công: <b>{sent}</b>\n"
        f"❌ Lỗi gửi: <b>{failed}</b>\n"
        f"🚫 Bị chặn/không tìm thấy: <b>{blocked}</b>"
    )
    
    try:
        await confirm_msg.edit_text(result_msg, parse_mode='HTML')
    except:
        await update.message.reply_text(result_msg, parse_mode='HTML')
    
    # Thông báo cho admin khác
    admin_notification = (
        f"📢 <b>ADMIN ĐÃ GỬI ẢNH THÔNG BÁO</b>\n\n"
        f"👤 Admin: {update.effective_user.full_name} (ID: {update.effective_user.id})\n"
        f"📊 Đã gửi đến: <b>{sent}/{total_users}</b> khách hàng\n"
        f"📝 Caption: {caption if caption else '(không có)'}"
    )
    await send_to_all_admins(context.bot, admin_notification, parse_mode='HTML')

async def cancel_broadcast(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Hủy broadcast"""
    await update.message.reply_text("❌ Đã hủy gửi thông báo.")
    return ConversationHandler.END

async def cmd_test_admin(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Lệnh test để kiểm tra gửi thông báo cho tất cả admin"""
    global BOT_STOPPED
    if BOT_STOPPED:
        await handle_maintenance_message(update, context)
        return
    if not is_admin(update.effective_user.id):
        await update.message.reply_text("❌ Chỉ admin mới có thể sử dụng lệnh này.")
        return
    
    test_msg = (
        f"🧪 <b>TEST THÔNG BÁO ADMIN</b>\n\n"
        f"Admin {update.effective_user.id} đã gửi lệnh test.\n"
        f"Thời gian: {get_vietnam_now().strftime('%d/%m/%Y %H:%M:%S')}"
    )
    
    await send_to_all_admins(context.bot, test_msg, parse_mode='HTML')
    await update.message.reply_text(
        f"✅ Đã gửi thông báo test cho {len(ADMIN_IDS)} admin:\n" + 
        "\n".join([f"• {admin_id}" for admin_id in ADMIN_IDS])
    )

async def cmd_confirm_order(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Admin command để xác nhận thanh toán thủ công khi API không hoạt động"""
    global BOT_STOPPED
    if BOT_STOPPED:
        await handle_maintenance_message(update, context)
        return
    if not is_admin(update.message.from_user.id):
        await update.message.reply_text("❌ Chỉ admin mới có thể sử dụng lệnh này.")
        return
    
    if not context.args or len(context.args) == 0:
        await update.message.reply_text(
            "📝 <b>Cách sử dụng:</b>\n"
            "<code>/confirm_order &lt;mã_đơn&gt;</code>\n\n"
            "Ví dụ: <code>/confirm_order ABC123</code>",
            parse_mode='HTML'
        )
        return
    
    order_code = context.args[0].upper().strip()
    
    if order_code not in pending_orders:
        await update.message.reply_text(f"❌ Không tìm thấy đơn hàng <code>{order_code}</code>", parse_mode='HTML')
        return
    
    order = pending_orders[order_code]
    
    # Xác nhận thanh toán thủ công
    logging.info(f"👤 Admin {update.message.from_user.id} xác nhận thanh toán thủ công cho đơn {order_code}")
    
    # Gọi logic giao hàng
    success, message = await deliver_order_logic(order_code, context)
    
    if success:
        await update.message.reply_text(
            f"✅ <b>Đã xác nhận thanh toán thành công!</b>\n\n"
            f"🆔 Mã đơn: <code>{order_code}</code>\n"
            f"💰 Số tiền: <b>{order['total']} VNĐ</b>\n"
            f"📦 Thông tin tài khoản đã được gửi đến khách hàng.",
            parse_mode='HTML'
        )
        
        # Thông báo cho tất cả admin về việc xác nhận thủ công
        try:
            admin_confirm_msg = (
                f"👤 <b>ADMIN XÁC NHẬN THỦ CÔNG</b>\n"
                f"🆔 Mã đơn: <b>{order_code}</b>\n"
                f"👨‍💼 Admin: {update.message.from_user.full_name} (ID: {update.message.from_user.id})\n"
                f"👤 Khách hàng: {order['fullname']} (ID: {order['user_id']})\n"
                f"📦 {order['product_name']} x {order['quantity']}\n"
                f"💰 <b>{order['total']} VNĐ</b>\n\n"
                f"✅ Đơn hàng đã được xác nhận và giao thành công!"
            )
            await send_to_all_admins(context.bot, admin_confirm_msg, parse_mode='HTML')
        except Exception as e:
            logging.error(f"Lỗi gửi thông báo xác nhận thủ công cho admin: {e}")
        
        # Gửi thông báo cho khách hàng
        try:
            await context.bot.send_message(
                chat_id=order['user_id'],
                text=(
                    f"✅ <b>ĐÃ XÁC NHẬN THANH TOÁN!</b>\n\n"
                    f"🆔 Mã đơn: <code>{order_code}</code>\n"
                    f"💰 Số tiền: <b>{order['total']} VNĐ</b>\n\n"
                    f"🎉 <b>Đơn hàng đã được xử lý thành công!</b>\n"
                    f"📦 Thông tin tài khoản đã được gửi đến bạn."
                ),
                parse_mode='HTML'
            )
        except Exception as e:
            logging.error(f"Lỗi gửi thông báo cho khách: {e}")
    else:
        await update.message.reply_text(
            f"❌ <b>Lỗi xử lý đơn hàng:</b>\n{message}",
            parse_mode='HTML'
        )

async def cmd_list_announcements(update: Update, context: ContextTypes.DEFAULT_TYPE):
    global BOT_STOPPED
    if BOT_STOPPED:
        await handle_maintenance_message(update, context)
        return
    if not is_admin(update.effective_user.id):
        await update.message.reply_text("❌ Chỉ admin mới dùng được lệnh này.")
        return
    announcements = load_announcements()
    if not announcements:
        await update.message.reply_text("📭 Chưa có thông báo nào.")
        return
    text = "📢 <b>DANH SÁCH THÔNG BÁO:</b>\n\n"
    for i, ann in enumerate(announcements[-10:], 1):
        status = "✅" if ann.get("active", True) else "❌"
        text += f"{i}. {status} <b>{ann.get('title', 'N/A')}</b>\n"
        text += f"   {ann.get('message', '')[:50]}...\n"
        text += f"   ID: {ann.get('id', 'N/A')}\n\n"
    keyboard = []
    for ann in announcements[-5:]:
        if ann.get("active", True):
            keyboard.append([
                InlineKeyboardButton(
                    f"❌ Tắt: {ann.get('title', 'N/A')[:20]}",
                    callback_data=f"toggle_ann_{ann.get('id', '')}"
                )
            ])
    await update.message.reply_text(text, parse_mode='HTML', reply_markup=InlineKeyboardMarkup(keyboard) if keyboard else None)

async def toggle_announcement(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    if not is_admin(query.from_user.id):
        try:
            await query.edit_message_text("❌ Chỉ admin mới dùng được.")
        except Exception as e:
            if "Message is not modified" not in str(e):
                logging.debug(f"Lỗi edit message (không nghiêm trọng): {e}")
        return
    ann_id = query.data.split("_")[-1]
    announcements = load_announcements()
    for ann in announcements:
        if ann.get("id") == ann_id:
            ann["active"] = not ann.get("active", True)
            save_announcements(announcements)
            status = "✅ Bật" if ann["active"] else "❌ Tắt"
            try:
                await query.edit_message_text(f"{status} thông báo: {ann.get('title', 'N/A')}")
            except Exception as e:
                if "Message is not modified" not in str(e):
                    logging.debug(f"Lỗi edit message (không nghiêm trọng): {e}")
            return
    try:
        await query.edit_message_text("⚠️ Không tìm thấy thông báo.")
    except Exception as e:
        if "Message is not modified" not in str(e):
            logging.debug(f"Lỗi edit message (không nghiêm trọng): {e}")

# ==============================================================================
# 7. CÁC HÀM KHÁC
# ==============================================================================

async def back_to_home(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    await start(update, context)

async def cancel(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text('🚫 Đã hủy.')
    return ConversationHandler.END

# ==============================================================================
# 8. XỬ LÝ CHAT ĐƠN GIẢN
# ==============================================================================

greeted_users = set()

async def handle_email_for_slot_order(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Xử lý email từ khách hàng cho sản phẩm Slot"""
    if not update.message or not update.message.text:
        return False
    
    user = update.effective_user
    user_text = update.message.text.strip()
    user_id = user.id
    
    # Không validate format - chấp nhận bất kỳ text nào
    if not user_text or len(user_text) < 3:  # Chỉ kiểm tra độ dài tối thiểu
        return False
    
    # Tìm đơn hàng đang chờ email của user này
    order_code_to_complete = None
    for order_code, order in pending_orders.items():
        if (order.get('user_id') == user_id and 
            order.get('waiting_for_email') == True):
            order_code_to_complete = order_code
            break
    
    if not order_code_to_complete:
        return False
    
    # Ghi email vào Google Sheets
    try:
        order = pending_orders[order_code_to_complete]
        db = get_db()
        ws_product = get_worksheet_by_name(db, order['sheet_worksheet'])
        
        if not ws_product:
            await update.message.reply_text(
                "❌ Lỗi: Không tìm thấy sheet. Vui lòng liên hệ admin.",
                reply_markup=get_reply_keyboard(update.effective_user.id if update and update.effective_user else None)
            )
            return True
        
        # Tìm dòng trống đầu tiên (bỏ qua header)
        all_rows = ws_product.get_all_values()
        
        # Lấy số dòng thực tế của sheet (tối đa 999 để tránh lỗi API)
        actual_max_rows = min(len(all_rows), 999)  # Google Sheet giới hạn 999 dòng
        
        # Tìm dòng trống đầu tiên
        next_row = None
        for i in range(1, actual_max_rows):  # Bỏ qua header (row 0)
            if i >= len(all_rows) or (len(all_rows[i]) == 0 or all_rows[i][0].strip() == ""):
                next_row = i + 1  # gspread dùng 1-based index
                break
        
        # Nếu không tìm thấy dòng trống, tìm dòng có thể ghi đè
        if next_row is None:
            for i in range(1, actual_max_rows):
                row = all_rows[i] if i < len(all_rows) else []
                # Tìm dòng có trạng thái "CHƯA BÁN" hoặc trống
                if len(row) < 2 or (row[1].strip().upper() in ["", "CHƯA ADD", "CHƯA BÁN"]):
                    next_row = i + 1
                    break
        
        # Nếu vẫn không tìm được, dùng dòng cuối nhưng KHÔNG vượt quá 999
        if next_row is None:
            next_row = min(actual_max_rows, 999)
        
        # Đảm bảo next_row không vượt quá giới hạn
        if next_row > 999:
            next_row = 999
            logging.warning(f"⚠️ Sheet {order['sheet_worksheet']} đã đầy, ghi đè dòng 999")
        
        # Ghi vào sheet: cột A (email), cột C (ngày), cột E (ID đơn)
        cells_to_update = [
            gspread.Cell(next_row, 1, user_text),  # Cột A: Email
            gspread.Cell(next_row, 3, order['delivery_date']),  # Cột C: Ngày tháng
            gspread.Cell(next_row, 5, str(order_code_to_complete))  # Cột E: ID đơn hàng
        ]
        ws_product.update_cells(cells_to_update)
        clear_cache()
        
        # Cập nhật thông tin email
        order['email'] = user_text
        order['waiting_for_email'] = False
        order['order_type'] = 'slot'
        if 'email_waiting_start' in order:
            del order['email_waiting_start']
        
        # Thông báo cho khách hàng - TRẠNG THÁI ĐANG XỬ LÝ
        customer_msg = (
            f"✅ <b>Đã nhận email của bạn!</b>\n\n"
            f"📧 Email: <code>{user_text}</code>\n"
            f"🆔 Mã đơn: <b>{order_code_to_complete}</b>\n\n"
            f"📊 <b>Trạng thái: ĐANG XỬ LÝ</b>\n"
            f"⏳ Admin đang xử lý đơn hàng của bạn, vui lòng chờ..."
        )
        await update.message.reply_text(
            customer_msg,
            parse_mode='HTML',
            reply_markup=get_reply_keyboard(update.effective_user.id if update and update.effective_user else None)
        )
        
        # Xóa message QR code nếu có
        try:
            if "message_id" in order and "chat_id" in order and order["message_id"] and order["chat_id"]:
                await context.bot.delete_message(
                    chat_id=order["chat_id"],
                    message_id=order["message_id"]
                )
                logging.info(f"✅ Đã xóa message QR code cho đơn {order_code_to_complete}")
        except Exception as e:
            error_msg = str(e)
            if "message to delete not found" not in error_msg.lower() and "message can't be deleted" not in error_msg.lower():
                logging.debug(f"Không thể xóa message QR code cho đơn {order_code_to_complete}: {e}")
        
        # Thông báo cho admin với 2 nút: ĐANG XỬ LÝ và ĐÃ XỬ LÝ
        product_name = order.get('product_name', 'Sản phẩm Slot')
        admin_msg = (
            f"🔔 <b>ĐƠN HÀNG SLOT CẦN XỬ LÝ!</b>\n\n"
            f"🆔 Mã đơn: <b>{order_code_to_complete}</b>\n"
            f"👤 Khách hàng: {order['fullname']} (ID: {user_id})\n"
            f"📦 <b>{product_name}</b> x {order['quantity']}\n"
            f"📧 Email: <code>{user_text}</code>\n"
            f"💰 <b>{order['total']} VNĐ</b>\n\n"
            f"📋 Đã ghi vào sheet: <b>{order['sheet_worksheet']}</b>"
        )
        admin_keyboard = [
            [
                InlineKeyboardButton("⏳ ĐANG XỬ LÝ", callback_data=f"slot_processing_{order_code_to_complete}"),
                InlineKeyboardButton("✅ ĐÃ XỬ LÝ", callback_data=f"slot_done_{order_code_to_complete}")
            ]
        ]
        await send_admin_message_with_keyboard(context.bot, admin_msg, admin_keyboard)
        
        # Chuyển đơn vào active_orders
        active_orders[order_code_to_complete] = order
        del pending_orders[order_code_to_complete]
        try:
            with open(PENDING_ORDERS_FILE, "w", encoding="utf-8") as f:
                json.dump(pending_orders, f, ensure_ascii=False, indent=2)
        except:
            pass
        
        # Lưu active_orders
        save_active_orders()
        
        logging.info(f"✅ Đã xử lý email cho đơn Slot {order_code_to_complete}, chờ admin xử lý")
        return True
    except Exception as e:
        logging.error(f"Lỗi khi xử lý email cho đơn Slot: {e}", exc_info=True)
        await update.message.reply_text(
            "❌ Đã xảy ra lỗi. Vui lòng liên hệ admin.",
            reply_markup=get_reply_keyboard(update.effective_user.id if update and update.effective_user else None)
        )
        return True


async def handle_slot_processing_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Xử lý khi admin bấm ĐANG XỬ LÝ cho slot order"""
    query = update.callback_query
    await query.answer()
    order_code = query.data.replace("slot_processing_", "")
    
    if order_code not in active_orders:
        try:
            await query.edit_message_text("⚠️ Đơn hàng không tồn tại hoặc đã xử lý.")
        except:
            pass
        return
    
    order = active_orders[order_code]
    
    # Gửi thông báo cho khách kiểm tra email + nút ĐÃ CHẤP NHẬN
    customer_keyboard = InlineKeyboardMarkup([
        [InlineKeyboardButton("✅ ĐÃ CHẤP NHẬN", callback_data=f"customer_slot_accepted_{order_code}")]
    ])
    await context.bot.send_message(
        chat_id=order['user_id'],
        text=(
            f"⏳ <b>ĐANG XỬ LÝ ĐƠN HÀNG</b>\n\n"
            f"Đơn hàng của bạn đang được admin xử lý.\n"
            f"📧 <b>Vui lòng kiểm tra email và chấp nhận lời mời!</b>\n\n"
            f"Sau khi chấp nhận xong, bấm nút bên dưới:"
        ),
        parse_mode='HTML',
        reply_markup=customer_keyboard
    )
    
    try:
        await query.edit_message_text(
            f"⏳ Đã thông báo khách kiểm tra email - đơn {order_code}\n"
            f"⏳ Đang chờ khách bấm ĐÃ CHẤP NHẬN...",
            parse_mode='HTML'
        )
    except:
        pass
    
    logging.info(f"📧 Admin đã bấm ĐANG XỬ LÝ cho đơn slot {order_code}")


async def handle_customer_slot_accepted_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Xử lý khi khách bấm ĐÃ CHẤP NHẬN cho đơn slot"""
    query = update.callback_query
    await query.answer("✅ Đã ghi nhận!")
    order_code = query.data.replace("customer_slot_accepted_", "")
    
    if order_code not in active_orders:
        try:
            await query.edit_message_text("⚠️ Đơn hàng không tồn tại hoặc đã hoàn thành.")
        except:
            pass
        return
    
    order = active_orders[order_code]
    
    # Cập nhật message cho khách
    try:
        await query.edit_message_text(
            f"✅ <b>ĐÃ GHI NHẬN</b>\n\n"
            f"Cảm ơn bạn đã xác nhận. Admin đang hoàn tất đơn hàng...",
            parse_mode='HTML'
        )
    except:
        pass
    
    # Gửi thông báo cho admin với nút ĐÃ HOÀN THÀNH
    admin_msg = (
        f"🎉 <b>KHÁCH ĐÃ CHẤP NHẬN!</b>\n\n"
        f"🆔 Mã đơn: <b>{order_code}</b>\n"
        f"👤 Khách: {order.get('fullname', 'N/A')} (ID: {order.get('user_id')})\n"
        f"📦 <b>{order.get('product_name')}</b> x {order.get('quantity')}\n"
        f"💰 <b>{order.get('total')} VNĐ</b>\n\n"
        f"✅ Khách đã chấp nhận lời mời email. Bấm ĐÃ HOÀN THÀNH để kết thúc đơn."
    )
    admin_keyboard = [
        [InlineKeyboardButton("✅ ĐÃ HOÀN THÀNH", callback_data=f"slot_complete_{order_code}")]
    ]
    await send_admin_message_with_keyboard(context.bot, admin_msg, admin_keyboard)
    
    logging.info(f"✅ Khách đã bấm ĐÃ CHẤP NHẬN cho đơn slot {order_code}")


async def handle_slot_complete_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Xử lý khi admin bấm ĐÃ HOÀN THÀNH cho slot order (sau khi khách chấp nhận)"""
    query = update.callback_query
    await query.answer("✅ Đã hoàn thành đơn hàng!")
    order_code = query.data.replace("slot_complete_", "")
    
    if order_code not in active_orders:
        try:
            await query.edit_message_text("⚠️ Đơn hàng không tồn tại hoặc đã hoàn thành.")
        except:
            pass
        return
    
    order = active_orders[order_code]
    
    # Gửi cảm ơn cho khách
    await context.bot.send_message(
        chat_id=order['user_id'],
        text=(
            f"🎉 <b>ĐƠN HÀNG HOÀN THÀNH!</b>\n\n"
            f"🆔 Mã đơn: <b>{order_code}</b>\n"
            f"📦 Sản phẩm: {order.get('product_name')}\n\n"
            f"✅ Đơn hàng của bạn đã được xử lý thành công!\n"
            f"🙏 Cảm ơn bạn đã sử dụng dịch vụ của chúng tôi!\n\n"
            f"💬 Nếu cần hỗ trợ, liên hệ:\n"
            f"📞 Zalo: {ZALO_ADMIN_1} hoặc {ZALO_ADMIN_2}\n"
            f"💬 Telegram: {TELEGRAM_ADMIN_USERNAME}"
        ),
        parse_mode='HTML',
        reply_markup=get_reply_keyboard(update.effective_user.id if update and update.effective_user else None)
    )
    
    # Cập nhật message admin
    try:
        await query.edit_message_text(
            f"✅ <b>ĐÃ HOÀN THÀNH</b> - Đơn {order_code}\n"
            f"📦 {order.get('product_name')} x {order.get('quantity')}\n"
            f"💰 {order.get('total')} VNĐ",
            parse_mode='HTML'
        )
    except:
        pass
    
    # Xóa đơn khỏi active_orders
    del active_orders[order_code]
    save_active_orders()
    
    logging.info(f"✅ Admin đã hoàn thành đơn slot {order_code}")


async def handle_slot_done_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Xử lý khi admin bấm ĐÃ XỬ LÝ cho slot order"""
    query = update.callback_query
    await query.answer("✅ Đã xác nhận hoàn thành!")
    order_code = query.data.replace("slot_done_", "")
    
    if order_code not in active_orders:
        try:
            await query.edit_message_text("⚠️ Đơn hàng không tồn tại.")
        except:
            pass
        return
    
    order = active_orders[order_code]
    
    # Gửi thông báo thành công + cảm ơn cho khách
    success_msg = (
        f"✅ <b>ĐƠN HÀNG HOÀN THÀNH!</b>\n\n"
        f"🆔 Mã đơn: <b>{order_code}</b>\n"
        f"📦 {order.get('product_name', 'Sản phẩm Slot')}\n\n"
        f"🎉 Slot đã được thêm vào farm của bạn!\n"
        f"💌 Cảm ơn bạn đã sử dụng dịch vụ!"
    )
    keyboard_new = [[InlineKeyboardButton("🔄 Mua đơn mới", callback_data='show_menu')]]
    await context.bot.send_message(
        chat_id=order['user_id'], 
        text=success_msg, 
        parse_mode='HTML',
        reply_markup=InlineKeyboardMarkup(keyboard_new)
    )
    
    # Xóa đơn khỏi active
    del active_orders[order_code]
    save_active_orders()
    
    # Update admin message
    try:
        await query.edit_message_text(
            f"✅ Đã hoàn thành đơn slot {order_code}",
            parse_mode='HTML'
        )
    except:
        pass
    
    logging.info(f"✅ Admin đã xử lý xong đơn slot {order_code}")


async def handle_link_for_special_order(update: Update, context: ContextTypes.DEFAULT_TYPE):

    """Xử lý link từ khách hàng cho sản phẩm SheerID hoặc Checkout"""
    if not update.message or not update.message.text:
        return False
    
    user = update.effective_user
    user_text = update.message.text.strip()
    user_id = user.id
    
    # Kiểm tra text có phải là link không (có http:// hoặc https://)
    if not user_text or not ('http://' in user_text.lower() or 'https://' in user_text.lower()):
        return False
    
    # Tìm đơn hàng đang chờ link của user này - kiểm tra cả pending_orders và active_orders
    order_code_to_complete = None
    order_type = None
    is_retry = False  # Flag đánh dấu đây là link lần 2 (sau khi LINK LỖI)
    
    # Kiểm tra trong pending_orders trước
    for order_code, order in pending_orders.items():
        if (order.get('user_id') == user_id and 
            order.get('waiting_for_link') == True):
            order_code_to_complete = order_code
            order_type = order.get('waiting_type', '')  # 'sheerid' hoặc 'checkout'
            break
    
    # Nếu không tìm thấy trong pending, kiểm tra trong active_orders (link lần 2)
    if not order_code_to_complete:
        for order_code, order in active_orders.items():
            if (order.get('user_id') == user_id and 
                order.get('waiting_for_new_link') == True):
                order_code_to_complete = order_code
                order_type = order.get('waiting_type', '')
                is_retry = True
                break
    
    if not order_code_to_complete or not order_type:
        return False
    
    # Ghi link vào Google Sheets
    try:
        if is_retry:
            order = active_orders[order_code_to_complete]
        else:
            order = pending_orders[order_code_to_complete]
        
        db = get_db()
        ws_product = get_worksheet_by_name(db, order['sheet_worksheet'])
        
        if not ws_product:
            await update.message.reply_text(
                "❌ Lỗi: Không tìm thấy sheet. Vui lòng liên hệ admin.",
                reply_markup=get_reply_keyboard(update.effective_user.id if update and update.effective_user else None)
            )
            return True
        
        # Tìm dòng trống đầu tiên (bỏ qua header)
        all_rows = ws_product.get_all_values()
        
        # Lấy số dòng thực tế của sheet (tối đa 999 để tránh lỗi API)
        actual_max_rows = min(len(all_rows), 999)  # Google Sheet giới hạn 999 dòng
        
        # Tìm dòng trống đầu tiên
        next_row = None
        for i in range(1, actual_max_rows):  # Bỏ qua header (row 0)
            if i >= len(all_rows) or (len(all_rows[i]) == 0 or all_rows[i][0].strip() == ""):
                next_row = i + 1  # gspread dùng 1-based index
                break
        
        # Nếu không tìm thấy dòng trống, tìm dòng có thể ghi đè
        if next_row is None:
            for i in range(1, actual_max_rows):
                row = all_rows[i] if i < len(all_rows) else []
                # Tìm dòng trống hoặc dòng có trạng thái "CHƯA BÁN"
                if len(row) < 2 or (row[1].strip().upper() in ["", "CHƯA ADD", "CHƯA BÁN"]):
                    next_row = i + 1
                    break
        
        # Nếu vẫn không tìm được, dùng dòng cuối nhưng KHÔNG vượt quá 999
        if next_row is None:
            next_row = min(actual_max_rows, 999)
        
        # Đảm bảo next_row không vượt quá giới hạn
        if next_row > 999:
            next_row = 999
            logging.warning(f"⚠️ Sheet {order['sheet_worksheet']} đã đầy, ghi đè dòng 999")
        
        # Ghi vào sheet: cột A (link), cột C (ngày), cột E (ID đơn)
        # Xác định loại link
        if order_type == 'sheerid':
            link_type_text = "Link SheerID"
            link_type_upper = "SHEERID VERIFY"
        elif order_type == 'verify_link':
            link_type_text = "Link SheerID"  # Verify cũng dùng SheerID link
            link_type_upper = "VERIFY (LINK)"
        else:
            link_type_text = "Link Checkout"
            link_type_upper = "CHECKOUT"
            
        cells_to_update = [
            gspread.Cell(next_row, 1, user_text),  # Cột A: Link
            gspread.Cell(next_row, 3, order['delivery_date']),  # Cột C: Ngày tháng
            gspread.Cell(next_row, 5, str(order_code_to_complete))  # Cột E: ID đơn hàng
        ]
        ws_product.update_cells(cells_to_update)
        clear_cache()
        
        # Cập nhật thông tin link
        order['link'] = user_text
        order['waiting_for_link'] = False
        order['waiting_for_new_link'] = False
        if 'link_waiting_start' in order:
            del order['link_waiting_start']
        
        # Thông báo cho khách hàng - TRẠNG THÁI ĐANG XỬ LÝ
        customer_msg = (
            f"✅ <b>Đã nhận {link_type_text} của bạn!</b>\n\n"
            f"🔗 Link: <code>{user_text[:50]}{'...' if len(user_text) > 50 else ''}</code>\n"
            f"🆔 Mã đơn: <b>{order_code_to_complete}</b>\n\n"
            f"📊 <b>Trạng thái: ĐANG XỬ LÝ</b>\n"
            f"⏳ Admin đang xử lý đơn hàng của bạn, vui lòng chờ..."
        )
        await update.message.reply_text(
            customer_msg,
            parse_mode='HTML',
            reply_markup=get_reply_keyboard(update.effective_user.id if update and update.effective_user else None)
        )
        
        # Xóa message QR code nếu có
        try:
            if "message_id" in order and "chat_id" in order and order["message_id"] and order["chat_id"]:
                await context.bot.delete_message(
                    chat_id=order["chat_id"],
                    message_id=order["message_id"]
                )
                logging.info(f"✅ Đã xóa message QR code cho đơn {order_code_to_complete}")
        except Exception as e:
            error_msg = str(e)
            if "message to delete not found" not in error_msg.lower() and "message can't be deleted" not in error_msg.lower():
                logging.debug(f"Không thể xóa message QR code cho đơn {order_code_to_complete}: {e}")
        
        # Thông báo cho admin với 2 nút: LINK LỖI và ĐÃ XỬ LÝ
        product_name = order.get('product_name', 'Sản phẩm')
        admin_msg = (
            f"🔔 <b>ĐƠN HÀNG {link_type_upper} CẦN XỬ LÝ!</b>\n\n"
            f"🆔 Mã đơn: <b>{order_code_to_complete}</b>\n"
            f"👤 Khách hàng: {order.get('fullname', 'N/A')} (ID: {user_id})\n"
            f"📦 <b>{product_name}</b> x {order['quantity']}\n"
            f"🔗 {link_type_text}: <code>{user_text}</code>\n"
            f"💰 <b>{order['total']} VNĐ</b>\n\n"
            f"📋 Đã ghi vào sheet: <b>{order['sheet_worksheet']}</b>"
        )
        admin_keyboard = [
            [
                InlineKeyboardButton("❌ LINK LỖI", callback_data=f"link_error_{order_code_to_complete}"),
                InlineKeyboardButton("✅ ĐÃ XỬ LÝ", callback_data=f"link_done_{order_code_to_complete}")
            ]
        ]
        await send_admin_message_with_keyboard(context.bot, admin_msg, admin_keyboard)
        
        # Chuyển đơn vào active_orders (nếu chưa có)
        if not is_retry:
            # Di chuyển từ pending_orders sang active_orders
            active_orders[order_code_to_complete] = order
            del pending_orders[order_code_to_complete]
            try:
                with open(PENDING_ORDERS_FILE, "w", encoding="utf-8") as f:
                    json.dump(pending_orders, f, ensure_ascii=False, indent=2)
            except:
                pass
        
        # Lưu active_orders
        save_active_orders()
        
        # Bắt đầu job reminder 3 phút
        asyncio.create_task(admin_order_reminder_loop(order_code_to_complete, order_type, context))
        
        logging.info(f"✅ Đã xử lý link cho đơn {order_code_to_complete}, chờ admin xử lý")
        return True
    except Exception as e:
        logging.error(f"Lỗi khi xử lý link cho đơn {order_type}: {e}", exc_info=True)
        await update.message.reply_text(
            "❌ Đã xảy ra lỗi. Vui lòng liên hệ admin.",
            reply_markup=get_reply_keyboard(update.effective_user.id if update and update.effective_user else None)
        )
        return True


async def admin_order_reminder_loop(order_code: str, order_type: str, context: ContextTypes.DEFAULT_TYPE):
    """Loop nhắc admin mỗi 3 phút về đơn hàng chưa xử lý"""
    await asyncio.sleep(180)  # Chờ 3 phút trước khi nhắc lần đầu
    
    while order_code in active_orders:
        order = active_orders[order_code]
        
        # Gửi nhắc nhở
        link_type_upper = "SHEERID VERIFY" if order_type == 'sheerid' else "CHECKOUT"
        reminder_msg = (
            f"⏰ <b>NHẮC NHỞ: ĐƠN HÀNG {link_type_upper} CHƯA XỬ LÝ!</b>\n\n"
            f"🆔 Mã đơn: <b>{order_code}</b>\n"
            f"📦 {order.get('product_name', 'N/A')}\n"
            f"👤 Khách: {order.get('fullname', 'N/A')}\n\n"
            f"⚠️ Đơn hàng đang chờ xử lý!"
        )
        admin_keyboard = [
            [
                InlineKeyboardButton("❌ LINK LỖI", callback_data=f"link_error_{order_code}"),
                InlineKeyboardButton("✅ ĐÃ XỬ LÝ", callback_data=f"link_done_{order_code}")
            ]
        ]
        await send_admin_message_with_keyboard(context.bot, reminder_msg, admin_keyboard)
        logging.info(f"📢 Đã gửi nhắc nhở cho đơn {order_code}")
        
        await asyncio.sleep(180)  # Chờ 3 phút tiếp


async def handle_link_error_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Xử lý khi admin bấm LINK LỖI"""
    query = update.callback_query
    await query.answer()
    order_code = query.data.replace("link_error_", "")
    
    if order_code not in active_orders:
        try:
            await query.edit_message_text("⚠️ Đơn hàng không tồn tại hoặc đã xử lý.")
        except:
            pass
        return
    
    order = active_orders[order_code]
    retry_count = order.get('link_retry_count', 0) + 1
    order['link_retry_count'] = retry_count
    
    if retry_count >= 2:
        # Đã lỗi 2 lần -> gửi thông tin hỗ trợ
        support_msg = (
            f"❌ <b>LINK KHÔNG HỢP LỆ</b>\n\n"
            f"Link bạn gửi không thể xử lý được sau 2 lần.\n"
            f"Vui lòng liên hệ admin để được hỗ trợ trực tiếp:\n\n"
            f"📞 Zalo: {ZALO_ADMIN_1} hoặc {ZALO_ADMIN_2}\n"
            f"💬 Telegram: {TELEGRAM_ADMIN_USERNAME}"
        )
        await context.bot.send_message(
            chat_id=order['user_id'], 
            text=support_msg, 
            parse_mode='HTML',
            reply_markup=get_reply_keyboard(update.effective_user.id if update and update.effective_user else None)
        )
        # Xóa đơn khỏi active
        del active_orders[order_code]
        save_active_orders()
        try:
            await query.edit_message_text(f"❌ Đã yêu cầu khách liên hệ trực tiếp - đơn {order_code}")
        except:
            pass
    else:
        # Yêu cầu khách gửi link mới
        order['waiting_for_new_link'] = True
        save_active_orders()
        
        await context.bot.send_message(
            chat_id=order['user_id'],
            text=(
                f"⚠️ <b>LINK KHÔNG HỢP LỆ</b>\n\n"
                f"Link bạn gửi không thể xử lý được.\n"
                f"🔗 <b>Vui lòng gửi lại link mới.</b>"
            ),
            parse_mode='HTML'
        )
        try:
            await query.edit_message_text(f"⏳ Đã yêu cầu khách gửi lại link - đơn {order_code}")
        except:
            pass


async def handle_link_done_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Xử lý khi admin bấm ĐÃ XỬ LÝ cho link order"""
    query = update.callback_query
    await query.answer("✅ Đã xác nhận hoàn thành!")
    order_code = query.data.replace("link_done_", "")
    
    if order_code not in active_orders:
        try:
            await query.edit_message_text("⚠️ Đơn hàng không tồn tại.")
        except:
            pass
        return
    
    order = active_orders[order_code]
    
    # Gửi thông báo thành công + cảm ơn cho khách
    success_msg = (
        f"✅ <b>ĐƠN HÀNG HOÀN THÀNH!</b>\n\n"
        f"🆔 Mã đơn: <b>{order_code}</b>\n"
        f"📦 {order.get('product_name', 'Sản phẩm')}\n\n"
        f"🎉 Cảm ơn bạn đã sử dụng dịch vụ!\n"
        f"💌 Hẹn gặp lại bạn lần sau!"
    )
    keyboard_new = [[InlineKeyboardButton("🔄 Mua đơn mới", callback_data='show_menu')]]
    await context.bot.send_message(
        chat_id=order['user_id'], 
        text=success_msg, 
        parse_mode='HTML',
        reply_markup=InlineKeyboardMarkup(keyboard_new)
    )
    
    # Xóa đơn khỏi active
    del active_orders[order_code]
    save_active_orders()
    
    # Update admin message
    try:
        await query.edit_message_text(
            f"✅ Đã hoàn thành đơn {order_code}",
            parse_mode='HTML'
        )
    except:
        pass
    
    logging.info(f"✅ Admin đã xử lý xong đơn {order_code}")


# ==============================================================================
# ADD FARM - GMAIL SHEET HELPERS (Ultra + 30tb)
# ==============================================================================

ULTRA_30TB_SHEET_NAME = "Ultra + 30tb"

def write_gmail_to_ultra_sheet(gmail, order_code, customer_info=""):
    """Ghi Gmail vào sheet 'Ultra + 30tb' ở dòng có trạng thái 'CHƯA ADD'.
    
    Logic an toàn:
    - Chỉ ghi vào dòng có cột B (Tình trạng) = 'CHƯA ADD'
    - Bỏ qua dòng có trạng thái khác (ADMIN, ĐỢI XỬ LÝ, ĐÃ ADD, ADD BÙ ĐẾN NGÀY...)
    - Bỏ qua dòng đã có nội dung ở cột A
    
    Returns:
        (bool, int, str): (thành công, row number, message)
    """
    try:
        db = get_db()
        ws = get_worksheet_by_name(db, ULTRA_30TB_SHEET_NAME)
        if not ws:
            return False, 0, f"Không tìm thấy sheet '{ULTRA_30TB_SHEET_NAME}'"
        
        # Lấy tất cả dữ liệu
        all_rows = ws.get_all_values()
        
        # Tìm dòng phù hợp (bỏ header row 0)
        target_row = None
        for i, row in enumerate(all_rows):
            if i == 0:  # Bỏ header
                continue
            
            # Cột A = Sản phẩm (Gmail), Cột B = Tình trạng
            col_a = row[0].strip() if len(row) > 0 else ""
            col_b = row[1].strip().upper() if len(row) > 1 else ""
            
            # Chỉ ghi vào dòng: cột A trống VÀ cột B = "CHƯA ADD"
            if col_a == "" and col_b == "CHƯA ADD":
                target_row = i + 1  # 1-indexed cho gspread
                break
        
        if not target_row:
            return False, 0, "Không còn dòng 'CHƯA ADD' trống trên sheet"
        
        # Ghi Gmail vào cột A, đổi cột B thành "ĐỢI XỬ LÝ"
        cells_to_update = [
            gspread.Cell(target_row, 1, gmail),           # Cột A: Gmail
            gspread.Cell(target_row, 2, "ĐỢI XỬ LÝ"),   # Cột B: Tình trạng
        ]
        
        # Ghi thông tin khách vào cột "Thông Tin KH" (cột G) nếu có
        if customer_info:
            cells_to_update.append(gspread.Cell(target_row, 7, customer_info))  # Cột G
        
        ws.update_cells(cells_to_update)
        clear_cache()
        
        logging.info(f"✅ Đã ghi Gmail '{gmail}' vào sheet '{ULTRA_30TB_SHEET_NAME}' dòng {target_row}")
        return True, target_row, "Thành công"
        
    except Exception as e:
        logging.error(f"❌ Lỗi ghi Gmail vào sheet '{ULTRA_30TB_SHEET_NAME}': {e}")
        return False, 0, str(e)


def update_ultra_sheet_status(gmail, new_status="ĐÃ ADD"):
    """Tìm Gmail trên sheet 'Ultra + 30tb' và đổi trạng thái.
    
    Args:
        gmail: Email cần tìm
        new_status: Trạng thái mới (mặc định: "ĐÃ ADD")
    
    Returns:
        (bool, str): (thành công, message)
    """
    try:
        db = get_db()
        ws = get_worksheet_by_name(db, ULTRA_30TB_SHEET_NAME)
        if not ws:
            return False, f"Không tìm thấy sheet '{ULTRA_30TB_SHEET_NAME}'"
        
        all_rows = ws.get_all_values()
        
        # Tìm dòng chứa Gmail
        for i, row in enumerate(all_rows):
            if i == 0:
                continue
            col_a = row[0].strip().lower() if len(row) > 0 else ""
            if col_a == gmail.strip().lower():
                target_row = i + 1  # 1-indexed
                # Đổi cột B thành trạng thái mới
                ws.update_cell(target_row, 2, new_status)
                clear_cache()
                logging.info(f"✅ Đã cập nhật trạng thái Gmail '{gmail}' → '{new_status}' (dòng {target_row})")
                return True, f"Đã đổi thành {new_status}"
        
        return False, f"Không tìm thấy Gmail '{gmail}' trên sheet"
        
    except Exception as e:
        logging.error(f"❌ Lỗi cập nhật trạng thái sheet: {e}")
        return False, str(e)


async def handle_gmail_for_addfarm_order(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Xử lý Gmail từ khách hàng cho đơn ADD Farm.
    
    Khi khách gửi Gmail sau thanh toán thành công:
    1. Validate email
    2. Ghi vào sheet 'Ultra + 30tb' (dòng CHƯA ADD → ĐỢI XỬ LÝ)
    3. Thông báo admin kèm nút ĐANG XỬ LÝ / ĐÃ XỬ LÝ
    4. Chuyển đơn sang active_orders
    """
    if not update.message or not update.message.text:
        return False
    
    user = update.effective_user
    user_text = update.message.text.strip()
    user_id = user.id
    
    # Tìm đơn hàng ADD Farm đang chờ Gmail của user
    order_code_found = None
    for oc, order in pending_orders.items():
        if (order.get('user_id') == user_id and 
            order.get('waiting_for_addfarm_gmail') == True):
            order_code_found = oc
            break
    
    if not order_code_found:
        return False
    
    order = pending_orders[order_code_found]
    
    # Validate email cơ bản
    if '@' not in user_text or '.' not in user_text or len(user_text) < 5:
        await update.message.reply_text(
            f"❌ <b>Email không hợp lệ!</b>\n\n"
            f"Vui lòng gửi đúng Gmail. Ví dụ: <code>example@gmail.com</code>",
            parse_mode='HTML'
        )
        return True  # Đã xử lý (không pass xuống handler khác)
    
    gmail = user_text.strip().lower()
    
    # Ghi vào sheet 'Ultra + 30tb'
    customer_info = f"Đơn: {order_code_found} | KH: {order.get('fullname', 'N/A')} (ID: {user_id})"
    success, row_num, msg = write_gmail_to_ultra_sheet(gmail, order_code_found, customer_info)
    
    if not success:
        await update.message.reply_text(
            f"⚠️ <b>Lỗi ghi Gmail vào hệ thống!</b>\n"
            f"Lỗi: {msg}\n\n"
            f"Vui lòng liên hệ admin: {TELEGRAM_ADMIN_USERNAME}",
            parse_mode='HTML'
        )
        logging.error(f"❌ Lỗi ghi Gmail cho đơn {order_code_found}: {msg}")
        return True
    
    # Lưu Gmail vào order
    order['addfarm_gmail'] = gmail
    order['addfarm_sheet_row'] = row_num
    order['waiting_for_addfarm_gmail'] = False
    
    # Chuyển đơn sang active_orders
    active_orders[order_code_found] = order
    del pending_orders[order_code_found]
    try:
        with open(PENDING_ORDERS_FILE, "w", encoding="utf-8") as f:
            json.dump(pending_orders, f, ensure_ascii=False, indent=2)
    except:
        pass
    save_active_orders()
    
    # Xác nhận cho khách
    await update.message.reply_text(
        f"✅ <b>Đã nhận Gmail của bạn!</b>\n\n"
        f"📧 Gmail: <code>{gmail}</code>\n"
        f"🆔 Mã đơn: <b>{order_code_found}</b>\n\n"
        f"📊 <b>Trạng thái: ĐANG XỬ LÝ</b>\n"
        f"⏳ Vui lòng chờ admin xử lý đơn hàng...",
        parse_mode='HTML'
    )
    
    # Thông báo admin kèm Gmail + 2 nút
    admin_msg = (
        f"📧 <b>KHÁCH ĐÃ GỬI GMAIL - ADD FARM!</b>\n\n"
        f"🆔 Mã đơn: <b>{order_code_found}</b>\n"
        f"👤 Khách: {order.get('fullname', 'N/A')} (ID: {user_id})\n"
        f"📦 <b>{order.get('product_name', 'ADD Farm')}</b> x {order.get('quantity', 1)}\n"
        f"💰 <b>{order.get('total', 'N/A')} VNĐ</b>\n"
        f"📧 Gmail: <code>{gmail}</code>\n"
        f"📝 Sheet: dòng {row_num} → ĐỢI XỬ LÝ\n\n"
        f"ℹ️ Bấm ĐANG XỬ LÝ để gửi hướng dẫn chuyển vùng cho khách"
    )
    admin_keyboard = [
        [
            InlineKeyboardButton("⏳ ĐANG XỬ LÝ", callback_data=f"addfarm_processing_{order_code_found}"),
            InlineKeyboardButton("✅ ĐÃ XỬ LÝ", callback_data=f"addfarm_done_{order_code_found}")
        ]
    ]
    await send_admin_message_with_keyboard(context.bot, admin_msg, admin_keyboard)
    
    logging.info(f"📧 Đã nhận Gmail '{gmail}' cho đơn ADD Farm {order_code_found}, ghi vào sheet dòng {row_num}")
    return True


async def handle_addfarm_processing_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Khi admin bấm ĐANG XỬ LÝ cho ADD Farm - gửi hướng dẫn chuyển vùng"""
    query = update.callback_query
    await query.answer()
    order_code = query.data.replace("addfarm_processing_", "")
    
    order = active_orders.get(order_code)
    if not order:
        try:
            await query.edit_message_text("⚠️ Đơn không tồn tại.")
        except:
            pass
        return
    
    # Gửi hướng dẫn chuyển vùng cho khách
    guide_msg = (
        f"📋 <b>HƯỚNG DẪN CHUYỂN VÙNG THANH TOÁN</b>\n\n"
        f"<b>Bước 1:</b> Quản lý tài khoản Google\n\n"
        f"<b>Bước 2:</b> Thanh toán & Gói thuê bao\n"
        f"   • 2.1: Quản lý Phương thức thanh toán\n\n"
        f"<b>Bước 3:</b> Cài đặt\n"
        f"   • 3.1: Sau khi bấm vào cài đặt, nếu chưa có hồ sơ thanh toán thì tạo 1 hồ sơ thanh toán <b>US (Hoa Kì)</b> mới. Nếu đã có thì xóa đi tạo lại.\n"
        f"   • Dùng thẻ visa không có tiền (hoặc nếu không có/lỗi không làm được, liên hệ admin {TELEGRAM_ADMIN_USERNAME})\n\n"
        f"   • 3.2: Link lấy địa chỉ US: https://www.fakexy.com/fake-address-generator-us\n\n"
        f"<b>Sau khi hoàn thành, bấm nút bên dưới:</b>"
    )
    customer_keyboard = [
        [InlineKeyboardButton("✅ ĐÃ XONG", callback_data=f"customer_addfarm_done_{order_code}")]
    ]
    await context.bot.send_message(
        chat_id=order['user_id'],
        text=guide_msg,
        parse_mode='HTML',
        reply_markup=InlineKeyboardMarkup(customer_keyboard),
        disable_web_page_preview=True
    )
    
    order['admin_processing'] = True
    save_active_orders()
    
    try:
        await query.edit_message_text(f"✅ Đã gửi hướng dẫn cho khách - đơn {order_code}")
    except:
        pass
    
    logging.info(f"📧 Admin đã gửi hướng dẫn chuyển vùng cho đơn ADD Farm {order_code}")


async def handle_addfarm_done_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Xử lý khi admin bấm ĐÃ XỬ LÝ ngay (không cần khách làm bước nào)"""
    query = update.callback_query
    await query.answer("✅ Đã xác nhận hoàn thành!")
    order_code = query.data.replace("addfarm_done_", "")
    
    order = active_orders.get(order_code)
    if not order:
        try:
            await query.edit_message_text("⚠️ Đơn hàng không tồn tại.")
        except:
            pass
        return
    
    # Cập nhật sheet 'Ultra + 30tb' → ĐÃ ADD
    addfarm_gmail = order.get('addfarm_gmail', '')
    if addfarm_gmail:
        sheet_ok, sheet_msg = update_ultra_sheet_status(addfarm_gmail, "ĐÃ ADD")
        if sheet_ok:
            logging.info(f"✅ Đã đổi sheet '{addfarm_gmail}' → ĐÃ ADD cho đơn {order_code}")
        else:
            logging.warning(f"⚠️ Không đổi được sheet cho đơn {order_code}: {sheet_msg}")
    
    # Gửi cảm ơn khách
    success_msg = (
        f"✅ <b>ĐƠN HÀNG HOÀN THÀNH!</b>\n\n"
        f"🆔 Mã đơn: <b>{order_code}</b>\n"
        f"📦 {order.get('product_name', 'ADD Farm')}\n\n"
        f"🎉 Cảm ơn bạn đã sử dụng dịch vụ!\n"
        f"💌 Hẹn gặp lại bạn lần sau!"
    )
    keyboard_new = [[InlineKeyboardButton("🔄 Mua đơn mới", callback_data='show_menu')]]
    await context.bot.send_message(
        chat_id=order['user_id'], 
        text=success_msg, 
        parse_mode='HTML',
        reply_markup=InlineKeyboardMarkup(keyboard_new)
    )
    
    del active_orders[order_code]
    save_active_orders()
    
    try:
        await query.edit_message_text(f"✅ Đã hoàn thành đơn ADD Farm {order_code}")
    except:
        pass
    
    logging.info(f"✅ Admin đã hoàn thành đơn ADD Farm {order_code}")


async def handle_customer_addfarm_done_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Khi khách bấm ĐÃ XONG sau hướng dẫn"""
    query = update.callback_query
    await query.answer("✅ Đã thông báo admin!")
    order_code = query.data.replace("customer_addfarm_done_", "")
    
    order = active_orders.get(order_code)
    if not order:
        try:
            await query.edit_message_text("⚠️ Đơn hàng không tồn tại.")
        except:
            pass
        return
    
    # Thông báo khách đang chờ
    try:
        await query.edit_message_text(
            f"⏳ <b>Admin đang xử lý đơn hàng của bạn...</b>\n"
            f"Vui lòng chờ trong giây lát.",
            parse_mode='HTML'
        )
    except:
        pass
    
    # Thông báo admin với 2 nút mới
    admin_msg = (
        f"🔔 <b>KHÁCH ĐÃ HOÀN THÀNH CHUYỂN VÙNG!</b>\n\n"
        f"🆔 Mã đơn: <b>{order_code}</b>\n"
        f"👤 Khách: {order.get('fullname', 'N/A')}\n"
        f"📦 {order.get('product_name', 'ADD Farm')}\n\n"
        f"⚠️ Vui lòng kiểm tra và hoàn thành đơn hàng!"
    )
    admin_keyboard = [
        [
            InlineKeyboardButton("❌ CHUYỂN VÙNG CHƯA ĐÚNG", callback_data=f"addfarm_wrong_{order_code}"),
            InlineKeyboardButton("✅ ĐÃ XỬ LÝ", callback_data=f"addfarm_complete_{order_code}")
        ]
    ]
    await send_admin_message_with_keyboard(context.bot, admin_msg, admin_keyboard)
    
    logging.info(f"📧 Khách đã bấm ĐÃ XONG cho đơn ADD Farm {order_code}")


async def handle_addfarm_wrong_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Khi admin bấm CHUYỂN VÙNG CHƯA ĐÚNG"""
    query = update.callback_query
    await query.answer()
    order_code = query.data.replace("addfarm_wrong_", "")
    
    order = active_orders.get(order_code)
    if not order:
        try:
            await query.edit_message_text("⚠️ Đơn không tồn tại.")
        except:
            pass
        return
    
    # Thông báo khách liên hệ admin
    await context.bot.send_message(
        chat_id=order['user_id'],
        text=(
            f"❌ <b>CHUYỂN VÙNG CHƯA ĐÚNG</b>\n\n"
            f"Vùng thanh toán của bạn chưa được cài đặt đúng.\n"
            f"Vui lòng liên hệ admin để được hỗ trợ:\n\n"
            f"📞 Zalo: {ZALO_ADMIN_1} hoặc {ZALO_ADMIN_2}\n"
            f"💬 Telegram: {TELEGRAM_ADMIN_USERNAME}"
        ),
        parse_mode='HTML',
        reply_markup=get_reply_keyboard(update.effective_user.id if update and update.effective_user else None)
    )
    
    try:
        await query.edit_message_text(f"❌ Đã yêu cầu khách liên hệ - đơn {order_code}")
    except:
        pass
    
    logging.info(f"❌ Admin báo chuyển vùng chưa đúng cho đơn {order_code}")


async def handle_addfarm_complete_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Khi admin hoàn thành đơn ADD Farm"""
    query = update.callback_query
    await query.answer("✅ Hoàn thành!")
    order_code = query.data.replace("addfarm_complete_", "")
    
    order = active_orders.get(order_code)
    if not order:
        try:
            await query.edit_message_text("⚠️ Đơn không tồn tại.")
        except:
            pass
        return
    
    # Cập nhật sheet 'Ultra + 30tb' → ĐÃ ADD
    addfarm_gmail = order.get('addfarm_gmail', '')
    if addfarm_gmail:
        sheet_ok, sheet_msg = update_ultra_sheet_status(addfarm_gmail, "ĐÃ ADD")
        if sheet_ok:
            logging.info(f"✅ Đã đổi sheet '{addfarm_gmail}' → ĐÃ ADD cho đơn {order_code}")
        else:
            logging.warning(f"⚠️ Không đổi được sheet cho đơn {order_code}: {sheet_msg}")
    
    # Gửi cảm ơn khách
    success_msg = (
        f"✅ <b>ĐƠN HÀNG HOÀN THÀNH!</b>\n\n"
        f"🆔 Mã đơn: <b>{order_code}</b>\n"
        f"📦 {order.get('product_name', 'ADD Farm')}\n\n"
        f"🎉 Cảm ơn bạn đã sử dụng dịch vụ!\n"
        f"💌 Hẹn gặp lại bạn lần sau!"
    )
    keyboard_new = [[InlineKeyboardButton("🔄 Mua đơn mới", callback_data='show_menu')]]
    await context.bot.send_message(
        chat_id=order['user_id'], 
        text=success_msg, 
        parse_mode='HTML',
        reply_markup=InlineKeyboardMarkup(keyboard_new)
    )
    
    del active_orders[order_code]
    save_active_orders()
    
    try:
        await query.edit_message_text(f"✅ Đã hoàn thành đơn ADD Farm {order_code}")
    except:
        pass
    
    logging.info(f"✅ Admin đã hoàn thành đơn ADD Farm {order_code}")


# ==============================================================================
# VERIFY 2-OPTIN HANDLERS
# ==============================================================================

async def handle_verify_link_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Xử lý khi khách bấm '🔗 Link SheerID' cho đơn Verify"""
    query = update.callback_query
    await query.answer()
    
    order_code = query.data.replace("verify_link_", "")
    user_id = query.from_user.id
    
    if order_code not in pending_orders:
        await query.edit_message_text("⚠️ Đơn hàng không tồn tại hoặc đã hết hạn.")
        return
    
    order = pending_orders[order_code]
    if order.get('user_id') != user_id:
        await query.answer("⚠️ Đây không phải đơn hàng của bạn.", show_alert=True)
        return
    
    # Chuyển sang trạng thái chờ link (giống SheerID)
    order['waiting_for_link'] = True
    order['waiting_type'] = 'verify_link'
    order['verify_method'] = 'link'
    order['link_waiting_start'] = time.time()
    pending_orders[order_code] = order
    
    try:
        with open(PENDING_ORDERS_FILE, "w", encoding="utf-8") as f:
            json.dump(pending_orders, f, ensure_ascii=False, indent=2)
    except:
        pass
    
    await query.edit_message_text(
        f"🔗 <b>Bạn đã chọn GỬI LINK</b>\n\n"
        f"Vui lòng gửi link SheerID của bạn ngay bây giờ!\n\n"
        f"💬 Chỉ cần gửi link SheerID cho bot là được!\n\n"
        f"⏰ <b>Thời gian chờ: 5 phút</b>",
        parse_mode='HTML'
    )
    
    # Thông báo admin khách đã chọn phương thức Link
    try:
        admin_msg = (
            f"📋 <b>KHÁCH ĐÃ CHỌN PHƯƠNG THỨC</b>\n\n"
            f"🆔 Mã đơn: <b>{order_code}</b>\n"
            f"📦 {order.get('product_name', 'Verify')}\n"
            f"✅ Phương thức: <b>GỬI LINK SHEERID</b>\n\n"
            f"⏳ <i>Đang chờ khách gửi link...</i>"
        )
        await send_to_all_admins(context.bot, admin_msg, parse_mode='HTML')
    except Exception as e:
        logging.error(f"Lỗi gửi thông báo admin (verify link): {e}")
    
    # Tạo task auto cancel sau 5 phút
    asyncio.create_task(auto_cancel_link_order_no_response(order_code, user_id, context, 'verify_link'))
    
    logging.info(f"✅ Khách chọn GỬI LINK cho đơn Verify {order_code}")


async def handle_verify_emailpass_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Xử lý khi khách bấm '📧 Nhập Email/Pass' cho đơn Verify"""
    query = update.callback_query
    await query.answer()
    
    order_code = query.data.replace("verify_emailpass_", "")
    user_id = query.from_user.id
    
    if order_code not in pending_orders:
        await query.edit_message_text("⚠️ Đơn hàng không tồn tại hoặc đã hết hạn.")
        return
    
    order = pending_orders[order_code]
    if order.get('user_id') != user_id:
        await query.answer("⚠️ Đây không phải đơn hàng của bạn.", show_alert=True)
        return
    
    # Chuyển sang trạng thái chờ email/password
    order['waiting_for_email_password'] = True
    order['waiting_type'] = 'verify_emailpass'
    order['verify_method'] = 'emailpass'
    order['email_waiting_start'] = time.time()
    pending_orders[order_code] = order
    
    try:
        with open(PENDING_ORDERS_FILE, "w", encoding="utf-8") as f:
            json.dump(pending_orders, f, ensure_ascii=False, indent=2)
    except:
        pass
    
    await query.edit_message_text(
        f"📧 <b>Bạn đã chọn GỬI EMAIL/PASSWORD</b>\n\n"
        f"Vui lòng gửi thông tin theo format:\n"
        f"<code>email|password</code>\n\n"
        f"📝 Ví dụ: <code>myemail@gmail.com|mypassword123</code>\n\n"
        f"⏰ <b>Thời gian chờ: 5 phút</b>",
        parse_mode='HTML'
    )
    
    # Thông báo admin khách đã chọn phương thức Email/Pass
    try:
        admin_msg = (
            f"📋 <b>KHÁCH ĐÃ CHỌN PHƯƠNG THỨC</b>\n\n"
            f"🆔 Mã đơn: <b>{order_code}</b>\n"
            f"📦 {order.get('product_name', 'Verify')}\n"
            f"✅ Phương thức: <b>GỬI EMAIL/PASSWORD</b>\n\n"
            f"⏳ <i>Đang chờ khách gửi email|password...</i>"
        )
        await send_to_all_admins(context.bot, admin_msg, parse_mode='HTML')
    except Exception as e:
        logging.error(f"Lỗi gửi thông báo admin (verify emailpass): {e}")
    
    # Tạo task auto cancel sau 5 phút
    asyncio.create_task(auto_cancel_link_order_no_response(order_code, user_id, context, 'verify_emailpass'))
    
    logging.info(f"✅ Khách chọn GỬI EMAIL/PASS cho đơn Verify {order_code}")


async def handle_emailpass_for_verify_order(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Xử lý email|password từ khách hàng cho sản phẩm Verify"""
    if not update.message or not update.message.text:
        return False
    
    user = update.effective_user
    user_text = update.message.text.strip()
    user_id = user.id
    
    # Tìm đơn hàng đang chờ email/password
    order_code_to_complete = None
    for order_code, order in pending_orders.items():
        if (order.get('user_id') == user_id and 
            order.get('waiting_for_email_password') == True):
            order_code_to_complete = order_code
            break
    
    # Cũng check active_orders (trường hợp admin bấm INFO LỖI)
    if not order_code_to_complete:
        for order_code, order in active_orders.items():
            if (order.get('user_id') == user_id and 
                order.get('waiting_for_email_password') == True):
                order_code_to_complete = order_code
                break
    
    if not order_code_to_complete:
        return False
    
    # Lấy order từ đúng dict
    if order_code_to_complete in pending_orders:
        order = pending_orders[order_code_to_complete]
        is_from_active = False
    else:
        order = active_orders[order_code_to_complete]
        is_from_active = True
    
    # Parse email|password
    if '|' not in user_text:
        await update.message.reply_text(
            "⚠️ <b>Format không đúng!</b>\n\n"
            "Vui lòng gửi theo format:\n"
            "<code>email|password</code>\n\n"
            "📝 Ví dụ: <code>myemail@gmail.com|mypassword123</code>",
            parse_mode='HTML'
        )
        return True
    
    parts = user_text.split('|', 1)
    email = parts[0].strip()
    password = parts[1].strip() if len(parts) > 1 else ""
    
    # Validate email
    if '@' not in email or not password:
        await update.message.reply_text(
            "⚠️ <b>Email hoặc Password không hợp lệ!</b>\n\n"
            "Vui lòng kiểm tra lại và gửi theo format:\n"
            "<code>email|password</code>",
            parse_mode='HTML'
        )
        return True
    
    try:
        # Ghi vào Google Sheets
        db = get_db()
        ws_product = get_worksheet_by_name(db, order['sheet_worksheet'])
        
        if not ws_product:
            await update.message.reply_text(
                "❌ Lỗi: Không tìm thấy sheet. Vui lòng liên hệ admin.",
                reply_markup=get_reply_keyboard(update.effective_user.id if update and update.effective_user else None)
            )
            return True
        
        # Tìm dòng trống và ghi
        all_rows = ws_product.get_all_values()
        next_row = None
        for i in range(1, min(len(all_rows), 999)):
            if i >= len(all_rows) or (len(all_rows[i]) == 0 or all_rows[i][0].strip() == ""):
                next_row = i + 1
                break
        if next_row is None:
            next_row = min(len(all_rows) + 1, 999)
        
        # Ghi email|password vào cột A
        cells_to_update = [
            gspread.Cell(next_row, 1, f"{email}|{password}"),  # Cột A: Email|Password
            gspread.Cell(next_row, 3, order['delivery_date']),  # Cột C: Ngày
            gspread.Cell(next_row, 5, str(order_code_to_complete))  # Cột E: ID đơn
        ]
        ws_product.update_cells(cells_to_update)
        clear_cache()
        
        # Cập nhật order
        order['email'] = email
        order['password'] = password
        order['waiting_for_email_password'] = False
        if 'email_waiting_start' in order:
            del order['email_waiting_start']
        
        # Thông báo khách
        await update.message.reply_text(
            f"✅ <b>Đã nhận thông tin Email/Password!</b>\n\n"
            f"📧 Email: <code>{email}</code>\n"
            f"🆔 Mã đơn: <b>{order_code_to_complete}</b>\n\n"
            f"📊 <b>Trạng thái: ĐANG XỬ LÝ</b>\n"
            f"⏳ Admin đang xử lý đơn hàng của bạn, vui lòng chờ...",
            parse_mode='HTML',
            reply_markup=get_reply_keyboard(update.effective_user.id if update and update.effective_user else None)
        )
        
        # Thông báo admin với nút xử lý
        product_name = order.get('product_name', 'Verify Product')
        admin_msg = (
            f"🔔 <b>ĐƠN VERIFY (EMAIL/PASS) CẦN XỬ LÝ!</b>\n\n"
            f"🆔 Mã đơn: <b>{order_code_to_complete}</b>\n"
            f"👤 Khách: {order.get('fullname', 'N/A')} (ID: {user_id})\n"
            f"📦 <b>{product_name}</b> x {order['quantity']}\n"
            f"📧 Email: <code>{email}</code>\n"
            f"🔑 Password: <code>{password}</code>\n"
            f"💰 <b>{order['total']} VNĐ</b>\n\n"
            f"📋 Đã ghi vào sheet: <b>{order['sheet_worksheet']}</b>"
        )
        admin_keyboard = [
            [
                InlineKeyboardButton("❌ INFO LỖI", callback_data=f"verify_ep_error_{order_code_to_complete}"),
                InlineKeyboardButton("✅ ĐÃ XỬ LÝ", callback_data=f"verify_ep_done_{order_code_to_complete}")
            ]
        ]
        await send_admin_message_with_keyboard(context.bot, admin_msg, admin_keyboard)
        
        # Chuyển vào active_orders
        if not is_from_active:
            active_orders[order_code_to_complete] = order
            del pending_orders[order_code_to_complete]
            try:
                with open(PENDING_ORDERS_FILE, "w", encoding="utf-8") as f:
                    json.dump(pending_orders, f, ensure_ascii=False, indent=2)
            except:
                pass
        else:
            active_orders[order_code_to_complete] = order
        save_active_orders()
        
        # Bắt đầu reminder loop
        asyncio.create_task(admin_order_reminder_loop(order_code_to_complete, 'verify_emailpass', context))
        
        logging.info(f"✅ Đã xử lý email/pass cho đơn Verify {order_code_to_complete}")
        return True
    except Exception as e:
        logging.error(f"Lỗi xử lý email/pass cho đơn Verify: {e}", exc_info=True)
        await update.message.reply_text(
            "❌ Đã xảy ra lỗi. Vui lòng liên hệ admin.",
            reply_markup=get_reply_keyboard(update.effective_user.id if update and update.effective_user else None)
        )
        return True


async def handle_verify_ep_error_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Admin báo thông tin email/pass lỗi cho đơn Verify"""
    query = update.callback_query
    await query.answer("❌ Đã thông báo khách!")
    
    order_code = query.data.replace("verify_ep_error_", "")
    
    if order_code not in active_orders:
        try:
            await query.edit_message_text("⚠️ Đơn hàng không còn tồn tại.")
        except:
            pass
        return
    
    order = active_orders[order_code]
    customer_id = order.get('user_id')
    
    # Thông báo khách cần gửi lại
    await context.bot.send_message(
        chat_id=customer_id,
        text=(
            f"⚠️ <b>THÔNG TIN ĐĂNG NHẬP LỖI!</b>\n\n"
            f"🆔 Mã đơn: <b>{order_code}</b>\n\n"
            f"❌ Email hoặc Password bạn gửi không chính xác.\n"
            f"Vui lòng kiểm tra lại và gửi lại theo format:\n"
            f"<code>email|password</code>\n\n"
            f"💬 Hoặc liên hệ admin:\n"
            f"📞 Zalo: {ZALO_ADMIN_1} hoặc {ZALO_ADMIN_2}\n"
            f"💬 Telegram: {TELEGRAM_ADMIN_USERNAME}"
        ),
        parse_mode='HTML',
        reply_markup=get_reply_keyboard(update.effective_user.id if update and update.effective_user else None)
    )
    
    # Cho phép gửi lại - giữ trong active_orders nhưng set waiting
    order['waiting_for_email_password'] = True
    order['email_waiting_start'] = time.time()
    active_orders[order_code] = order
    save_active_orders()
    
    try:
        await query.edit_message_text(
            f"❌ Đã thông báo khách gửi lại thông tin.\n"
            f"Mã đơn: {order_code}"
        )
    except:
        pass
    
    logging.info(f"❌ Admin báo INFO LỖI cho đơn Verify {order_code}")


async def handle_verify_ep_done_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Admin hoàn thành đơn Verify (Email/Pass)"""
    query = update.callback_query
    await query.answer("✅ Hoàn thành!")
    
    order_code = query.data.replace("verify_ep_done_", "")
    
    if order_code not in active_orders:
        try:
            await query.edit_message_text("⚠️ Đơn hàng không còn tồn tại.")
        except:
            pass
        return
    
    order = active_orders[order_code]
    customer_id = order.get('user_id')
    
    # Thông báo khách hoàn thành
    success_msg = (
        f"🎉 <b>ĐƠN HÀNG ĐÃ HOÀN THÀNH!</b>\n\n"
        f"🆔 Mã đơn: <b>{order_code}</b>\n"
        f"📦 Sản phẩm: {order.get('product_name')}\n\n"
        f"✅ Admin đã xử lý xong đơn hàng của bạn.\n\n"
        f"💌 <i>Cảm ơn bạn đã ủng hộ Shop!</i>"
    )
    keyboard_new = [[InlineKeyboardButton("🔄 Mua đơn mới", callback_data='show_menu')]]
    
    await context.bot.send_message(
        chat_id=customer_id,
        text=success_msg,
        parse_mode='HTML',
        reply_markup=InlineKeyboardMarkup(keyboard_new)
    )
    
    # Xóa đơn
    del active_orders[order_code]
    save_active_orders()
    
    try:
        await query.edit_message_text(
            f"✅ Đã hoàn thành đơn Verify {order_code}."
        )
    except:
        pass
    
    logging.info(f"✅ Admin đã hoàn thành đơn Verify (Email/Pass) {order_code}")


# ==============================================================================
# ADMIN VERIFY PHONE HANDLERS
# ==============================================================================

def load_verify_queue():
    """Load queue verify từ file"""
    try:
        if os.path.exists(VERIFY_QUEUE_FILE):
            with open(VERIFY_QUEUE_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
    except:
        pass
    return []

def save_verify_queue(queue):
    """Lưu queue verify vào file"""
    os.makedirs(os.path.dirname(VERIFY_QUEUE_FILE), exist_ok=True)
    with open(VERIFY_QUEUE_FILE, "w", encoding="utf-8") as f:
        json.dump(queue, f, ensure_ascii=False, indent=2)

def load_verify_results():
    """Load kết quả verify từ file"""
    try:
        if os.path.exists(VERIFY_RESULTS_FILE):
            with open(VERIFY_RESULTS_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
    except:
        pass
    return []

def load_verify_status():
    """Load status hiện tại của tool"""
    try:
        if os.path.exists(VERIFY_STATUS_FILE):
            with open(VERIFY_STATUS_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
    except:
        pass
    return {"status": "unknown", "message": "Tool chưa chạy"}

# ==============================================================================
# VERIFY PENDING RETRY SYSTEM
# Lưu account thất bại để retry với quốc gia khác
# ==============================================================================

def load_verify_pending_retry():
    """Load danh sách acc thất bại chờ retry - theo user_id"""
    try:
        if os.path.exists(VERIFY_PENDING_RETRY_FILE):
            with open(VERIFY_PENDING_RETRY_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
    except:
        pass
    return {}  # {user_id: [{email, password, original_country, failed_at}, ...]}

def save_verify_pending_retry(pending_retry):
    """Lưu danh sách acc thất bại chờ retry"""
    os.makedirs(os.path.dirname(VERIFY_PENDING_RETRY_FILE), exist_ok=True)
    with open(VERIFY_PENDING_RETRY_FILE, "w", encoding="utf-8") as f:
        json.dump(pending_retry, f, ensure_ascii=False, indent=2)

def add_failed_accounts_for_retry(user_id: int, accounts: list):
    """Thêm acc thất bại vào danh sách chờ retry
    
    Args:
        user_id: ID của user
        accounts: List of {email, password, failed_country}
    """
    pending = load_verify_pending_retry()
    user_key = str(user_id)
    
    if user_key not in pending:
        pending[user_key] = []
    
    # Thêm acc mới (tránh trùng lặp email)
    existing_emails = {acc["email"] for acc in pending[user_key]}
    for acc in accounts:
        if acc["email"] not in existing_emails:
            pending[user_key].append({
                "email": acc["email"],
                "password": acc["password"],
                "failed_country": acc.get("failed_country", ""),
                "failed_at": get_vietnam_now().isoformat()
            })
    
    save_verify_pending_retry(pending)
    logging.info(f"📝 Đã lưu {len(accounts)} acc thất bại cho user {user_id} chờ retry")

def get_failed_accounts_for_retry(user_id: int) -> list:
    """Lấy danh sách acc thất bại chờ retry của user"""
    pending = load_verify_pending_retry()
    return pending.get(str(user_id), [])

def clear_failed_accounts_for_retry(user_id: int):
    """Xóa danh sách acc thất bại sau khi đã retry"""
    pending = load_verify_pending_retry()
    user_key = str(user_id)
    if user_key in pending:
        del pending[user_key]
        save_verify_pending_retry(pending)
        logging.info(f"🗑️ Đã xóa danh sách acc chờ retry của user {user_id}")

# ==============================================================================
# SMS PROVIDER SETTINGS (ADMIN ONLY)
# ==============================================================================

SMS_PROVIDER_CONFIG_FILE = "config/sms_provider_config.json"

def load_sms_provider_config():
    """Load SMS provider config"""
    try:
        if os.path.exists(SMS_PROVIDER_CONFIG_FILE):
            with open(SMS_PROVIDER_CONFIG_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
    except Exception as e:
        logging.error(f"Lỗi load SMS provider config: {e}")
    
    # Default config
    return {
        "active_provider": "smspool",
        "providers": {
            "smspool": {"name": "SMSPool", "api_key": "", "enabled": True},
            "codesim": {"name": "Codesim", "api_key": "", "enabled": True},
            "viotp": {"name": "Viotp", "api_key": "", "enabled": False}
        }
    }

def save_sms_provider_config(config):
    """Lưu SMS provider config"""
    try:
        os.makedirs(os.path.dirname(SMS_PROVIDER_CONFIG_FILE), exist_ok=True)
        with open(SMS_PROVIDER_CONFIG_FILE, 'w', encoding='utf-8') as f:
            json.dump(config, f, ensure_ascii=False, indent=4)
        return True
    except Exception as e:
        logging.error(f"Lỗi lưu SMS provider config: {e}")
        return False

def get_active_sms_provider():
    """Lấy provider đang active"""
    config = load_sms_provider_config()
    return config.get("active_provider", "smspool")

def set_active_sms_provider(provider_name: str) -> bool:
    """Đặt provider active"""
    config = load_sms_provider_config()
    if provider_name in config.get("providers", {}):
        config["active_provider"] = provider_name
        return save_sms_provider_config(config)
    return False

async def cmd_settingverify(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Admin: Cài đặt SMS provider cho verify phone"""
    user_id = update.effective_user.id
    
    # Chỉ admin mới dùng được
    if not is_admin(user_id):
        await update.message.reply_text(
            "❌ Bạn không có quyền sử dụng lệnh này.",
            parse_mode='HTML'
        )
        return
    
    # Load config hiện tại
    config = load_sms_provider_config()
    active_provider = config.get("active_provider", "smspool")
    providers = config.get("providers", {})
    
    # Tạo keyboard với các provider
    keyboard = []
    for key, provider_info in providers.items():
        if not provider_info.get("enabled", True):
            continue
        
        name = provider_info.get("name", key.upper())
        # Đánh dấu provider đang active
        if key == active_provider:
            btn_text = f"✅ {name} (đang dùng)"
        else:
            btn_text = f"⬜ {name}"
        
        keyboard.append([InlineKeyboardButton(btn_text, callback_data=f"sms_provider|{key}")])
    
    # Thêm nút đóng
    keyboard.append([InlineKeyboardButton("❌ Đóng", callback_data="sms_provider|close")])
    
    await update.message.reply_text(
        f"⚙️ <b>CÀI ĐẶT SMS PROVIDER</b>\n\n"
        f"📱 Provider hiện tại: <b>{active_provider.upper()}</b>\n\n"
        f"Chọn provider bạn muốn sử dụng cho chức năng Verify Phone.\n"
        f"Tất cả admin và khách hàng sẽ dùng provider được chọn.",
        reply_markup=InlineKeyboardMarkup(keyboard),
        parse_mode='HTML'
    )

async def handle_sms_provider_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Xử lý khi admin chọn SMS provider"""
    query = update.callback_query
    await query.answer()
    
    user_id = query.from_user.id
    
    # Chỉ admin mới dùng được
    if not is_admin(user_id):
        await query.answer("❌ Bạn không có quyền!", show_alert=True)
        return
    
    data = query.data  # sms_provider|smspool hoặc sms_provider|codesim hoặc sms_provider|close
    parts = data.split("|")
    if len(parts) != 2:
        return
    
    action = parts[1]
    
    if action == "close":
        await query.message.delete()
        return
    
    provider_key = action  # smspool, codesim, viotp
    
    # Load config
    config = load_sms_provider_config()
    providers = config.get("providers", {})
    
    if provider_key not in providers:
        await query.answer("❌ Provider không hợp lệ!", show_alert=True)
        return
    
    # Kiểm tra provider có enabled không
    provider_info = providers.get(provider_key, {})
    if not provider_info.get("enabled", True):
        await query.answer("❌ Provider này chưa được hỗ trợ!", show_alert=True)
        return
    
    # Kiểm tra Codesim có API key chưa
    if provider_key == "codesim":
        api_key = provider_info.get("api_key", "")
        if not api_key:
            await query.message.edit_text(
                f"⚠️ <b>CODESIM CHƯA CÓ API KEY</b>\n\n"
                f"Vui lòng cập nhật API key Codesim trong file:\n"
                f"<code>config/sms_provider_config.json</code>\n\n"
                f"Hoặc liên hệ developer để cấu hình.",
                parse_mode='HTML'
            )
            return
    
    # Kiểm tra Viotp có API key chưa
    if provider_key == "viotp":
        api_key = provider_info.get("api_key", "")
        if not api_key:
            await query.message.edit_text(
                f"⚠️ <b>VIOTP CHƯA CÓ API KEY</b>\n\n"
                f"Vui lòng cập nhật API key Viotp trong file:\n"
                f"<code>config/sms_provider_config.json</code>",
                parse_mode='HTML'
            )
            return
    
    # Kiểm tra 365OTP có API key chưa
    if provider_key == "365otp":
        api_key = provider_info.get("api_key", "")
        if not api_key:
            await query.message.edit_text(
                f"⚠️ <b>365OTP CHƯA CÓ API KEY</b>\n\n"
                f"Vui lòng cập nhật API key 365OTP trong file:\n"
                f"<code>config/sms_provider_config.json</code>",
                parse_mode='HTML'
            )
            return
    
    # Đổi provider
    old_provider = config.get("active_provider", "smspool")
    if set_active_sms_provider(provider_key):
        provider_name = provider_info.get("name", provider_key.upper())
        
        # Cập nhật lại keyboard
        config = load_sms_provider_config()  # Reload
        active_provider = config.get("active_provider", "smspool")
        
        keyboard = []
        for key, pinfo in providers.items():
            if not pinfo.get("enabled", True):
                continue
            
            name = pinfo.get("name", key.upper())
            if key == active_provider:
                btn_text = f"✅ {name} (đang dùng)"
            else:
                btn_text = f"⬜ {name}"
            
            keyboard.append([InlineKeyboardButton(btn_text, callback_data=f"sms_provider|{key}")])
        
        keyboard.append([InlineKeyboardButton("❌ Đóng", callback_data="sms_provider|close")])
        
        await query.message.edit_text(
            f"✅ <b>ĐÃ ĐỔI SMS PROVIDER</b>\n\n"
            f"📱 Provider cũ: <code>{old_provider.upper()}</code>\n"
            f"📱 Provider mới: <b>{provider_name}</b>\n\n"
            f"Tất cả verify phone sẽ sử dụng <b>{provider_name}</b> từ bây giờ.",
            reply_markup=InlineKeyboardMarkup(keyboard),
            parse_mode='HTML'
        )
        
        logging.info(f"✅ Admin {user_id} đã đổi SMS provider: {old_provider} → {provider_key}")
    else:
        await query.answer("❌ Lỗi khi đổi provider!", show_alert=True)

# ==============================================================================
# MENU PHONE - Admin cấu hình quốc gia cho SMSPool
# ==============================================================================

# State cho conversation handler
MENU_PHONE_SELECT_TRIES = 100  # State chờ nhập số lần thử

async def cmd_menu_phone(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Admin: Cấu hình quốc gia cho verify phone (chỉ SMSPool)"""
    user_id = update.effective_user.id
    
    # Chỉ admin mới dùng được
    if not is_admin(user_id):
        await update.message.reply_text(
            "❌ Bạn không có quyền sử dụng lệnh này.",
            parse_mode='HTML'
        )
        return
    
    # Chỉ dùng được khi đang dùng SMSPool
    active_provider = get_active_sms_provider()
    if active_provider.lower() != "smspool":
        await update.message.reply_text(
            f"❌ <b>Lệnh này chỉ dùng được khi đang dùng SMSPool!</b>\n\n"
            f"Provider hiện tại: <code>{active_provider.upper()}</code>\n\n"
            f"Dùng /settingverify để chuyển sang SMSPool trước.",
            parse_mode='HTML'
        )
        return
    
    # Load config hiện tại
    config = load_sms_provider_config()
    smspool_config = config.get("providers", {}).get("smspool", {})
    current_countries = smspool_config.get("admin_countries", [
        {"code": "ID", "name": "Indonesia", "dial_code": "+62", "max_tries": 2},
        {"code": "NL", "name": "Netherlands", "dial_code": "+31", "max_tries": 3}
    ])
    
    # Danh sách quốc gia có sẵn
    available_countries = config.get("available_countries", [
        {"code": "VN", "name": "Vietnam", "dial_code": "+84"},
        {"code": "ID", "name": "Indonesia", "dial_code": "+62"},
        {"code": "NL", "name": "Netherlands", "dial_code": "+31"},
        {"code": "EE", "name": "Estonia", "dial_code": "+372"},
        {"code": "PH", "name": "Philippines", "dial_code": "+63"},
    ])
    
    # Hiển thị cấu hình hiện tại
    current_text = "📋 <b>CẤU HÌNH HIỆN TẠI:</b>\n"
    total_tries = 0
    for i, c in enumerate(current_countries):
        current_text += f"  {i+1}. {c['name']} ({c['code']}): {c['max_tries']} lần\n"
        total_tries += c.get('max_tries', 0)
    current_text += f"  📊 Tổng: {total_tries} lần/account\n\n"
    
    # Tạo keyboard chọn quốc gia
    keyboard = []
    for country in available_countries:
        code = country["code"]
        name = country["name"]
        # Check if already selected
        is_selected = any(c.get("code") == code for c in current_countries)
        if is_selected:
            btn_text = f"✅ {name} ({code})"
        else:
            btn_text = f"⬜ {name} ({code})"
        keyboard.append([InlineKeyboardButton(btn_text, callback_data=f"menu_phone|select|{code}")])
    
    keyboard.append([InlineKeyboardButton("🔄 Reset về mặc định", callback_data="menu_phone|reset")])
    keyboard.append([InlineKeyboardButton("❌ Đóng", callback_data="menu_phone|close")])
    
    await update.message.reply_text(
        f"📱 <b>CÀI ĐẶT QUỐC GIA CHO ADMIN (SMSPOOL)</b>\n\n"
        f"{current_text}"
        f"<b>HƯỚNG DẪN:</b>\n"
        f"• Chọn tối đa 5 quốc gia\n"
        f"• Tổng số lần thử tối đa: 5\n"
        f"• Quốc gia 1 sẽ thử trước, nếu fail sẽ đổi sang quốc gia tiếp theo\n\n"
        f"<b>Chọn quốc gia để cấu hình:</b>",
        reply_markup=InlineKeyboardMarkup(keyboard),
        parse_mode='HTML'
    )

async def handle_menu_phone_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Xử lý callback từ menu_phone"""
    query = update.callback_query
    await query.answer()
    
    user_id = query.from_user.id
    
    if not is_admin(user_id):
        await query.answer("❌ Bạn không có quyền!", show_alert=True)
        return
    
    data = query.data  # menu_phone|select|ID, menu_phone|tries|ID|2, menu_phone|reset, menu_phone|close
    parts = data.split("|")
    
    if len(parts) < 2:
        return
    
    action = parts[1]
    
    if action == "close":
        await query.message.delete()
        return
    
    if action == "reset":
        # Reset về mặc định
        config = load_sms_provider_config()
        if "providers" in config and "smspool" in config["providers"]:
            config["providers"]["smspool"]["admin_countries"] = [
                {"code": "ID", "name": "Indonesia", "dial_code": "+62", "max_tries": 2},
                {"code": "NL", "name": "Netherlands", "dial_code": "+31", "max_tries": 3}
            ]
            save_sms_provider_config(config)
        
        await query.message.edit_text(
            "✅ <b>ĐÃ RESET VỀ MẶC ĐỊNH</b>\n\n"
            "📋 Cấu hình mới:\n"
            "  1. Indonesia (ID): 2 lần\n"
            "  2. Netherlands (NL): 3 lần\n"
            "  📊 Tổng: 5 lần/account",
            parse_mode='HTML'
        )
        return
    
    if action == "select":
        if len(parts) < 3:
            return
        
        country_code = parts[2]
        
        # Load config
        config = load_sms_provider_config()
        smspool_config = config.get("providers", {}).get("smspool", {})
        current_countries = smspool_config.get("admin_countries", [])
        available_countries = config.get("available_countries", [])
        
        # Tìm thông tin quốc gia
        country_info = next((c for c in available_countries if c["code"] == country_code), None)
        if not country_info:
            await query.answer("❌ Quốc gia không hợp lệ!", show_alert=True)
            return
        
        # Check if already selected
        is_selected = any(c.get("code") == country_code for c in current_countries)
        
        if is_selected:
            # Bỏ chọn
            current_countries = [c for c in current_countries if c.get("code") != country_code]
            config["providers"]["smspool"]["admin_countries"] = current_countries
            save_sms_provider_config(config)
            
            await query.answer(f"🗑️ Đã bỏ {country_info['name']}", show_alert=False)
        else:
            # Kiểm tra đã chọn đủ 5 chưa
            if len(current_countries) >= 5:
                await query.answer("⚠️ Đã chọn đủ 5 quốc gia! Bỏ quốc gia cũ trước.", show_alert=True)
                return
            
            # Hiển thị menu chọn số lần thử
            total_tries_used = sum(c.get("max_tries", 0) for c in current_countries)
            remaining_tries = 5 - total_tries_used
            
            keyboard = []
            for i in range(1, min(remaining_tries + 1, 5)):
                keyboard.append([InlineKeyboardButton(f"{i} lần", callback_data=f"menu_phone|tries|{country_code}|{i}")])
            keyboard.append([InlineKeyboardButton("⬅️ Quay lại", callback_data="menu_phone|back")])
            
            await query.message.edit_text(
                f"📱 <b>CHỌN SỐ LẦN THỬ</b>\n\n"
                f"Quốc gia: <b>{country_info['name']} ({country_code})</b>\n"
                f"Đầu số: {country_info.get('dial_code', '')}\n\n"
                f"Số lần thử còn lại: <b>{remaining_tries}</b>\n"
                f"(Tổng tối đa 5 lần cho các quốc gia)\n\n"
                f"Chọn số lần thử cho quốc gia này:",
                reply_markup=InlineKeyboardMarkup(keyboard),
                parse_mode='HTML'
            )
            return
        
        # Refresh menu
        await refresh_menu_phone(query)
        return
    
    if action == "tries":
        if len(parts) < 4:
            return
        
        country_code = parts[2]
        tries = int(parts[3])
        
        # Load config
        config = load_sms_provider_config()
        available_countries = config.get("available_countries", [])
        
        # Tìm thông tin quốc gia
        country_info = next((c for c in available_countries if c["code"] == country_code), None)
        if not country_info:
            await query.answer("❌ Quốc gia không hợp lệ!", show_alert=True)
            return
        
        # Thêm quốc gia vào config
        current_countries = config.get("providers", {}).get("smspool", {}).get("admin_countries", [])
        
        # Kiểm tra tổng số lần
        total_tries_used = sum(c.get("max_tries", 0) for c in current_countries)
        if total_tries_used + tries > 5:
            await query.answer(f"⚠️ Tổng số lần vượt quá 5! (hiện tại: {total_tries_used})", show_alert=True)
            return
        
        new_country = {
            "code": country_code,
            "name": country_info["name"],
            "dial_code": country_info.get("dial_code", ""),
            "max_tries": tries
        }
        current_countries.append(new_country)
        
        config["providers"]["smspool"]["admin_countries"] = current_countries
        save_sms_provider_config(config)
        
        await query.answer(f"✅ Đã thêm {country_info['name']}: {tries} lần", show_alert=False)
        
        # Refresh menu
        await refresh_menu_phone(query)
        return
    
    if action == "back":
        await refresh_menu_phone(query)
        return

async def refresh_menu_phone(query):
    """Refresh hiển thị menu phone"""
    config = load_sms_provider_config()
    smspool_config = config.get("providers", {}).get("smspool", {})
    current_countries = smspool_config.get("admin_countries", [])
    available_countries = config.get("available_countries", [])
    
    # Hiển thị cấu hình hiện tại
    current_text = "📋 <b>CẤU HÌNH HIỆN TẠI:</b>\n"
    total_tries = 0
    if current_countries:
        for i, c in enumerate(current_countries):
            current_text += f"  {i+1}. {c['name']} ({c['code']}): {c['max_tries']} lần\n"
            total_tries += c.get('max_tries', 0)
        current_text += f"  📊 Tổng: {total_tries} lần/account\n\n"
    else:
        current_text += "  (Chưa chọn quốc gia nào)\n\n"
    
    # Tạo keyboard
    keyboard = []
    for country in available_countries:
        code = country["code"]
        name = country["name"]
        is_selected = any(c.get("code") == code for c in current_countries)
        if is_selected:
            # Hiển thị số lần đã chọn
            selected_country = next((c for c in current_countries if c.get("code") == code), {})
            btn_text = f"✅ {name} ({code}) - {selected_country.get('max_tries', 0)} lần"
        else:
            btn_text = f"⬜ {name} ({code})"
        keyboard.append([InlineKeyboardButton(btn_text, callback_data=f"menu_phone|select|{code}")])
    
    keyboard.append([InlineKeyboardButton("🔄 Reset về mặc định", callback_data="menu_phone|reset")])
    keyboard.append([InlineKeyboardButton("❌ Đóng", callback_data="menu_phone|close")])
    
    await query.message.edit_text(
        f"📱 <b>CÀI ĐẶT QUỐC GIA CHO ADMIN (SMSPOOL)</b>\n\n"
        f"{current_text}"
        f"<b>HƯỚNG DẪN:</b>\n"
        f"• Chọn tối đa 5 quốc gia\n"
        f"• Tổng số lần thử tối đa: 5\n"
        f"• Quốc gia 1 sẽ thử trước, nếu fail sẽ đổi sang quốc gia tiếp theo\n\n"
        f"<b>Chọn quốc gia để cấu hình:</b>",
        reply_markup=InlineKeyboardMarkup(keyboard),
        parse_mode='HTML'
    )


async def handle_verify_365otp_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Xử lý khi khách chọn quốc gia cho 365OTP (VN hoặc ID)"""
    query = update.callback_query
    await query.answer()
    
    user_id = query.from_user.id
    data = query.data
    
    if data == "verify_365otp|cancel":
        await query.edit_message_text(
            "❌ <b>Đã hủy verify phone.</b>",
            parse_mode='HTML'
        )
        return ConversationHandler.END
    
    if not data.startswith("verify_365otp|"):
        return
    
    country_code = data.split("|")[1]  # VN hoặc ID
    
    # Xác định giá và thông tin
    if country_code == "VN":
        price = 2800
        country_name = "🇻🇳 Việt Nam (+84)"
        dial_code = "+84"
    elif country_code == "ID":
        price = 2300
        country_name = "🇮🇩 Indonesia (+62)"
        dial_code = "+62"
    else:
        await query.edit_message_text(
            "⚠️ <b>Quốc gia không hợp lệ!</b>",
            parse_mode='HTML'
        )
        return ConversationHandler.END
    
    # Kiểm tra số dư
    current_balance = get_user_balance(user_id)
    max_accounts = current_balance // price if price > 0 else 0
    
    if max_accounts == 0:
        await query.edit_message_text(
            f"⚠️ <b>Số dư không đủ!</b>\n\n"
            f"📱 Đã chọn: <b>{country_name}</b>\n"
            f"💰 Giá: <b>{price:,}đ</b>/account\n"
            f"💳 Số dư: <b>{format_balance(current_balance)}</b>\n\n"
            f"💡 Vui lòng nạp thêm tiền.",
            parse_mode='HTML'
        )
        return ConversationHandler.END
    
    # Lưu thông tin vào context
    context.user_data['verify_country'] = country_code
    context.user_data['verify_country_365otp'] = country_code  # Đánh dấu dùng 365OTP
    context.user_data['verify_price'] = price
    context.user_data['verify_dial_code'] = dial_code
    
    await query.edit_message_text(
        f"✅ <b>Đã chọn: {country_name}</b>\n\n"
        f"💰 Giá: <b>{price:,}đ</b>/account\n"
        f"💳 Số dư: <b>{format_balance(current_balance)}</b>\n"
        f"📊 Có thể verify: <b>{max_accounts}</b> account\n\n"
        f"🔹 Gửi thông tin theo format:\n"
        f"<code>email|password</code>\n\n"
        f"📝 Ví dụ:\n"
        f"<code>example@gmail.com|mypassword123</code>\n\n"
        f"💡 Có thể gửi nhiều account (mỗi dòng 1 account)\n\n"
        f"❌ Gửi /cancel để hủy",
        parse_mode='HTML'
    )
    
    return WAITING_VERIFY_CREDENTIALS


async def cmd_verify_phone(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Verify phone cho Google account - Admin miễn phí, khách dùng balance"""
    user_id = update.effective_user.id
    user = update.effective_user
    
    # ===== KIỂM TRA BẢO TRÌ - CHỈ KHÁCH BỊ CHẶN, ADMIN BYPASS =====
    if await check_maintenance_block(update, user_id, "verify_phone"):
        return ConversationHandler.END
    # ================================================================
    
    # Lưu thông tin user vào context
    context.user_data['verify_user_id'] = user_id
    context.user_data['verify_username'] = user.username or user.full_name
    context.user_data['verify_fullname'] = user.full_name
    
    # Kiểm tra provider đang active
    active_provider = get_active_sms_provider()
    
    if is_admin(user_id):
        # Admin - miễn phí, nhập trực tiếp email|password
        provider_info = f"📡 Provider: <b>{active_provider.upper()}</b>\n" if active_provider else ""
        await update.message.reply_text(
            f"📱 <b>VERIFY PHONE GOOGLE ACCOUNT</b>\n"
            f"👑 <i>Admin - Miễn phí</i>\n\n"
            f"{provider_info}"
            f"🔹 Gửi thông tin theo format:\n"
            f"<code>email|password</code>\n\n"
            f"📝 Ví dụ:\n"
            f"<code>example@gmail.com|mypassword123</code>\n\n"
            f"💡 Có thể gửi nhiều account (mỗi dòng 1 account)\n\n"
            f"❌ Gửi /cancel để hủy",
            parse_mode='HTML'
        )
        return WAITING_VERIFY_CREDENTIALS
    else:
        # Khách hàng
        current_balance = get_user_balance(user_id)
        
        # ========== CODESIM: Không cần chọn quốc gia ==========
        if active_provider == "codesim":
            # Codesim: Giá cố định, không cần chọn quốc gia
            codesim_price = 4000  # Giá Codesim cho Gmail
            max_accounts = current_balance // codesim_price if codesim_price > 0 else 0
            
            # Lưu giá vào context
            context.user_data['verify_country'] = "VN"  # Codesim dùng sim VN
            context.user_data['verify_price'] = codesim_price
            
            if max_accounts <= 0:
                await update.message.reply_text(
                    f"📱 <b>VERIFY PHONE</b>\n\n"
                    f"💳 Số dư: <b>{format_balance(current_balance)}</b>\n"
                    f"💰 Giá: <b>{codesim_price:,}đ</b>/account\n\n"
                    f"❌ <b>Số dư không đủ!</b>\n"
                    f"Vui lòng /naptien để nạp thêm.",
                    parse_mode='HTML'
                )
                return ConversationHandler.END
            
            await update.message.reply_text(
                f"📱 <b>VERIFY PHONE</b>\n\n"
                f"💳 Số dư: <b>{format_balance(current_balance)}</b>\n"
                f"💰 Giá: <b>{codesim_price:,}đ</b>/account\n"
                f"📊 Có thể verify: <b>{max_accounts}</b> account\n\n"
                f"🔹 Gửi thông tin theo format:\n"
                f"<code>email|password</code>\n\n"
                f"📝 Ví dụ:\n"
                f"<code>example@gmail.com|mypassword123</code>\n\n"
                f"💡 Có thể gửi nhiều account (mỗi dòng 1 account)\n\n"
                f"❌ Gửi /cancel để hủy",
                parse_mode='HTML'
            )
            return WAITING_VERIFY_CREDENTIALS
        
        # ========== VIOTP: Không cần chọn quốc gia (chỉ VN) ==========
        if active_provider == "viotp":
            # Viotp: Giá cố định 3500đ, chỉ sim Việt Nam
            viotp_price = 3500  # Giá Viotp cho Google/Gmail
            max_accounts = current_balance // viotp_price if viotp_price > 0 else 0
            
            # Lưu giá vào context
            context.user_data['verify_country'] = "VN"  # Viotp dùng sim VN
            context.user_data['verify_price'] = viotp_price
            
            if max_accounts <= 0:
                await update.message.reply_text(
                    f"📱 <b>VERIFY PHONE</b>\n\n"
                    f"💳 Số dư: <b>{format_balance(current_balance)}</b>\n"
                    f"💰 Giá: <b>{viotp_price:,}đ</b>/account\n\n"
                    f"❌ <b>Số dư không đủ!</b>\n"
                    f"Vui lòng /naptien để nạp thêm.",
                    parse_mode='HTML'
                )
                return ConversationHandler.END
            
            await update.message.reply_text(
                f"📱 <b>VERIFY PHONE</b>\n\n"
                f"💳 Số dư: <b>{format_balance(current_balance)}</b>\n"
                f"💰 Giá: <b>{viotp_price:,}đ</b>/account\n"
                f"📊 Có thể verify: <b>{max_accounts}</b> account\n\n"
                f"🔹 Gửi thông tin theo format:\n"
                f"<code>email|password</code>\n\n"
                f"📝 Ví dụ:\n"
                f"<code>example@gmail.com|mypassword123</code>\n\n"
                f"💡 Có thể gửi nhiều account (mỗi dòng 1 account)\n\n"
                f"❌ Gửi /cancel để hủy",
                parse_mode='HTML'
            )
            return WAITING_VERIFY_CREDENTIALS
        
        # ========== 365OTP: Hiển thị menu chọn VN hoặc ID cho khách ==========
        if active_provider == "365otp":
            # 365OTP: 2 quốc gia - VN (2800đ) và ID (2300đ)
            vn_price = 2800
            id_price = 2300
            
            max_vn = current_balance // vn_price if vn_price > 0 else 0
            max_id = current_balance // id_price if id_price > 0 else 0
            
            if max_vn <= 0 and max_id <= 0:
                await update.message.reply_text(
                    f"📱 <b>VERIFY PHONE</b>\n\n"
                    f"💳 Số dư: <b>{format_balance(current_balance)}</b>\n\n"
                    f"💰 Bảng giá:\n"
                    f"  • 🇻🇳 Việt Nam: <b>{vn_price:,}đ</b>/account\n"
                    f"  • 🇮🇩 Indonesia: <b>{id_price:,}đ</b>/account\n\n"
                    f"❌ <b>Số dư không đủ!</b>\n"
                    f"Vui lòng /naptien để nạp thêm.",
                    parse_mode='HTML'
                )
                return ConversationHandler.END
            
            # Tạo keyboard chọn quốc gia
            keyboard = []
            if max_vn > 0:
                keyboard.append([InlineKeyboardButton(
                    f"🇻🇳 Việt Nam - {vn_price:,}đ (max {max_vn} acc)", 
                    callback_data="verify_365otp|VN"
                )])
            if max_id > 0:
                keyboard.append([InlineKeyboardButton(
                    f"🇮🇩 Indonesia - {id_price:,}đ (max {max_id} acc)", 
                    callback_data="verify_365otp|ID"
                )])
            keyboard.append([InlineKeyboardButton("❌ Hủy", callback_data="verify_365otp|cancel")])
            
            await update.message.reply_text(
                f"📱 <b>VERIFY PHONE - 365OTP</b>\n\n"
                f"💳 Số dư: <b>{format_balance(current_balance)}</b>\n\n"
                f"🌍 <b>Chọn quốc gia:</b>\n\n"
                f"🇻🇳 <b>Việt Nam (+84)</b>\n"
                f"   💰 Giá: {vn_price:,}đ/account\n"
                f"   📊 Có thể verify: {max_vn} account\n\n"
                f"🇮🇩 <b>Indonesia (+62)</b>\n"
                f"   💰 Giá: {id_price:,}đ/account\n"
                f"   📊 Có thể verify: {max_id} account",
                reply_markup=InlineKeyboardMarkup(keyboard),
                parse_mode='HTML'
            )
            return WAITING_VERIFY_COUNTRY_365OTP
        
        # ========== SMSPOOL: Hiển thị menu chọn quốc gia ==========
        # Tạo message hiển thị bảng giá
        price_table = "📊 <b>BẢNG GIÁ VERIFY PHONE:</b>\n\n"
        
        # Sắp xếp theo success rate giảm dần
        sorted_countries = sorted(
            VERIFY_COUNTRY_PRICING.items(),
            key=lambda x: x[1]['success_rate'],
            reverse=True
        )
        
        for code, info in sorted_countries:
            price_fmt = f"{info['price']:,}".replace(",", ".")
            max_acc = current_balance // info['price'] if info['price'] > 0 else 0
            can_buy = "✅" if max_acc > 0 else "❌"
            price_table += f"{can_buy} <b>{info['name']}</b>\n"
            price_table += f"   💰 {price_fmt}đ • 📈 {info['success_rate']}%\n\n"
        
        # Tạo inline buttons cho mỗi quốc gia
        keyboard = []
        row = []
        for i, (code, info) in enumerate(sorted_countries):
            price_fmt = f"{info['price']:,}".replace(",", ".")
            btn_text = f"{info['name'].split()[0]} - {price_fmt}đ"
            row.append(InlineKeyboardButton(btn_text, callback_data=f"verify_country|{code}"))
            
            if len(row) == 2:  # 2 buttons per row
                keyboard.append(row)
                row = []
        
        if row:  # Add remaining buttons
            keyboard.append(row)
        
        keyboard.append([InlineKeyboardButton("❌ Hủy", callback_data="verify_cancel")])
        
        await update.message.reply_text(
            f"📱 <b>VERIFY PHONE</b>\n\n"
            f"💳 <b>Số dư của bạn:</b> {format_balance(current_balance)}\n\n"
            f"{price_table}"
            f"👇 <b>Chọn loại số điện thoại:</b>",
            parse_mode='HTML',
            reply_markup=InlineKeyboardMarkup(keyboard)
        )
        
        return WAITING_VERIFY_COUNTRY


async def handle_verify_country_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Xử lý khi khách chọn quốc gia để verify"""
    query = update.callback_query
    await query.answer()
    
    user_id = query.from_user.id
    data = query.data
    
    if data == "verify_cancel":
        await query.edit_message_text(
            "❌ <b>Đã hủy verify phone.</b>",
            parse_mode='HTML'
        )
        return ConversationHandler.END
    
    if not data.startswith("verify_country|"):
        return WAITING_VERIFY_COUNTRY
    
    # Lấy country code
    country_code = data.split("|")[1]
    
    if country_code not in VERIFY_COUNTRY_PRICING:
        await query.edit_message_text(
            "⚠️ <b>Quốc gia không hợp lệ!</b>",
            parse_mode='HTML'
        )
        return ConversationHandler.END
    
    country_info = VERIFY_COUNTRY_PRICING[country_code]
    price = country_info["price"]
    country_name = country_info["name"]
    success_rate = country_info["success_rate"]
    
    # Kiểm tra số dư
    current_balance = get_user_balance(user_id)
    max_accounts = current_balance // price if price > 0 else 0
    
    if max_accounts == 0:
        price_fmt = f"{price:,}".replace(",", ".")
        await query.edit_message_text(
            f"⚠️ <b>Số dư không đủ!</b>\n\n"
            f"📱 Số đã chọn: <b>{country_name}</b>\n"
            f"💰 Giá: <b>{price_fmt}đ</b>/acc\n"
            f"💳 Số dư hiện tại: <b>{format_balance(current_balance)}</b>\n\n"
            f"💡 Vui lòng nạp thêm tiền hoặc chọn số rẻ hơn.",
            parse_mode='HTML'
        )
        return ConversationHandler.END
    
    # Lưu country choice vào context
    context.user_data['verify_country_code'] = country_code
    context.user_data['verify_country_name'] = country_name
    context.user_data['verify_price'] = price
    context.user_data['verify_success_rate'] = success_rate
    
    price_fmt = f"{price:,}".replace(",", ".")
    
    await query.edit_message_text(
        f"✅ <b>Đã chọn: {country_name}</b>\n\n"
        f"💰 Giá: <b>{price_fmt}đ</b>/acc • 📈 {success_rate}%\n"
        f"💳 Số dư: <b>{format_balance(current_balance)}</b>\n"
        f"📊 Có thể verify: <b>{max_accounts}</b> account\n\n"
        f"📝 Vui lòng nhập <b>số lượng tài khoản</b> muốn verify:\n"
        f"(Ví dụ: Gửi <code>5</code> nếu muốn verify 5 tài khoản)\n\n"
        f"❌ Gửi /cancel để hủy",
        parse_mode='HTML'
    )
    
    return WAITING_VERIFY_QUANTITY


async def handle_verify_quantity(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Khách nhập số lượng account → kiểm tra balance và yêu cầu credentials
    Nếu khách gửi credentials trực tiếp (email|password) thì tự động xử lý
    """
    user_id = update.effective_user.id
    user = update.effective_user
    
    text = update.message.text.strip()
    
    # Lấy giá từ country đã chọn trong context
    country_code = context.user_data.get('verify_country_code', 'ID')
    country_name = context.user_data.get('verify_country_name', 'Indonesia 🇮🇩')
    price = context.user_data.get('verify_price', get_verify_price(country_code))
    
    # Phát hiện nếu khách gửi credentials trực tiếp (có @ và |)
    if '@' in text and '|' in text:
        # Khách gửi credentials trực tiếp, đếm số lượng và xử lý
        lines = [line.strip() for line in text.split('\n') if line.strip() and '@' in line and '|' in line]
        if lines:
            quantity = len(lines)
            total_amount = price * quantity
            
            current_balance = get_user_balance(user_id)
            
            if current_balance < total_amount:
                need_more = total_amount - current_balance
                await update.message.reply_text(
                    f"⚠️ <b>KHÔNG ĐỦ SỐ DƯ!</b>\n\n"
                    f"📱 Số: <b>{country_name}</b>\n"
                    f"📧 Số account: <b>{quantity}</b>\n"
                    f"💰 Giá: {price:,}đ x {quantity} = <b>{total_amount:,}đ</b>\n"
                    f"💳 Số dư hiện tại: <b>{format_balance(current_balance)}</b>\n"
                    f"❌ Thiếu: <b>{format_balance(need_more)}</b>\n\n"
                    f"💡 Vui lòng nạp thêm tiền.\n"
                    f"Bấm nút <b>💰 Nạp Tiền</b> để nạp.",
                    parse_mode='HTML',
                    reply_markup=get_reply_keyboard(update.effective_user.id if update and update.effective_user else None)
                )
                return ConversationHandler.END
            
            # Đủ balance - lưu thông tin và forward tới handle_verify_credentials
            context.user_data['verify_quantity'] = quantity
            context.user_data['verify_total_amount'] = total_amount
            
            # Gọi trực tiếp handle_verify_credentials
            return await handle_verify_credentials(update, context)
    
    # Kiểm tra số lượng hợp lệ
    try:
        quantity = int(text)
        if quantity <= 0:
            raise ValueError("Số lượng phải > 0")
        if quantity > 100:
            await update.message.reply_text(
                "⚠️ <b>Số lượng quá lớn!</b>\n\n"
                "Tối đa 100 tài khoản mỗi lần.\n"
                "Vui lòng nhập lại số lượng:",
                parse_mode='HTML'
            )
            return WAITING_VERIFY_QUANTITY
    except ValueError:
        await update.message.reply_text(
            "⚠️ <b>Số lượng không hợp lệ!</b>\n\n"
            "Vui lòng nhập một số nguyên dương.\n"
            "Ví dụ: <code>5</code>\n\n"
            "💡 Hoặc gửi trực tiếp email|password nếu muốn verify ngay.",
            parse_mode='HTML'
        )
        return WAITING_VERIFY_QUANTITY
    
    # Tính tiền và kiểm tra balance
    total_amount = price * quantity
    price_formatted = f"{price:,}".replace(",", ".")
    total_formatted = f"{total_amount:,}".replace(",", ".")
    
    current_balance = get_user_balance(user_id)
    
    if current_balance < total_amount:
        need_more = total_amount - current_balance
        await update.message.reply_text(
            f"⚠️ <b>KHÔNG ĐỦ SỐ DƯ!</b>\n\n"
            f"💰 Giá: {price_formatted}đ x {quantity} = <b>{total_formatted}đ</b>\n"
            f"💳 Số dư hiện tại: <b>{format_balance(current_balance)}</b>\n"
            f"❌ Thiếu: <b>{format_balance(need_more)}</b>\n\n"
            f"💡 Vui lòng nạp thêm tiền hoặc giảm số lượng.\n"
            f"Bấm nút <b>💰 Nạp Tiền</b> để nạp.",
            parse_mode='HTML',
            reply_markup=get_reply_keyboard(update.effective_user.id if update and update.effective_user else None)
        )
        return ConversationHandler.END
    
    # Đủ balance - lưu thông tin và yêu cầu credentials
    context.user_data['verify_quantity'] = quantity
    context.user_data['verify_total_amount'] = total_amount
    
    balance_after = current_balance - total_amount
    
    await update.message.reply_text(
        f"✅ <b>XÁC NHẬN VERIFY PHONE</b>\n\n"
        f"📧 Số account: <b>{quantity}</b>\n"
        f"💰 Giá: {price_formatted}đ x {quantity} = <b>{total_formatted}đ</b>\n\n"
        f"💳 Số dư hiện tại: {format_balance(current_balance)}\n"
        f"💳 Sau khi trừ: <b>{format_balance(balance_after)}</b>\n\n"
        f"━━━━━━━━━━━━━━━━\n"
        f"📝 Bây giờ hãy gửi thông tin <b>{quantity}</b> tài khoản theo format:\n\n"
        f"<code>email1|password1\nemail2|password2\n...</code>\n\n"
        f"⚠️ <b>Lưu ý:</b> Mỗi dòng 1 account (email|password)\n\n"
        f"❌ Gửi /cancel để hủy",
        parse_mode='HTML'
    )
    
    logging.info(f"📱 Khách {user_id} xác nhận verify {quantity} accounts, cần {total_formatted}đ")
    
    return WAITING_VERIFY_CREDENTIALS


async def handle_verify_credentials(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Nhận email|password và xử lý - Admin miễn phí, khách thanh toán"""
    user_id = update.effective_user.id
    user = update.effective_user
    
    text = update.message.text.strip()
    
    # Tách nhiều dòng - mỗi dòng là 1 account
    lines = [line.strip() for line in text.split('\n') if line.strip()]
    
    if not lines:
        await update.message.reply_text(
            "⚠️ <b>Không có dữ liệu!</b>\n\n"
            "Vui lòng gửi theo format:\n"
            "<code>email|password</code>\n\n"
            "Hoặc nhiều account (mỗi dòng 1 account):\n"
            "<code>email1|password1\nemail2|password2</code>",
            parse_mode='HTML'
        )
        return WAITING_VERIFY_CREDENTIALS
    
    # Parse từng dòng
    accounts = []
    errors = []
    
    for i, line in enumerate(lines, 1):
        if '|' not in line:
            errors.append(f"Dòng {i}: Thiếu dấu |")
            continue
        
        parts = line.split('|', 1)
        email = parts[0].strip()
        password = parts[1].strip() if len(parts) > 1 else ""
        
        if '@' not in email:
            errors.append(f"Dòng {i}: Email không hợp lệ")
            continue
        if not password:
            errors.append(f"Dòng {i}: Thiếu password")
            continue
        
        accounts.append({"email": email, "password": password})
    
    if not accounts:
        error_msg = "\n".join(errors) if errors else "Không parse được account nào"
        await update.message.reply_text(
            f"⚠️ <b>Lỗi!</b>\n\n{error_msg}",
            parse_mode='HTML'
        )
        return WAITING_VERIFY_CREDENTIALS
    
    now = get_vietnam_now()
    
    # Đọc active_provider từ file config
    active_provider = "codesim"  # Default fallback
    try:
        sms_config_path = os.path.join(os.path.dirname(__file__), "config", "sms_provider_config.json")
        if os.path.exists(sms_config_path):
            with open(sms_config_path, 'r', encoding='utf-8') as f:
                sms_config = json.load(f)
                active_provider = sms_config.get("active_provider", "codesim")
    except Exception as e:
        logging.warning(f"Không thể đọc sms_provider_config.json: {e}")
    
    # ============= ADMIN - MIỄN PHÍ =============
    if is_admin(user_id):
        queue = load_verify_queue()
        task_ids = []
        
        for idx, acc in enumerate(accounts):
            task_id = f"VRF_{now.strftime('%Y%m%d_%H%M%S')}_{random.randint(100, 999)}"
            task = {
                "id": task_id,
                "email": acc["email"],
                "password": acc["password"],
                "status": "pending",
                "user_id": user_id,
                "username": user.username or user.full_name,
                "is_admin": True,
                "sms_provider": active_provider,  # Lưu provider để xử lý đúng
                # Admin SMSPool: để trống để verify_phone_tool dùng admin_countries từ config
                # Admin 365OTP: mặc định VN với fallback ID
                "country_code": "VN" if active_provider == "365otp" else "",
                "fallback_to_id": active_provider == "365otp",  # Flag cho fallback VN→ID
                "created_at": now.isoformat()
            }
            queue.append(task)
            task_ids.append(task_id)
        
        save_verify_queue(queue)
        
        # Thông báo xác nhận cho admin
        if len(accounts) == 1:
            await update.message.reply_text(
                f"✅ <b>ĐÃ NHẬN ĐƠN VERIFY!</b>\n\n"
                f"📧 Email: <code>{accounts[0]['email']}</code>\n\n"
                f"⏳ Đang xử lý verify...\n"
                f"📊 Dùng /verify_status để xem trạng thái\n\n"
                f"💡 Bạn sẽ nhận thông báo khi verify hoàn tất.",
                parse_mode='HTML'
            )
        else:
            email_list = "\n".join([f"  • {acc['email']}" for acc in accounts[:10]])
            if len(accounts) > 10:
                email_list += f"\n  ... và {len(accounts) - 10} account khác"
            
            await update.message.reply_text(
                f"✅ <b>ĐÃ NHẬN ĐƠN VERIFY {len(accounts)} ACCOUNT!</b>\n\n"
                f"📧 Danh sách:\n{email_list}\n\n"
                f"⏳ Đang xử lý verify (5 luồng song song)...\n"
                f"📊 Dùng /verify_status để xem trạng thái\n\n"
                f"💡 Bạn sẽ nhận thông báo khi verify hoàn tất.",
                parse_mode='HTML'
            )
        
        if errors:
            error_msg = "\n".join(errors[:5])
            await update.message.reply_text(
                f"⚠️ <b>Một số dòng bị lỗi:</b>\n{error_msg}",
                parse_mode='HTML'
            )
        
        logging.info(f"📱 Admin {user_id} thêm {len(accounts)} verify tasks")
        
        # Gửi thông báo cho tất cả admin
        await send_to_all_admins(
            context.bot,
            f"📱 <b>ĐƠN VERIFY MỚI (ADMIN)</b>\n\n"
            f"👤 Admin: {user.full_name}\n"
            f"📧 Số account: {len(accounts)}\n"
            f"⏰ Thời gian: {now.strftime('%H:%M %d/%m/%Y')}",
            parse_mode='HTML'
        )
        
        return ConversationHandler.END
    
    # ============= KHÁCH - DÙNG BALANCE =============
    # Lấy thông tin từ context (đã lưu ở handle_verify_quantity)
    expected_quantity = context.user_data.get('verify_quantity', 0)
    expected_amount = context.user_data.get('verify_total_amount', 0)
    
    # Kiểm tra số lượng credentials khớp với đã đặt
    if expected_quantity > 0 and len(accounts) != expected_quantity:
        await update.message.reply_text(
            f"⚠️ <b>SỐ LƯỢNG KHÔNG KHỚP!</b>\n\n"
            f"📧 Đã yêu cầu: <b>{expected_quantity}</b> tài khoản\n"
            f"📝 Bạn gửi: <b>{len(accounts)}</b> tài khoản\n\n"
            f"Vui lòng gửi đúng <b>{expected_quantity}</b> tài khoản.",
            parse_mode='HTML'
        )
        return WAITING_VERIFY_CREDENTIALS
    
    # Nếu chưa có thông tin từ context (người dùng gọi trực tiếp), tính lại
    if expected_quantity == 0:
        # Ưu tiên đọc verify_price từ context (đã set cho Codesim ở cmd_verify_phone)
        price = context.user_data.get('verify_price', 0)
        if not price:
            # Fallback về giá theo quốc gia (SMSPool)
            price = get_verify_price(context.user_data.get('verify_country', 'ID'))
        expected_quantity = len(accounts)
        expected_amount = price * expected_quantity
    
    # Kiểm tra và trừ balance
    current_balance = get_user_balance(user_id)
    if current_balance < expected_amount:
        await update.message.reply_text(
            f"⚠️ <b>KHÔNG ĐỦ SỐ DƯ!</b>\n\n"
            f"💰 Cần: <b>{format_balance(expected_amount)}</b>\n"
            f"💳 Số dư: <b>{format_balance(current_balance)}</b>\n\n"
            f"Vui lòng nạp thêm tiền.\n"
            f"Bấm nút <b>💰 Nạp Tiền</b> để nạp.",
            parse_mode='HTML',
            reply_markup=get_reply_keyboard(update.effective_user.id if update and update.effective_user else None)
        )
        return ConversationHandler.END
    
    # KHÔNG TRỪ TIỀN Ở ĐÂY - Chỉ trừ khi verify THÀNH CÔNG
    # Lưu thông tin giá vào task để trừ sau khi verify xong
    price_per_account = expected_amount // len(accounts) if len(accounts) > 0 else get_verify_price()
    
    # Thêm tasks vào queue
    queue = load_verify_queue()
    task_ids = []
    
    for acc in accounts:
        task_id = f"VRF_{now.strftime('%Y%m%d_%H%M%S')}_{random.randint(100, 999)}"
        task = {
            "id": task_id,
            "email": acc["email"],
            "password": acc["password"],
            "status": "pending",
            "user_id": user_id,
            "username": user.username or user.full_name,
            "is_admin": False,
            "amount_to_charge": price_per_account,  # Giá sẽ trừ khi SUCCESS
            "sms_provider": active_provider,  # Lưu provider
            # Lấy country đúng: verify_country_code (từ flow chọn quốc gia)
            "country_code": context.user_data.get('verify_country_code') or context.user_data.get('verify_country_365otp') or context.user_data.get('verify_country', ''),
            "created_at": now.isoformat()
        }
        queue.append(task)
        task_ids.append(task_id)
    
    save_verify_queue(queue)
    
    # Xóa context data
    context.user_data.pop('verify_quantity', None)
    context.user_data.pop('verify_total_amount', None)
    
    # Thông báo cho khách
    email_list = "\n".join([f"  • {acc['email']}" for acc in accounts[:5]])
    if len(accounts) > 5:
        email_list += f"\n  ... và {len(accounts) - 5} account khác"
    
    await update.message.reply_text(
        f"✅ <b>ĐÃ NHẬN ĐƠN VERIFY {len(accounts)} ACCOUNT!</b>\n\n"
        f"💰 Giá: <b>{format_balance(expected_amount)}</b>\n"
        f"💳 Số dư hiện tại: <b>{format_balance(current_balance)}</b>\n\n"
        f"📧 Danh sách:\n{email_list}\n\n"
        f"⏳ Đang xử lý verify (5 luồng song song)...\n"
        f"📊 Dùng /verify_status để xem trạng thái\n\n"
        f"💡 <b>LƯU Ý:</b> Tiền chỉ bị trừ khi verify THÀNH CÔNG!",
        parse_mode='HTML',
        reply_markup=get_reply_keyboard(update.effective_user.id if update and update.effective_user else None)
    )
    
    if errors:
        error_msg = "\n".join(errors[:5])
        await update.message.reply_text(
            f"⚠️ <b>Một số dòng bị lỗi:</b>\n{error_msg}",
            parse_mode='HTML'
        )
    
    logging.info(f"📱 Khách {user_id} gửi {len(accounts)} credentials, đã trừ {expected_amount}đ")
    
    # Thông báo cho admin
    await send_to_all_admins(
        context.bot,
        f"📱 <b>ĐƠN VERIFY MỚI (KHÁCH - BALANCE)</b>\n\n"
        f"👤 Khách: {user.full_name} (@{user.username or 'N/A'})\n"
        f"📧 Số account: {len(accounts)}\n"
        f"💰 Giá: {format_balance(expected_amount)}\n"
        f"💳 Số dư hiện tại: {format_balance(current_balance)}\n"
        f"⏰ Thời gian: {now.strftime('%H:%M %d/%m/%Y')}",
        parse_mode='HTML'
    )
    
    return ConversationHandler.END

async def cmd_verify_status(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Xem trạng thái verify - Hiển thị rõ ràng từng account"""
    user_id = update.effective_user.id
    
    # Load data
    queue = load_verify_queue()
    results = load_verify_results()
    
    if is_admin(user_id):
        # Admin xem tất cả
        pending = [t for t in queue if t.get("status") == "pending"]
        processing = [t for t in queue if t.get("status") == "processing"]
        # Hiển thị TẤT CẢ kết quả (không lọc notified)
        success_results = [r for r in results if r.get("status") == "success"]
        failed_results = [r for r in results if r.get("status") not in ["success", "skipped", None]]
        skipped_results = [r for r in results if r.get("status") == "skipped"]
    else:
        # Khách chỉ xem của mình - hiển thị TẤT CẢ kết quả của họ
        pending = [t for t in queue if t.get("status") == "pending" and t.get("user_id") == user_id]
        processing = [t for t in queue if t.get("status") == "processing" and t.get("user_id") == user_id]
        success_results = [r for r in results if r.get("status") == "success" and r.get("user_id") == user_id]
        failed_results = [r for r in results if r.get("status") not in ["success", "skipped", None] and r.get("user_id") == user_id]
        skipped_results = [r for r in results if r.get("status") == "skipped" and r.get("user_id") == user_id]
    
    msg = f"📊 <b>TRẠNG THÁI VERIFY PHONE</b>\n"
    msg += "─────────────────────\n\n"
    
    # Đang xử lý - chỉ số lượng
    if processing:
        msg += f"🔄 <b>Đang xử lý:</b> {len(processing)} account\n\n"
    
    # Pending - danh sách email
    if pending:
        msg += f"⏳ <b>Đang chờ:</b> {len(pending)} account\n"
        for t in pending[:10]:
            msg += f"   • <code>{t.get('email', 'N/A')}</code>\n"
        if len(pending) > 10:
            msg += f"   ... và {len(pending) - 10} account khác\n"
        msg += "\n"
    
    # Thành công - danh sách chi tiết
    if success_results:
        msg += f"✅ <b>Thành công:</b> {len(success_results)} account\n"
        for r in success_results[:10]:
            phone = r.get('phone_used', '')
            email = r.get('email', 'N/A')
            if phone:
                msg += f"   ✅ <code>{email}</code> (SĐT: {phone})\n"
            else:
                msg += f"   ✅ <code>{email}</code>\n"
        if len(success_results) > 10:
            msg += f"   ... và {len(success_results) - 10} account khác\n"
        msg += "\n"
    
    # Bỏ qua
    if skipped_results:
        msg += f"⏭️ <b>Bỏ qua (không cần verify):</b> {len(skipped_results)} account\n"
        for r in skipped_results[:5]:
            msg += f"   ⏭️ <code>{r.get('email', 'N/A')}</code>\n"
        if len(skipped_results) > 5:
            msg += f"   ... và {len(skipped_results) - 5} account khác\n"
        msg += "\n"
    
    # Thất bại - danh sách chi tiết + GỢI Ý RETRY
    keyboard = None
    if failed_results:
        msg += f"❌ <b>Thất bại:</b> {len(failed_results)} account\n"
        for r in failed_results[:10]:
            msg += f"   ❌ <code>{r.get('email', 'N/A')}</code>\n"
        if len(failed_results) > 10:
            msg += f"   ... và {len(failed_results) - 10} account khác\n"
        msg += "\n"
        
        # Lưu danh sách acc thất bại để retry (chỉ cho khách, không cho admin)
        if not is_admin(user_id):
            failed_accounts = []
            queue = load_verify_queue()
            for r in failed_results:
                # Tìm password từ queue nếu có
                email = r.get("email", "")
                password = ""
                for q in queue:
                    if q.get("email") == email:
                        password = q.get("password", "")
                        break
                if email and password:
                    failed_accounts.append({
                        "email": email,
                        "password": password,
                        "failed_country": r.get("failed_country", "")
                    })
            
            if failed_accounts:
                add_failed_accounts_for_retry(user_id, failed_accounts)
                
                # Thêm gợi ý và keyboard chọn quốc gia mới
                msg += "💡 <b>Bạn có thể thử lại với quốc gia khác!</b>\n"
                msg += "Chọn quốc gia bên dưới để retry tất cả account thất bại:\n\n"
                
                keyboard = [
                    [
                        InlineKeyboardButton("🇮🇩 ID - 5,500đ", callback_data=f"verify_retry_ID"),
                        InlineKeyboardButton("🇳🇱 NL - 8,500đ", callback_data=f"verify_retry_NL"),
                    ],
                    [
                        InlineKeyboardButton("🇪🇪 EE - 12,000đ", callback_data=f"verify_retry_EE"),
                        InlineKeyboardButton("🇵🇱 PL - 11,000đ", callback_data=f"verify_retry_PL"),
                    ],
                    [
                        InlineKeyboardButton("🇭🇷 HR - 8,000đ", callback_data=f"verify_retry_HR"),
                        InlineKeyboardButton("🇧🇷 BR - 8,300đ", callback_data=f"verify_retry_BR"),
                    ],
                    [
                        InlineKeyboardButton("❌ Không retry", callback_data="verify_retry_cancel"),
                    ]
                ]
    
    # Nếu không có gì
    if not pending and not processing and not success_results and not failed_results and not skipped_results:
        msg += "📭 Không có task verify nào.\n"
    
    if keyboard:
        await update.message.reply_text(msg, parse_mode='HTML', reply_markup=InlineKeyboardMarkup(keyboard))
    else:
        await update.message.reply_text(msg, parse_mode='HTML')

async def handle_verify_retry_country(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Xử lý khi khách chọn quốc gia mới để retry các account thất bại"""
    query = update.callback_query
    await query.answer()
    
    user_id = query.from_user.id
    user = query.from_user
    callback_data = query.data  # verify_retry_ID, verify_retry_NL, verify_retry_cancel, ...
    
    # Xử lý hủy retry
    if callback_data == "verify_retry_cancel":
        clear_failed_accounts_for_retry(user_id)
        await query.edit_message_text(
            "❌ <b>Đã hủy retry.</b>\n\n"
            "Danh sách account thất bại đã được xóa.\n"
            "Bạn có thể gửi lại account nếu muốn verify.",
            parse_mode='HTML'
        )
        return
    
    # Lấy country code từ callback_data
    country_code = callback_data.replace("verify_retry_", "")
    if country_code not in VERIFY_COUNTRY_PRICING:
        await query.edit_message_text("❌ Quốc gia không hợp lệ.")
        return
    
    # Lấy danh sách account thất bại
    failed_accounts = get_failed_accounts_for_retry(user_id)
    if not failed_accounts:
        await query.edit_message_text(
            "❌ <b>Không có account nào để retry.</b>\n\n"
            "Danh sách có thể đã được xử lý hoặc hết hạn.",
            parse_mode='HTML'
        )
        return
    
    # Tính giá và kiểm tra balance
    country_info = VERIFY_COUNTRY_PRICING[country_code]
    price_per_account = country_info["price"]
    total_amount = price_per_account * len(failed_accounts)
    current_balance = get_user_balance(user_id)
    
    if current_balance < total_amount:
        await query.edit_message_text(
            f"⚠️ <b>KHÔNG ĐỦ SỐ DƯ!</b>\n\n"
            f"📧 Số account cần retry: <b>{len(failed_accounts)}</b>\n"
            f"💰 Giá mỗi account ({country_code}): <b>{format_balance(price_per_account)}</b>\n"
            f"💰 Tổng cần: <b>{format_balance(total_amount)}</b>\n"
            f"💳 Số dư hiện tại: <b>{format_balance(current_balance)}</b>\n\n"
            f"Vui lòng nạp thêm tiền để retry.",
            parse_mode='HTML'
        )
        return
    
    # Đọc active_provider từ file config
    active_provider = "smspool"  # Default fallback
    try:
        sms_config_path = os.path.join(os.path.dirname(__file__), "config", "sms_provider_config.json")
        if os.path.exists(sms_config_path):
            with open(sms_config_path, 'r', encoding='utf-8') as f:
                sms_config = json.load(f)
                active_provider = sms_config.get("active_provider", "smspool")
    except Exception as e:
        logging.warning(f"Không thể đọc sms_provider_config.json: {e}")
    
    # Thêm tasks mới vào queue với quốc gia mới
    queue = load_verify_queue()
    now = get_vietnam_now()
    task_ids = []
    
    for acc in failed_accounts:
        task_id = f"VRF_RETRY_{now.strftime('%Y%m%d_%H%M%S')}_{random.randint(100, 999)}"
        task = {
            "id": task_id,
            "email": acc["email"],
            "password": acc["password"],
            "status": "pending",
            "user_id": user_id,
            "username": user.username or user.full_name,
            "is_admin": False,
            "amount_to_charge": price_per_account,
            "sms_provider": active_provider,
            "country_code": country_code,  # Quốc gia mới do khách chọn
            "is_retry": True,  # Đánh dấu là retry
            "original_country": acc.get("failed_country", ""),  # Quốc gia cũ đã thất bại
            "created_at": now.isoformat()
        }
        queue.append(task)
        task_ids.append(task_id)
    
    save_verify_queue(queue)
    
    # Xóa danh sách pending retry sau khi đã tạo task
    clear_failed_accounts_for_retry(user_id)
    
    # Thông báo cho khách
    email_list = "\n".join([f"  • {acc['email']}" for acc in failed_accounts[:5]])
    if len(failed_accounts) > 5:
        email_list += f"\n  ... và {len(failed_accounts) - 5} account khác"
    
    await query.edit_message_text(
        f"✅ <b>ĐÃ GỬI RETRY {len(failed_accounts)} ACCOUNT!</b>\n\n"
        f"🌍 Quốc gia mới: <b>{country_info['name']}</b>\n"
        f"💰 Giá mỗi account: <b>{format_balance(price_per_account)}</b>\n"
        f"💰 Tổng: <b>{format_balance(total_amount)}</b>\n"
        f"💳 Số dư hiện tại: <b>{format_balance(current_balance)}</b>\n\n"
        f"📧 Danh sách retry:\n{email_list}\n\n"
        f"⏳ Đang xử lý verify...\n"
        f"📊 Dùng /verify_status để xem trạng thái\n\n"
        f"💡 <b>LƯU Ý:</b> Tiền chỉ bị trừ khi verify THÀNH CÔNG!",
        parse_mode='HTML'
    )
    
    logging.info(f"🔄 User {user_id} retry {len(failed_accounts)} accounts với quốc gia {country_code}")
    
    # Thông báo cho admin
    await send_to_all_admins(
        context.bot,
        f"🔄 <b>RETRY VERIFY</b>\n\n"
        f"👤 Khách: {user.full_name} (ID: {user_id})\n"
        f"📧 Số account: {len(failed_accounts)}\n"
        f"🌍 Quốc gia mới: {country_info['name']}\n"
        f"💰 Tổng: {format_balance(total_amount)}\n"
        f"⏰ {now.strftime('%H:%M %d/%m/%Y')}",
        parse_mode='HTML'
    )

async def cmd_stopverify(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Dừng verify phone tool qua chat - Admin only"""
    user_id = update.effective_user.id
    
    if not is_admin(user_id):
        await update.message.reply_text("❌ Bạn không có quyền sử dụng lệnh này.")
        return
    
    try:
        # Ghi file signal để dừng verify_phone_tool.py
        signal_file = "pending_orders/verify_stop_signal.json"
        os.makedirs(os.path.dirname(signal_file), exist_ok=True)
        with open(signal_file, 'w', encoding='utf-8') as f:
            json.dump({
                "stopped": True,
                "stopped_at": get_vietnam_now().isoformat(),
                "stopped_by": user_id
            }, f, ensure_ascii=False, indent=2)
        
        STOPPED_FEATURES["verify_phone"] = True
        
        await update.message.reply_text(
            "🛑 <b>VERIFY PHONE TOOL ĐÃ DỪNG!</b>\n\n"
            "⏸️ Tool sẽ DỪNG VÔ THỜI HẠN cho đến khi admin gọi /startverify\n"
            "📌 Các task đang chạy sẽ hoàn thành trước khi dừng.\n\n"
            "✅ Dùng <code>/startverify</code> để tiếp tục.",
            parse_mode='HTML'
        )
        logging.info(f"🛑 Admin {user_id} đã DỪNG verify phone tool qua /stopverify")
        
    except Exception as e:
        logging.error(f"Lỗi ghi stop signal: {e}")
        await update.message.reply_text(f"❌ Lỗi: {e}")

async def cmd_startverify(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Tiếp tục verify phone tool qua chat - Admin only"""
    user_id = update.effective_user.id
    
    if not is_admin(user_id):
        await update.message.reply_text("❌ Bạn không có quyền sử dụng lệnh này.")
        return
    
    try:
        # Xóa file signal để verify_phone_tool.py tiếp tục
        signal_file = "pending_orders/verify_stop_signal.json"
        if os.path.exists(signal_file):
            os.remove(signal_file)
        
        STOPPED_FEATURES.pop("verify_phone", None)
        
        await update.message.reply_text(
            "✅ <b>Verify phone tool đã được MỞ LẠI!</b>\n\n"
            "📌 Tool sẽ tiếp tục xử lý tasks trong vài giây.\n"
            "📌 Dùng <code>/stopverify</code> để dừng lại.",
            parse_mode='HTML'
        )
        logging.info(f"✅ Admin {user_id} đã MỞ LẠI verify phone tool qua /startverify")
        
    except Exception as e:
        logging.error(f"Lỗi xóa stop signal: {e}")
        await update.message.reply_text(f"❌ Lỗi: {e}")

async def cmd_cancel_verify(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Hủy quá trình nhập verify"""
    await update.message.reply_text("❌ Đã hủy.")
    return ConversationHandler.END

async def handle_credentials_for_verify_phone(update: Update, context: ContextTypes.DEFAULT_TYPE) -> bool:
    """Xử lý nhận email|password sau khi khách đã thanh toán đơn verify_phone
    
    Returns:
        True nếu đã xử lý, False nếu không phải credentials cho verify_phone
    """
    if not update.message or not update.message.text:
        return False
    
    user_id = update.effective_user.id
    text = update.message.text.strip()
    
    # Tìm đơn verify_phone đang chờ credentials của user này
    target_order = None
    target_code = None
    
    for order_code, order in pending_orders.items():
        if (order.get('product_type') == 'verify_phone' and
            order.get('user_id') == user_id and
            order.get('waiting_for_credentials')):
            target_order = order
            target_code = order_code
            break
    
    if not target_order:
        return False
    
    # Parse email|password
    lines = [line.strip() for line in text.split('\n') if line.strip()]
    if not lines:
        return False
    
    accounts = []
    errors = []
    
    for i, line in enumerate(lines, 1):
        if '|' not in line:
            errors.append(f"Dòng {i}: Thiếu dấu |")
            continue
        
        parts = line.split('|', 1)
        email = parts[0].strip()
        password = parts[1].strip() if len(parts) > 1 else ""
        
        if '@' not in email:
            errors.append(f"Dòng {i}: Email không hợp lệ")
            continue
        if not password:
            errors.append(f"Dòng {i}: Thiếu password")
            continue
        
        accounts.append({"email": email, "password": password})
    
    if not accounts:
        error_msg = "\n".join(errors[:5]) if errors else "Không parse được account nào"
        await update.message.reply_text(
            f"⚠️ <b>Lỗi!</b>\n\n{error_msg}\n\n"
            f"📝 Vui lòng gửi lại theo format:\n"
            f"<code>email|password</code>",
            parse_mode='HTML'
        )
        return True
    
    expected_qty = target_order.get('quantity', 0)
    if len(accounts) != expected_qty:
        await update.message.reply_text(
            f"⚠️ <b>Số lượng không khớp!</b>\n\n"
            f"📧 Bạn đã đặt: <b>{expected_qty}</b> tài khoản\n"
            f"📝 Bạn gửi: <b>{len(accounts)}</b> tài khoản\n\n"
            f"Vui lòng gửi đúng <b>{expected_qty}</b> tài khoản.",
            parse_mode='HTML'
        )
        return True
    
    # Thêm vào queue verify
    now = get_vietnam_now()
    queue = load_verify_queue()
    
    for acc in accounts:
        task_id = f"VRF_{now.strftime('%Y%m%d_%H%M%S')}_{random.randint(100, 999)}"
        task = {
            "id": task_id,
            "email": acc["email"],
            "password": acc["password"],
            "status": "pending",
            "user_id": user_id,
            "username": target_order.get('username', ''),
            "is_admin": False,
            "order_code": target_code,
            "created_at": now.isoformat()
        }
        queue.append(task)
    
    save_verify_queue(queue)
    
    # Thông báo thành công cho khách
    await update.message.reply_text(
        f"✅ <b>ĐÃ NHẬN {len(accounts)} TÀI KHOẢN!</b>\n\n"
        f"📦 Mã đơn: <code>{target_code}</code>\n\n"
        f"⏳ Tool đang xử lý verify (5 luồng song song)...\n"
        f"💡 Bạn sẽ nhận thông báo khi verify hoàn tất.\n\n"
        f"📊 Dùng /verify_status để xem trạng thái",
        parse_mode='HTML'
    )
    
    # Thông báo cho admin
    await send_to_all_admins(
        context.bot,
        f"✅ <b>KHÁCH ĐÃ GỬI CREDENTIALS!</b>\n\n"
        f"📦 Mã đơn: <code>{target_code}</code>\n"
        f"👤 Khách: {target_order.get('user_fullname', 'N/A')}\n"
        f"📧 Số account: {len(accounts)}\n\n"
        f"⏳ Đã thêm vào queue verify...",
        parse_mode='HTML'
    )
    
    # Xóa đơn khỏi pending
    del pending_orders[target_code]
    save_pending_orders()
    
    if errors:
        error_msg = "\n".join(errors[:3])
        await update.message.reply_text(
            f"⚠️ <b>Một số dòng bị lỗi:</b>\n{error_msg}",
            parse_mode='HTML'
        )
    
    logging.info(f"📱 Khách {user_id} gửi {len(accounts)} credentials cho đơn {target_code}")
    
    return True

async def check_verify_phone_payments_job(context: ContextTypes.DEFAULT_TYPE):
    """Job chạy định kỳ kiểm tra thanh toán cho đơn verify_phone
    
    LAZY-FETCH: Chỉ gọi API khi có đơn verify_phone đang chờ thanh toán
    và đơn còn mới (trong vòng 1 giờ)
    """
    current_time = time.time()
    MAX_ORDER_AGE = 3600  # 1 giờ - bỏ qua đơn cũ hơn
    
    try:
        # Tìm các đơn verify_phone đang chờ thanh toán - CHỈ ĐƠN TRONG VÒNG 1 GIỜ
        verify_orders = []
        for order_code, order in list(pending_orders.items()):
            created_at = order.get('created_at', 0)
            
            # Xử lý cả trường hợp created_at là ISO string (đơn cũ) hoặc timestamp số (đơn mới)
            if isinstance(created_at, str):
                try:
                    from datetime import datetime
                    dt = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
                    created_at = dt.timestamp()
                except:
                    created_at = 0
            
            order_age = current_time - created_at
            
            # Bỏ qua đơn quá cũ (hơn 1 giờ)
            if order_age > MAX_ORDER_AGE:
                continue
                
            if (order.get('product_type') == 'verify_phone' and 
                order.get('status') == 'pending_payment' and
                not order.get('waiting_for_credentials')):
                verify_orders.append((order_code, order))
        
        # LAZY-FETCH: Skip nếu không có đơn nào
        if not verify_orders:
            return  # Không gọi API, return ngay
        
        # Lấy danh sách giao dịch từ API
        try:
            api_cfg = get_apicanhan_config()
            if not has_valid_apicanhan_config(api_cfg):
                return
            
            tx_list = fetch_apicanhan_transactions()
            if not tx_list:
                return
        except Exception as e:
            logging.debug(f"Lỗi fetch transactions cho verify_phone: {e}")
            return
        
        # Kiểm tra từng đơn
        for order_code, order in verify_orders:
            try:
                expected_amount = float(order.get('total_amount', 0))
                
                is_paid, payment_info = match_payment_in_transactions(order_code, expected_amount, tx_list)
                
                if is_paid:
                    logging.info(f"✅ Đã nhận thanh toán verify_phone cho đơn {order_code}")
                    
                    # Gọi deliver_order_logic để xử lý
                    success, message = await deliver_order_logic(order_code, context)
                    
                    if success:
                        logging.info(f"✅ Đã xử lý đơn verify_phone {order_code} thành công")
                    else:
                        logging.warning(f"⚠️ Xử lý đơn verify_phone {order_code} thất bại: {message}")
                        
            except Exception as e:
                logging.error(f"Lỗi kiểm tra thanh toán verify_phone {order_code}: {e}")
                continue
                
    except Exception as e:
        logging.debug(f"check_verify_phone_payments_job error: {e}")

async def check_verify_results_job(context: ContextTypes.DEFAULT_TYPE):
    """Job chạy định kỳ kiểm tra kết quả verify và thông báo cho KHÁCH + ADMIN
    
    Format thông báo giống nhau cho cả khách và admin:
    - Task ID, Email, Status, SĐT, Số lần thử
    """
    try:
        # Kiểm tra file tồn tại
        if not os.path.exists(VERIFY_RESULTS_FILE):
            return
        
        results = load_verify_results()
        if not results or not isinstance(results, list):
            return
        
        # Lọc kết quả chưa thông báo
        pending_results = []
        for result in results:
            if not isinstance(result, dict):
                continue
            if result.get("notified"):
                continue
            pending_results.append(result)
        
        if not pending_results:
            return
        
        logging.info(f"📤 Có {len(pending_results)} kết quả verify cần thông báo")
        
        # Group theo user_id để gửi riêng cho từng user
        user_results = {}
        no_user_results = []  # Kết quả không có user_id
        
        for r in pending_results:
            # Ưu tiên user_id, fallback về admin_id
            user_id = r.get("user_id") or r.get("admin_id")
            logging.info(f"   Result {r.get('id')}: user_id={r.get('user_id')}, admin_id={r.get('admin_id')}")
            if user_id:
                if user_id not in user_results:
                    user_results[user_id] = []
                user_results[user_id].append(r)
            else:
                no_user_results.append(r)
        
        # Log thống kê
        logging.info(f"   Grouped: {len(user_results)} users, {len(no_user_results)} no-user results")
        
        sent_count = 0
        
        # Gửi cho từng user (bao gồm cả khách và admin đã gửi đơn)
        for user_id, user_pending in user_results.items():
            if not user_pending:
                continue
            
            # Thống kê
            user_total = len(user_pending)
            user_success = sum(1 for r in user_pending if r.get("status") == "success")
            user_skipped = sum(1 for r in user_pending if r.get("status") == "skipped")
            user_failed = user_total - user_success - user_skipped
            
            # ===== TRỪ TIỀN CHO VERIFY THÀNH CÔNG (CHỈ KHÁCH, KHÔNG ADMIN) =====
            charge_amount = 0
            charge_count = 0
            for r in user_pending:
                # Chỉ trừ tiền cho khách (không phải admin)
                if r.get("is_admin"):
                    continue
                # Chỉ trừ tiền cho verify THÀNH CÔNG
                if r.get("status") == "success":
                    amount_to_charge = r.get("amount_to_charge", 0)
                    if amount_to_charge > 0:
                        charge_amount += amount_to_charge
                        charge_count += 1
            
            # Thực hiện trừ tiền nếu có verify thành công
            if charge_amount > 0:
                success, new_balance = subtract_user_balance(user_id, charge_amount)
                if success:
                    logging.info(f"💰 Trừ {format_balance(charge_amount)} từ user {user_id} ({charge_count} verify thành công)")
                else:
                    logging.warning(f"⚠️ Không thể trừ {format_balance(charge_amount)} từ user {user_id} - không đủ số dư")
            
            # Tạo message với format giống ảnh
            msg = f"📱 <b>KẾT QUẢ VERIFY PHONE</b>\n"
            msg += f"📋 Tổng: <b>{user_total}</b> tài khoản\n\n"
            
            if user_success > 0:
                msg += f"✅ Thành công: <b>{user_success}</b>\n"
            if user_skipped > 0:
                msg += f"⏭️ Bỏ qua: <b>{user_skipped}</b>\n"
            if user_failed > 0:
                msg += f"❌ Thất bại: <b>{user_failed}</b>\n"
            
            # Thông báo trừ tiền nếu có
            if charge_amount > 0:
                msg += f"\n💸 <b>ĐÃ TRỪ:</b> -{format_balance(charge_amount)} ({charge_count} account thành công)\n"
            
            msg += "\n" + "─" * 25 + "\n"
            
            # Chi tiết từng account
            for r in user_pending[:15]:  # Giới hạn 15 để tránh tin quá dài
                task_id = r.get("id", "N/A")
                email = r.get("email", "N/A")
                status = r.get("status", "unknown")
                phone_used = r.get("phone_used", "")
                attempts = r.get("attempts", 0)
                proxy_used = r.get("proxy_used", "")  # IP proxy đã dùng
                
                # Icon theo status
                if status == "success":
                    icon = "✅"
                    status_text = "THÀNH CÔNG"
                elif status == "skipped":
                    icon = "⏭️"
                    status_text = "BỎ QUA"
                else:
                    icon = "❌"
                    status_text = "THẤT BẠI"
                
                msg += f"\n{icon} Task: <code>{task_id}</code>\n"
                msg += f"📧 Email: <code>{email}</code>\n"
                msg += f"📌 Status: <b>{status_text}</b>\n"
                if phone_used:
                    msg += f"📱 SĐT: <code>{phone_used}</code>\n"
                msg += f"🔄 Số lần thử: {attempts}\n"
                if proxy_used:
                    msg += f"🌐 IP: <code>{proxy_used}</code>\n"
            
            if len(user_pending) > 15:
                msg += f"\n... và {len(user_pending) - 15} account khác\n"
            
            # GỬI CHO USER (KHÁCH HOẶC ADMIN ĐÃ GỬI ĐƠN)
            try:
                await context.bot.send_message(chat_id=user_id, text=msg, parse_mode='HTML')
                sent_count += 1
                logging.info(f"✅ Đã gửi kết quả verify cho user {user_id} ({user_total} accounts)")
            except Exception as e:
                logging.warning(f"❌ Lỗi gửi thông báo verify cho user {user_id}: {e}")
            
            await asyncio.sleep(0.3)
        
        # LUÔN gửi bản tổng hợp cho TẤT CẢ ADMIN
        if pending_results:
            total_accounts = len(pending_results)
            success_count = sum(1 for r in pending_results if r.get("status") == "success")
            skipped_count = sum(1 for r in pending_results if r.get("status") == "skipped")
            failed_count = total_accounts - success_count - skipped_count
            
            admin_msg = f"📱 <b>KẾT QUẢ VERIFY PHONE (ADMIN)</b>\n"
            admin_msg += f"📋 Tổng: <b>{total_accounts}</b> tài khoản\n\n"
            
            if success_count > 0:
                admin_msg += f"✅ Thành công: <b>{success_count}</b>\n"
            if skipped_count > 0:
                admin_msg += f"⏭️ Bỏ qua: <b>{skipped_count}</b>\n"
            if failed_count > 0:
                admin_msg += f"❌ Thất bại: <b>{failed_count}</b>\n"
            
            admin_msg += "\n" + "─" * 25 + "\n"
            
            # Chi tiết
            for r in pending_results[:10]:
                task_id = r.get("id", "N/A")
                email = r.get("email", "N/A")
                status = r.get("status", "unknown")
                phone_used = r.get("phone_used", "")
                attempts = r.get("attempts", 0)
                submitter_id = r.get("user_id") or r.get("admin_id")
                
                if status == "success":
                    icon = "✅"
                    status_text = "THÀNH CÔNG"
                elif status == "skipped":
                    icon = "⏭️"
                    status_text = "BỎ QUA"
                else:
                    icon = "❌"
                    status_text = "THẤT BẠI"
                
                admin_msg += f"\n{icon} Task: <code>{task_id}</code>\n"
                admin_msg += f"📧 Email: <code>{email}</code>\n"
                admin_msg += f"📌 Status: <b>{status_text}</b>\n"
                if phone_used:
                    admin_msg += f"📱 SĐT: <code>{phone_used}</code>\n"
                admin_msg += f"🔄 Số lần thử: {attempts}\n"
                if submitter_id and submitter_id not in ADMIN_IDS:
                    admin_msg += f"👤 Khách: {submitter_id}\n"
            
            if len(pending_results) > 10:
                admin_msg += f"\n... và {len(pending_results) - 10} account khác\n"
            
            for admin_id in ADMIN_IDS:
                try:
                    await context.bot.send_message(chat_id=admin_id, text=admin_msg, parse_mode='HTML')
                    sent_count += 1
                except Exception as e:
                    logging.debug(f"Lỗi gửi thông báo verify cho admin {admin_id}: {e}")
                await asyncio.sleep(0.1)
        
        if sent_count > 0:
            # Đánh dấu đã thông báo
            for r in pending_results:
                r["notified"] = True
            
            try:
                with open(VERIFY_RESULTS_FILE, "w", encoding="utf-8") as f:
                    json.dump(results, f, ensure_ascii=False, indent=2)
            except:
                pass
            
            logging.info(f"📤 Đã gửi kết quả verify ({len(pending_results)} accounts) cho {sent_count} người")
            
    except Exception as e:
        logging.error(f"check_verify_results_job error: {e}")


# ==============================================================================
# Seller Menu Callback Handler
# ==============================================================================

async def handle_seller_menu_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle seller menu button clicks"""
    global BOT_STOPPED
    query = update.callback_query
    user_id = query.from_user.id
    
    # Kiểm tra bảo trì - Admin bypass
    if not is_admin(user_id) and BOT_STOPPED:
        await query.answer(MAINTENANCE_ALERT, show_alert=True)
        return
    
    await query.answer()
    
    action = query.data.replace("seller_menu_", "")
    
    try:
        # Import seller commands
        from seller_commands import (
            cmd_dangky_seller, cmd_check_balance_seller, 
            cmd_nap_api_seller, cmd_mua_hang_seller,
            get_linked_reseller, get_balance, format_money
        )
        
        if action == "dangky":
            # Create a fake update with message for the command handler
            await query.edit_message_text("⏳ Đang xử lý...")
            # Check if already registered
            user_id = update.effective_user.id
            linked = get_linked_reseller(user_id)
            if linked:
                await query.edit_message_text(
                    f"ℹ️ <b>Bạn đã là Reseller!</b>\n\n"
                    f"📋 Reseller ID: <code>{linked.get('reseller_id')}</code>\n\n"
                    f"📌 Dùng các nút bên dưới để thao tác.",
                    parse_mode='HTML'
                )
            else:
                await query.edit_message_text(
                    "🎉 <b>ĐĂNG KÝ TRỞ THÀNH RESELLER</b>\n\n"
                    "Gõ lệnh: /dangky_seller\n"
                    "Sau đó nhập tên shop của bạn.",
                    parse_mode='HTML'
                )
        
        elif action == "balance":
            user_id = update.effective_user.id
            linked = get_linked_reseller(user_id)
            if linked:
                api_key = linked.get("api_key")
                balance_info = get_balance(api_key)
                if balance_info:
                    await query.edit_message_text(
                        f"💰 <b>Số dư tài khoản Reseller</b>\n\n"
                        f"📋 Reseller ID: <code>{linked.get('reseller_id')}</code>\n"
                        f"💵 Số dư: <b>{format_money(balance_info.get('balance', 0))}</b>",
                        parse_mode='HTML'
                    )
                else:
                    await query.edit_message_text("❌ Không thể lấy số dư. API Key không hợp lệ.")
            else:
                await query.edit_message_text(
                    "⚠️ Bạn chưa là Reseller!\n\n"
                    "Gõ /dangky_seller để đăng ký.",
                    parse_mode='HTML'
                )
        
        elif action == "nap":
            await query.edit_message_text(
                "💳 <b>NẠP TIỀN RESELLER</b>\n\n"
                "Gõ lệnh: /nap_api_seller\n"
                "Sau đó nhập số tiền muốn nạp.",
                parse_mode='HTML'
            )
        
        elif action == "mua":
            await query.edit_message_text(
                "🛒 <b>MUA HÀNG TỪ KHO</b>\n\n"
                "Gõ lệnh: /mua_hang_seller\n"
                "Sau đó chọn sản phẩm và số lượng.",
                parse_mode='HTML'
            )
    
    except Exception as e:
        logging.error(f"Error in seller menu callback: {e}")
        await query.edit_message_text(f"❌ Lỗi: {e}")


# ==============================================================================
# WARRANTY (BẢO HÀNH) HANDLERS
# ==============================================================================

async def cmd_warranty_start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Bắt đầu flow bảo hành - yêu cầu nhập mã đơn hàng"""
    user_id = update.effective_user.id
    
    # Kiểm tra bảo trì
    if BOT_STOPPED and not is_admin(user_id):
        await update.message.reply_text(MAINTENANCE_MESSAGE, parse_mode='HTML')
        return
    
    # Xóa đơn hàng cũ trước khi bắt đầu
    cleanup_old_orders()
    
    await update.message.reply_text(
        "🛡️ <b>CHỨC NĂNG BẢO HÀNH</b>\n\n"
        "📝 Vui lòng nhập <b>Mã Đơn Hàng</b> của bạn:\n"
        "(VD: P12345)\n\n"
        f"💡 <i>Gợi ý: Nếu không nhớ mã đơn, bạn có thể dùng chức năng "
        f"Tìm tin nhắn (Search) trong chat để tìm lại mã đơn đã mua.</i>\n\n"
        "❌ Gõ /cancel để hủy.",
        parse_mode='HTML'
    )
    
    # Lưu state đang chờ mã đơn
    context.user_data['warranty_waiting_order'] = True
    return WARRANTY_WAITING_ORDER_CODE


async def warranty_check_order(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Kiểm tra mã đơn hàng và hiển thị thông tin"""
    if not context.user_data.get('warranty_waiting_order'):
        return
    
    order_code = update.message.text.strip().upper()
    
    # Bỏ qua commands
    if order_code.startswith('/'):
        if order_code == '/CANCEL':
            context.user_data.pop('warranty_waiting_order', None)
            await update.message.reply_text(
                "❌ Đã hủy yêu cầu bảo hành.",
                reply_markup=get_reply_keyboard(update.effective_user.id)
            )
        return ConversationHandler.END
    
    order = get_order_from_history(order_code)
    
    if not order:
        await update.message.reply_text(
            f"❌ Không tìm thấy đơn hàng với mã <code>{order_code}</code>.\n\n"
            "Có thể đơn hàng đã quá hạn bảo hành (> 30 ngày) hoặc mã đơn không chính xác.\n\n"
            "📝 Vui lòng nhập lại mã đơn hoặc gõ /cancel để hủy.",
            parse_mode='HTML'
        )
        return WARRANTY_WAITING_ORDER_CODE
    
    # KIỂM TRA NGƯỜI YÊU CẦU BẢO HÀNH CÓ PHẢI NGƯỜI MUA KHÔNG
    # ADMIN BYPASS: Admin có thể kiểm tra bảo hành cho bất kỳ đơn hàng nào
    order_buyer_id = order.get('user_id')
    current_user_id = update.effective_user.id
    
    if order_buyer_id and order_buyer_id != current_user_id and not is_admin(current_user_id):
        # Không khớp user_id VÀ không phải admin - từ chối bảo hành
        buyer_username = order.get('username', 'N/A')
        context.user_data.pop('warranty_waiting_order', None)
        await update.message.reply_text(
            f"⛔ <b>KHÔNG THỂ YÊU CẦU BẢO HÀNH</b>\n\n"
            f"📦 Mã đơn: <code>{order_code}</code>\n\n"
            f"❌ Đơn hàng này được mua bởi tài khoản khác.\n"
            f"📱 Bạn cần sử dụng đúng tài khoản Telegram đã mua sản phẩm để yêu cầu bảo hành.\n\n"
            f"💡 <i>Nếu bạn cho rằng đây là lỗi, vui lòng liên hệ Admin.</i>",
            parse_mode='HTML',
            reply_markup=get_reply_keyboard(update.effective_user.id)
        )
        logging.warning(f"⚠️ Bảo hành từ chối: User {current_user_id} cố claim đơn {order_code} của user {order_buyer_id}")
        return ConversationHandler.END
    
    # KIỂM TRA SẢN PHẨM CÓ ĐƯỢC BẢO HÀNH KHÔNG (từ cột E trong Sheet)
    warranty_days = order.get('warranty_days', 30)
    warranty_text = order.get('warranty_text', '')
    
    if warranty_days == 0:
        context.user_data.pop('warranty_waiting_order', None)
        await update.message.reply_text(
            f"❌ <b>SẢN PHẨM KHÔNG ĐƯỢC BẢO HÀNH</b>\n\n"
            f"📦 Mã đơn: <code>{order_code}</code>\n"
            f"🛒 Sản phẩm: <b>{order.get('product_name', 'N/A')}</b>\n\n"
            f"⚠️ Chính sách lúc mua: <b>{warranty_text or 'Không bảo hành'}</b>\n\n"
            f"Sản phẩm này không được áp dụng chính sách bảo hành.\n"
            f"📞 Nếu cần hỗ trợ, vui lòng liên hệ Admin.",
            parse_mode='HTML',
            reply_markup=get_reply_keyboard(update.effective_user.id)
        )
        return ConversationHandler.END
    
    # CHỈ CHẤP NHẬN BẢO HÀNH CHO SẢN PHẨM THUỘC SHEET "VEO3 ULTRA 45"
    # Xác định theo Tên Tab Sheet Thật, không theo tên sản phẩm (vì có thể thay đổi)
    sheet_tab = order.get('sheet_tab_name', '').strip().lower()
    product_name_lower = order.get('product_name', '').strip().lower()
    
    # Kiểm tra sheet tab hoặc product name có phải Veo3 Ultra 45 không
    is_veo3_ultra_45 = (
        'veo3 ultra 45' in sheet_tab or
        ('veo3' in product_name_lower and 'ultra' in product_name_lower and '45' in product_name_lower) or
        ('veo3' in product_name_lower and '45k' in product_name_lower)
    )
    
    if not is_veo3_ultra_45:
        context.user_data.pop('warranty_waiting_order', None)
        await update.message.reply_text(
            f"⚠️ <b>SẢN PHẨM KHÔNG HỖ TRỢ BẢO HÀNH TỰ ĐỘNG</b>\n\n"
            f"📦 Mã đơn: <code>{order_code}</code>\n"
            f"🛒 Sản phẩm: <b>{order.get('product_name', 'N/A')}</b>\n"
            f"📆 Bảo hành: <b>{warranty_days} ngày</b>\n\n"
            f"❌ Chức năng bảo hành tự động chỉ hỗ trợ cho sản phẩm thuộc sheet:\n"
            f"• <b>Veo3 Ultra 45</b>\n\n"
            f"📞 Nếu cần bảo hành sản phẩm khác, vui lòng liên hệ Admin trực tiếp.",
            parse_mode='HTML',
            reply_markup=get_reply_keyboard(update.effective_user.id)
        )
        return ConversationHandler.END
    
    # Lấy danh sách acc đã giao
    accounts_delivered = order.get('accounts_delivered', [])
    
    if not accounts_delivered:
        context.user_data.pop('warranty_waiting_order', None)
        await update.message.reply_text(
            f"⚠️ <b>KHÔNG TÌM THẤY THÔNG TIN TÀI KHOẢN</b>\n\n"
            f"📦 Mã đơn: <code>{order_code}</code>\n"
            f"🛒 Sản phẩm: <b>{order.get('product_name', 'N/A')}</b>\n\n"
            f"❌ Đơn hàng này không có thông tin tài khoản đã giao.\n"
            f"📞 Vui lòng liên hệ Admin để được hỗ trợ.",
            parse_mode='HTML',
            reply_markup=get_reply_keyboard(update.effective_user.id)
        )
        return ConversationHandler.END
    
    # Tính toán ngày hết hạn và số ngày còn lại
    try:
        purchase_date = datetime.fromisoformat(order.get('purchase_date', ''))
        if purchase_date.tzinfo is None:
            purchase_date = purchase_date.replace(tzinfo=VIETNAM_TZ)
    except:
        purchase_date = get_vietnam_now()
    
    now = get_vietnam_now()
    
    # Ưu tiên sử dụng warranty_expiry_date (ngày hết hạn cố định từ Sheet)
    warranty_expiry_date = order.get('warranty_expiry_date')
    
    if warranty_expiry_date:
        # Ngày hết hạn cố định
        expiry_date = datetime.strptime(warranty_expiry_date, "%Y-%m-%d")
        expiry_date = expiry_date.replace(hour=23, minute=59, second=59, tzinfo=VIETNAM_TZ)
        days_remaining = (expiry_date.date() - now.date()).days
        total_warranty_days = (expiry_date.date() - purchase_date.date()).days
        days_used = (now.date() - purchase_date.date()).days
    else:
        # Fallback: nếu không có warranty_expiry_date, không cho bảo hành
        days_remaining = 0
        days_used = (now.date() - purchase_date.date()).days
        expiry_date = purchase_date
        total_warranty_days = 0
    
    # Kiểm tra đã hết hạn bảo hành chưa
    if days_remaining <= 0:
        context.user_data.pop('warranty_waiting_order', None)
        days_overdue = abs(days_remaining)
        await update.message.reply_text(
            f"⏰ <b>ĐÃ HẾT HẠN BẢO HÀNH</b>\n\n"
            f"📦 Mã đơn: <code>{order_code}</code>\n"
            f"🛒 Sản phẩm: <b>{order.get('product_name', 'N/A')}</b>\n\n"
            f"📅 Ngày mua: <b>{purchase_date.strftime('%d/%m/%Y')}</b>\n"
            f"🛡️ Bảo hành đến: <b>{expiry_date.strftime('%d/%m/%Y')}</b>\n\n"
            f"❌ Hôm nay ({now.strftime('%d/%m/%Y')}) đã <b>quá hạn {days_overdue} ngày</b>.\n\n"
            f"📞 Nếu cần hỗ trợ, vui lòng liên hệ Admin.",
            parse_mode='HTML',
            reply_markup=get_reply_keyboard(update.effective_user.id)
        )
        return ConversationHandler.END
    
    # Xóa state chờ mã đơn
    context.user_data.pop('warranty_waiting_order', None)
    
    # Lưu thông tin để dùng sau
    context.user_data['warranty_order_code'] = order_code
    context.user_data['warranty_order'] = order
    context.user_data['warranty_accounts'] = accounts_delivered
    context.user_data['warranty_waiting_selection'] = True
    context.user_data['warranty_days_remaining'] = days_remaining
    context.user_data['warranty_total_days'] = total_warranty_days
    
    # Tạo danh sách acc có đánh số
    acc_list_text = ""
    for i, acc in enumerate(accounts_delivered, start=1):
        acc_list_text += f"<b>{i}</b>: <code>{html_module.escape(str(acc))}</code>\n"
    
    # Tính tiền hoàn cho 1 acc (dựa trên số ngày còn lại / tổng số ngày bảo hành)
    unit_price = order.get('unit_price', 0)
    if unit_price == 0 and len(accounts_delivered) > 0:
        unit_price = order.get('total_amount', 0) // len(accounts_delivered)
    refund_per_acc = int((days_remaining / total_warranty_days) * unit_price) if total_warranty_days > 0 else 0
    refund_per_acc = (refund_per_acc // 1000) * 1000  # Làm tròn xuống 1000
    
    await update.message.reply_text(
        f"📦 <b>THÔNG TIN ĐƠN HÀNG</b>\n\n"
        f"🆔 Mã đơn: <code>{order_code}</code>\n"
        f"📅 Ngày mua: {purchase_date.strftime('%d/%m/%Y')}\n"
        f"🛒 Sản phẩm: <b>{order.get('product_name', 'N/A')}</b>\n"
        f"🛡️ Bảo hành đến: <b>{expiry_date.strftime('%d/%m/%Y')}</b>\n"
        f"📆 Còn lại: <b>{days_remaining} ngày</b>\n"
        f"💵 Tiền hoàn mỗi acc: <b>{refund_per_acc:,} VNĐ</b>\n\n"
        f"━━━━━━━━━━━━━━━━\n"
        f"📋 <b>DANH SÁCH TÀI KHOẢN ({len(accounts_delivered)}):</b>\n\n"
        f"{acc_list_text}\n"
        f"━━━━━━━━━━━━━━━━\n\n"
        f"📝 <b>Vui lòng nhập số thứ tự các acc cần bảo hành:</b>\n"
        f"(Ví dụ: <code>1, 3, 5</code> hoặc <code>1</code>)\n\n"
        f"❌ Gõ /cancel để hủy.",
        parse_mode='HTML'
    )
    return WARRANTY_WAITING_ACC_SELECTION


async def warranty_receive_acc_selection(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Nhận lựa chọn acc từ khách và hiển thị nút bảo hành"""
    if not context.user_data.get('warranty_waiting_selection'):
        return
    
    user_input = update.message.text.strip()
    
    # Bỏ qua commands
    if user_input.startswith('/'):
        if user_input.upper() == '/CANCEL':
            context.user_data.pop('warranty_waiting_selection', None)
            context.user_data.pop('warranty_order_code', None)
            context.user_data.pop('warranty_order', None)
            context.user_data.pop('warranty_accounts', None)
            await update.message.reply_text(
                "❌ Đã hủy yêu cầu bảo hành.",
                reply_markup=get_reply_keyboard(update.effective_user.id)
            )
        return ConversationHandler.END
    
    accounts = context.user_data.get('warranty_accounts', [])
    order_code = context.user_data.get('warranty_order_code', '')
    order = context.user_data.get('warranty_order', {})
    
    # Parse lựa chọn từ user (VD: "1, 3, 5" hoặc "1 3 5" hoặc "1,3,5")
    try:
        # Thay thế dấu phẩy, khoảng trắng thành dấu phẩy rồi split
        cleaned = user_input.replace(' ', ',').replace(',,', ',')
        selected_indices = [int(x.strip()) for x in cleaned.split(',') if x.strip().isdigit()]
        
        # Validate indices
        invalid_indices = [i for i in selected_indices if i < 1 or i > len(accounts)]
        if invalid_indices:
            await update.message.reply_text(
                f"❌ Số thứ tự không hợp lệ: {invalid_indices}\n\n"
                f"📝 Vui lòng nhập số từ 1 đến {len(accounts)}.\n"
                f"Ví dụ: <code>1, 3, 5</code>",
                parse_mode='HTML'
            )
            return WARRANTY_WAITING_ACC_SELECTION
        
        if not selected_indices:
            await update.message.reply_text(
                "❌ Không tìm thấy số thứ tự nào.\n\n"
                f"📝 Vui lòng nhập số từ 1 đến {len(accounts)}.\n"
                f"Ví dụ: <code>1, 3, 5</code>",
                parse_mode='HTML'
            )
            return WARRANTY_WAITING_ACC_SELECTION
        
        # Loại bỏ duplicate
        selected_indices = list(set(selected_indices))
        selected_indices.sort()
        
    except Exception as e:
        await update.message.reply_text(
            f"❌ Lỗi xử lý: {e}\n\n"
            f"📝 Vui lòng nhập đúng format.\n"
            f"Ví dụ: <code>1, 3, 5</code>",
            parse_mode='HTML'
        )
        return WARRANTY_WAITING_ACC_SELECTION
    
    # Lấy các acc được chọn
    selected_accounts = [accounts[i-1] for i in selected_indices]
    
    # Xóa state chờ selection
    context.user_data.pop('warranty_waiting_selection', None)
    
    # Lưu selected accounts
    context.user_data['warranty_selected_accounts'] = selected_accounts
    context.user_data['warranty_selected_indices'] = selected_indices
    
    # Tính tiền hoàn
    try:
        purchase_date = datetime.fromisoformat(order.get('purchase_date', ''))
        if purchase_date.tzinfo is None:
            purchase_date = purchase_date.replace(tzinfo=VIETNAM_TZ)
    except:
        purchase_date = get_vietnam_now()
    
    now = get_vietnam_now()
    days_used = (now.date() - purchase_date.date()).days
    warranty_days = order.get('warranty_days', 30)
    days_remaining = max(0, warranty_days - days_used)
    
    unit_price = order.get('unit_price', 0)
    if unit_price == 0 and len(accounts) > 0:
        unit_price = order.get('total_amount', 0) // len(accounts)
    
    refund_per_acc = int((days_remaining / warranty_days) * unit_price) if warranty_days > 0 else 0
    refund_per_acc = (refund_per_acc // 1000) * 1000
    total_refund = refund_per_acc * len(selected_accounts)
    
    # Hiển thị acc đã chọn
    selected_text = "\n".join([f"• <code>{html_module.escape(str(acc))}</code>" for acc in selected_accounts])
    
    # Lưu thông tin vào context để xử lý
    context.user_data['warranty_total_refund'] = total_refund
    context.user_data['warranty_refund_per_acc'] = refund_per_acc
    context.user_data['warranty_days_remaining'] = days_remaining
    
    # Gửi thông báo đang kiểm tra (KHÔNG CÓ NÚT - tự động check)
    processing_msg = await update.message.reply_text(
        f"✅ <b>ĐÃ CHỌN {len(selected_accounts)} TÀI KHOẢN BẢO HÀNH</b>\n\n"
        f"📦 Mã đơn: <code>{order_code}</code>\n"
        f"📆 Còn lại: {days_remaining} ngày\n\n"
        f"📋 <b>Acc bạn đã chọn:</b>\n{selected_text}\n\n"
        f"💵 <b>Tiền hoàn nếu đủ điều kiện: {total_refund:,} VNĐ</b>\n"
        f"({len(selected_accounts)} acc x {refund_per_acc:,} VNĐ)\n\n"
        f"🔍 <b>ĐANG KIỂM TRA TÀI KHOẢN...</b>\n"
        f"⏳ Quá trình này có thể mất 1-2 phút.",
        parse_mode='HTML'
    )
    
    # Tự động trigger check credit trong background
    user = update.effective_user
    user_id = update.effective_user.id
    
    # Ghi acc vào file để tool check
    check_input_file = os.path.join(os.path.dirname(__file__), "Tool Auto Check Ultra", "warranty_check_input.txt")
    check_output_file = os.path.join(os.path.dirname(__file__), "Tool Auto Check Ultra", "warranty_check_output.json")
    cli_script = os.path.join(os.path.dirname(__file__), "Tool Auto Check Ultra", "check_credit_cli.py")
    
    try:
        os.makedirs(os.path.dirname(check_input_file), exist_ok=True)
        with open(check_input_file, 'w', encoding='utf-8') as f:
            for acc in selected_accounts:
                f.write(f"{acc}\n")
        logging.info(f"📝 Đã ghi {len(selected_accounts)} acc vào {check_input_file}")
    except Exception as e:
        logging.error(f"Lỗi ghi file check: {e}")
        await processing_msg.edit_text(f"❌ Lỗi hệ thống: {e}")
        return ConversationHandler.END
    
    # Thông báo admin
    acc_list_text = "\n".join([f"• <code>{html_module.escape(str(acc))}</code>" for acc in selected_accounts])
    for admin_id in ADMIN_IDS:
        try:
            await context.bot.send_message(
                chat_id=admin_id,
                text=(
                    f"🤖 <b>AUTO CHECK BẢO HÀNH ĐANG CHẠY</b>\n\n"
                    f"👤 Khách: {user.full_name} (@{user.username or 'N/A'})\n"
                    f"📦 Mã đơn: <code>{order_code}</code>\n"
                    f"📋 Acc đang check ({len(selected_accounts)}):\n{acc_list_text}\n\n"
                    f"⏳ Bot đang tự động check..."
                ),
                parse_mode='HTML'
            )
        except Exception as e:
            logging.error(f"Lỗi gửi thông báo admin: {e}")
    
    # Chạy CLI tool trong background
    async def run_auto_credit_check():
        try:
            # XÓA FILE OUTPUT CŨ để tránh đọc kết quả cũ
            if os.path.exists(check_output_file):
                try:
                    os.remove(check_output_file)
                    logging.info(f"🗑️ Đã xóa file output cũ: {check_output_file}")
                except Exception as e:
                    logging.warning(f"Không thể xóa file output cũ: {e}")
            
            # Chạy check_credit_cli.py với 5 threads song song
            process = await asyncio.create_subprocess_exec(
                sys.executable, cli_script,
                check_input_file, check_output_file,
                '--visible',  # Hiển thị browser để check
                '-t', '5',    # 5 browser song song
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                cwd=os.path.dirname(cli_script)
            )
            
            stdout, stderr = await process.communicate()
            
            logging.info(f"Check credit finished with code: {process.returncode}")
            if stdout:
                logging.info(f"Check credit stdout: {stdout.decode('utf-8', errors='ignore')}")
            if stderr:
                logging.warning(f"Check credit stderr: {stderr.decode('utf-8', errors='ignore')}")
            
            # KIỂM TRA CLI CÓ LỖI KHÔNG
            if process.returncode != 0:
                error_msg = stderr.decode('utf-8', errors='ignore') if stderr else "Unknown error"
                logging.error(f"CLI script failed with code {process.returncode}: {error_msg}")
                await context.bot.send_message(
                    chat_id=user_id,
                    text=(
                        f"❌ <b>LỖI KIỂM TRA TÀI KHOẢN</b>\n\n"
                        f"Hệ thống không thể kiểm tra credit tự động.\n"
                        f"Vui lòng liên hệ Admin để được hỗ trợ.\n\n"
                        f"<i>Mã lỗi: {process.returncode}</i>"
                    ),
                    parse_mode='HTML'
                )
                return
            
            logging.info(f"Looking for output file: {check_output_file}")
            logging.info(f"Output file exists: {os.path.exists(check_output_file)}")

            # Đọc kết quả - CHỈ khi file tồn tại VÀ CLI thành công
            if os.path.exists(check_output_file):
                with open(check_output_file, 'r', encoding='utf-8') as f:
                    results = json.load(f)

                
                WARRANTY_CREDIT_MAX = 100
                WARRANTY_CREDIT_REJECT = 120
                
                acc_results = results.get('results', [])
                total_checked = len(acc_results)
                
                # CHECK FOR WRONG PASSWORD ACCOUNTS FIRST
                wrong_password_accounts = []
                for idx, acc in enumerate(acc_results):
                    if acc.get('status') == 'WrongPassword':
                        wrong_password_accounts.append({
                            'index': idx + 1,  # 1-indexed for user
                            'email': acc.get('email', 'N/A'),
                            'password': acc.get('password', '')
                        })
                
                # If any wrong password accounts, ask customer to resend
                if wrong_password_accounts:
                    wrong_list_text = "\n".join([
                        f"<b>{a['index']}</b>: <code>{html_module.escape(str(a['email']))}</code>" 
                        for a in wrong_password_accounts
                    ])
                    
                    # Save for retry
                    context.user_data['warranty_wrong_password_results'] = results
                    context.user_data['warranty_waiting_password_retry'] = True
                    
                    await context.bot.send_message(
                        chat_id=user_id,
                        text=(
                            f"🔑 <b>SAI MẬT KHẨU - YÊU CẦU GỬI LẠI</b>\n\n"
                            f"📦 Mã đơn: <code>{order_code}</code>\n\n"
                            f"❌ Các tài khoản sau có mật khẩu sai:\n{wrong_list_text}\n\n"
                            f"📝 <b>Vui lòng gửi lại mật khẩu đúng theo format:</b>\n"
                            f"<code>số_thứ_tự email|password_mới</code>\n\n"
                            f"<i>Ví dụ: <code>1 test@gmail.com|MyNewPass123</code></i>\n\n"
                            f"❌ Gõ /cancel để hủy bảo hành."
                        ),
                        parse_mode='HTML'
                    )
                    
                    # Notify admin about wrong password
                    for admin_id in ADMIN_IDS:
                        try:
                            await context.bot.send_message(
                                chat_id=admin_id,
                                text=(
                                    f"🔑 <b>BẢO HÀNH - SAI MẬT KHẨU</b>\n\n"
                                    f"👤 Khách: {user.full_name} (@{user.username or 'N/A'})\n"
                                    f"📦 Mã đơn: <code>{order_code}</code>\n\n"
                                    f"❌ Acc sai pass:\n{wrong_list_text}\n\n"
                                    f"⏳ Đang chờ khách gửi lại password..."
                                ),
                                parse_mode='HTML'
                            )
                        except Exception as e:
                            logging.error(f"Lỗi gửi thông báo admin: {e}")
                    return  # Wait for customer to resend password

                eligible_accounts = []
                ineligible_accounts = []
                has_ultra_accounts = []  # Accounts still have Ultra subscription
                
                for acc in acc_results:
                    credits = acc.get('credits', 0)
                    email = acc.get('email', 'N/A')
                    status = acc.get('status', '')
                    has_ultra = acc.get('has_ultra', False)
                    
                    # Skip error/wrong password accounts
                    if status in ['Error', 'WrongPassword']:
                        continue
                    
                    # Accounts with HasUltra status - NOT eligible for warranty
                    # Even with 0 credits, they still have Ultra subscription benefits
                    if status == 'HasUltra' or has_ultra:
                        has_ultra_accounts.append({'email': email, 'credits': credits})
                        continue
                    
                    # Không có Ultra → ĐỦ ĐIỀU KIỆN BẢO HÀNH (bất kể credit)
                    # Logic mới: Chỉ cần không có Ultra subscription là đủ điều kiện
                    eligible_accounts.append({'email': email, 'credits': credits})
                
                # ========== BUILD COMPREHENSIVE RESULT SUMMARY ==========
                # Calculate refund only for eligible accounts
                refund_per_acc = context.user_data.get('warranty_refund_per_acc', 0)
                eligible_refund = len(eligible_accounts) * refund_per_acc
                
                # Store eligible accounts for refund/replace flow
                context.user_data['warranty_eligible_accounts'] = eligible_accounts
                context.user_data['warranty_eligible_refund'] = eligible_refund
                
                # Build result text for each category
                result_sections = []
                
                # 1. Eligible accounts (can get refund)
                if eligible_accounts:
                    eligible_text = "\n".join([f"  ✅ {html_module.escape(str(a['email'][:30]))}: {a['credits']} credit" for a in eligible_accounts])
                    result_sections.append(f"<b>✅ ĐỦ ĐIỀU KIỆN BẢO HÀNH ({len(eligible_accounts)} acc):</b>\n{eligible_text}")
                
                # 2. HasUltra accounts (not eligible - still have Ultra subscription)
                if has_ultra_accounts:
                    ultra_text = "\n".join([f"  ⚠️ {html_module.escape(str(a['email'][:30]))}: {a['credits']} credit (CÓ ULTRA)" for a in has_ultra_accounts])
                    result_sections.append(f"<b>⚠️ CÒN ULTRA - KHÔNG BẢO HÀNH ({len(has_ultra_accounts)} acc):</b>\n{ultra_text}")
                
                # 3. Ineligible accounts (high credits)
                if ineligible_accounts:
                    ineligible_text = "\n".join([f"  ❌ {html_module.escape(str(a['email'][:30]))}: {a['credits']} credit" for a in ineligible_accounts])
                    result_sections.append(f"<b>❌ CÒN CREDIT - KHÔNG BẢO HÀNH ({len(ineligible_accounts)} acc):</b>\n{ineligible_text}")
                
                # 4. Wrong password accounts
                wrong_pass_accounts = [acc for acc in acc_results if acc.get('status') == 'WrongPassword']
                if wrong_pass_accounts:
                    wrong_text = "\n".join([f"  🔑 {html_module.escape(str(a['email'][:30]))}: SAI MẬT KHẨU" for a in wrong_pass_accounts])
                    result_sections.append(f"<b>🔑 SAI MẬT KHẨU ({len(wrong_pass_accounts)} acc):</b>\n{wrong_text}")
                
                # 5. Error accounts
                error_accounts = [acc for acc in acc_results if acc.get('status') == 'Error']
                if error_accounts:
                    error_text = "\n".join([f"  ⚠️ {html_module.escape(str(a['email'][:30]))}: LỖI" for a in error_accounts])
                    result_sections.append(f"<b>⚠️ LỖI CHECK ({len(error_accounts)} acc):</b>\n{error_text}")
                
                full_result_text = "\n\n".join(result_sections)
                
                # ========== SEND RESULT TO CUSTOMER ==========
                if eligible_accounts:
                    # Has eligible accounts - show refund options
                    customer_keyboard = [
                        [InlineKeyboardButton("💸 Hoàn Tiền", callback_data=f"warranty_refund_{order_code}")],
                        [InlineKeyboardButton("🔄 Lấy Acc Mới", callback_data=f"warranty_replace_{order_code}")],
                    ]
                    
                    # Lấy thông tin đơn hàng để hiển thị
                    order_info = context.user_data.get('warranty_order', {})
                    purchase_date_str = order_info.get('purchase_date', 'N/A')
                    try:
                        pd = datetime.fromisoformat(purchase_date_str)
                        purchase_date_display = pd.strftime('%d/%m/%Y')
                    except:
                        purchase_date_display = purchase_date_str
                    warranty_days_val = order_info.get('warranty_days', 30)
                    warranty_expiry_val = order_info.get('warranty_expiry_date', 'N/A')
                    try:
                        ed = datetime.strptime(warranty_expiry_val, '%Y-%m-%d')
                        expiry_display = ed.strftime('%d/%m/%Y')
                    except:
                        expiry_display = warranty_expiry_val
                    product_name_display = order_info.get('product_name', 'N/A')
                    
                    await context.bot.send_message(
                        chat_id=user_id,
                        text=(
                            f"📊 <b>KẾT QUẢ KIỂM TRA BẢO HÀNH</b>\n\n"
                            f"📦 Mã đơn: <code>{order_code}</code>\n"
                            f"🛒 Sản phẩm: <b>{product_name_display}</b>\n"
                            f"📅 Ngày mua: {purchase_date_display}\n"
                            f"🛡️ Hết hạn BH: <b>{expiry_display}</b>\n"
                            f"💰 Đơn giá/acc: <b>{refund_per_acc:,} VNĐ</b>\n"
                            f"📋 Tổng check: {total_checked} acc\n\n"
                            f"{full_result_text}\n\n"
                            f"═══════════════════════\n"
                            f"💵 <b>TIỀN HOÀN: {eligible_refund:,} VNĐ</b>\n"
                            f"<i>({len(eligible_accounts)} acc x {refund_per_acc:,} VNĐ)</i>\n\n"
                            f"🔽 <b>CHỌN HÌNH THỨC BẢO HÀNH CHO {len(eligible_accounts)} ACC:</b>"
                        ),
                        reply_markup=InlineKeyboardMarkup(customer_keyboard),
                        parse_mode='HTML'
                    )
                else:
                    # No eligible accounts - just show summary
                    await context.bot.send_message(
                        chat_id=user_id,
                        text=(
                            f"📊 <b>KẾT QUẢ KIỂM TRA BẢO HÀNH</b>\n\n"
                            f"📦 Mã đơn: <code>{order_code}</code>\n"
                            f"🛒 Sản phẩm: <b>{product_name_display}</b>\n"
                            f"📅 Ngày mua: {purchase_date_display}\n"
                            f"🛡️ Hết hạn BH: <b>{expiry_display}</b>\n"
                            f"📋 Tổng check: {total_checked} acc\n\n"
                            f"{full_result_text}\n\n"
                            f"═══════════════════════\n"
                            f"❌ <b>KHÔNG CÓ ACC ĐỦ ĐIỀU KIỆN BẢO HÀNH</b>\n\n"
                            f"💡 <i>Điều kiện: Credit ≤100 VÀ không còn Ultra subscription</i>"
                        ),
                        parse_mode='HTML'
                    )
                
                # ========== GHI ACC GỐC VÀO SHEET "Acc thu hồi" NGAY KHI ĐỦ ĐIỀU KIỆN ==========
                if eligible_accounts:
                    try:
                        db_thuhoi = get_db()
                        ws_thuhoi = get_worksheet_by_name(db_thuhoi, "Acc thu hồi")
                        if ws_thuhoi:
                            for acc_info in eligible_accounts:
                                email = acc_info.get('email', '')
                                # Tìm acc gốc đầy đủ (email|password) từ selected_accounts
                                original_acc_full = email  # Fallback
                                for sa in selected_accounts:
                                    if email in sa:
                                        original_acc_full = sa
                                        break
                                
                                # Kiểm tra acc gốc đã có trong sheet chưa (tránh duplicate)
                                all_thuhoi_values = ws_thuhoi.get_all_values()
                                already_exists = False
                                for th_row in all_thuhoi_values[1:]:  # Skip header
                                    if len(th_row) > 6 and th_row[6].strip() == order_code and email in th_row[0]:
                                        already_exists = True
                                        break
                                
                                if not already_exists:
                                    new_row = [
                                        original_acc_full,      # A: Acc gốc (email|pass)
                                        '',                     # B: (chờ acc thay thế)
                                        '',                     # C: Ngày đổi pass (khi thu hồi)
                                        'CHƯA THU HỒI',       # D: Tình trạng
                                        purchase_date_display,  # E: Ngày mua
                                        expiry_display,         # F: Ngày hết hạn
                                        order_code              # G: Mã đơn
                                    ]
                                    # Ghi tuần tự từ trên xuống — tìm dòng tiếp theo dựa trên cột A
                                    next_r = find_next_row_col_a(ws_thuhoi)
                                    ws_thuhoi.update(f'A{next_r}:G{next_r}', [new_row], value_input_option='USER_ENTERED')
                                    logging.info(f"✅ Đã ghi acc gốc vào sheet thu hồi row {next_r}: {email} | Đơn: {order_code}")
                            
                            logging.info(f"✅ Đã ghi {len(eligible_accounts)} acc gốc vào sheet 'Acc thu hồi'")
                    except Exception as e:
                        logging.error(f"❌ Lỗi ghi acc gốc vào sheet 'Acc thu hồi': {e}")
                
                # ========== NOTIFY ADMIN ==========
                admin_summary = (
                    f"📊 <b>KẾT QUẢ CHECK BẢO HÀNH</b>\n\n"
                    f"👤 Khách: {user.full_name} (@{user.username or 'N/A'})\n"
                    f"📦 Mã đơn: <code>{order_code}</code>\n"
                    f"🛒 SP: <b>{product_name_display}</b>\n"
                    f"📅 Ngày mua: {purchase_date_display}\n"
                    f"🛡️ Hết hạn: <b>{expiry_display}</b>\n"
                    f"💰 Đơn giá/acc: <b>{refund_per_acc:,} VNĐ</b>\n"
                    f"📋 Tổng check: {total_checked} acc\n\n"
                    f"{full_result_text}\n\n"
                    f"═══════════════════════\n"
                )
                
                if eligible_accounts:
                    admin_summary += (
                        f"💵 Tiền hoàn: <b>{eligible_refund:,} VNĐ</b>\n"
                        f"⏳ Đang chờ khách chọn hình thức..."
                    )
                else:
                    admin_summary += f"🚫 Không có acc đủ điều kiện bảo hành."
                
                for admin_id in ADMIN_IDS:
                    try:
                        await context.bot.send_message(
                            chat_id=admin_id,
                            text=admin_summary,
                            parse_mode='HTML'
                        )
                    except Exception as e:
                        logging.error(f"Lỗi gửi thông báo admin warranty: {e}")
            else:
                await context.bot.send_message(
                    chat_id=user_id,
                    text="❌ Không thể kiểm tra tài khoản. Vui lòng thử lại sau."
                )
        except Exception as e:
            logging.error(f"Lỗi auto check credit: {e}", exc_info=True)
            await context.bot.send_message(
                chat_id=user_id,
                text=f"❌ Lỗi kiểm tra: {e}"
            )
    
    # Chạy check trong background
    asyncio.create_task(run_auto_credit_check())

    return ConversationHandler.END


async def warranty_password_retry(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Nhận password mới từ khách và chạy lại check cho acc đó"""
    if not context.user_data.get('warranty_waiting_password_retry'):
        return
    
    user_input = update.message.text.strip()
    user = update.effective_user
    user_id = update.effective_user.id
    
    # Handle cancel
    if user_input.startswith('/'):
        if user_input.upper() == '/CANCEL':
            context.user_data.pop('warranty_waiting_password_retry', None)
            context.user_data.pop('warranty_wrong_password_results', None)
            await update.message.reply_text(
                "❌ Đã hủy yêu cầu bảo hành.",
                reply_markup=get_reply_keyboard(user_id)
            )
        return ConversationHandler.END
    
    # Parse input format: "1 email@test.com|newpassword"
    try:
        parts = user_input.split(' ', 1)
        if len(parts) < 2:
            await update.message.reply_text(
                "❌ Sai format. Vui lòng gửi theo đúng format:\n"
                "<code>số_thứ_tự email|password_mới</code>\n\n"
                "Ví dụ: <code>1 test@gmail.com|MyNewPass123</code>",
                parse_mode='HTML'
            )
            return WARRANTY_WAITING_PASSWORD_RETRY
        
        idx = int(parts[0])
        acc_parts = parts[1].split('|', 1)
        
        if len(acc_parts) < 2 or not acc_parts[1].strip():
            await update.message.reply_text(
                "❌ Thiếu password. Vui lòng gửi theo format:\n"
                "<code>số_thứ_tự email|password_mới</code>",
                parse_mode='HTML'
            )
            return WARRANTY_WAITING_PASSWORD_RETRY
        
        new_email = acc_parts[0].strip()
        new_password = acc_parts[1].strip()
        
    except ValueError:
        await update.message.reply_text(
            "❌ Số thứ tự không hợp lệ. Vui lòng gửi lại.",
            parse_mode='HTML'
        )
        return WARRANTY_WAITING_PASSWORD_RETRY
    
    order_code = context.user_data.get('warranty_order_code', 'N/A')
    selected_accounts = context.user_data.get('warranty_selected_accounts', [])
    total_refund = context.user_data.get('warranty_total_refund', 0)
    
    # Thông báo đang check lại
    await update.message.reply_text(
        f"🔄 <b>ĐANG KIỂM TRA LẠI...</b>\n\n"
        f"📧 Acc: <code>{new_email}</code>\n"
        f"🔑 Password mới: <code>{new_password[:3]}***</code>\n\n"
        f"⏳ Vui lòng chờ...",
        parse_mode='HTML'
    )
    
    # Update acc trong list và chạy lại check
    check_input_file = os.path.join(os.path.dirname(__file__), "Tool Auto Check Ultra", "warranty_check_input.txt")
    check_output_file = os.path.join(os.path.dirname(__file__), "Tool Auto Check Ultra", "warranty_check_output.json")
    cli_script = os.path.join(os.path.dirname(__file__), "Tool Auto Check Ultra", "check_credit_cli.py")
    
    # Ghi acc mới vào file để check
    try:
        with open(check_input_file, 'w', encoding='utf-8') as f:
            f.write(f"{new_email}|{new_password}\n")
    except Exception as e:
        await update.message.reply_text(f"❌ Lỗi ghi file: {e}")
        return ConversationHandler.END
    
    # Clear state
    context.user_data.pop('warranty_waiting_password_retry', None)
    context.user_data.pop('warranty_wrong_password_results', None)
    
    # Chạy check trong background
    async def run_single_check():
        try:
            # Xóa file output cũ
            if os.path.exists(check_output_file):
                os.remove(check_output_file)
            
            process = await asyncio.create_subprocess_exec(
                sys.executable, cli_script,
                check_input_file, check_output_file,
                '--visible',
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                cwd=os.path.dirname(cli_script)
            )
            
            stdout, stderr = await process.communicate()
            
            if process.returncode != 0:
                await context.bot.send_message(
                    chat_id=user_id,
                    text="❌ Lỗi kiểm tra. Vui lòng liên hệ Admin."
                )
                return
            
            if os.path.exists(check_output_file):
                with open(check_output_file, 'r', encoding='utf-8') as f:
                    results = json.load(f)
                
                acc_results = results.get('results', [])
                if acc_results:
                    acc = acc_results[0]
                    status = acc.get('status', 'Error')
                    credits = acc.get('credits', 0)
                    
                    if status == 'WrongPassword':
                        # Vẫn sai password
                        await context.bot.send_message(
                            chat_id=user_id,
                            text=(
                                f"❌ <b>VẪN SAI MẬT KHẨU</b>\n\n"
                                f"📧 Acc: <code>{new_email}</code>\n\n"
                                f"Vui lòng kiểm tra lại password và gửi lại.\n"
                                f"Format: <code>1 {new_email}|password_đúng</code>\n\n"
                                f"❌ Gõ /cancel để hủy."
                            ),
                            parse_mode='HTML'
                        )
                        context.user_data['warranty_waiting_password_retry'] = True
                    elif credits <= 100:
                        # Đủ điều kiện
                        keyboard = [
                            [InlineKeyboardButton("💸 Hoàn Tiền", callback_data=f"warranty_refund_{order_code}")],
                            [InlineKeyboardButton("🔄 Lấy Acc Mới", callback_data=f"warranty_replace_{order_code}")],
                        ]
                        await context.bot.send_message(
                            chat_id=user_id,
                            text=(
                                f"✅ <b>TÀI KHOẢN ĐỦ ĐIỀU KIỆN BẢO HÀNH!</b>\n\n"
                                f"📧 Acc: <code>{new_email}</code>\n"
                                f"💎 Credits: <b>{credits}</b>\n\n"
                                f"💵 <b>Tiền hoàn: {total_refund:,} VNĐ</b>\n\n"
                                f"🔽 <b>CHỌN HÌNH THỨC BẢO HÀNH:</b>"
                            ),
                            reply_markup=InlineKeyboardMarkup(keyboard),
                            parse_mode='HTML'
                        )
                        
                        # Notify admin
                        for admin_id in ADMIN_IDS:
                            try:
                                await context.bot.send_message(
                                    chat_id=admin_id,
                                    text=(
                                        f"✅ <b>RETRY CHECK - ĐỦ ĐIỀU KIỆN</b>\n\n"
                                        f"👤 Khách: {user.full_name} (@{user.username or 'N/A'})\n"
                                        f"📦 Mã đơn: <code>{order_code}</code>\n"
                                        f"📧 Acc: <code>{new_email}</code>\n"
                                        f"💎 Credits: {credits}\n"
                                        f"💵 Tiền hoàn: {total_refund:,} VNĐ"
                                    ),
                                    parse_mode='HTML'
                                )
                            except:
                                pass
                    else:
                        # Không đủ điều kiện (credits > 100)
                        await context.bot.send_message(
                            chat_id=user_id,
                            text=(
                                f"❌ <b>KHÔNG ĐỦ ĐIỀU KIỆN BẢO HÀNH</b>\n\n"
                                f"📧 Acc: <code>{new_email}</code>\n"
                                f"💎 Credits: <b>{credits}</b>\n\n"
                                f"⚠️ Acc vẫn còn credit (> 100).\n"
                                f"Bảo hành chỉ áp dụng cho acc đã hết credit."
                            ),
                            parse_mode='HTML'
                        )
        except Exception as e:
            logging.error(f"Lỗi retry check: {e}", exc_info=True)
            await context.bot.send_message(
                chat_id=user_id,
                text=f"❌ Lỗi kiểm tra: {e}"
            )
    
    asyncio.create_task(run_single_check())
    return ConversationHandler.END


async def handle_warranty_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Xử lý callback từ nút bảo hành"""
    query = update.callback_query
    await query.answer()
    
    data = query.data
    user_id = update.effective_user.id
    user = update.effective_user
    
    if data == "warranty_cancel":
        await query.edit_message_text(
            "❌ Đã hủy yêu cầu bảo hành.\n\n"
            "Cảm ơn bạn đã sử dụng dịch vụ!"
        )
        return
    
    # ========== WARRANTY CHECK CREDIT (AUTO) ==========
    if data.startswith("warranty_check_"):
        order_code = data.replace("warranty_check_", "")
        selected_accounts = context.user_data.get('warranty_selected_accounts', [])
        total_refund = context.user_data.get('warranty_total_refund', 0)
        refund_per_acc = context.user_data.get('warranty_refund_per_acc', 0)
        
        if not selected_accounts:
            await query.edit_message_text("❌ Không tìm thấy thông tin acc đã chọn.")
            return
        
        # Ghi acc vào file để tool check
        check_input_file = os.path.join(os.path.dirname(__file__), "Tool Auto Check Ultra", "warranty_check_input.txt")
        check_output_file = os.path.join(os.path.dirname(__file__), "Tool Auto Check Ultra", "warranty_check_output.json")
        cli_script = os.path.join(os.path.dirname(__file__), "Tool Auto Check Ultra", "check_credit_cli.py")
        
        try:
            os.makedirs(os.path.dirname(check_input_file), exist_ok=True)
            with open(check_input_file, 'w', encoding='utf-8') as f:
                for acc in selected_accounts:
                    f.write(f"{acc}\n")
            logging.info(f"📝 Đã ghi {len(selected_accounts)} acc vào {check_input_file}")
        except Exception as e:
            logging.error(f"Lỗi ghi file check: {e}")
            await query.edit_message_text(f"❌ Lỗi hệ thống: {e}")
            return
        
        # Thông báo khách đang check
        await query.edit_message_text(
            f"🔍 <b>ĐANG KIỂM TRA CREDIT TỰ ĐỘNG...</b>\n\n"
            f"📦 Mã đơn: <code>{order_code}</code>\n"
            f"📋 Số acc: {len(selected_accounts)}\n\n"
            f"⏳ Hệ thống đang tự động kiểm tra các tài khoản của bạn.\n"
            f"Quá trình này có thể mất <b>{len(selected_accounts) * 1} - {len(selected_accounts) * 2} phút</b>.\n\n"
            f"🤖 <i>Bot sẽ tự động thông báo kết quả khi hoàn tất.</i>",
            parse_mode='HTML'
        )
        
        # Thông báo admin
        acc_list_text = "\n".join([f"• <code>{acc}</code>" for acc in selected_accounts])
        for admin_id in ADMIN_IDS:
            try:
                await context.bot.send_message(
                    chat_id=admin_id,
                    text=(
                        f"🤖 <b>AUTO CHECK BẢO HÀNH ĐANG CHẠY</b>\n\n"
                        f"👤 Khách: {user.full_name} (@{user.username or 'N/A'})\n"
                        f"📦 Mã đơn: <code>{order_code}</code>\n"
                        f"📋 Acc đang check ({len(selected_accounts)}):\n{acc_list_text}\n\n"
                        f"⏳ Bot đang tự động check..."
                    ),
                    parse_mode='HTML'
                )
            except Exception as e:
                logging.error(f"Lỗi gửi thông báo admin: {e}")
        
        # Chạy CLI tool trong background
        async def run_credit_check():
            try:
                import subprocess
                
                # Chạy check_credit_cli.py
                process = await asyncio.create_subprocess_exec(
                    sys.executable, cli_script,
                    check_input_file, check_output_file,
                    '--visible',  # Hiển thị browser để check
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE,
                    cwd=os.path.dirname(cli_script)
                )
                
                stdout, stderr = await process.communicate()
                
                logging.info(f"Check credit finished with code: {process.returncode}")
                if stderr:
                    logging.warning(f"Check credit stderr: {stderr.decode()}")
                
                # Đọc kết quả
                if os.path.exists(check_output_file):
                    with open(check_output_file, 'r', encoding='utf-8') as f:
                        results = json.load(f)
                    
                    # Phân tích kết quả - kiểm tra từng acc
                    # Điều kiện bảo hành: credit <= 100 (die hoặc gần die)
                    # Không bảo hành: credit >= 120 (khách còn credit sử dụng được)
                    
                    WARRANTY_CREDIT_MAX = 100  # Tối đa 100 credit để được BH
                    WARRANTY_CREDIT_REJECT = 120  # Từ 120 credit trở lên không cho BH
                    
                    acc_results = results.get('results', [])
                    total_checked = len(acc_results)
                    
                    eligible_accounts = []  # Acc đủ điều kiện BH (<=100 credit)
                    ineligible_accounts = []  # Acc không đủ điều kiện (>=120 credit)
                    
                    for acc in acc_results:
                        credits = acc.get('credits', 0)
                        email = acc.get('email', 'N/A')
                        if credits <= WARRANTY_CREDIT_MAX:  # 0-100 = OK
                            eligible_accounts.append({'email': email, 'credits': credits})
                        elif credits >= WARRANTY_CREDIT_REJECT:  # 120+ = NOT OK
                            ineligible_accounts.append({'email': email, 'credits': credits})
                        else:  # 101-119 = OK (gray zone, benefit of doubt)
                            eligible_accounts.append({'email': email, 'credits': credits})
                    
                    # Tất cả acc đủ điều kiện = cho bảo hành
                    all_eligible = len(ineligible_accounts) == 0 and total_checked > 0
                    
                    if all_eligible:
                        # Approve - cho bảo hành (tất cả acc <= 100 credit)
                        customer_keyboard = [
                            [InlineKeyboardButton("💸 Hoàn Tiền", callback_data=f"warranty_refund_{order_code}")],
                            [InlineKeyboardButton("🔄 Lấy Acc Mới", callback_data=f"warranty_replace_{order_code}")],
                        ]
                        
                        # Tạo text chi tiết credit từng acc
                        acc_detail_text = "\n".join([f"• {a['email'][:25]}...: {a['credits']} credit" for a in eligible_accounts])
                        
                        await context.bot.send_message(
                            chat_id=user_id,
                            text=(
                                f"✅ <b>KIỂM TRA HOÀN TẤT - ĐỦ ĐIỀU KIỆN BẢO HÀNH</b>\n\n"
                                f"📦 Mã đơn: <code>{order_code}</code>\n"
                                f"📊 Kết quả: <b>{len(eligible_accounts)}/{total_checked} acc đủ điều kiện</b>\n"
                                f"(Credit ≤ {WARRANTY_CREDIT_THRESHOLD})\n\n"
                                f"💵 Tiền hoàn: <b>{total_refund:,} VNĐ</b>\n\n"
                                f"👇 Vui lòng chọn phương thức bảo hành:"
                            ),
                            reply_markup=InlineKeyboardMarkup(customer_keyboard),
                            parse_mode='HTML'
                        )
                        
                        # Thông báo admin
                        for admin_id in ADMIN_IDS:
                            try:
                                await context.bot.send_message(
                                    chat_id=admin_id,
                                    text=(
                                        f"✅ <b>AUTO CHECK BẢO HÀNH XONG</b>\n\n"
                                        f"📦 Mã đơn: <code>{order_code}</code>\n"
                                        f"👤 Khách: {user.full_name}\n"
                                        f"📊 Kết quả: {len(eligible_accounts)} đủ điều kiện / {total_checked} total\n"
                                        f"✅ <b>ĐÃ TỰ ĐỘNG CHO BẢO HÀNH</b>"
                                    ),
                                    parse_mode='HTML'
                                )
                            except:
                                pass
                    else:
                        # Reject - không cho bảo hành (có acc > 100 credit)
                        # Tạo text chi tiết acc không đủ điều kiện
                        ineligible_text = "\n".join([f"• {a['email'][:25]}...: <b>{a['credits']:,} credit</b>" for a in ineligible_accounts])
                        
                        await context.bot.send_message(
                            chat_id=user_id,
                            text=(
                                f"❌ <b>KHÔNG ĐỦ ĐIỀU KIỆN BẢO HÀNH</b>\n\n"
                                f"📦 Mã đơn: <code>{order_code}</code>\n\n"
                                f"📊 <b>Kết quả kiểm tra:</b>\n"
                                f"• Đủ điều kiện (≤{WARRANTY_CREDIT_THRESHOLD} credit): {len(eligible_accounts)}\n"
                                f"• <b>Không đủ điều kiện:</b> {len(ineligible_accounts)}\n\n"
                                f"⚠️ <b>Acc còn credit (không đạt):</b>\n{ineligible_text}\n\n"
                                f"Các tài khoản trên vẫn còn credit. Bạn đã sử dụng hết credit chứ không phải acc bị die.\n\n"
                                f"📞 Nếu bạn cho rằng có sai sót, vui lòng liên hệ Admin."
                            ),
                            parse_mode='HTML'
                        )
                        
                        # Thông báo admin
                        for admin_id in ADMIN_IDS:
                            try:
                                await context.bot.send_message(
                                    chat_id=admin_id,
                                    text=(
                                        f"❌ <b>AUTO CHECK - TỪ CHỐI BH</b>\n\n"
                                        f"📦 Mã đơn: <code>{order_code}</code>\n"
                                        f"👤 Khách: {user.full_name}\n"
                                        f"📊 {len(ineligible_accounts)} acc còn >{WARRANTY_CREDIT_THRESHOLD} credit\n"
                                        f"❌ <b>KHÔNG CHO BẢO HÀNH</b>"
                                    ),
                                    parse_mode='HTML'
                                )
                            except:
                                pass

                else:
                    # Không có file kết quả - lỗi
                    await context.bot.send_message(
                        chat_id=user_id,
                        text=(
                            f"⚠️ <b>LỖI KIỂM TRA</b>\n\n"
                            f"Không thể hoàn tất kiểm tra credit.\n"
                            f"Vui lòng thử lại sau hoặc liên hệ Admin."
                        ),
                        parse_mode='HTML'
                    )
                    
            except Exception as e:
                logging.error(f"Auto check credit error: {e}")
                try:
                    await context.bot.send_message(
                        chat_id=user_id,
                        text=f"⚠️ Lỗi kiểm tra: {e}\nVui lòng liên hệ Admin."
                    )
                except:
                    pass
        
        # Chạy check trong background (không block bot)
        asyncio.create_task(run_credit_check())
        return
    

    # ========== ADMIN APPROVE WARRANTY ==========
    if data.startswith("warranty_approve_"):
        parts = data.replace("warranty_approve_", "").rsplit("_", 1)
        if len(parts) != 2:
            await query.edit_message_text("❌ Lỗi dữ liệu.")
            return
        
        order_code, customer_id = parts
        order = get_order_from_history(order_code)
        
        if not order:
            await query.edit_message_text("❌ Đơn hàng không tồn tại.")
            return
        
        # Gửi thông báo cho khách với 2 nút lựa chọn bảo hành
        customer_keyboard = [
            [InlineKeyboardButton("💸 Hoàn Tiền", callback_data=f"warranty_refund_{order_code}")],
            [InlineKeyboardButton("🔄 Lấy Acc Mới", callback_data=f"warranty_replace_{order_code}")],
        ]
        
        try:
            await context.bot.send_message(
                chat_id=int(customer_id),
                text=(
                    f"✅ <b>ĐÃ XÁC NHẬN - ACC ĐỦ ĐIỀU KIỆN BẢO HÀNH</b>\n\n"
                    f"📦 Mã đơn: <code>{order_code}</code>\n\n"
                    f"Kết quả kiểm tra: <b>Acc đã hết credit (Die)</b>\n\n"
                    f"👇 Vui lòng chọn phương thức bảo hành:"
                ),
                reply_markup=InlineKeyboardMarkup(customer_keyboard),
                parse_mode='HTML'
            )
        except Exception as e:
            logging.error(f"Lỗi gửi thông báo khách: {e}")
        
        await query.edit_message_text(
            f"✅ Đã gửi thông báo cho khách.\n"
            f"Mã đơn: {order_code} | Khách ID: {customer_id}"
        )
        return
    
    # ========== ADMIN REJECT WARRANTY ==========
    if data.startswith("warranty_reject_"):
        parts = data.replace("warranty_reject_", "").rsplit("_", 1)
        if len(parts) != 2:
            await query.edit_message_text("❌ Lỗi dữ liệu.")
            return
        
        order_code, customer_id = parts
        
        try:
            await context.bot.send_message(
                chat_id=int(customer_id),
                text=(
                    f"❌ <b>KHÔNG ĐỦ ĐIỀU KIỆN BẢO HÀNH</b>\n\n"
                    f"📦 Mã đơn: <code>{order_code}</code>\n\n"
                    f"Kết quả kiểm tra: <b>Acc vẫn còn credit</b>\n\n"
                    f"Tài khoản của bạn vẫn còn credit sử dụng được nên không đủ điều kiện bảo hành.\n\n"
                    f"📞 Nếu bạn cho rằng có sai sót, vui lòng liên hệ Admin."
                ),
                parse_mode='HTML'
            )
        except Exception as e:
            logging.error(f"Lỗi gửi thông báo khách: {e}")
        
        await query.edit_message_text(
            f"❌ Đã từ chối bảo hành.\n"
            f"Mã đơn: {order_code} | Khách ID: {customer_id}"
        )
        return
    

    if data.startswith("warranty_refund_"):
        order_code = data.replace("warranty_refund_", "")
        
        # Check xem option Hoàn tiền có được bật không
        if not is_warranty_option_enabled('refund'):
            await query.edit_message_text(
                "❌ <b>TÍNH NĂNG TẠM KHÓA</b>\n\n"
                "💸 Chức năng <b>Hoàn tiền</b> hiện đang tạm khóa.\n\n"
                "Vui lòng liên hệ Admin hoặc chọn phương thức bảo hành khác.",
                parse_mode='HTML'
            )
            return
        
        order = get_order_from_history(order_code)
        
        if not order:
            await query.edit_message_text("❌ Đơn hàng không tồn tại hoặc đã hết hạn bảo hành.")
            return
        
        refund_amount = calculate_warranty_refund(order)
        
        if refund_amount <= 0:
            await query.edit_message_text(
                "⚠️ Đơn hàng đã hết thời hạn bảo hành.\n\n"
                "Số tiền hoàn trả: 0 VNĐ"
            )
            return
        
        # Lưu thông tin để chờ QR code
        context.user_data['warranty_refund_order'] = order_code
        context.user_data['warranty_refund_amount'] = refund_amount
        
        await query.edit_message_text(
            f"💸 <b>YÊU CẦU HOÀN TIỀN</b>\n\n"
            f"💰 Số tiền hoàn: <b>{refund_amount:,} VNĐ</b>\n\n"
            f"📸 Vui lòng gửi <b>ảnh QR Code</b> ngân hàng của bạn để nhận tiền hoàn.\n\n"
            f"⏰ <i>Thời gian chờ: 5 phút</i>\n\n"
            f"❌ Gõ /cancel để hủy.",
            parse_mode='HTML'
        )
        return
    
    if data.startswith("warranty_replace_"):
        order_code = data.replace("warranty_replace_", "")
        
        # Check xem option Đổi acc mới có được bật không
        if not is_warranty_option_enabled('replace'):
            await query.edit_message_text(
                "❌ <b>TÍNH NĂNG TẠM KHÓA</b>\n\n"
                "🔄 Chức năng <b>Đổi acc mới</b> hiện đang tạm khóa.\n\n"
                "Vui lòng liên hệ Admin hoặc chọn phương thức bảo hành khác.",
                parse_mode='HTML'
            )
            return
        
        order = get_order_from_history(order_code)
        
        if not order:
            await query.edit_message_text("❌ Đơn hàng không tồn tại hoặc đã hết hạn bảo hành.")
            return
        
        # Get eligible accounts count from context (set during credit check)
        eligible_accounts = context.user_data.get('warranty_eligible_accounts', [])
        num_replacement = len(eligible_accounts) if eligible_accounts else 1
        
        await query.edit_message_text(f"⏳ Đang lấy {num_replacement} acc mới từ kho...")
        
        try:
            # Get product info from order
            product_id = order.get('product_id', '')
            sheet_tab = order.get('sheet_tab', '') or order.get('sheet_tab_name', '')
            
            if not sheet_tab:
                # Try to get from product_name
                product_name = order.get('product_name', '')
                logging.error(f"❌ Không có sheet_tab trong order: {order_code}, product: {product_name}")
                await context.bot.send_message(
                    chat_id=user_id,
                    text=(
                        f"❌ Không tìm thấy thông tin sản phẩm trong đơn hàng.\n"
                        f"Vui lòng liên hệ Admin để được hỗ trợ.\n\n"
                        f"📞 Telegram: @thinh_shopmmo04\n"
                        f"📞 Telegram: @dat_shopmmo_04\n"
                        f"📞 Zalo: 0965268536"
                        f"📞 Zalo: 0393959643"
                    )
                )
                return
            
            # Get replacement accounts from same sheet
            try:
                db = get_db()
                worksheet = db.worksheet(sheet_tab)
                all_accounts = worksheet.get_all_values()
            except Exception as e:
                logging.error(f"Lỗi lấy worksheet {sheet_tab}: {e}")
                await context.bot.send_message(
                    chat_id=user_id,
                    text=f"❌ Lỗi kết nối kho hàng: {e}"
                )
                return
            
            # Find available accounts - ONLY take "CHƯA BÁN" status
            # Column layout: A=email|pass (combined), B=status, C=date, D=price
            available_accounts = []
            for idx, row in enumerate(all_accounts):
                if len(row) >= 1 and row[0]:
                    # Parse email|password from column A
                    acc_data = row[0].strip()
                    if '|' not in acc_data:
                        continue
                    
                    parts = acc_data.split('|', 1)
                    if len(parts) != 2:
                        continue
                    
                    email = parts[0].strip()
                    password = parts[1].strip()
                    
                    # ONLY take if status is exactly "CHƯA BÁN"
                    status = row[1].strip().upper() if len(row) > 1 else ""
                    
                    if status == "CHƯA BÁN":
                        available_accounts.append({
                            'row_idx': idx + 1,  # 1-indexed for sheets
                            'email': email,
                            'password': password
                        })
            
            if len(available_accounts) < num_replacement:
                # Add retry button and admin contact
                retry_keyboard = [
                    [InlineKeyboardButton("🔄 Thử Lần Nữa", callback_data=f"warranty_replace_{order_code}")],
                ]
                await context.bot.send_message(
                    chat_id=user_id,
                    text=(
                        f"❌ <b>KHÔNG ĐỦ HÀNG TRONG KHO</b>\n\n"
                        f"Yêu cầu: {num_replacement} acc\n"
                        f"Còn trong kho: {len(available_accounts)} acc\n\n"
                        f"🔄 Bấm nút bên dưới để thử lại hoặc liên hệ Admin:\n\n"
                        f"📞 <b>Hỗ trợ:</b>\n"
                        f"• Telegram: @thinh_shopmmo04\n"
                        f"• Telegram: @dat_shopmmo_04\n"
                        f"• Zalo: 0965268536/0393959643\n"
                        f"• Group: https://t.me/+_jXbADedabg0YjQ1"
                    ),
                    reply_markup=InlineKeyboardMarkup(retry_keyboard),
                    parse_mode='HTML'
                )
                return
            
            # Take the required number of accounts
            replacement_accounts = available_accounts[:num_replacement]
            
            # Mark them as BẢO HÀNH in the sheet
            # Column B = status, Column C = date, Column F = note
            from datetime import datetime, timedelta
            warranty_date = datetime.now().strftime("%d/%m/%Y")
            
            # Calculate warranty expiry date - LẤY TỪ ĐƠN HÀNG GỐC
            # Logic: Khách mua ngày 1/2 với BH 30 ngày → hết hạn 2/3
            # Nếu claim ngày 20/2 → vẫn dùng đến 2/3 (không reset)
            warranty_expiry_date = order.get('warranty_expiry_date')  # Format: YYYY-MM-DD
            if warranty_expiry_date:
                # Parse và format lại cho hiển thị
                try:
                    expiry_dt = datetime.strptime(warranty_expiry_date, "%Y-%m-%d")
                    expiry_date = expiry_dt.strftime("%d/%m/%Y")
                except:
                    warranty_days = order.get('warranty_days', 30)
                    expiry_dt = datetime.now() + timedelta(days=warranty_days)
                    warranty_expiry_date = expiry_dt.strftime("%Y-%m-%d")
                    expiry_date = expiry_dt.strftime("%d/%m/%Y")
            else:
                warranty_days = order.get('warranty_days', 30)
                expiry_dt = datetime.now() + timedelta(days=warranty_days)
                warranty_expiry_date = expiry_dt.strftime("%Y-%m-%d")
                expiry_date = expiry_dt.strftime("%d/%m/%Y")
            
            # Format: BH + Mã đơn + Username + Ngày hết hạn
            username = user.username or f"ID:{user.id}"
            warranty_note = f"BH {order_code} {username} {expiry_date}"
            
            for acc in replacement_accounts:
                try:
                    # Update column B = BẢO HÀNH
                    worksheet.update_cell(acc['row_idx'], 2, 'BẢO HÀNH')
                    # Update column C = date
                    worksheet.update_cell(acc['row_idx'], 3, warranty_date)
                    # Update column F = note with order code and customer info
                    worksheet.update_cell(acc['row_idx'], 6, warranty_note)
                except Exception as e:
                    logging.warning(f"Không thể đánh dấu BẢO HÀNH row {acc['row_idx']}: {e}")
            
            # Build message with replacement accounts
            import html
            acc_list_text = "\n".join([
                f"📧 <code>{html.escape(acc['email'])}|{html.escape(acc['password'])}</code>"
                for acc in replacement_accounts
            ])
            
            # Send replacement accounts to customer - THÊM NGÀY HẾT HẠN
            await context.bot.send_message(
                chat_id=user_id,
                text=(
                    f"✅ <b>BẢO HÀNH THÀNH CÔNG!</b>\n\n"
                    f"📦 Mã đơn: <code>{order_code}</code>\n"
                    f"🔄 Số acc thay thế: <b>{num_replacement}</b>\n"
                    f"📅 <b>Hạn dùng:</b> {expiry_date}\n\n"
                    f"📋 <b>ACC MỚI CỦA BẠN:</b>\n{acc_list_text}\n\n"
                    f"⚠️ <i>Vui lòng đổi mật khẩu ngay sau khi đăng nhập!</i>\n\n"
                    f"🙏 Cảm ơn bạn đã sử dụng dịch vụ!"
                ),
                parse_mode='HTML'
            )
            
            # ========== LƯU WARRANTY CLAIM ĐỂ NHẮC ADMIN KHI HẾT HẠN ==========
            # Lưu thông tin để nhắc admin xóa acc khi hết hạn BH
            try:
                product_name = order.get('product_name', 'N/A')
                accounts_replaced = [acc['email'] for acc in replacement_accounts]
                
                add_warranty_claim(
                    order_code=order_code,
                    user_id=user_id,
                    username=user.username,
                    user_fullname=user.full_name,
                    product_name=product_name,
                    accounts_replaced=accounts_replaced,
                    warranty_expiry_date=warranty_expiry_date
                )
            except Exception as e:
                logging.error(f"Lỗi lưu warranty claim: {e}")
            
            # ========== GHI ACC THAY THẾ VÀO SHEET "Acc thu hồi" ==========
            # Logic: Tìm row acc gốc theo mã đơn (Col G), ghi acc thay thế vào Col B cùng hàng
            try:
                db = get_db()
                if db:
                    ws_thuhoi = get_worksheet_by_name(db, "Acc thu hồi")
                    if ws_thuhoi:
                        all_values = ws_thuhoi.get_all_values()
                        
                        # Lấy thông tin ngày từ order
                        purchase_date_order = order.get('purchase_date', '')
                        try:
                            pd_dt = datetime.strptime(purchase_date_order[:10], '%Y-%m-%d')
                            purchase_date_sheet = pd_dt.strftime('%d/%m/%Y')
                        except:
                            purchase_date_sheet = datetime.now().strftime('%d/%m/%Y')
                        
                        expiry_date_sheet = expiry_date  # Đã được format DD/MM/YYYY ở trên
                        
                        # === BƯỚC 1: Ghi acc thay thế vào Col B của row acc gốc (tìm theo Col G = order_code) ===
                        replacement_idx = 0  # Index để match từng replacement với từng row acc gốc
                        for row_idx, row in enumerate(all_values):
                            if row_idx == 0:  # Skip header
                                continue
                            # Match by order_code in Col G (index 6)
                            if len(row) > 6 and row[6].strip() == order_code:
                                # Check Col B còn trống (chưa có acc thay thế)
                                if len(row) > 1 and not row[1].strip():
                                    if replacement_idx < len(replacement_accounts):
                                        replacement_acc = replacement_accounts[replacement_idx]
                                        replacement_full = f"{replacement_acc['email']}|{replacement_acc['password']}"
                                        ws_thuhoi.update_cell(row_idx + 1, 2, replacement_full)  # Col B: acc thay thế
                                        ws_thuhoi.update_cell(row_idx + 1, 4, "ĐÃ BẢO HÀNH")   # Col D: trạng thái
                                        logging.info(f"✅ Ghi acc thay thế vào Col B row {row_idx + 1}: {replacement_acc['email']}")
                                        replacement_idx += 1

            except Exception as e:
                logging.error(f"❌ Lỗi ghi acc BH vào sheet 'Acc thu hồi': {e}")
            
            # ========== XÓA ĐƠN KHỎI HISTORY (KHÔNG CHO BH LẠI) ==========
            try:
                history = load_order_history()
                if order_code in history:
                    del history[order_code]
                    save_order_history(history)
                    logging.info(f"🗑️ Đã xóa đơn {order_code} khỏi history sau khi bảo hành thành công")
            except Exception as e:
                logging.error(f"Lỗi xóa order history: {e}")
            # Notify admins
            eligible_emails = [a['email'] for a in eligible_accounts] if eligible_accounts else []
            for admin_id in ADMIN_IDS:
                try:
                    await context.bot.send_message(
                        chat_id=admin_id,
                        text=(
                            f"✅ <b>BẢO HÀNH - ĐÃ GỬI ACC MỚI</b>\n\n"
                            f"👤 Khách: {user.full_name} (@{user.username or 'N/A'})\n"
                            f"📦 Mã đơn: <code>{order_code}</code>\n\n"
                            f"❌ Acc lỗi ({len(eligible_emails)}):\n" + 
                            "\n".join([f"• {e}" for e in eligible_emails[:10]]) + "\n\n"
                            f"✅ Acc thay thế ({num_replacement}):\n{acc_list_text}"
                        ),
                        parse_mode='HTML'
                    )
                except Exception as e:
                    logging.error(f"Lỗi gửi thông báo admin: {e}")
            
            # Clear warranty data
            context.user_data.pop('warranty_eligible_accounts', None)
            context.user_data.pop('warranty_eligible_refund', None)
            
        except Exception as e:
            logging.error(f"Lỗi xử lý warranty replace: {e}", exc_info=True)
            await context.bot.send_message(
                chat_id=user_id,
                text=f"❌ Lỗi xử lý: {e}\n\nVui lòng liên hệ Admin."
            )
        return
    
    # ========== ADMIN CONFIRM PAID ==========
    if data.startswith("warranty_paid_"):
        parts = data.replace("warranty_paid_", "").rsplit("_", 1)
        if len(parts) != 2:
            await query.edit_message_text("❌ Lỗi dữ liệu callback.")
            return
        
        admin_who_paid = query.from_user
        order_code, customer_user_id = parts
        order = get_order_from_history(order_code)
        
        # Kiểm tra xem đơn đã được xử lý chưa (tránh xử lý 2 lần)
        if not order:
            await query.edit_message_text(
                f"⚠️ Đơn hàng {order_code} đã được xử lý hoặc không tồn tại.\n"
                f"(Có thể admin khác đã xác nhận trước đó)"
            )
            return
        
        refund_amount = calculate_warranty_refund(order) if order else 0
        
        # Thông báo cho khách
        try:
            await context.bot.send_message(
                chat_id=int(customer_user_id),
                text=(
                    f"🎉 <b>ADMIN ĐÃ HOÀN TIỀN!</b>\n\n"
                    f"📦 Mã đơn: <code>{order_code}</code>\n"
                    f"💰 Số tiền: <b>{refund_amount:,} VNĐ</b>\n\n"
                    f"Cảm ơn bạn đã sử dụng dịch vụ của Shop! 🙏"
                ),
                parse_mode='HTML'
            )
        except Exception as e:
            logging.error(f"Lỗi gửi thông báo cho khách {customer_user_id}: {e}")
        
        # ========== XÓA ĐƠN KHỎI HISTORY (CHẤM DỨT BẢO HÀNH) ==========
        try:
            history = load_order_history()
            if order_code in history:
                del history[order_code]
                save_order_history(history)
                logging.info(f"🗑️ Đã xóa đơn {order_code} khỏi history sau khi hoàn tiền thành công")
            
            # THÊM VÀO BLACKLIST - ngăn dùng lại mã đơn qua API
            add_to_warranty_blacklist(order_code, "refund_completed")
        except Exception as e:
            logging.error(f"Lỗi xóa order history: {e}")
        
        await query.edit_message_text(
            f"✅ Đã xác nhận chuyển tiền cho khách.\n"
            f"Mã đơn: {order_code} | Số tiền: {refund_amount:,} VNĐ\n"
            f"📝 Đơn hàng đã được xóa khỏi hệ thống."
        )
        
        # ========== THÔNG BÁO CHO CÁC ADMIN KHÁC ==========
        for admin_id in ADMIN_IDS:
            if admin_id != admin_who_paid.id:
                try:
                    await context.bot.send_message(
                        chat_id=admin_id,
                        text=(
                            f"📢 <b>HOÀN TIỀN ĐÃ XỬ LÝ</b>\n\n"
                            f"👤 Admin: {admin_who_paid.full_name}\n"
                            f"📦 Mã đơn: <code>{order_code}</code>\n"
                            f"💰 Số tiền: <b>{refund_amount:,} VNĐ</b>\n\n"
                            f"✅ Đơn đã xóa khỏi hệ thống."
                        ),
                        parse_mode='HTML'
                    )
                except Exception as e:
                    logging.error(f"Lỗi thông báo admin {admin_id}: {e}")
        return

async def handle_warranty_qr_received(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Xử lý khi nhận được ảnh QR Code từ khách"""
    order_code = context.user_data.get('warranty_refund_order')
    refund_amount = context.user_data.get('warranty_refund_amount', 0)
    
    if not order_code or not update.message.photo:
        return
    
    order = get_order_from_history(order_code)
    if not order:
        await update.message.reply_text("❌ Đơn hàng không tồn tại.")
        return
    
    user = update.effective_user
    
    # Xóa state
    context.user_data.pop('warranty_refund_order', None)
    context.user_data.pop('warranty_refund_amount', None)
    
    # Gửi thông báo + QR code cho tất cả admin
    for admin_id in ADMIN_IDS:
        try:
            # Forward ảnh QR cho admin
            await context.bot.copy_message(
                chat_id=admin_id,
                from_chat_id=update.message.chat_id,
                message_id=update.message.message_id
            )
            # Gửi thông tin kèm nút xác nhận
            keyboard = [[InlineKeyboardButton("✅ Đã Chuyển Tiền", 
                        callback_data=f"warranty_paid_{order_code}_{user.id}")]]
            await context.bot.send_message(
                chat_id=admin_id,
                text=(
                    f"🛡️ <b>YÊU CẦU HOÀN TIỀN BẢO HÀNH</b>\n\n"
                    f"👤 Khách: {user.full_name} (@{user.username or 'N/A'})\n"
                    f"🆔 User ID: <code>{user.id}</code>\n"
                    f"📦 Mã đơn: <code>{order_code}</code>\n"
                    f"🛒 SP: {order.get('product_name', 'N/A')}\n"
                    f"📅 Ngày mua: {order.get('purchase_date', 'N/A')}\n"
                    f"💰 Số tiền cần chuyển: <b>{refund_amount:,} VNĐ</b>\n\n"
                    f"📸 QR Code ở tin nhắn trên ⬆️"
                ),
                reply_markup=InlineKeyboardMarkup(keyboard),
                parse_mode='HTML'
            )
        except Exception as e:
            logging.error(f"Lỗi gửi QR cho admin {admin_id}: {e}")
    
    await update.message.reply_text(
        "✅ Đã gửi yêu cầu hoàn tiền cho Admin!\n\n"
        "⏳ Vui lòng chờ Admin xử lý và chuyển tiền.\n"
        "📩 Bạn sẽ nhận được thông báo khi Admin đã chuyển tiền.",
        reply_markup=get_reply_keyboard(user.id)
    )


async def handle_warranty_admin_paid(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Admin xác nhận đã chuyển tiền"""
    query = update.callback_query
    await query.answer()
    
    admin_who_paid = update.effective_user
    
    data = query.data.replace("warranty_paid_", "")
    parts = data.rsplit("_", 1)
    if len(parts) != 2:
        await query.edit_message_text("❌ Lỗi dữ liệu callback.")
        return
    
    order_code, customer_user_id = parts
    order = get_order_from_history(order_code)
    
    # Kiểm tra xem đơn đã được xử lý chưa (tránh xử lý 2 lần)
    if not order:
        await query.edit_message_text(
            f"⚠️ Đơn hàng {order_code} đã được xử lý hoặc không tồn tại.\n"
            f"(Có thể admin khác đã xác nhận trước đó)"
        )
        return
    
    refund_amount = calculate_warranty_refund(order) if order else 0
    
    # Thông báo cho khách
    try:
        await context.bot.send_message(
            chat_id=int(customer_user_id),
            text=(
                f"🎉 <b>ADMIN ĐÃ HOÀN TIỀN!</b>\n\n"
                f"📦 Mã đơn: <code>{order_code}</code>\n"
                f"💰 Số tiền: <b>{refund_amount:,} VNĐ</b>\n\n"
                f"Cảm ơn bạn đã sử dụng dịch vụ của Shop! 🙏"
            ),
            parse_mode='HTML'
        )
    except Exception as e:
        logging.error(f"Lỗi gửi thông báo cho khách {customer_user_id}: {e}")
    
    # ========== XÓA ĐƠN KHỎI HISTORY (CHẤM DỨT BẢO HÀNH) ==========
    try:
        history = load_order_history()
        if order_code in history:
            del history[order_code]
            save_order_history(history)
            logging.info(f"🗑️ Đã xóa đơn {order_code} khỏi history sau khi hoàn tiền thành công")
        
        # THÊM VÀO BLACKLIST - ngăn dùng lại mã đơn qua API
        add_to_warranty_blacklist(order_code, "refund_completed")
    except Exception as e:
        logging.error(f"Lỗi xóa order history: {e}")
    
    # Update message của admin hiện tại
    await query.edit_message_text(
        f"✅ Đã xác nhận chuyển tiền cho khách.\n"
        f"Mã đơn: {order_code} | Số tiền: {refund_amount:,} VNĐ\n"
        f"📝 Đơn hàng đã được xóa khỏi hệ thống."
    )
    
    # ========== THÔNG BÁO CHO CÁC ADMIN KHÁC ==========
    for admin_id in ADMIN_IDS:
        if admin_id != admin_who_paid.id:  # Không gửi lại cho admin đã xử lý
            try:
                await context.bot.send_message(
                    chat_id=admin_id,
                    text=(
                        f"📢 <b>THÔNG BÁO HOÀN TIỀN ĐÃ XỬ LÝ</b>\n\n"
                        f"👤 Admin xử lý: {admin_who_paid.full_name}\n"
                        f"📦 Mã đơn: <code>{order_code}</code>\n"
                        f"💰 Số tiền: <b>{refund_amount:,} VNĐ</b>\n\n"
                        f"✅ Đơn hàng đã được xóa khỏi hệ thống.\n"
                        f"⚠️ Nếu bạn thấy nút 'Đã Chuyển Tiền' cho đơn này, vui lòng bỏ qua."
                    ),
                    parse_mode='HTML'
                )
            except Exception as e:
                logging.error(f"Lỗi thông báo admin {admin_id}: {e}")


async def process_warranty_replace(query, context, order_code, order, user):
    """Xử lý lấy acc mới cho khách"""
    try:
        sheet_tab = order.get('sheet_tab_name', '')
        quantity = order.get('quantity', 1)
        product_name = order.get('product_name', '')
        
        if not sheet_tab:
            await query.edit_message_text("❌ Không tìm thấy thông tin sheet sản phẩm.")
            return
        
        # Lấy acc từ sheet
        db = get_db()
        ws_product = get_worksheet_by_name(db, sheet_tab)
        
        if not ws_product:
            await query.edit_message_text("❌ Không tìm thấy sheet sản phẩm.")
            return
        
        all_rows = ws_product.get_all_values()
        available_rows = []
        for i, row in enumerate(all_rows[1:], start=2):
            if len(row) >= 2 and row[0].strip() and row[1].strip().upper() == "CHƯA BÁN":
                available_rows.append((i, row[0]))
        
        if len(available_rows) < quantity:
            await query.edit_message_text(
                f"❌ Kho không đủ hàng!\n\n"
                f"Cần: {quantity} acc\n"
                f"Còn: {len(available_rows)} acc\n\n"
                f"Vui lòng liên hệ Admin để được hỗ trợ."
            )
            # Thông báo admin
            await send_to_all_admins(
                context.bot,
                f"⚠️ <b>BẢO HÀNH - KHO HẾT HÀNG!</b>\n\n"
                f"👤 Khách: {user.full_name} (@{user.username or 'N/A'})\n"
                f"📦 Mã đơn: {order_code}\n"
                f"🛒 SP: {product_name}\n"
                f"🔢 Cần: {quantity} acc\n"
                f"📊 Còn: {len(available_rows)} acc",
                parse_mode='HTML'
            )
            return
        
        # Lấy acc và cập nhật sheet
        today_str = get_vietnam_now().strftime("%d/%m/%Y")
        now = get_vietnam_now()
        warranty_days = order.get('warranty_days', 30)
        expiry_date = now + timedelta(days=warranty_days)
        expiry_str = expiry_date.strftime("%d/%m/%Y")
        
        acc_list = []
        cells_to_update = []
        
        # Xác định loại khách hàng và format ID
        is_seller_order = order_code.lower().startswith(("seller_", "order_", "sl_"))
        if is_seller_order:
            # Seller: lấy seller_id từ order hoặc dùng order_code
            seller_id = order.get('seller_id', order_code.split('_')[0] if '_' in order_code else order_code)
            customer_type = f"seller:{seller_id}"
        else:
            # Khách thường: tele:ID(username)
            username_display = user.username or "N/A"
            customer_type = f"tele:{user.id}({username_display})"
        
        for i in range(quantity):
            row_num, acc_info = available_rows[i]
            acc_list.append(acc_info)
            
            # Cột B = BẢO HÀNH, Cột C = ngày
            # Cột F = tele:ID(username)|mã đơn|DD/MM/YYYY hoặc seller:ID|mã đơn|DD/MM/YYYY
            column_f_value = f"{customer_type}|{order_code}|{expiry_str}"
            
            cells_to_update.append(gspread.Cell(row_num, 2, "BẢO HÀNH"))
            cells_to_update.append(gspread.Cell(row_num, 3, today_str))
            cells_to_update.append(gspread.Cell(row_num, 6, column_f_value))
        
        if cells_to_update:
            ws_product.update_cells(cells_to_update)
        
        # ========== XÓA NOTE CŨ CỦA ORDER NÀY (nếu có) ==========
        # Khi đổi acc mới, xóa note của acc cũ
        delete_warranty_notes_for_order(order_code)
        
        # ========== TẠO NOTE MỚI THEO TỪNG ACC ==========
        # Note theo ACC cụ thể, không phải order_code
        for acc_info in acc_list:
            create_warranty_acc_note(
                acc_info=acc_info,
                customer_type=customer_type,
                order_code=order_code,
                product_name=product_name,
                expiry_date=expiry_date,
                application=context.application
            )
        
        # ========== GHI ACC THAY THẾ VÀO SHEET "Acc thu hồi" ==========
        # Logic: Tìm row acc gốc theo mã đơn (Col G), ghi acc thay thế vào Col B cùng hàng
        try:
            ws_thuhoi = get_worksheet_by_name(db, "Acc thu hồi")
            if ws_thuhoi:
                # Lấy ngày mua từ order
                purchase_date_order = order.get('purchase_date', '')
                try:
                    pd_dt = datetime.strptime(str(purchase_date_order)[:10], '%Y-%m-%d')
                    purchase_date_sheet = pd_dt.strftime('%d/%m/%Y')
                except:
                    purchase_date_sheet = today_str
                
                all_thuhoi_values = ws_thuhoi.get_all_values()
                
                # === BƯỚC 1: Ghi acc thay thế vào Col B của row acc gốc (tìm theo Col G = order_code) ===
                replacement_idx = 0
                for row_idx, row in enumerate(all_thuhoi_values):
                    if row_idx == 0:  # Skip header
                        continue
                    if len(row) > 6 and row[6].strip() == order_code:
                        if len(row) > 1 and not row[1].strip():  # Col B còn trống
                            if replacement_idx < len(acc_list):
                                ws_thuhoi.update_cell(row_idx + 1, 2, acc_list[replacement_idx])  # Col B
                                ws_thuhoi.update_cell(row_idx + 1, 4, "ĐÃ BẢO HÀNH")            # Col D
                                logging.info(f"✅ Ghi acc thay thế vào Col B row {row_idx + 1}: {acc_list[replacement_idx].split('|')[0]}")
                                replacement_idx += 1

        except Exception as e:
            logging.error(f"❌ Lỗi ghi acc BH vào sheet 'Acc thu hồi': {e}")
        
        # Gửi acc cho khách
        acc_text = "\n".join([f"🔹 <code>{acc}</code>" for acc in acc_list])
        await context.bot.send_message(
            chat_id=user.id,
            text=(
                f"🎉 <b>ĐÃ GỬI ACC BẢO HÀNH!</b>\n\n"
                f"📦 Mã đơn: <code>{order_code}</code>\n"
                f"🛒 SP: {product_name}\n"
                f"🔢 SL: {quantity}\n"
                f"📅 Hạn dùng: {expiry_date.strftime('%d/%m/%Y')}\n\n"
                f"📋 <b>Danh sách tài khoản:</b>\n"
                f"{acc_text}\n\n"
                f"🛡️ Hãy lưu lại mã đơn để sử dụng bảo hành nếu cần!"
            ),
            parse_mode='HTML'
        )
        
        # Thông báo cho admin
        await send_to_all_admins(
            context.bot,
            f"🛡️ <b>BẢO HÀNH - ĐÃ GỬI ACC MỚI</b>\n\n"
            f"👤 Khách: {user.full_name} (@{user.username or 'N/A'})\n"
            f"🆔 User ID: {user.id}\n"
            f"📦 Mã đơn: {order_code}\n"
            f"🛒 SP: {product_name}\n"
            f"🔢 SL: {quantity}\n"
            f"📅 Hạn dùng: {expiry_date.strftime('%d/%m/%Y')}\n\n"
            f"📋 Acc đã gửi:\n{acc_text}",
            parse_mode='HTML'
        )
        
        await query.edit_message_text(
            "✅ Đã gửi acc mới thành công!\n"
            "Vui lòng kiểm tra tin nhắn."
        )
        
    except Exception as e:
        logging.error(f"Lỗi process_warranty_replace: {e}", exc_info=True)
        await query.edit_message_text(f"❌ Lỗi xử lý: {e}")


def delete_warranty_notes_for_order(order_code):
    """Xóa tất cả note bảo hành của 1 order (dùng khi đổi acc mới)
    
    Khi khách đổi acc A → acc B, cần xóa note của acc A để tạo note mới cho acc B
    """
    notes = load_notes()
    original_count = len(notes)
    
    # Lọc ra các note KHÔNG thuộc order này
    notes = [n for n in notes if n.get('warranty_info', {}).get('order_code') != order_code]
    
    deleted_count = original_count - len(notes)
    if deleted_count > 0:
        save_notes(notes)
        logging.info(f"🗑️ Đã xóa {deleted_count} note bảo hành cũ của order {order_code}")
    
    return deleted_count


def create_warranty_acc_note(acc_info, customer_type, order_code, product_name, expiry_date, application=None):
    """Tạo note nhắc nhở admin XÓA ACC cụ thể khi hết hạn bảo hành
    
    Args:
        acc_info: Thông tin acc (email|pass)
        customer_type: "tele:ID(username)" hoặc "seller:ID"
        order_code: Mã đơn hàng
        product_name: Tên sản phẩm
        expiry_date: Ngày hết hạn
        application: Application để lên lịch job
    """
    notes = load_notes()
    
    # ID note dựa trên ACC để dễ quản lý
    acc_short = acc_info.split('|')[0][:20] if '|' in acc_info else acc_info[:20]
    note_id = f"warranty_acc_{order_code}_{int(time.time())}"
    
    # Đảm bảo expiry_date có timezone
    if expiry_date.tzinfo is None:
        expiry_date = expiry_date.replace(tzinfo=VIETNAM_TZ)
    
    # Nhắc lúc 10:00 SÁNG NGÀY SAU ngày hết hạn
    # Ví dụ: hết hạn 10/02 → nhắc 10:00 sáng 11/02
    remind_at = datetime(
        expiry_date.year, expiry_date.month, expiry_date.day,
        10, 0, 0, tzinfo=VIETNAM_TZ
    ) + timedelta(days=1)
    
    note = {
        "id": note_id,
        "info": f"🗑️ XÓA ACC BẢO HÀNH: {acc_info}\n{customer_type} | {order_code} | {product_name}",
        "expiry_date": expiry_date.strftime("%d/%m/%Y"),
        "remind_at": remind_at.isoformat(),
        "created_by": "warranty_acc_system",
        "warranty_info": {
            "acc_info": acc_info,
            "customer_type": customer_type,
            "order_code": order_code,
            "product_name": product_name
        }
    }
    
    notes.append(note)
    save_notes(notes)
    
    # Lên lịch job nhắc nhở nếu có application
    if application:
        try:
            schedule_note_job(application, note)
        except Exception as e:
            logging.error(f"Lỗi lên lịch warranty acc note: {e}")
    
    logging.info(f"📝 Đã tạo note bảo hành ACC {acc_short}... - nhắc xóa lúc {remind_at.strftime('%d/%m %H:%M')}")
    return note


def create_warranty_reminder_note(username, user_id, product_name, expiry_date, order_code, application=None):
    """Tạo note nhắc nhở admin khi hết hạn bảo hành"""
    notes = load_notes()
    note_id = f"warranty_{order_code}_{int(time.time())}"
    
    # Đảm bảo expiry_date có timezone
    if expiry_date.tzinfo is None:
        expiry_date = expiry_date.replace(tzinfo=VIETNAM_TZ)
    
    remind_at = datetime(
        expiry_date.year, expiry_date.month, expiry_date.day,
        11, 0, 0, tzinfo=VIETNAM_TZ
    )
    
    note = {
        "id": note_id,
        "info": f"BH @{username} (ID:{user_id}) - {product_name} - Đơn {order_code} - HẾT HẠN, yêu cầu xóa acc",
        "expiry_date": expiry_date.strftime("%d/%m/%Y"),
        "remind_at": remind_at.isoformat(),
        "created_by": "warranty_system",
        "warranty_info": {
            "username": username,
            "user_id": user_id,
            "order_code": order_code,
            "product_name": product_name
        }
    }
    
    notes.append(note)
    save_notes(notes)
    
    # Lên lịch job nhắc nhở nếu có application
    if application:
        try:
            schedule_note_job(application, note)
        except Exception as e:
            logging.error(f"Lỗi lên lịch warranty note: {e}")
    
    logging.info(f"📝 Đã tạo note bảo hành {note_id} - nhắc lúc {remind_at}")
    return note


async def simple_chat_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):


    global BOT_STOPPED
    user = update.effective_user
    user_id = user.id
    
    # Kiểm tra bảo trì - Admin bypass
    if BOT_STOPPED and not is_admin(user.id):
        await update.message.reply_text(MAINTENANCE_MESSAGE, parse_mode='HTML')
        return
    
    if not update.message or not update.message.text:
        return
    user_text = update.message.text.strip()
    if user_text.startswith('/'):
        return
    add_user_to_list(user.id, user.username, user.full_name)
    
    # Kiểm tra xem có phải link cho đơn hàng SheerID/Checkout không
    if await handle_link_for_special_order(update, context):
        return
    
    # Kiểm tra xem có phải email cho đơn hàng Slot không
    if await handle_email_for_slot_order(update, context):
        return
    
    # Kiểm tra xem có phải Gmail cho đơn ADD Farm không
    if await handle_gmail_for_addfarm_order(update, context):
        return
    
    # Kiểm tra xem có phải email/password cho đơn Verify không
    if await handle_emailpass_for_verify_order(update, context):
        return
    
    # Kiểm tra xem có phải credentials cho đơn verify_phone đã thanh toán không
    if await handle_credentials_for_verify_phone(update, context):
        return

    
    # Xử lý Reply Keyboard buttons
    if user_text in ["🛍️ Sản phẩm", "Sản phẩm", "sản phẩm", "san pham"]:
        # Hiển thị menu sản phẩm
        await cmd_startmenu(update, context)
        return
    elif user_text in ["📦 Đơn hàng", "Đơn hàng", "đơn hàng", "don hang"]:
        # Hiển thị đơn hàng
        await cmd_donhang(update, context)
        return
    elif user_text in ["💬 Hỗ trợ", "Hỗ trợ", "hỗ trợ", "ho tro"]:
        # Hiển thị hỗ trợ
        await cmd_hotro(update, context)
        return
    elif user_text in ["💰 Nạp Tiền", "Nạp Tiền", "nạp tiền", "nap tien"]:
        # Bắt đầu flow nạp tiền
        await cmd_deposit(update, context)
        return
    elif user_text in ["💳 Xem Số Dư", "Xem Số Dư", "xem số dư", "xem so du", "số dư", "so du"]:
        # Xem số dư
        await cmd_check_balance(update, context)
        return
    elif user_text in ["🏪 Reseller", "Reseller", "reseller"]:
        # Hiển thị menu Reseller
        keyboard = [
            [InlineKeyboardButton("🏪 Đăng ký Reseller", callback_data="seller_menu_dangky")],
            [InlineKeyboardButton("💵 Xem số dư", callback_data="seller_menu_balance")],
            [InlineKeyboardButton("💳 Nạp tiền", callback_data="seller_menu_nap")],
            [InlineKeyboardButton("🛒 Mua hàng", callback_data="seller_menu_mua")]
        ]
        await update.message.reply_text(
            "🏪 <b>MENU RESELLER</b>\n\n"
            "Chọn chức năng bạn muốn sử dụng:",
            reply_markup=InlineKeyboardMarkup(keyboard),
            parse_mode='HTML'
        )
        return
    elif user_text in ["🛡️ Bảo Hành", "Bảo Hành", "bảo hành", "bao hanh", "Bảo hành"]:
        # Bắt đầu flow bảo hành
        await cmd_warranty_start(update, context)
        return
    
    if user_id not in greeted_users:
        greeted_users.add(user_id)
        # Gửi lời chào kèm nút chọn ngôn ngữ
        await send_greeting_with_language(update, context, user)
        user_lower = user_text.lower()
        if any(kw in user_lower for kw in ["menu", "sản phẩm", "san pham", "hàng", "hang", "mua", "giá", "gia", "acc", "tài khoản"]):
            await send_main_menu_panel(update.effective_chat.id, user.full_name, context, user.id)
    else:
        user_lower = user_text.lower()
        if any(kw in user_lower for kw in ["menu", "sản phẩm", "san pham", "hàng", "hang", "mua", "giá", "gia", "acc"]):
            await update.message.reply_text(
                "🛒 <b>Xem sản phẩm ngay!</b>",
                reply_markup=get_reply_keyboard(update.effective_user.id if update and update.effective_user else None),
                parse_mode='HTML'
            )
            await cmd_startmenu(update, context)
        elif any(kw in user_lower for kw in ["đơn hàng", "don hang", "đơn", "don", "hóa đơn", "order"]):
            await update.message.reply_text(
                "📦 <b>Tra cứu đơn hàng</b>",
                reply_markup=get_reply_keyboard(update.effective_user.id if update and update.effective_user else None),
                parse_mode='HTML'
            )
            await cmd_donhang(update, context)
        elif any(kw in user_lower for kw in ["hỗ trợ", "ho tro", "admin", "zalo", "liên hệ", "lien he", "help"]):
            await cmd_hotro(update, context)
        else:
            # Gửi tin nhắn hướng dẫn kèm nút chọn ngôn ngữ
            lang = get_user_language(user_id)
            what_next = get_text(user_id, "what_next")
            
            keyboard = [
                [
                    InlineKeyboardButton("🇻🇳 Tiếng Việt", callback_data="lang_vi"),
                    InlineKeyboardButton("🇺🇸 English", callback_data="lang_en")
                ]
            ]
            
            await update.message.reply_text(
                f"🌐 <b>Select language:</b>\n\n{what_next}",
                reply_markup=InlineKeyboardMarkup(keyboard),
                parse_mode='HTML'
            )

async def setup_commands(app):
    print("🔧 [DEBUG] setup_commands() đang chạy...")
    try:
        await app.bot.delete_webhook(drop_pending_updates=True)
        logging.info("✅ Đã xóa webhook Telegram - Bot sẽ chỉ dùng polling")
    except Exception as e:
        logging.info(f"ℹ️ Không có webhook để xóa (hoặc lỗi): {e}")
    
    # Tạo menu commands mặc định cho tất cả người dùng (CHỈ 7 LỆNH CƠ BẢN)
    commands = [
        BotCommand("start", "🏠 Bắt đầu"),
        BotCommand("startmenu", "🛍️ Sản phẩm"),
        BotCommand("donhang", "📦 Đơn hàng"),
        BotCommand("baohanh", "🛡️ Bảo hành"),
        BotCommand("restart", "🔄 Khởi động lại"),
        BotCommand("naptien", "💰 Nạp tiền"),
        BotCommand("sodu", "💳 Xem số dư"),
        BotCommand("hotro", "💬 Hỗ trợ"),
    ]
    # Menu riêng cho admin: thêm các lệnh quản lý
    admin_commands = commands + [
        BotCommand("verify_phone", "📱 Verify Phone Google"),
        BotCommand("verify_status", "📊 Xem trạng thái verify"),
        BotCommand("menu_phone", "📞 Cài đặt quốc gia verify"),
        BotCommand("settingverify", "⚙️ Cài đặt SMS Provider"),
        BotCommand("addmoney", "➕ Cộng tiền cho user"),
        BotCommand("removemoney", "➖ Trừ tiền của user"),
        BotCommand("setmoney", "💰 Đặt số dư cho user"),
        BotCommand("broadcast", "📢 Gửi tin tới tất cả khách"),
        BotCommand("baocao", "📊 Báo cáo doanh thu ngày"),
        BotCommand("baocaothang", "📊 Báo cáo doanh thu tháng"),
        BotCommand("note", "📝 Đặt nhắc hết hạn khách"),
        BotCommand("gift", "🎁 Gửi quà tặng đặc biệt"),
        BotCommand("stop", "🛑 Dừng bot tạm thời"),
        BotCommand("offbaohanh", "🔒 Toggle on/off bảo hành"),
        BotCommand("blacklistbh", "🚫 Thêm đơn vào blacklist"),
        BotCommand("updatebaohanh", "🔄 Cập nhật warranty"),
        BotCommand("offapiseller", "🔒 Tắt mua hàng seller"),
        BotCommand("onapiseller", "✅ Bật mua hàng seller"),
        BotCommand("confirm_order", "✅ Xác nhận đơn thủ công"),
    ]

    try:
        # Xóa tất cả commands cũ trước
        await app.bot.delete_my_commands()
        for admin_id in ADMIN_IDS:
            try:
                await app.bot.delete_my_commands(scope=BotCommandScopeChat(chat_id=admin_id))
            except Exception:
                pass
        
        # Xóa commands của admin cũ đã bị loại khỏi hệ thống
        OLD_ADMIN_IDS = [5256783743]  # Admin cũ đã bị xóa quyền
        for old_id in OLD_ADMIN_IDS:
            try:
                await app.bot.delete_my_commands(scope=BotCommandScopeChat(chat_id=old_id))
                logging.info(f"🗑️ Đã xóa commands menu của admin cũ {old_id}")
            except Exception:
                pass
        
        # 1) Command mặc định cho tất cả (khách chỉ thấy 7 lệnh cơ bản)
        await app.bot.set_my_commands(commands)
        print(f"✅ Đã set {len(commands)} commands cho KHÁCH HÀNG")
        logging.info(f"✅ Đã set {len(commands)} commands cho KHÁCH HÀNG")

        # 2) Command riêng cho từng admin
        for admin_id in ADMIN_IDS:
            try:
                await app.bot.set_my_commands(
                    admin_commands,
                    scope=BotCommandScopeChat(chat_id=admin_id),
                )
                print(f"✅ Đã set {len(admin_commands)} commands cho ADMIN {admin_id}")
                logging.info(f"✅ Đã set {len(admin_commands)} commands cho ADMIN {admin_id}")
            except Exception as e:
                logging.error(f"❌ Lỗi khi thiết lập commands cho admin {admin_id}: {e}")
        
        # Thiết lập menu button để hiển thị popup menu (nếu hỗ trợ)
        if MenuButtonCommands is not None:
            try:
                menu_button = MenuButtonCommands()
                await app.bot.set_chat_menu_button(menu_button=menu_button)
                logging.info("✅ Đã thiết lập menu button")
            except Exception as e:
                logging.debug(f"Không thể thiết lập menu button: {e}")
        else:
            # Chỉ cần set commands là đủ, Telegram sẽ tự động hiển thị menu
            logging.info("ℹ️ MenuButtonCommands không khả dụng, chỉ dùng commands")
    except Exception as e:
        logging.error(f"❌ Lỗi khi thiết lập commands: {e}")
        
    # Lưu ý: confirm_order không hiển thị trong menu, chỉ admin biết và dùng trực tiếp

if __name__ == '__main__':
    payment_detector_process = None
    print("ℹ️ Bot chỉ chạy Python. Nếu có dịch vụ ghi payment_log.json, hãy chạy riêng.")
    print("   Bot sẽ đọc thanh toán từ: pending_orders/payment_log.json")
    print("   Nếu không có service ghi file này, cần xác nhận thủ công /confirm_order")
    print("")
    print(f"👥 Danh sách Admin ({len(ADMIN_IDS)} người):")
    for idx, admin_id in enumerate(ADMIN_IDS, 1):
        print(f"   {idx}. {admin_id}")
    print("")
    
    clean_old_data()
    load_active_orders()  # Load đơn hàng đang chờ admin xử lý
    load_pending_orders()  # Load đơn nạp tiền đang chờ thanh toán
    cleanup_old_orders()   # Xóa đơn hàng cũ > 30 ngày khỏi order history
    application = (
        ApplicationBuilder()
        .token(BOT_TOKEN)
        .post_init(setup_commands)
        .build()
    )
    
    # ================== MAINTENANCE HANDLER - PHẢI ĐĂNG KÝ ĐẦU TIÊN ==================
    # Đăng ký TRƯỚC TẤT CẢ các handler khác để có thể chặn mọi thứ khi bot dừng
    # group=-1 đảm bảo handler này chạy trước các handler khác trong cùng group
    application.add_handler(
        MessageHandler(
            filters.ALL,  # Chặn TẤT CẢ messages bao gồm cả commands
            handle_maintenance_message
        ),
        group=-1  # Priority cao nhất
    )
    application.add_handler(
        CallbackQueryHandler(handle_maintenance_message),
        group=-1  # Priority cao cho callback queries
    )
    # ================================================================================
    
    conv_handler = ConversationHandler(
        entry_points=[
            CallbackQueryHandler(show_menu_handler, pattern='^show_menu$'),
            CommandHandler('startmenu', cmd_startmenu),
            # Cho phép mở menu bằng nút Reply Keyboard "Sản phẩm"
            MessageHandler(
                filters.Regex(r"(?i)^\s*(?:🛍️\s*)?(sản phẩm|san pham)\s*$"),
                cmd_startmenu
            ),
        ],
        states={
            CHOOSING_PRODUCT: [
                CallbackQueryHandler(ask_quantity, pattern='^select\\|'),
                CallbackQueryHandler(show_menu_handler, pattern='^show_menu$'),  # Cho phép bấm lại menu
                CommandHandler('startmenu', cmd_startmenu)  # Cho phép dùng lệnh lại
            ],
            ASKING_QUANTITY: [
                MessageHandler(filters.TEXT & ~filters.COMMAND, process_order_request),
                CallbackQueryHandler(show_menu_handler, pattern='^show_menu$'),  # Cho phép bấm lại menu
                CommandHandler('startmenu', cmd_startmenu)  # Cho phép dùng lệnh lại
            ]
        },
        fallbacks=[
            CommandHandler('cancel', cancel),
            CommandHandler('startmenu', cmd_startmenu),  # Cho phép reset bằng startmenu
            CallbackQueryHandler(back_to_home, pattern='^back_to_home$'),
            CallbackQueryHandler(show_menu_handler, pattern='^show_menu$')  # Cho phép reset bằng show_menu
        ],
        allow_reentry=True  # Cho phép vào lại conversation
    )
    
    # Đăng ký ConversationHandler TRƯỚC các CallbackQueryHandler khác để tránh conflict
    application.add_handler(conv_handler)
    
    # Command handlers
    # QUAN TRỌNG: cmd_admin_start đăng ký TRƯỚC start để admin có thể dùng /start với tham số
    application.add_handler(CommandHandler('start', cmd_admin_start))  # Admin /start xử lý trước
    application.add_handler(CommandHandler('start', cmd_customer_start))  # Khách hàng /start
    application.add_handler(CommandHandler('donhang', cmd_donhang))
    application.add_handler(CommandHandler('hotro', cmd_hotro))
    application.add_handler(CommandHandler('baocao', cmd_monthly_report))
    application.add_handler(CommandHandler('baocaothang', cmd_month_report))
    application.add_handler(CommandHandler('time', cmd_time))
    application.add_handler(CommandHandler('stop', cmd_stop))
    application.add_handler(CommandHandler('testapi', cmd_testapi))  # Admin test API
    application.add_handler(CommandHandler('restart', cmd_restart))  # Admin restart bot
    # Note reminder conversation (admin)
    note_conv_handler = ConversationHandler(
        entry_points=[CommandHandler('note', note_start)],
        states={
            NOTE_WAITING_INFO: [
                MessageHandler(filters.TEXT & ~filters.COMMAND, note_receive_info),
            ],
            NOTE_WAITING_EXPIRY: [
                MessageHandler(filters.TEXT & ~filters.COMMAND, note_receive_expiry),
            ],
        },
        fallbacks=[CommandHandler('cancel', cancel)],
        allow_reentry=True
    )
    application.add_handler(note_conv_handler)

    # Gift conversation handler
    gift_conv_handler = ConversationHandler(
        entry_points=[CommandHandler('gift', cmd_gift)],
        states={
            WAITING_GIFT_MESSAGE: [
                MessageHandler((filters.TEXT | filters.PHOTO) & ~filters.COMMAND, handle_gift_message),
            ],
            WAITING_GIFT_CONFIRM: [
                CallbackQueryHandler(confirm_send_gift, pattern="^(confirm|cancel)_send_gift$"),
            ],
        },
        fallbacks=[CommandHandler('cancel', cancel)],
        allow_reentry=True
    )
    application.add_handler(gift_conv_handler)
    
    # Deposit (Nạp tiền) conversation handler - ĐẶT TRƯỚC verify_phone để ưu tiên
    deposit_conv_handler = ConversationHandler(
        entry_points=[
            CommandHandler('deposit', cmd_deposit),
            CommandHandler('naptien', cmd_deposit),
            MessageHandler(filters.Regex(r'^💰\s*Nạp\s*Tiền$'), cmd_deposit),
            MessageHandler(filters.Regex(r'^[Nn]ạp\s*[Tt]iền$'), cmd_deposit),
        ],
        states={
            WAITING_DEPOSIT_AMOUNT: [
                MessageHandler(filters.TEXT & ~filters.COMMAND, handle_deposit_amount),
            ],
        },
        fallbacks=[CommandHandler('cancel', cancel)],
        allow_reentry=True
    )
    application.add_handler(deposit_conv_handler)
    
    # ==============================================================================
    # WARRANTY (BẢO HÀNH) HANDLERS
    # ==============================================================================
    warranty_conv_handler = ConversationHandler(
        entry_points=[
            CommandHandler('baohanh', cmd_warranty_start),
            CommandHandler('warranty', cmd_warranty_start),
        ],
        states={
            WARRANTY_WAITING_ORDER_CODE: [
                MessageHandler(filters.TEXT & ~filters.COMMAND, warranty_check_order),
            ],
            WARRANTY_WAITING_ACC_SELECTION: [
                MessageHandler(filters.TEXT & ~filters.COMMAND, warranty_receive_acc_selection),
            ],
            WARRANTY_WAITING_PASSWORD_RETRY: [
                MessageHandler(filters.TEXT & ~filters.COMMAND, warranty_password_retry),
            ],
        },
        fallbacks=[CommandHandler('cancel', cancel)],
        allow_reentry=True
    )
    application.add_handler(warranty_conv_handler)
    
    # Warranty callback handlers
    application.add_handler(CallbackQueryHandler(handle_warranty_callback, pattern=r'^warranty_check_'))
    application.add_handler(CallbackQueryHandler(handle_warranty_callback, pattern=r'^warranty_approve_'))
    application.add_handler(CallbackQueryHandler(handle_warranty_callback, pattern=r'^warranty_reject_'))
    application.add_handler(CallbackQueryHandler(handle_warranty_callback, pattern=r'^warranty_refund_'))
    application.add_handler(CallbackQueryHandler(handle_warranty_callback, pattern=r'^warranty_replace_'))
    application.add_handler(CallbackQueryHandler(handle_warranty_callback, pattern='^warranty_cancel$'))
    application.add_handler(CallbackQueryHandler(handle_warranty_admin_paid, pattern=r'^warranty_paid_'))
    
    # Handler for QR code photo for warranty refund
    application.add_handler(MessageHandler(
        filters.PHOTO & filters.User(user_id=None),  # Will be checked in handler
        handle_warranty_qr_received
    ))
    
    # Verify phone conversation handler
    verify_phone_conv_handler = ConversationHandler(
        entry_points=[CommandHandler('verify_phone', cmd_verify_phone)],
        states={
            WAITING_VERIFY_COUNTRY: [
                CallbackQueryHandler(handle_verify_country_callback, pattern=r'^verify_country\|'),
                CallbackQueryHandler(handle_verify_country_callback, pattern='^verify_cancel$'),
            ],
            WAITING_VERIFY_COUNTRY_365OTP: [
                CallbackQueryHandler(handle_verify_365otp_callback, pattern=r'^verify_365otp\|'),
            ],
            WAITING_VERIFY_CREDENTIALS: [
                MessageHandler(filters.TEXT & ~filters.COMMAND, handle_verify_credentials),
            ],
            WAITING_VERIFY_QUANTITY: [
                MessageHandler(filters.TEXT & ~filters.COMMAND, handle_verify_quantity),
            ],
        },
        fallbacks=[CommandHandler('cancel', cmd_cancel_verify)],
        allow_reentry=True
    )
    application.add_handler(verify_phone_conv_handler)
    application.add_handler(CommandHandler('verify_status', cmd_verify_status))
    
    # SMS Provider settings (admin only)
    application.add_handler(CommandHandler('settingverify', cmd_settingverify))
    application.add_handler(CallbackQueryHandler(handle_sms_provider_callback, pattern=r'^sms_provider\|'))
    
    # Menu Phone - Admin cấu hình quốc gia cho SMSPool
    application.add_handler(CommandHandler('menu_phone', cmd_menu_phone))
    application.add_handler(CallbackQueryHandler(handle_menu_phone_callback, pattern=r'^menu_phone\|'))
    
    # 365OTP country selection callback (handled by conversation handler above, but also register for safety)
    application.add_handler(CallbackQueryHandler(handle_verify_365otp_callback, pattern=r'^verify_365otp\|'))
    
    # Balance commands (customer) - BỎ deposit_conv_handler trùng lặp bên dưới
    
    # Balance commands (customer)
    application.add_handler(CommandHandler('balance', cmd_check_balance))
    application.add_handler(CommandHandler('sodu', cmd_check_balance))
    application.add_handler(CommandHandler('xemsodu', cmd_check_balance))
    application.add_handler(CommandHandler('naptien', cmd_deposit))
    
    # Admin balance commands
    application.add_handler(CommandHandler('addmoney', cmd_addmoney))
    application.add_handler(CommandHandler('removemoney', cmd_removemoney))
    application.add_handler(CommandHandler('setmoney', cmd_setmoney))
    
    # ============ SELLER COMMANDS ============
    # Import and add seller handlers for reseller API integration
    try:
        from seller_commands import get_seller_handlers
        for handler in get_seller_handlers():
            application.add_handler(handler)
        logging.info("✅ Đã đăng ký seller commands: /dangky_seller, /check_balance_seller, /nap_api_seller, /mua_hang_seller")
    except ImportError as e:
        logging.warning(f"⚠️ Không thể import seller_commands: {e}")
    
    # Admin bot control commands
    # QUAN TRỌNG: cmd_admin_start phải đăng ký TRƯỚC handler start của khách
    # để admin có thể dùng /start với tham số
    application.add_handler(CommandHandler('stop', cmd_stop))
    application.add_handler(CommandHandler('stopverify', cmd_stopverify))  # Dừng verify tool
    application.add_handler(CommandHandler('startverify', cmd_startverify))  # Tiếp tục verify tool
    application.add_handler(CommandHandler('status', cmd_status))
    application.add_handler(CommandHandler('updatebaohanh', cmd_update_baohanh))  # Test warranty update
    application.add_handler(CommandHandler('offbaohanh', cmd_off_baohanh))  # Toggle warranty options
    application.add_handler(CommandHandler('blacklistbh', cmd_blacklist_baohanh))  # Thêm đơn vào blacklist
    application.add_handler(CommandHandler('offapiseller', cmd_off_api_seller))  # Tắt mua hàng seller
    application.add_handler(CommandHandler('onapiseller', cmd_on_api_seller))  # Bật mua hàng seller
    application.add_handler(CommandHandler('thuhoiacc', cmd_thuhoiacc))  # Thu hồi acc farm thủ công
    application.add_handler(CommandHandler('cleanlogs', cmd_cleanlogs))  # Dọn dẹp log files
    application.add_handler(CommandHandler('addadmin', cmd_addadmin))  # Thêm admin farm
    application.add_handler(CommandHandler('listadmin', cmd_listadmin))  # Xem danh sách admin
    application.add_handler(CommandHandler('removeadmin', cmd_removeadmin))  # Xóa admin
    
    # Các lệnh test nhắc nhở (chỉ admin, không hiện trong menu)
    application.add_handler(CommandHandler('testsang', cmd_test_morning))
    application.add_handler(CommandHandler('testtrua', cmd_test_lunch))
    application.add_handler(CommandHandler('testngu', cmd_test_sleep))
    application.add_handler(CommandHandler('announce', cmd_announce))
    # Broadcast conversation handler
    broadcast_conv_handler = ConversationHandler(
        entry_points=[CommandHandler('broadcast', cmd_broadcast)],
        states={
            WAITING_BROADCAST: [
                MessageHandler((filters.TEXT | filters.PHOTO) & ~filters.COMMAND, handle_broadcast_message),
                CommandHandler('cancel', cancel_broadcast)
            ]
        },
        fallbacks=[CommandHandler('cancel', cancel_broadcast)],
        allow_reentry=True
    )
    application.add_handler(broadcast_conv_handler)
    application.add_handler(CommandHandler('list_announcements', cmd_list_announcements))
    application.add_handler(CommandHandler('confirm_order', cmd_confirm_order))
    application.add_handler(CommandHandler('test_admin', cmd_test_admin))
    
    # Handler cho nút Restart Bot (admin only)
    async def handle_restart_button(update: Update, context: ContextTypes.DEFAULT_TYPE):
        user_id = update.effective_user.id
        if not is_admin(user_id):
            return
        await cmd_restart(update, context)
    
    application.add_handler(MessageHandler(filters.Regex(r'^🔄\s*Restart\s*Bot$'), handle_restart_button))
    
    # Handler cho nút Dọn Log (admin only)
    async def handle_cleanlogs_button(update: Update, context: ContextTypes.DEFAULT_TYPE):
        user_id = update.effective_user.id
        if not is_admin(user_id):
            return
        await cmd_cleanlogs(update, context)
    
    application.add_handler(MessageHandler(filters.Regex(r'^🧹\s*Dọn\s*Log$'), handle_cleanlogs_button))
    
    # CallbackQueryHandler - đăng ký SAU ConversationHandler
    # LƯU Ý: Không đăng ký handler cho 'back_to_home' ở đây vì nó đã có trong ConversationHandler fallbacks
    application.add_handler(CallbackQueryHandler(check_order, pattern='^check_order$'))
    application.add_handler(CallbackQueryHandler(show_order_detail, pattern=r'^order_detail\|'))
    # Handler Fallback cho nút chọn sản phẩm.
    # Trong một số trường hợp hiếm (VD: state ConversationHandler bị END do lỗi),
    # callback_data `select|<id>` sẽ không rơi vào state `CHOOSING_PRODUCT` nên Telegram chỉ hiển thị "Loading..."
    # mà không có phản hồi. Đăng ký thêm handler bên ngoài ConversationHandler để luôn xử lý được callback này.
    application.add_handler(CallbackQueryHandler(ask_quantity, pattern=r'^select\|'))
    # BỎ handler back_to_home ở đây để tránh conflict với ConversationHandler
    # application.add_handler(CallbackQueryHandler(back_to_home, pattern='^back_to_home$'))
    application.add_handler(CallbackQueryHandler(cancel_order_customer, pattern='^cancel_'))
    application.add_handler(CallbackQueryHandler(extend_order, pattern='^extend_order_'))
    application.add_handler(CallbackQueryHandler(check_payment_status, pattern='^check_payment_'))
    application.add_handler(CallbackQueryHandler(toggle_announcement, pattern='^toggle_ann_'))
    
    # Handlers cho quản lý trạng thái đơn hàng (Link/SheerID/Checkout)
    application.add_handler(CallbackQueryHandler(handle_link_error_callback, pattern='^link_error_'))
    application.add_handler(CallbackQueryHandler(handle_link_done_callback, pattern='^link_done_'))
    
    # Handlers cho đơn hàng Slot
    application.add_handler(CallbackQueryHandler(handle_slot_processing_callback, pattern='^slot_processing_'))
    application.add_handler(CallbackQueryHandler(handle_customer_slot_accepted_callback, pattern='^customer_slot_accepted_'))
    application.add_handler(CallbackQueryHandler(handle_slot_complete_callback, pattern='^slot_complete_'))
    application.add_handler(CallbackQueryHandler(handle_slot_done_callback, pattern='^slot_done_'))
    
    # Handlers cho đơn hàng ADD Farm
    application.add_handler(CallbackQueryHandler(handle_addfarm_processing_callback, pattern='^addfarm_processing_'))
    application.add_handler(CallbackQueryHandler(handle_addfarm_done_callback, pattern='^addfarm_done_'))
    application.add_handler(CallbackQueryHandler(handle_customer_addfarm_done_callback, pattern='^customer_addfarm_done_'))
    application.add_handler(CallbackQueryHandler(handle_addfarm_wrong_callback, pattern='^addfarm_wrong_'))
    application.add_handler(CallbackQueryHandler(handle_addfarm_complete_callback, pattern='^addfarm_complete_'))
    
    # Handlers cho đơn hàng Verify (2-Optin)
    application.add_handler(CallbackQueryHandler(handle_verify_link_callback, pattern='^verify_link_'))
    application.add_handler(CallbackQueryHandler(handle_verify_emailpass_callback, pattern='^verify_emailpass_'))
    application.add_handler(CallbackQueryHandler(handle_verify_ep_error_callback, pattern='^verify_ep_error_'))
    application.add_handler(CallbackQueryHandler(handle_verify_ep_done_callback, pattern='^verify_ep_done_'))
    
    # Handler cho hủy đơn nạp tiền
    application.add_handler(CallbackQueryHandler(cancel_deposit_callback, pattern='^cancel_deposit\\|'))
    # Handler cho kiểm tra lại thanh toán nạp tiền
    application.add_handler(CallbackQueryHandler(check_deposit_payment_callback, pattern='^check_deposit\\|'))
    
    # Handler cho chọn ngôn ngữ
    application.add_handler(CallbackQueryHandler(handle_language_callback, pattern='^lang_'))
    
    # Handler cho retry verify với quốc gia mới
    application.add_handler(CallbackQueryHandler(handle_verify_retry_country, pattern='^verify_retry_'))
    
    # Handler cho menu Reseller
    application.add_handler(CallbackQueryHandler(handle_seller_menu_callback, pattern='^seller_menu_'))
    
    # ============ WARRANTY (BẢO HÀNH) HANDLERS ============
    # Handler cho tất cả warranty callbacks
    application.add_handler(CallbackQueryHandler(handle_warranty_callback, pattern='^warranty_'))
    
    # Handler cho ảnh QR Code bảo hành (hoàn tiền)
    async def warranty_photo_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Handle photo messages - check if waiting for warranty QR"""
        if context.user_data.get('warranty_refund_order'):
            await handle_warranty_qr_received(update, context)
    
    application.add_handler(MessageHandler(filters.PHOTO, warranty_photo_handler))
    
    # NOTE: Maintenance handler đã được đăng ký ở ĐẦU TIÊN ngay sau application.build()
    # để đảm bảo chặn được TẤT CẢ các handler khác bao gồm ConversationHandler
    
    # Message handler - đăng ký CUỐI CÙNG
    application.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, simple_chat_handler))
    
    # ====== JOB BÁO CÁO + NHẮC NHỞ HẰNG NGÀY ======
    # - Báo cáo NGÀY: 22:00 mỗi ngày
    # - Báo cáo THÁNG: 19:00 ngày CUỐI THÁNG
    # - Nhắc admin:
    #   + 08:00: Dậy làm việc
    #   + 11:30: Ăn trưa
    #   + 23:59: Đi ngủ
    try:
        if application.job_queue is not None:
            # Tất cả job chạy theo giờ Việt Nam (UTC+7)
            report_time = dt_time(hour=22, minute=0, tzinfo=VIETNAM_TZ)
            application.job_queue.run_daily(
                send_daily_revenue_report,
                time=report_time,
                name="daily_revenue_report",
            )
            logging.info("📊 Đã lên lịch báo cáo doanh thu ngày lúc 22:00")
            
            # Job kiểm tra và gửi báo cáo THÁNG vào 19:00 ngày cuối tháng
            async def send_monthly_if_last_day(context: ContextTypes.DEFAULT_TYPE) -> None:
                now = get_vietnam_now()
                last_day = calendar.monthrange(now.year, now.month)[1]
                if now.day == last_day:
                    await send_monthly_revenue_report(context, notify_admins=True)

            month_time = dt_time(hour=19, minute=0, tzinfo=VIETNAM_TZ)
            application.job_queue.run_daily(
                send_monthly_if_last_day,
                time=month_time,
                name="monthly_revenue_report",
            )
            logging.info("📊 Đã lên lịch báo cáo doanh thu tháng lúc 19:00 (ngày cuối tháng)")
            
            # Nhắc nhở hằng ngày (giờ Việt Nam)
            application.job_queue.run_daily(
                morning_reminder,
                time=dt_time(hour=8, minute=0, tzinfo=VIETNAM_TZ),
                name="morning_reminder",
            )
            application.job_queue.run_daily(
                lunch_reminder,
                time=dt_time(hour=11, minute=30, tzinfo=VIETNAM_TZ),
                name="lunch_reminder",
            )
            application.job_queue.run_daily(
                sleep_reminder,
                time=dt_time(hour=23, minute=59, tzinfo=VIETNAM_TZ),
                name="sleep_reminder",
            )
            logging.info("⏰ Đã lên lịch nhắc nhở: 08:00 / 11:30 / 23:59")
            
            # ==============================================================================
            # JOB TỰ ĐỘNG THU HỒI ACC FARM - chạy 10:00 sáng mỗi ngày
            # ==============================================================================
            application.job_queue.run_daily(
                run_farm_recovery_job,
                time=dt_time(hour=10, minute=0, tzinfo=VIETNAM_TZ),
                name="daily_farm_recovery",
            )
            logging.info("🔄 Đã lên lịch tự động thu hồi acc farm: 10:00 mỗi ngày")
            
            # Job dọn log cũ hằng ngày lúc 4:00 sáng
            async def daily_log_cleanup(context: ContextTypes.DEFAULT_TYPE) -> None:
                """Dọn dẹp các file log backup cũ"""
                import glob
                cleaned_count = 0
                try:
                    # Xóa các file log backup cũ hơn 7 ngày
                    for pattern in ["*.log.*", "chat_logs/*.txt"]:
                        for filepath in glob.glob(pattern):
                            try:
                                file_age = time.time() - os.path.getmtime(filepath)
                                if file_age > 7 * 24 * 3600:  # 7 ngày
                                    os.remove(filepath)
                                    cleaned_count += 1
                            except:
                                pass
                    if cleaned_count > 0:
                        logging.info(f"🧹 Đã dọn {cleaned_count} file log cũ")
                except Exception as e:
                    logging.error(f"❌ Lỗi dọn log: {e}")
            
            application.job_queue.run_daily(
                daily_log_cleanup,
                time=dt_time(hour=4, minute=0, tzinfo=VIETNAM_TZ),
                name="daily_log_cleanup",
            )
            logging.info("📋 Đã lên lịch job dọn log hằng ngày lúc 4:00")
            
            # ==============================================================================
            # JOB NHẮC ADMIN XÓA ACC WARRANTY HẾT HẠN - chạy 11:00, 11:05, 11:10
            # ==============================================================================
            application.job_queue.run_daily(
                check_expired_warranty_claims,
                time=dt_time(hour=11, minute=0, tzinfo=VIETNAM_TZ),
                name="warranty_reminder_1",
            )
            application.job_queue.run_daily(
                check_expired_warranty_claims,
                time=dt_time(hour=11, minute=5, tzinfo=VIETNAM_TZ),
                name="warranty_reminder_2",
            )
            application.job_queue.run_daily(
                check_expired_warranty_claims,
                time=dt_time(hour=11, minute=10, tzinfo=VIETNAM_TZ),
                name="warranty_reminder_3",
            )
            logging.info("🔔 Đã lên lịch nhắc admin xóa acc BH hết hạn: 11:00 / 11:05 / 11:10")
            
            # Khôi phục các nhắc nhở note của admin
            restore_note_jobs(application)
            
            # Job kiểm tra kết quả verify phone mỗi 10 giây
            application.job_queue.run_repeating(
                check_verify_results_job,
                interval=10,
                first=5,
                name="check_verify_results"
            )
            
            # Job kiểm tra thanh toán verify_phone mỗi 2 giây
            application.job_queue.run_repeating(
                check_verify_phone_payments_job,
                interval=2,
                first=1,
                name="check_verify_phone_payments"
            )
            
            # Job kiểm tra thanh toán nạp tiền (deposit) mỗi 2 giây
            application.job_queue.run_repeating(
                check_deposit_payments_job,
                interval=2,
                first=1,
                name="check_deposit_payments"
            )
            
            logging.info(
                "✅ Đã đăng ký job (giờ Việt Nam UTC+7): báo cáo doanh thu ngày (22:00), "
                "báo cáo tháng (19:00, ngày cuối tháng), nhắc nhở 08:00 / 11:30 / 23:59, "
                "kiểm tra verify phone mỗi 10s, kiểm tra thanh toán verify_phone mỗi 3s, "
                "và kiểm tra thanh toán nạp tiền mỗi 3s."
            )
        else:
            logging.warning(
                "⚠️ JobQueue không khả dụng (chưa cài đặt phụ thuộc 'python-telegram-bot[job-queue]'). "
                "Tự động báo cáo doanh thu hàng ngày sẽ tạm tắt, nhưng lệnh /baocao vẫn dùng bình thường."
            )
    except Exception as e:
        logging.error(f"❌ Lỗi khi đăng ký job báo cáo doanh thu hằng ngày: {e}", exc_info=True)
    
    # Thêm error handler để xử lý Conflict error
    async def error_handler(update: object, context: ContextTypes.DEFAULT_TYPE) -> None:
        """Xử lý lỗi"""
        error = context.error
        if isinstance(error, Conflict):
            logging.warning("⚠️ Phát hiện nhiều bot instance đang chạy. Vui lòng tắt các instance khác.")
            logging.warning("⚠️ Bot sẽ tự động retry sau 10 giây...")
            await asyncio.sleep(10)
        elif isinstance(error, Exception):
            error_msg = str(error)
            if "terminated by other getUpdates" in error_msg or "Conflict" in type(error).__name__:
                logging.warning("⚠️ Phát hiện nhiều bot instance đang chạy. Vui lòng tắt các instance khác.")
            else:
                logging.error(f"Lỗi không xử lý được: {error}", exc_info=error)
    
    application.add_error_handler(error_handler)
    
    print("🤖 Bot đang chạy...")
    print("⚠️ Lưu ý: Chỉ chạy MỘT instance bot tại một thời điểm!")
    print("")
    print("📋 HƯỚNG DẪN CHẠY:")
    print("   1. Bot Python: Đang chạy (terminal này)")
    print("   2. Nếu có service ghi payment_log.json, hãy chạy service đó riêng")
    print("   3. Bot sẽ đọc payment từ: pending_orders/payment_log.json")
    print("   4. Nếu không có service tự động, dùng /confirm_order <mã_đơn> để xác nhận")
    print("")
    
    async def main():
        """Hàm async chính để chạy bot - đảm bảo initialize() được gọi trước"""
        async with application:
            await application.start()
            
            # === XÓA VÀ SET LẠI COMMANDS CHO ĐÚNG ===
            try:
                print("🔧 [MAIN] Đang set commands...")
                
                # Xóa tất cả commands cũ
                await application.bot.delete_my_commands()
                for admin_id in ADMIN_IDS:
                    try:
                        await application.bot.delete_my_commands(scope=BotCommandScopeChat(chat_id=admin_id))
                    except:
                        pass
                
                # 7 commands cơ bản cho KHÁCH HÀNG
                customer_commands = [
                    BotCommand("start", "🏠 Bắt đầu"),
                    BotCommand("startmenu", "🛍️ Sản phẩm"),
                    BotCommand("donhang", "📦 Đơn hàng"),
                    BotCommand("baohanh", "🛡️ Bảo hành"),
                    BotCommand("naptien", "💰 Nạp tiền"),
                    BotCommand("sodu", "💳 Xem số dư"),
                    BotCommand("hotro", "💬 Hỗ trợ"),
                ]
                await application.bot.set_my_commands(customer_commands)
                print(f"✅ Đã set {len(customer_commands)} commands cho KHÁCH HÀNG")
                
                # 26 commands cho ADMIN  
                admin_commands = customer_commands + [
                    BotCommand("verify_phone", "📱 Verify Phone Google"),
                    BotCommand("verify_status", "📊 Xem trạng thái verify"),
                    BotCommand("menu_phone", "📞 Cài đặt quốc gia verify"),
                    BotCommand("settingverify", "⚙️ Cài đặt SMS Provider"),
                    BotCommand("addmoney", "➕ Cộng tiền cho user"),
                    BotCommand("removemoney", "➖ Trừ tiền của user"),
                    BotCommand("setmoney", "💰 Đặt số dư cho user"),
                    BotCommand("broadcast", "📢 Gửi tin tới tất cả khách"),
                    BotCommand("baocao", "📊 Báo cáo doanh thu ngày"),
                    BotCommand("baocaothang", "📊 Báo cáo doanh thu tháng"),
                    BotCommand("note", "📝 Đặt nhắc hết hạn khách"),
                    BotCommand("gift", "🎁 Gửi quà tặng đặc biệt"),
                    BotCommand("stop", "🛑 Dừng bot tạm thời"),
                    BotCommand("offbaohanh", "🔒 Toggle on/off bảo hành"),
                    BotCommand("blacklistbh", "🚫 Thêm đơn vào blacklist"),
                    BotCommand("updatebaohanh", "🔄 Cập nhật warranty"),
                    BotCommand("offapiseller", "🔒 Tắt mua hàng seller"),
                    BotCommand("onapiseller", "✅ Bật mua hàng seller"),
                    BotCommand("confirm_order", "✅ Xác nhận đơn thủ công"),
                ]
                
                for admin_id in ADMIN_IDS:
                    try:
                        await application.bot.set_my_commands(
                            admin_commands,
                            scope=BotCommandScopeChat(chat_id=admin_id)
                        )
                        print(f"✅ Đã set {len(admin_commands)} commands cho ADMIN {admin_id}")
                    except Exception as e:
                        print(f"❌ Lỗi set commands cho admin {admin_id}: {e}")
                        
            except Exception as e:
                print(f"⚠️ Lỗi khi set commands: {e}")
            
            await application.updater.start_polling(
                drop_pending_updates=True,
                allowed_updates=Update.ALL_TYPES
            )
            
            # === LÊN LỊCH DỌN LOG TỰ ĐỘNG ===
            try:
                # Chạy cleanup ngay khi khởi động
                cleanup_report = cleanup_large_logs()
                if cleanup_report:
                    logging.info(f"🧹 Đã dọn log khi khởi động: {len(cleanup_report)} files")
                
                # Lên lịch job chạy hàng ngày lúc 4:00 sáng
                application.job_queue.run_daily(
                    log_cleanup_job,
                    time=dt_time(hour=4, minute=0, tzinfo=VIETNAM_TZ),
                    name="daily_log_cleanup"
                )
                logging.info("📅 Đã lên lịch job dọn log hàng ngày lúc 4:00")
            except Exception as e:
                logging.error(f"❌ Lỗi lên lịch job cleanup: {e}")
            
            # === LÊN LỊCH CẬP NHẬT WARRANTY TỰ ĐỘNG VÀO 23:59 HẰNG NGÀY ===
            try:
                asyncio.create_task(schedule_daily_warranty_update())
                logging.info("📅 Đã lên lịch job update warranty hằng ngày lúc 23:59")
            except Exception as e:
                logging.error(f"❌ Lỗi lên lịch job warranty: {e}")
            
            # Giữ bot chạy vô thời hạn
            await asyncio.Event().wait()
    
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n🛑 Bot đang dừng...")
        print("🛑 Bot đã dừng.")
    except Conflict as e:
        logging.error(f"❌ Conflict: Có bot instance khác đang chạy. Vui lòng tắt instance đó trước.")
        print("❌ Lỗi: Có bot instance khác đang chạy. Vui lòng tắt instance đó trước.")
    except Exception as e:
        logging.error(f"Lỗi khi chạy bot: {e}", exc_info=True)
