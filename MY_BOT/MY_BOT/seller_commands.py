"""
Seller Commands Module
Provides /check_balance_seller and /nap_api_seller commands for resellers
"""
import logging
import json
import html as html_lib
import os
import requests
import asyncio
from datetime import datetime, timedelta, timezone
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import (
    ContextTypes,
    CommandHandler,
    MessageHandler,
    CallbackQueryHandler,
    ConversationHandler,
    filters,
)

logger = logging.getLogger(__name__)

# Vietnam timezone
VIETNAM_TZ = timezone(timedelta(hours=7))

# Conversation states
SELLER_WAITING_API_KEY, SELLER_WAITING_AMOUNT = range(100, 102)
SELLER_REGISTER_NAME = 102
SELLER_SELECT_PRODUCT, SELLER_SELECT_QUANTITY, SELLER_CONFIRM_PURCHASE = range(103, 106)

# File to store seller API key linking
SELLER_LINKING_FILE = "pending_orders/seller_linking.json"

# Inventory API config - Now using Railway via custom domain
INVENTORY_API_URL = "https://shopmmoapikey.shop"
ADMIN_TOKEN = "INV_ADMIN_2026_xK9mP4qR7sT2vW5y"

# MB Bank config for QR
BANK_ID = "MB"
ACCOUNT_NO = ""  # Will be loaded from config
ACCOUNT_NAME = ""

# =============================================================================
# SELLER API ON/OFF CONTROL
# =============================================================================
SELLER_API_CONFIG_FILE = "pending_orders/seller_api_config.json"

def load_seller_api_config():
    """Load seller API config (enabled/disabled state)"""
    if os.path.exists(SELLER_API_CONFIG_FILE):
        try:
            with open(SELLER_API_CONFIG_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except:
            pass
    return {"purchase_enabled": True}

def save_seller_api_config(config):
    """Save seller API config"""
    os.makedirs(os.path.dirname(SELLER_API_CONFIG_FILE), exist_ok=True)
    with open(SELLER_API_CONFIG_FILE, "w", encoding="utf-8") as f:
        json.dump(config, f, ensure_ascii=False, indent=2)

def is_seller_purchase_enabled():
    """Check if seller purchase is enabled"""
    config = load_seller_api_config()
    return config.get("purchase_enabled", True)

def set_seller_purchase_enabled(enabled: bool):
    """Set seller purchase enabled/disabled"""
    config = load_seller_api_config()
    config["purchase_enabled"] = enabled
    config["updated_at"] = datetime.now(VIETNAM_TZ).isoformat()
    save_seller_api_config(config)
    return config

def get_all_linked_sellers():
    """Get all linked seller user IDs for notification"""
    linking_data = load_seller_linking()
    return list(linking_data.keys())  # Returns list of user_id strings


def load_seller_linking():
    """Load seller linking data (user_id -> reseller info)"""
    if os.path.exists(SELLER_LINKING_FILE):
        try:
            with open(SELLER_LINKING_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except:
            pass
    return {}


def save_seller_linking(data):
    """Save seller linking data"""
    os.makedirs(os.path.dirname(SELLER_LINKING_FILE), exist_ok=True)
    with open(SELLER_LINKING_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

def get_linked_reseller(user_id):
    """Get linked reseller info for user - verifies reseller still exists"""
    data = load_seller_linking()
    linked = data.get(str(user_id))
    
    if linked:
        # Verify reseller still exists in API
        api_key = linked.get("api_key")
        if api_key:
            balance_info = get_balance(api_key)
            if balance_info is None:
                # Reseller no longer exists - remove link
                logger.info(f"Reseller {linked.get('reseller_id')} no longer exists, removing link for user {user_id}")
                del data[str(user_id)]
                save_seller_linking(data)
                return None
    
    return linked


def link_reseller(user_id, reseller_id, api_key):
    """Link user to reseller"""
    data = load_seller_linking()
    data[str(user_id)] = {
        "reseller_id": reseller_id,
        "api_key": api_key,
        "linked_at": datetime.now(VIETNAM_TZ).isoformat()
    }
    save_seller_linking(data)


def validate_api_key(api_key):
    """Validate API key with inventory API, returns reseller info or None"""
    try:
        response = requests.get(
            f"{INVENTORY_API_URL}/v1/balance",
            headers={"Authorization": f"Bearer {api_key}"},
            timeout=10
        )
        if response.status_code == 200:
            return response.json()
        return None
    except Exception as e:
        logger.error(f"Error validating API key: {e}")
        return None


def get_balance(api_key):
    """Get balance for reseller"""
    try:
        response = requests.get(
            f"{INVENTORY_API_URL}/v1/balance",
            headers={"Authorization": f"Bearer {api_key}"},
            timeout=10
        )
        if response.status_code == 200:
            return response.json()
        return None
    except Exception as e:
        logger.error(f"Error getting balance: {e}")
        return None


def format_money(amount):
    """Format money: 500000 -> 500.000 VNĐ"""
    return f"{amount:,}".replace(",", ".") + " VNĐ"


def generate_qr_url(amount, content, account_no, bank_id="MB"):
    """Generate VietQR URL"""
    # VietQR format: https://img.vietqr.io/image/{bank}-{account}-{template}.png?amount={amount}&addInfo={content}
    safe_content = content.replace(" ", "%20")
    return f"https://img.vietqr.io/image/{bank_id}-{account_no}-compact.png?amount={amount}&addInfo={safe_content}"


def create_reseller(reseller_id, name):
    """Create a new reseller via admin API"""
    try:
        response = requests.post(
            f"{INVENTORY_API_URL}/v1/admin/resellers",
            headers={
                "X-ADMIN-TOKEN": ADMIN_TOKEN,
                "Content-Type": "application/json"
            },
            json={"id": reseller_id, "name": name},
            timeout=10
        )
        if response.status_code == 200:
            return response.json()
        elif response.status_code == 409:
            return {"error": "already_exists"}
        else:
            logger.error(f"Create reseller failed: {response.status_code} - {response.text}")
            return None
    except Exception as e:
        logger.error(f"Error creating reseller: {e}")
        return None


def get_products(api_key):
    """Get list of products from inventory API"""
    try:
        response = requests.get(
            f"{INVENTORY_API_URL}/v1/products",
            headers={"Authorization": f"Bearer {api_key}"},
            timeout=10
        )
        if response.status_code == 200:
            return response.json().get("products", [])
        return []
    except Exception as e:
        logger.error(f"Error getting products: {e}")
        return []


def purchase_product(api_key, product_id, quantity, order_id):
    """Purchase product from inventory API"""
    try:
        response = requests.post(
            f"{INVENTORY_API_URL}/v1/purchase",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json"
            },
            json={
                "product_id": product_id,
                "quantity": quantity,
                "reseller_order_id": order_id
            },
            timeout=30
        )
        return response.status_code, response.json()
    except Exception as e:
        logger.error(f"Error purchasing: {e}")
        return 500, {"error": str(e)}


# ==============================================================================
# /dangky_seller Command - Register as Reseller
# ==============================================================================

async def cmd_dangky_seller(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Register as a new reseller"""
    user_id = update.effective_user.id
    
    # Check if already linked
    linked = get_linked_reseller(user_id)
    if linked:
        api_key = linked.get("api_key")
        balance_info = get_balance(api_key)
        
        if balance_info:
            await update.message.reply_text(
                f"ℹ️ <b>Bạn đã là Reseller!</b>\n\n"
                f"📋 Reseller ID: <code>{linked.get('reseller_id')}</code>\n"
                f"💵 Số dư: <b>{format_money(balance_info.get('balance', 0))}</b>\n\n"
                f"📌 Dùng /check_balance_seller để xem số dư\n"
                f"📌 Dùng /nap_api_seller để nạp tiền\n"
                f"📌 Dùng /mua_hang_seller để mua hàng",
                parse_mode='HTML'
            )
            return ConversationHandler.END
    
    await update.message.reply_text(
        "🎉 <b>ĐĂNG KÝ TRỞ THÀNH RESELLER</b>\n\n"
        "Bạn sẽ nhận được <b>API Key</b> để:\n"
        "• Nạp tiền và mua hàng từ kho\n"
        "• Tích hợp vào bot riêng của bạn\n\n"
        "📝 Vui lòng nhập <b>Tên Shop</b> của bạn:\n"
        "<i>Ví dụ: Shop ABC MMO</i>",
        parse_mode='HTML'
    )
    return SELLER_REGISTER_NAME


async def seller_register_receive_name(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Receive shop name and create reseller"""
    user_id = update.effective_user.id
    shop_name = update.message.text.strip()
    
    if len(shop_name) < 2:
        await update.message.reply_text(
            "❌ Tên shop quá ngắn! Vui lòng nhập lại:",
            parse_mode='HTML'
        )
        return SELLER_REGISTER_NAME
    
    if len(shop_name) > 50:
        await update.message.reply_text(
            "❌ Tên shop quá dài (tối đa 50 ký tự)! Vui lòng nhập lại:",
            parse_mode='HTML'
        )
        return SELLER_REGISTER_NAME
    
    # Generate reseller ID from user_id
    reseller_id = f"RS_{user_id}"
    
    await update.message.reply_text("⏳ Đang tạo tài khoản Reseller...")
    
    # Create reseller via API
    result = create_reseller(reseller_id, shop_name)
    
    if result is None:
        await update.message.reply_text(
            "❌ <b>Lỗi tạo tài khoản!</b>\n\n"
            "Vui lòng thử lại sau hoặc liên hệ Admin.",
            parse_mode='HTML'
        )
        return ConversationHandler.END
    
    if result.get("error") == "already_exists":
        await update.message.reply_text(
            "⚠️ <b>Tài khoản đã tồn tại!</b>\n\n"
            "Vui lòng dùng /check_balance_seller và nhập API Key của bạn.",
            parse_mode='HTML'
        )
        return ConversationHandler.END
    
    # Success - get API key
    api_key = result.get("api_key", "")
    
    # Link user to reseller
    link_reseller(user_id, reseller_id, api_key)
    
    # Message 1: Registration success + API Key only
    docs_url = "https://shopmmoapikey.shop/docs"
    base_url = "https://shopmmoapikey.shop"
    
    await update.message.reply_text(
        f"✅ <b>ĐĂNG KÝ THÀNH CÔNG!</b>\n\n"
        f"📋 Reseller ID: <code>{reseller_id}</code>\n"
        f"🏪 Tên Shop: <b>{shop_name}</b>",
        parse_mode='HTML'
    )
    
    # Message 2: API Key (separate for easy copy)
    await update.message.reply_text(
        f"🔑 <b>API KEY CỦA BẠN:</b>\n"
        f"<code>{api_key}</code>\n\n"
        f"⚠️ <b>LƯU Ý:</b> API Key chỉ hiển thị <b>1 LẦN!</b>\n"
        f"Hãy copy và lưu lại ngay!",
        parse_mode='HTML'
    )
    
    # Message 3: Base URL + Auth header
    await update.message.reply_text(
        f"🌐 <b>BASE URL:</b>\n"
        f"<code>{base_url}</code>\n\n"
        f"🔐 <b>HEADER XÁC THỰC:</b>\n"
        f"<code>Authorization: Bearer {api_key}</code>",
        parse_mode='HTML'
    )
    
    # Message 4: Docs link
    await update.message.reply_text(
        f"📖 <b>Tài liệu tích hợp API:</b>\n"
        f"{docs_url}\n\n"
        f"📌 <b>LƯU Ý QUAN TRỌNG:</b>\n"
        f"• <code>reseller_order_id</code> phải UNIQUE mỗi đơn\n"
        f"• Rate limit: 10 req/phút cho /purchase\n"
        f"• Khi lỗi 429: chờ 5s → 10s → 20s rồi retry",
        parse_mode='HTML'
    )
    
    # Message 5: Quick commands only
    await update.message.reply_text(
        f"📌 <b>Các lệnh nhanh trong bot này:</b>\n\n"
        f"• /check_balance_seller - Xem số dư\n"
        f"• /nap_api_seller - Nạp tiền qua QR\n"
        f"• /mua_hang_seller - Mua hàng thủ công\n\n"
        f"💡 Xem tài liệu để tích hợp vào bot riêng!",
        parse_mode='HTML'
    )
    
    return ConversationHandler.END


# ==============================================================================
# /check_balance_seller Command
# ==============================================================================

async def cmd_check_balance_seller(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Check balance command for sellers"""
    user_id = update.effective_user.id
    
    # Check if already linked
    linked = get_linked_reseller(user_id)
    if linked:
        api_key = linked.get("api_key")
        balance_info = get_balance(api_key)
        
        if balance_info:
            await update.message.reply_text(
                f"💰 <b>Số dư tài khoản Reseller</b>\n\n"
                f"📋 Reseller ID: <code>{balance_info.get('reseller_id', linked.get('reseller_id'))}</code>\n"
                f"💵 Số dư: <b>{format_money(balance_info.get('balance', 0))}</b>\n\n"
                f"📌 Dùng /nap_api_seller để nạp thêm tiền",
                parse_mode='HTML'
            )
            return ConversationHandler.END
        else:
            # API key might be invalid/disabled
            await update.message.reply_text(
                "⚠️ <b>API Key không còn hợp lệ!</b>\n\n"
                "Vui lòng gửi API Key mới của bạn:",
                parse_mode='HTML'
            )
            return SELLER_WAITING_API_KEY
    
    # Not linked, ask for API key
    await update.message.reply_text(
        "🔐 <b>Liên kết tài khoản Reseller</b>\n\n"
        "Vui lòng gửi API Key của bạn để kiểm tra số dư:\n\n"
        "📌 <i>API Key được cấp bởi Admin khi tạo tài khoản reseller</i>",
        parse_mode='HTML'
    )
    return SELLER_WAITING_API_KEY


async def seller_receive_api_key(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Receive and validate API key from seller"""
    user_id = update.effective_user.id
    api_key = update.message.text.strip()
    
    # Validate API key
    balance_info = validate_api_key(api_key)
    
    if not balance_info:
        await update.message.reply_text(
            "❌ <b>API Key không hợp lệ!</b>\n\n"
            "Vui lòng kiểm tra lại hoặc liên hệ Admin.\n"
            "Gửi /cancel để hủy.",
            parse_mode='HTML'
        )
        return SELLER_WAITING_API_KEY
    
    # Link user to reseller
    reseller_id = balance_info.get("reseller_id", "unknown")
    link_reseller(user_id, reseller_id, api_key)
    
    await update.message.reply_text(
        f"✅ <b>Liên kết thành công!</b>\n\n"
        f"📋 Reseller ID: <code>{reseller_id}</code>\n"
        f"💵 Số dư: <b>{format_money(balance_info.get('balance', 0))}</b>\n\n"
        f"📌 Từ giờ bạn có thể dùng:\n"
        f"• /check_balance_seller - Xem số dư\n"
        f"• /nap_api_seller - Nạp tiền",
        parse_mode='HTML'
    )
    return ConversationHandler.END


# ==============================================================================
# /nap_api_seller Command
# ==============================================================================

async def cmd_nap_api_seller(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Deposit command for sellers"""
    user_id = update.effective_user.id
    
    # Check if linked
    linked = get_linked_reseller(user_id)
    if not linked:
        await update.message.reply_text(
            "⚠️ <b>Bạn chưa liên kết API Key!</b>\n\n"
            "Vui lòng dùng /check_balance_seller để liên kết trước.",
            parse_mode='HTML'
        )
        return ConversationHandler.END
    
    # Verify API key still valid
    api_key = linked.get("api_key")
    balance_info = get_balance(api_key)
    
    if not balance_info:
        await update.message.reply_text(
            "⚠️ <b>API Key không còn hợp lệ!</b>\n\n"
            "Vui lòng dùng /check_balance_seller để liên kết lại.",
            parse_mode='HTML'
        )
        return ConversationHandler.END
    
    # Store reseller info in context
    context.user_data['seller_reseller_id'] = linked.get("reseller_id")
    context.user_data['seller_api_key'] = api_key
    context.user_data['seller_current_balance'] = balance_info.get('balance', 0)
    
    await update.message.reply_text(
        f"💳 <b>Nạp tiền tài khoản Reseller</b>\n\n"
        f"📋 Reseller ID: <code>{linked.get('reseller_id')}</code>\n"
        f"💵 Số dư hiện tại: <b>{format_money(balance_info.get('balance', 0))}</b>\n\n"
        f"💰 Nhập số tiền bạn muốn nạp (VNĐ):\n"
        f"<i>Ví dụ: 500000</i>",
        parse_mode='HTML'
    )
    return SELLER_WAITING_AMOUNT


async def seller_receive_amount(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Receive deposit amount and generate QR"""
    user_id = update.effective_user.id
    amount_text = update.message.text.strip().replace(",", "").replace(".", "")
    
    # Validate amount
    try:
        amount = int(amount_text)
        if amount < 10000:
            await update.message.reply_text(
                "❌ Số tiền tối thiểu là 10.000 VNĐ\n"
                "Vui lòng nhập lại:",
                parse_mode='HTML'
            )
            return SELLER_WAITING_AMOUNT
        if amount > 100000000:
            await update.message.reply_text(
                "❌ Số tiền tối đa là 100.000.000 VNĐ\n"
                "Vui lòng nhập lại:",
                parse_mode='HTML'
            )
            return SELLER_WAITING_AMOUNT
    except ValueError:
        await update.message.reply_text(
            "❌ Số tiền không hợp lệ!\n"
            "Vui lòng nhập số (ví dụ: 500000):",
            parse_mode='HTML'
        )
        return SELLER_WAITING_AMOUNT
    
    reseller_id = context.user_data.get('seller_reseller_id')
    current_balance = context.user_data.get('seller_current_balance', 0)
    
    # Generate unique transfer content (alphanumeric only - banks remove special chars)
    import random
    import string
    token = ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
    # Remove underscores from reseller_id for bank compatibility
    clean_reseller_id = reseller_id.replace("_", "") if reseller_id else ""
    transfer_content = f"NAPSELLER {clean_reseller_id} {token}"
    
    # Store pending deposit
    pending_seller_deposits = load_pending_seller_deposits()
    pending_seller_deposits[token] = {
        "user_id": user_id,
        "reseller_id": reseller_id,
        "amount": amount,
        "content": transfer_content,
        "created_at": datetime.now(VIETNAM_TZ).isoformat(),
        "status": "pending"
    }
    save_pending_seller_deposits(pending_seller_deposits)
    
    # Get bank account from config
    try:
        with open("mbbank-main/config/config.json", "r", encoding="utf-8") as f:
            config = json.load(f)
            account_no = config.get("accountNo", "")
    except:
        account_no = ""
    
    if not account_no:
        await update.message.reply_text(
            "❌ Không thể tạo QR, vui lòng liên hệ Admin!",
            parse_mode='HTML'
        )
        return ConversationHandler.END
    
    # Generate QR URL
    qr_url = generate_qr_url(amount, transfer_content, account_no)
    
    # Send QR
    await update.message.reply_photo(
        photo=qr_url,
        caption=(
            f"💳 <b>Nạp tiền Reseller</b>\n\n"
            f"📋 Reseller ID: <code>{reseller_id}</code>\n"
            f"💵 Số tiền: <b>{format_money(amount)}</b>\n\n"
            f"🏦 <b>Thông tin chuyển khoản:</b>\n"
            f"• Ngân hàng: MB Bank\n"
            f"• Số TK: <code>{account_no}</code>\n"
            f"• Nội dung: <code>{transfer_content}</code>\n\n"
            f"⏳ Thời gian chờ: 10 phút\n"
            f"✅ Sau khi chuyển khoản, hệ thống sẽ tự động cộng tiền.\n\n"
            f"📌 <i>Lưu ý: Ghi đúng nội dung chuyển khoản!</i>"
        ),
        parse_mode='HTML'
    )
    
    # Store for payment checking
    context.user_data['seller_pending_token'] = token
    context.user_data['seller_pending_amount'] = amount
    
    return ConversationHandler.END


# ==============================================================================
# /mua_hang_seller Command - Purchase Products
# ==============================================================================

async def cmd_mua_hang_seller(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Purchase products from inventory"""
    user_id = update.effective_user.id
    
    # CHECK: Seller purchase có bị admin tắt không?
    if not is_seller_purchase_enabled():
        await update.message.reply_text(
            "⚠️ <b>CHỨC NĂNG MUA HÀNG ĐÃ TẠM KHÓA</b>\n\n"
            "🔒 Admin đã tạm khóa chức năng mua hàng qua bot.\n\n"
            "📢 <b>Vui lòng kết nối API trực tiếp để mua hàng:</b>\n"
            f"• API Endpoint: <code>{INVENTORY_API_URL}</code>\n"
            "• Xem hướng dẫn: /huongdan_api\n\n"
            "💡 <i>Hạn chế sử dụng trực tiếp qua bot, kết nối API ra ngoài để có trải nghiệm tốt hơn!</i>\n\n"
            "📞 Liên hệ admin nếu cần hỗ trợ.",
            parse_mode='HTML'
        )
        return ConversationHandler.END
    
    # Check if linked
    linked = get_linked_reseller(user_id)
    if not linked:
        await update.message.reply_text(
            "⚠️ <b>Bạn chưa liên kết API Key!</b>\n\n"
            "Vui lòng dùng /dangky_seller để đăng ký\n"
            "hoặc /check_balance_seller để liên kết API Key.",
            parse_mode='HTML'
        )
        return ConversationHandler.END
    
    # Verify API key still valid and get balance
    api_key = linked.get("api_key")
    balance_info = get_balance(api_key)
    
    if not balance_info:
        await update.message.reply_text(
            "⚠️ <b>API Key không còn hợp lệ!</b>\n\n"
            "Vui lòng dùng /check_balance_seller để liên kết lại.",
            parse_mode='HTML'
        )
        return ConversationHandler.END
    
    current_balance = balance_info.get('balance', 0)
    
    # Get products list
    products = get_products(api_key)
    
    if not products:
        await update.message.reply_text(
            "❌ <b>Không có sản phẩm nào trong kho!</b>\n\n"
            "Vui lòng liên hệ Admin.",
            parse_mode='HTML'
        )
        return ConversationHandler.END
    
    # Store in context
    context.user_data['seller_api_key'] = api_key
    context.user_data['seller_balance'] = current_balance
    context.user_data['seller_products'] = products
    context.user_data['seller_reseller_id'] = linked.get('reseller_id')
    
    # Create inline keyboard with products
    keyboard = []
    for p in products:
        if p.get('available', 0) > 0:
            btn_text = f"{p['name']} - {format_money(p['price'])} ({p['available']} có sẵn)"
            keyboard.append([InlineKeyboardButton(btn_text, callback_data=f"seller_buy_{p['id']}")])
    
    keyboard.append([InlineKeyboardButton("❌ Hủy", callback_data="seller_buy_cancel")])
    
    await update.message.reply_text(
        f"🛒 <b>MUA HÀNG TỪ KHO</b>\n\n"
        f"💵 Số dư hiện tại: <b>{format_money(current_balance)}</b>\n\n"
        f"📦 Chọn sản phẩm muốn mua:",
        reply_markup=InlineKeyboardMarkup(keyboard),
        parse_mode='HTML'
    )
    return SELLER_SELECT_PRODUCT


async def seller_select_product_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle product selection callback"""
    query = update.callback_query
    await query.answer()
    
    data = query.data
    
    if data == "seller_buy_cancel":
        await query.edit_message_text("❌ Đã hủy mua hàng.")
        return ConversationHandler.END
    
    # Parse product_id
    product_id = data.replace("seller_buy_", "")
    
    # Find product info
    products = context.user_data.get('seller_products', [])
    product = next((p for p in products if p['id'] == product_id), None)
    
    if not product:
        await query.edit_message_text("❌ Sản phẩm không tồn tại!")
        return ConversationHandler.END
    
    # Store selected product
    context.user_data['seller_selected_product'] = product
    
    balance = context.user_data.get('seller_balance', 0)
    max_qty = min(product.get('available', 0), balance // product['price']) if product['price'] > 0 else product.get('available', 0)
    
    await query.edit_message_text(
        f"🛍️ <b>Sản phẩm đã chọn:</b>\n\n"
        f"📦 {product['name']}\n"
        f"💰 Đơn giá: {format_money(product['price'])}\n"
        f"📊 Còn lại: {product.get('available', 0)}\n"
        f"💵 Số dư của bạn: {format_money(balance)}\n"
        f"🔢 Bạn có thể mua tối đa: <b>{max_qty}</b>\n\n"
        f"📝 Nhập số lượng muốn mua:\n"
        f"<i>Gửi /cancel để hủy</i>",
        parse_mode='HTML'
    )
    return SELLER_SELECT_QUANTITY


async def seller_receive_quantity(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Receive quantity and confirm purchase"""
    qty_text = update.message.text.strip()
    
    try:
        quantity = int(qty_text)
        if quantity <= 0:
            raise ValueError("Invalid quantity")
    except ValueError:
        await update.message.reply_text(
            "❌ Số lượng không hợp lệ! Vui lòng nhập số:",
            parse_mode='HTML'
        )
        return SELLER_SELECT_QUANTITY
    
    product = context.user_data.get('seller_selected_product')
    balance = context.user_data.get('seller_balance', 0)
    
    if not product:
        await update.message.reply_text("❌ Lỗi! Vui lòng thử lại /mua_hang_seller")
        return ConversationHandler.END
    
    available = product.get('available', 0)
    price = product.get('price', 0)
    total_cost = price * quantity
    
    if quantity > available:
        await update.message.reply_text(
            f"❌ Không đủ hàng! Chỉ còn {available} sản phẩm.\n"
            f"Vui lòng nhập số lượng khác:",
            parse_mode='HTML'
        )
        return SELLER_SELECT_QUANTITY
    
    if total_cost > balance:
        max_affordable = balance // price if price > 0 else 0
        await update.message.reply_text(
            f"❌ Không đủ số dư!\n\n"
            f"💵 Số dư hiện tại: {format_money(balance)}\n"
            f"💰 Tổng tiền: {format_money(total_cost)}\n"
            f"🔢 Bạn chỉ có thể mua tối đa: {max_affordable}\n\n"
            f"Vui lòng nhập số lượng khác hoặc /nap_api_seller để nạp thêm tiền:",
            parse_mode='HTML'
        )
        return SELLER_SELECT_QUANTITY
    
    # Store quantity and show confirmation
    context.user_data['seller_quantity'] = quantity
    context.user_data['seller_total_cost'] = total_cost
    
    keyboard = [
        [
            InlineKeyboardButton("✅ Xác nhận mua", callback_data="seller_confirm_yes"),
            InlineKeyboardButton("❌ Hủy", callback_data="seller_confirm_no")
        ]
    ]
    
    await update.message.reply_text(
        f"🛒 <b>XÁC NHẬN ĐƠN HÀNG</b>\n\n"
        f"📦 Sản phẩm: <b>{product['name']}</b>\n"
        f"🔢 Số lượng: <b>{quantity}</b>\n"
        f"💰 Đơn giá: {format_money(price)}\n"
        f"━━━━━━━━━━━━━━━━━━\n"
        f"💵 Tổng tiền: <b>{format_money(total_cost)}</b>\n"
        f"💰 Số dư sau mua: {format_money(balance - total_cost)}\n"
        f"━━━━━━━━━━━━━━━━━━\n\n"
        f"Bạn có chắc chắn muốn mua?",
        reply_markup=InlineKeyboardMarkup(keyboard),
        parse_mode='HTML'
    )
    return SELLER_CONFIRM_PURCHASE


async def seller_confirm_purchase_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle purchase confirmation"""
    query = update.callback_query
    await query.answer()
    
    if query.data == "seller_confirm_no":
        await query.edit_message_text("❌ Đã hủy đơn hàng.")
        return ConversationHandler.END
    
    # Get data from context
    api_key = context.user_data.get('seller_api_key')
    product = context.user_data.get('seller_selected_product')
    quantity = context.user_data.get('seller_quantity')
    reseller_id = context.user_data.get('seller_reseller_id')
    
    if not all([api_key, product, quantity]):
        await query.edit_message_text("❌ Lỗi dữ liệu! Vui lòng thử lại /mua_hang_seller")
        return ConversationHandler.END
    
    # Generate order ID: seller_{id_seller}_w{warranty}_{random}
    # VD: seller_shop123_w30_A1B2C3
    import random
    import string
    from datetime import datetime, timezone, timedelta
    warranty_days = product.get('warranty_days', 30)  # Mặc định 30 ngày
    random_suffix = ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
    seller_id_clean = (reseller_id or 'unknown').replace(' ', '_')
    order_id = f"seller_{seller_id_clean}_w{warranty_days}_{random_suffix}"
    
    await query.edit_message_text("⏳ Đang xử lý đơn hàng...")
    
    # Call purchase API
    status_code, result = purchase_product(api_key, product['id'], quantity, order_id)
    
    if status_code == 200 and result.get('success'):
        items = result.get('items', [])
        new_balance = result.get('new_balance', 0)
        total_amount = result.get('total_amount', 0)
        
        # === LƯU VÀO ORDER HISTORY ĐỂ SELLER DÙNG /BAOHANH ===
        try:
            from main import save_order_to_history
            
            # Lấy warranty_days từ sản phẩm (nếu có)
            warranty_days = product.get('warranty_days', 30)  # Mặc định 30 ngày
            
            # Tạo order_data giống như đơn khách thường
            order_data = {
                'user_id': query.from_user.id,
                'username': query.from_user.username or '',
                'user_fullname': query.from_user.full_name or '',
                'product_name': product['name'],
                'product_id': product['id'],
                'sheet_tab_name': product.get('sheet_tab', product['id']),
                'quantity': quantity,
                'total_int': total_amount,
                'unit_price': product['price'],
                'warranty_days': warranty_days,
                'warranty_text': f"BH {warranty_days} ngày",
                'is_seller_order': True,
                'reseller_id': reseller_id
            }
            
            # Lưu vào order history
            save_order_to_history(order_id, order_data, items)
            logger.info(f"📝 Đã lưu đơn seller {order_id} vào order history (BH {warranty_days} ngày)")
        except Exception as e:
            logger.error(f"❌ Lỗi lưu order history cho seller: {e}")
        
        # Format items for display - ESCAPE HTML để tránh lỗi parse khi item chứa < >
        items_text = "\n".join([f"<code>{html_lib.escape(str(item))}</code>" for item in items])
        
        await query.edit_message_text(
            f"✅ <b>MUA HÀNG THÀNH CÔNG!</b>\n\n"
            f"📦 Sản phẩm: <b>{product['name']}</b>\n"
            f"🔢 Số lượng: <b>{quantity}</b>\n"
            f"💵 Tổng tiền: {format_money(total_amount)}\n"
            f"💰 Số dư còn lại: <b>{format_money(new_balance)}</b>\n\n"
            f"━━━━━━━━━━━━━━━━━━\n"
            f"📋 <b>SẢN PHẨM CỦA BẠN:</b>\n\n"
            f"{items_text}\n"
            f"━━━━━━━━━━━━━━━━━━\n\n"
            f"🆔 Order ID: <code>{order_id}</code>\n\n"
            f"🛡️ Dùng /baohanh để yêu cầu bảo hành nếu cần.",
            parse_mode='HTML'
        )
    else:
        error_msg = result.get('error', 'Unknown error')
        if 'INSUFFICIENT_BALANCE' in str(error_msg):
            error_msg = "Không đủ số dư! Vui lòng nạp thêm tiền."
        elif 'OUT_OF_STOCK' in str(error_msg):
            error_msg = "Hết hàng! Vui lòng chọn sản phẩm khác."
        
        await query.edit_message_text(
            f"❌ <b>MUA HÀNG THẤT BẠI!</b>\n\n"
            f"Lỗi: {html_lib.escape(str(error_msg))}\n\n"
            f"Vui lòng thử lại /mua_hang_seller",
            parse_mode='HTML'
        )
    
    return ConversationHandler.END


# ==============================================================================
# Pending Seller Deposits Management
# ==============================================================================

PENDING_SELLER_DEPOSITS_FILE = "pending_orders/seller_deposits.json"


def load_pending_seller_deposits():
    """Load pending seller deposits"""
    if os.path.exists(PENDING_SELLER_DEPOSITS_FILE):
        try:
            with open(PENDING_SELLER_DEPOSITS_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except:
            pass
    return {}


def save_pending_seller_deposits(data):
    """Save pending seller deposits"""
    os.makedirs(os.path.dirname(PENDING_SELLER_DEPOSITS_FILE), exist_ok=True)
    with open(PENDING_SELLER_DEPOSITS_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


async def process_seller_deposit(reseller_id: str, amount: int, bank_txn_id: str, bot):
    """Process seller deposit - called when payment is detected"""
    try:
        # Call admin topup API
        response = requests.post(
            f"{INVENTORY_API_URL}/v1/admin/wallet/topup",
            headers={"X-ADMIN-TOKEN": ADMIN_TOKEN},
            json={
                "reseller_id": reseller_id,
                "amount": amount,
                "bank_txn_id": bank_txn_id,
                "bank_content": f"Seller deposit via Telegram"
            },
            timeout=10
        )
        
        if response.status_code == 200:
            result = response.json()
            logger.info(f"✅ Seller deposit success: {reseller_id} +{amount}")
            return True, result.get("new_balance", 0)
        else:
            logger.error(f"❌ Seller deposit failed: {response.text}")
            return False, 0
    except Exception as e:
        logger.error(f"❌ Error processing seller deposit: {e}")
        return False, 0


async def check_seller_payment(bank_content: str, amount: int, bank_txn_id: str, bot):
    """Check if bank payment matches a seller deposit
    
    Returns: (matched, reseller_id, user_id) or (False, None, None)
    """
    # Normalize function - remove spaces and underscores for bank compatibility
    def normalize(s: str) -> str:
        return s.upper().replace(" ", "").replace("_", "")
    
    # Look for NAPSELLER pattern
    bank_normalized = normalize(bank_content)
    if "NAPSELLER" not in bank_normalized:
        return False, None, None
    
    pending = load_pending_seller_deposits()
    
    for token, data in pending.items():
        if data.get("status") != "pending":
            continue
        
        expected_content = data.get("content", "")
        expected_amount = data.get("amount", 0)
        
        # Check if content matches (normalized - handles bank variations)
        expected_normalized = normalize(expected_content)
        if token in bank_normalized or expected_normalized in bank_normalized:
            # Check amount (allow 1000 VND tolerance)
            if abs(amount - expected_amount) <= 1000:
                reseller_id = data.get("reseller_id")
                user_id = data.get("user_id")
                
                # Generate fallback txn_id if empty
                if not bank_txn_id:
                    import time
                    bank_txn_id = f"SELLER_{reseller_id}_{int(time.time())}"
                
                # Process deposit
                success, new_balance = await process_seller_deposit(
                    reseller_id, amount, bank_txn_id, bot
                )
                
                if success:
                    # Mark as processed
                    data["status"] = "completed"
                    data["completed_at"] = datetime.now(VIETNAM_TZ).isoformat()
                    data["bank_txn_id"] = bank_txn_id
                    save_pending_seller_deposits(pending)
                    
                    # Notify seller
                    try:
                        await bot.send_message(
                            chat_id=user_id,
                            text=(
                                f"✅ <b>Nạp tiền thành công!</b>\n\n"
                                f"📋 Reseller ID: <code>{reseller_id}</code>\n"
                                f"💵 Số tiền: <b>{format_money(amount)}</b>\n"
                                f"💰 Số dư mới: <b>{format_money(new_balance)}</b>\n\n"
                                f"📌 Cảm ơn bạn đã sử dụng dịch vụ!"
                            ),
                            parse_mode='HTML'
                        )
                    except Exception as e:
                        logger.error(f"Error notifying seller: {e}")
                    
                    return True, reseller_id, user_id
    
    return False, None, None


async def check_api_deposit_payment(bank_content: str, amount: int, bank_txn_id: str, bot):
    """Check if bank payment matches an API-initiated deposit request
    
    Matches pattern: NAPAPI {reseller_id} {token}
    
    Returns: (matched, reseller_id, token) or (False, None, None)
    """
    # Look for NAPAPI pattern
    if "NAPAPI" not in bank_content.upper():
        return False, None, None
    
    try:
        # Get pending API deposits from the inventory API
        response = requests.get(
            f"{INVENTORY_API_URL}/v1/admin/pending-deposits",
            headers={"X-ADMIN-TOKEN": ADMIN_TOKEN},
            timeout=10
        )
        
        if response.status_code != 200:
            logger.error(f"Failed to get pending API deposits: {response.status_code}")
            return False, None, None
        
        pending_deposits = response.json()
        
        for deposit in pending_deposits:
            if deposit.get("status") != "pending":
                continue
            
            token = deposit.get("token", "")
            expected_content = deposit.get("content", "")
            expected_amount = deposit.get("amount", 0)
            reseller_id = deposit.get("reseller_id", "")
            
            # Check if content matches
            if token in bank_content.upper() or expected_content.upper() in bank_content.upper():
                # Check amount (allow 1000 VND tolerance)
                if abs(amount - expected_amount) <= 1000:
                    # Process via admin API
                    success, new_balance = await process_seller_deposit(
                        reseller_id, amount, bank_txn_id, bot
                    )
                    
                    if success:
                        # Mark deposit as completed via API
                        try:
                            complete_response = requests.post(
                                f"{INVENTORY_API_URL}/v1/admin/pending-deposits/{token}/complete",
                                headers={"X-ADMIN-TOKEN": ADMIN_TOKEN},
                                json={"bank_txn_id": bank_txn_id},
                                timeout=10
                            )
                            if complete_response.status_code == 200:
                                logger.info(f"✅ API deposit completed: {token} - {reseller_id} +{amount}")
                            else:
                                logger.warning(f"Failed to mark deposit complete: {complete_response.text}")
                        except Exception as e:
                            logger.error(f"Error marking deposit complete: {e}")
                        
                        return True, reseller_id, token
        
    except Exception as e:
        logger.error(f"Error checking API deposits: {e}")
    
    return False, None, None


# ==============================================================================
# Cancel Handler
# ==============================================================================

async def cancel_seller(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Cancel conversation"""
    await update.message.reply_text(
        "❌ Đã hủy thao tác.",
        parse_mode='HTML'
    )
    return ConversationHandler.END


# ==============================================================================
# Get Handlers
# ==============================================================================

def get_seller_handlers():
    """Get all seller command handlers"""
    
    # Registration conversation
    dangky_handler = ConversationHandler(
        entry_points=[CommandHandler("dangky_seller", cmd_dangky_seller)],
        states={
            SELLER_REGISTER_NAME: [
                MessageHandler(filters.TEXT & ~filters.COMMAND, seller_register_receive_name)
            ],
        },
        fallbacks=[CommandHandler("cancel", cancel_seller)],
        name="seller_dangky",
        persistent=False,
    )
    
    # Check balance conversation
    check_balance_handler = ConversationHandler(
        entry_points=[CommandHandler("check_balance_seller", cmd_check_balance_seller)],
        states={
            SELLER_WAITING_API_KEY: [
                MessageHandler(filters.TEXT & ~filters.COMMAND, seller_receive_api_key)
            ],
        },
        fallbacks=[CommandHandler("cancel", cancel_seller)],
        name="seller_check_balance",
        persistent=False,
    )
    
    # Nap tien conversation
    nap_tien_handler = ConversationHandler(
        entry_points=[CommandHandler("nap_api_seller", cmd_nap_api_seller)],
        states={
            SELLER_WAITING_API_KEY: [
                MessageHandler(filters.TEXT & ~filters.COMMAND, seller_receive_api_key)
            ],
            SELLER_WAITING_AMOUNT: [
                MessageHandler(filters.TEXT & ~filters.COMMAND, seller_receive_amount)
            ],
        },
        fallbacks=[CommandHandler("cancel", cancel_seller)],
        name="seller_nap_tien",
        persistent=False,
    )
    
    # Purchase conversation
    mua_hang_handler = ConversationHandler(
        entry_points=[CommandHandler("mua_hang_seller", cmd_mua_hang_seller)],
        states={
            SELLER_SELECT_PRODUCT: [
                CallbackQueryHandler(seller_select_product_callback, pattern=r"^seller_buy_")
            ],
            SELLER_SELECT_QUANTITY: [
                MessageHandler(filters.TEXT & ~filters.COMMAND, seller_receive_quantity)
            ],
            SELLER_CONFIRM_PURCHASE: [
                CallbackQueryHandler(seller_confirm_purchase_callback, pattern=r"^seller_confirm_")
            ],
        },
        fallbacks=[CommandHandler("cancel", cancel_seller)],
        name="seller_mua_hang",
        persistent=False,
    )
    
    return [dangky_handler, check_balance_handler, nap_tien_handler, mua_hang_handler]
