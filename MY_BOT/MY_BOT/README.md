# Discord Customer Management Bot

This Discord bot helps manage customer subscriptions, track expiration dates, and send notifications and gifts to customers.

## Features

1. **Customer Management**: Add customers with their products and purchase dates
2. **Expiration Tracking**: Set and track product expiration dates
3. **Automated Notifications**: Get notified when a customer's subscription expires
4. **Gift Distribution**: Send gifts to all customers
5. **Broadcast Messages**: Send announcements to all customers

## Setup Instructions

1. Install the required dependencies:
   ```
   pip install -r requirements.txt
   ```

2. Create a Discord application and bot:
   - Go to the [Discord Developer Portal](https://discord.com/developers/applications)
   - Create a new application
   - Create a bot for the application
   - Copy the bot token

3. Configure the bot:
   - Edit `config.json` and replace `YOUR_BOT_TOKEN` with your actual bot token
   - Add your Discord user ID to the `admin_ids` array

4. Run the bot:
   ```
   python customer_bot.py
   ```

## Commands

### Admin Commands

- `!add_customer @username+product+dd/mm/yyyy`: Add a new customer
  - Example: `!add_customer @ntaidat-tele+5acc veo3 ultra+25/11/2025`

- `!set_expiry @username dd/mm/yyyy`: Set the expiration date for a customer
  - Example: `!set_expiry @ntaidat-tele 25/11/2025`

- `!check_customer @username`: Check customer information
  - Example: `!check_customer @ntaidat-tele`

- `!gift message`: Send a gift to all customers
  - Example: `!gift Tặng quà đặc biệt!`

- `!broadcast message`: Send a broadcast message to all customers
  - Example: `!broadcast Thông báo quan trọng!`

## Notification Format

The gift message will be automatically formatted in a box when it contains the following text:
```
Tặng
Email:
Password ChatGPT:
Password Email:
```

## How It Works

1. When you add a customer, the bot stores their information in a JSON file.
2. After adding a customer, you need to set their expiration date using the `!set_expiry` command.
3. The bot checks for expired subscriptions daily and sends a notification to the admin at 11:00 AM on the day of expiration.
4. The `!gift` and `!broadcast` commands allow you to send messages to all customers.

## Notes

- The current implementation stores customer data in a JSON file. For production use, you should consider using a database.
- The `!gift` and `!broadcast` commands require confirmation before sending messages.
- The bot needs to be running for the expiration check to work.
